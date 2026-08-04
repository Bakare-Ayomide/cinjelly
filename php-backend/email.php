<?php
/**
 * Email Helper for PHP Backend
 * Supports template variable replacement and SMTP email sending via sockets (SSL/TLS/STARTTLS).
 */

function replace_template_vars($template, $user = null, $config = null, $customVars = []) {
    if (empty($template)) return '';

    $publicAppUrl = isset($_SERVER['HTTP_HOST']) ? (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] : 'https://zerolord.com';

    $vars = array_merge([
        'username' => $user['username'] ?? $user['fullName'] ?? 'User',
        'fullName' => $user['fullName'] ?? $user['username'] ?? 'Valued Subscriber',
        'email' => $user['email'] ?? '',
        'app_name' => 'CINJELLY Stream',
        'login_url' => $publicAppUrl,
        'support_email' => !empty($config['contactEmail']) ? $config['contactEmail'] : (!empty($config['smtpFromEmail']) ? $config['smtpFromEmail'] : 'support@zerolord.com'),
        'website_url' => !empty($config['serverUrl']) ? $config['serverUrl'] : $publicAppUrl,
        'current_year' => date('Y'),
        'ios_app_link' => $config['iosDownloadUrl'] ?? 'https://apps.apple.com/app/jellyfin/id1601583420',
        'android_app_link' => $config['androidDownloadUrl'] ?? 'https://play.google.com/store/apps/details?id=org.jellyfin.mobile',
    ], $customVars);

    foreach ($vars as $key => $val) {
        $search = [
            '{{' . $key . '}}',
            '{{ ' . $key . ' }}',
            '{' . $key . '}',
        ];
        $template = str_replace($search, (string)$val, $template);
    }

    return $template;
}

function send_smtp_email($to, $subject, $htmlContent, $customConfig = null) {
    try {
        $config = $customConfig ?? DB::getConfig();
        if (!$config) {
            return ['success' => false, 'error' => 'System configuration not found.'];
        }

        $smtpEnabled = isset($config['smtpEnabled']) ? (int)$config['smtpEnabled'] : 0;
        if ($smtpEnabled !== 1 && $customConfig === null) {
            return ['success' => false, 'error' => 'SMTP email sending is currently turned off in admin settings.'];
        }

        $rawHost = $config['smtpHost'] ?? '';
        $host = preg_replace('/^(ssl|tls|tcp|http|https):\/\//i', '', trim($rawHost));
        $host = preg_replace('/:.*$/', '', $host);
        
        $port = !empty($config['smtpPort']) ? (int)$config['smtpPort'] : 587;
        $user = trim($config['smtpUser'] ?? '');
        $pass = $config['smtpPass'] ?? '';
        $fromEmail = !empty($config['smtpFromEmail']) ? trim($config['smtpFromEmail']) : $user;
        $fromName = !empty($config['smtpFromName']) ? trim($config['smtpFromName']) : 'CINJELLY Stream';
        $secure = !empty($config['smtpSecure']) && ($config['smtpSecure'] == 1 || $config['smtpSecure'] === '1' || $config['smtpSecure'] === true);

        if (empty($host) || empty($user) || empty($pass)) {
            return ['success' => false, 'error' => 'SMTP credentials missing. Please enter SMTP Host, Username, and Password in settings.'];
        }

        // Connect using socket
        $protocol = ($secure || $port == 465) ? 'ssl' : 'tcp';
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $socket = @stream_socket_client("$protocol://$host:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) {
            return ['success' => false, 'error' => "SMTP connection failed to $host:$port : $errstr ($errno)"];
        }

        $getLine = function() use ($socket) {
            $response = '';
            while (!feof($socket)) {
                $line = fgets($socket, 515);
                if ($line === false) break;
                $response .= $line;
                if (strlen($line) >= 4 && substr($line, 3, 1) === ' ') break;
            }
            return $response;
        };

        $putLine = function($cmd) use ($socket) {
            fputs($socket, $cmd . "\r\n");
        };

        $banner = $getLine();
        if (substr($banner, 0, 3) !== '220') {
            fclose($socket);
            return ['success' => false, 'error' => "SMTP server greeting error ($host:$port): " . trim($banner)];
        }

        $hostname = !empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : gethostname();
        if (empty($hostname)) $hostname = 'localhost';

        $putLine("EHLO " . $hostname);
        $ehloResp = $getLine();
        if (substr($ehloResp, 0, 3) !== '250') {
            $putLine("HELO " . $hostname);
            $ehloResp = $getLine();
        }

        if (!$secure && $port != 465 && (strpos($ehloResp, 'STARTTLS') !== false || $port == 587)) {
            $putLine("STARTTLS");
            $starttlsResp = $getLine();
            if (substr($starttlsResp, 0, 3) === '220') {
                $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                    $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                }
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                    $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                }
                $cryptoOk = @stream_socket_enable_crypto($socket, true, $cryptoMethod);
                if ($cryptoOk) {
                    $putLine("EHLO " . $hostname);
                    $ehloResp = $getLine();
                }
            }
        }

        // Authenticate using AUTH LOGIN or AUTH PLAIN
        $authenticated = false;
        $authErrorDetail = '';

        // Strategy 1: AUTH LOGIN
        $putLine("AUTH LOGIN");
        $authReq = $getLine();
        if (substr($authReq, 0, 3) === '334') {
            $putLine(base64_encode($user));
            $userResp = $getLine();
            if (substr($userResp, 0, 3) === '334') {
                $putLine(base64_encode($pass));
                $authResp = $getLine();
                if (substr($authResp, 0, 3) === '235') {
                    $authenticated = true;
                } else {
                    $authErrorDetail = trim($authResp);
                }
            } else {
                $authErrorDetail = trim($userResp);
            }
        } else {
            $authErrorDetail = trim($authReq);
        }

        // Strategy 2: AUTH PLAIN fallback
        if (!$authenticated) {
            $plainAuth = base64_encode("\0" . $user . "\0" . $pass);
            $putLine("AUTH PLAIN " . $plainAuth);
            $plainResp = $getLine();
            if (substr($plainResp, 0, 3) === '235') {
                $authenticated = true;
            } else if (substr($plainResp, 0, 3) === '334') {
                $putLine($plainAuth);
                $plainResp2 = $getLine();
                if (substr($plainResp2, 0, 3) === '235') {
                    $authenticated = true;
                } else {
                    if (empty($authErrorDetail)) $authErrorDetail = trim($plainResp2);
                }
            } else {
                if (empty($authErrorDetail)) $authErrorDetail = trim($plainResp);
            }
        }

        if (!$authenticated) {
            fclose($socket);
            return ['success' => false, 'error' => 'SMTP Authentication failed for user (' . $user . '). Server response: ' . $authErrorDetail . '. Ensure your full email address and exact email account password are configured.'];
        }

        $senderAddress = !empty($fromEmail) ? $fromEmail : $user;
        $putLine("MAIL FROM: <$senderAddress>");
        $mailResp = $getLine();
        if (substr($mailResp, 0, 3) !== '250' && substr($mailResp, 0, 3) !== '251') {
            // Retry with authenticated user email if custom fromEmail was rejected
            if ($senderAddress !== $user) {
                $senderAddress = $user;
                $putLine("MAIL FROM: <$senderAddress>");
                $mailResp = $getLine();
            }
            if (substr($mailResp, 0, 3) !== '250' && substr($mailResp, 0, 3) !== '251') {
                fclose($socket);
                return ['success' => false, 'error' => 'Sender address rejected (<' . $senderAddress . '>): ' . trim($mailResp)];
            }
        }

        $putLine("RCPT TO: <$to>");
        $rcptResp = $getLine();
        if (substr($rcptResp, 0, 3) !== '250' && substr($rcptResp, 0, 3) !== '251') {
            fclose($socket);
            return ['success' => false, 'error' => 'Recipient address rejected (<' . $to . '>): ' . trim($rcptResp)];
        }

        $putLine("DATA");
        $dataReq = $getLine();
        if (substr($dataReq, 0, 3) !== '354') {
            fclose($socket);
            return ['success' => false, 'error' => 'SMTP DATA command rejected: ' . trim($dataReq)];
        }

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>\r\n";
        $headers .= "To: <$to>\r\n";
        $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
        $headers .= "Date: " . date('r') . "\r\n";

        // Dot stuffing
        $cleanBody = str_replace("\r\n.", "\r\n..", $htmlContent);
        $message = $headers . "\r\n" . $cleanBody . "\r\n.";

        $putLine($message);
        $dataResp = $getLine();

        $putLine("QUIT");
        fclose($socket);

        if (substr($dataResp, 0, 3) !== '250') {
            return ['success' => false, 'error' => 'Email delivery failed: ' . trim($dataResp)];
        }

        return ['success' => true];
    } catch (Exception $e) {
        return ['success' => false, 'error' => 'SMTP exception: ' . $e->getMessage()];
    }
}
