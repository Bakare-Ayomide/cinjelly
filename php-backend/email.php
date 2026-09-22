<?php
/**
 * Email Helper for PHP Backend
 * Supports template variable replacement, multi-port SMTP socket client (SSL/TLS/STARTTLS),
 * and automatic fallback strategies for 100% reliable email delivery.
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

/**
 * Execute low-level SMTP socket delivery to a specific host, port, protocol
 */
function execute_smtp_socket_session($host, $port, $protocol, $user, $pass, $fromEmail, $fromName, $to, $subject, $htmlContent, &$debugLog = []) {
    $debugLog[] = "Attempting SMTP socket connection to $protocol://$host:$port";

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
            'SNI_enabled' => true,
            'peer_name' => $host
        ]
    ]);

    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client("$protocol://$host:$port", $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        $debugLog[] = "Connection failed: $errstr ($errno)";
        return ['success' => false, 'error' => "Connection failed to $host:$port ($errstr)"];
    }

    stream_set_timeout($socket, 15);

    $getLine = function() use ($socket, &$debugLog) {
        $response = '';
        while (!feof($socket)) {
            $line = fgets($socket, 1024);
            if ($line === false) break;
            $response .= $line;
            $t = rtrim($line, "\r\n");
            // Terminating line of SMTP response: 3 digits followed by space or end of string
            if (preg_match('/^\d{3}(?:[ ].*)?$/', $t)) {
                break;
            }
        }
        $debugLog[] = "< " . trim($response);
        return $response;
    };

    $putLine = function($cmd, $mask = false) use ($socket, &$debugLog) {
        $debugLog[] = "> " . ($mask ? '********' : $cmd);
        fputs($socket, $cmd . "\r\n");
    };

    $banner = $getLine();
    if (substr(trim($banner), 0, 3) !== '220') {
        fclose($socket);
        return ['success' => false, 'error' => "Invalid greeting: " . trim($banner)];
    }

    // Generate valid FQDN or IP for EHLO
    $hostname = !empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : gethostname();
    $hostname = preg_replace('/[^a-zA-Z0-9\.\-]/', '', $hostname);
    if (empty($hostname) || !strpos($hostname, '.')) {
        $hostname = 'zerolord.com';
    }

    $putLine("EHLO " . $hostname);
    $ehloResp = $getLine();
    if (substr(trim($ehloResp), 0, 3) !== '250') {
        $putLine("HELO " . $hostname);
        $ehloResp = $getLine();
    }

    // Handle STARTTLS on non-SSL port if supported or on port 587
    if ($protocol !== 'ssl' && $port != 465 && (stripos($ehloResp, 'STARTTLS') !== false || $port == 587)) {
        $putLine("STARTTLS");
        $starttlsResp = $getLine();
        if (substr(trim($starttlsResp), 0, 3) === '220') {
            stream_set_blocking($socket, true);
            $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            }
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            }
            $cryptoOk = @stream_socket_enable_crypto($socket, true, $cryptoMethod);
            if (!$cryptoOk) {
                // Fallback crypto attempt
                $cryptoOk = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            }

            if ($cryptoOk) {
                $debugLog[] = "TLS crypto enabled successfully.";
                $putLine("EHLO " . $hostname);
                $ehloResp = $getLine();
            } else {
                $debugLog[] = "TLS crypto negotiation failed.";
            }
        }
    }

    // Authenticate (if user & pass provided)
    if (!empty($user) && !empty($pass)) {
        $authenticated = false;
        $authErrorDetail = '';

        // Strategy 1: AUTH LOGIN
        $putLine("AUTH LOGIN");
        $authReq = $getLine();
        if (substr(trim($authReq), 0, 3) === '334') {
            $putLine(base64_encode($user));
            $userResp = $getLine();
            if (substr(trim($userResp), 0, 3) === '334') {
                $putLine(base64_encode($pass), true);
                $authResp = $getLine();
                if (substr(trim($authResp), 0, 3) === '235') {
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
            $putLine("AUTH PLAIN " . $plainAuth, true);
            $plainResp = $getLine();
            if (substr(trim($plainResp), 0, 3) === '235') {
                $authenticated = true;
            } else if (substr(trim($plainResp), 0, 3) === '334') {
                $putLine($plainAuth, true);
                $plainResp2 = $getLine();
                if (substr(trim($plainResp2), 0, 3) === '235') {
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
            return ['success' => false, 'error' => "SMTP Authentication failed for ($user): " . $authErrorDetail];
        }
    }

    $senderAddress = !empty($fromEmail) ? $fromEmail : $user;
    $putLine("MAIL FROM: <$senderAddress>");
    $mailResp = $getLine();
    if (substr(trim($mailResp), 0, 3) !== '250' && substr(trim($mailResp), 0, 3) !== '251') {
        if ($senderAddress !== $user && !empty($user)) {
            $senderAddress = $user;
            $putLine("MAIL FROM: <$senderAddress>");
            $mailResp = $getLine();
        }
        if (substr(trim($mailResp), 0, 3) !== '250' && substr(trim($mailResp), 0, 3) !== '251') {
            fclose($socket);
            return ['success' => false, 'error' => "Sender address rejected (<$senderAddress>): " . trim($mailResp)];
        }
    }

    $putLine("RCPT TO: <$to>");
    $rcptResp = $getLine();
    if (substr(trim($rcptResp), 0, 3) !== '250' && substr(trim($rcptResp), 0, 3) !== '251') {
        fclose($socket);
        return ['success' => false, 'error' => "Recipient address rejected (<$to>): " . trim($rcptResp)];
    }

    $putLine("DATA");
    $dataReq = $getLine();
    if (substr(trim($dataReq), 0, 3) !== '354') {
        fclose($socket);
        return ['success' => false, 'error' => "SMTP DATA command rejected: " . trim($dataReq)];
    }

    // Build RFC-compliant headers
    $msgId = time() . '.' . bin2hex(random_bytes(8)) . '@' . $hostname;
    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
    $encodedFromName = "=?UTF-8?B?" . base64_encode($fromName) . "?=";

    // Use base64 content transfer encoding for message body to strictly guarantee 
    // all lines are chunked at 76 characters, avoiding transport line limit violations (RFC 2822 / 5322 limit 998 / MTA limit 2048)
    $encodedBody = chunk_split(base64_encode($htmlContent), 76, "\r\n");

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: base64\r\n";
    $headers .= "From: $encodedFromName <$senderAddress>\r\n";
    $headers .= "Reply-To: <$senderAddress>\r\n";
    $headers .= "To: <$to>\r\n";
    $headers .= "Subject: $encodedSubject\r\n";
    $headers .= "Date: " . date('r') . "\r\n";
    $headers .= "Message-ID: <$msgId>\r\n";
    $headers .= "X-Mailer: CINJELLY High-Speed Mailer\r\n";
    $headers .= "Auto-Submitted: auto-generated\r\n";

    $message = $headers . "\r\n" . $encodedBody . "\r\n.";

    $putLine($message);
    $dataResp = $getLine();

    $putLine("QUIT");
    fclose($socket);

    if (substr(trim($dataResp), 0, 3) !== '250') {
        return ['success' => false, 'error' => "Email delivery failed at DATA end: " . trim($dataResp)];
    }

    return ['success' => true];
}

/**
 * Main SMTP Dispatcher with multi-tier fallback
 */
function send_smtp_email($to, $subject, $htmlContent, $customConfig = null) {
    try {
        $config = $customConfig ?? DB::getConfig();
        if (!$config) {
            return ['success' => false, 'error' => 'System configuration not found in database.'];
        }

        $rawHost = $config['smtpHost'] ?? '';
        $host = preg_replace('/^(ssl|tls|tcp|http|https):\/\//i', '', trim($rawHost));
        $host = preg_replace('/:.*$/', '', $host);
        
        $port = !empty($config['smtpPort']) ? (int)$config['smtpPort'] : 587;
        $user = trim($config['smtpUser'] ?? '');
        $pass = trim($config['smtpPass'] ?? '');
        $fromEmail = !empty($config['smtpFromEmail']) ? trim($config['smtpFromEmail']) : $user;
        $fromName = !empty($config['smtpFromName']) ? trim($config['smtpFromName']) : 'CINJELLY Stream';
        $secure = !empty($config['smtpSecure']) && ($config['smtpSecure'] == 1 || $config['smtpSecure'] === '1' || $config['smtpSecure'] === true);

        $debugLog = [];
        $lastError = '';

        // If credentials are present, attempt SMTP sockets
        if (!empty($host) && !empty($user)) {
            // Attempt 1: Configured port and security
            $protocol1 = ($secure || $port == 465) ? 'ssl' : 'tcp';
            $res1 = execute_smtp_socket_session($host, $port, $protocol1, $user, $pass, $fromEmail, $fromName, $to, $subject, $htmlContent, $debugLog);
            if ($res1['success']) {
                return ['success' => true];
            }
            $lastError = $res1['error'];

            // Attempt 2: Alternative port fallback (465 SSL <-> 587 STARTTLS)
            $altPort = ($port == 465 || $secure) ? 587 : 465;
            $altProtocol = ($altPort == 465) ? 'ssl' : 'tcp';
            $debugLog[] = "Attempt 1 failed. Trying alternative port $altPort ($altProtocol)...";

            $res2 = execute_smtp_socket_session($host, $altPort, $altProtocol, $user, $pass, $fromEmail, $fromName, $to, $subject, $htmlContent, $debugLog);
            if ($res2['success']) {
                return ['success' => true];
            }
            $lastError = $res2['error'];

            // Attempt 3: Port 25 fallback
            if ($port != 25 && $altPort != 25) {
                $debugLog[] = "Trying port 25 (tcp)...";
                $res3 = execute_smtp_socket_session($host, 25, 'tcp', $user, $pass, $fromEmail, $fromName, $to, $subject, $htmlContent, $debugLog);
                if ($res3['success']) {
                    return ['success' => true];
                }
            }
        }

        // Attempt 4: Fallback to PHP native mail() if socket SMTP could not deliver
        if (function_exists('mail')) {
            $debugLog[] = "Attempting native PHP mail() fallback...";
            $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
            $encodedFromName = "=?UTF-8?B?" . base64_encode($fromName) . "?=";
            $senderAddr = !empty($fromEmail) ? $fromEmail : 'cinjelly@zerolord.com';
            $encodedBody = chunk_split(base64_encode($htmlContent), 76, "\r\n");

            $headers = [
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
                "From: $encodedFromName <$senderAddr>",
                "Reply-To: <$senderAddr>",
                "X-Mailer: CINJELLY PHP Engine",
                "Auto-Submitted: auto-generated"
            ];
            $headerStr = implode("\r\n", $headers);

            $mailOk = @mail($to, $encodedSubject, $encodedBody, $headerStr, "-f $senderAddr");
            if (!$mailOk) {
                $mailOk = @mail($to, $encodedSubject, $encodedBody, $headerStr);
            }

            if ($mailOk) {
                $debugLog[] = "mail() succeeded.";
                return ['success' => true];
            } else {
                $debugLog[] = "mail() returned false.";
            }
        }

        // Log failure details for debugging
        $logEntry = date('[Y-m-d H:i:s] ') . "Email failure to ($to): " . $lastError . "\nDebug trace:\n" . implode("\n", $debugLog) . "\n\n";
        @file_put_contents(__DIR__ . '/email_error_log.txt', $logEntry, FILE_APPEND);

        return [
            'success' => false,
            'error' => !empty($lastError) ? $lastError : 'Email delivery failed. Please verify SMTP host, username, password and port in Admin Settings.'
        ];
    } catch (Exception $e) {
        $logEntry = date('[Y-m-d H:i:s] ') . "Exception sending email to ($to): " . $e->getMessage() . "\n";
        @file_put_contents(__DIR__ . '/email_error_log.txt', $logEntry, FILE_APPEND);
        return ['success' => false, 'error' => 'SMTP exception: ' . $e->getMessage()];
    }
}

/**
 * Mask account number helper: ******7890
 */
function mask_account_number($accNo) {
    $clean = trim((string)$accNo);
    $len = strlen($clean);
    if ($len <= 4) return $clean;
    return '******' . substr($clean, -4);
}

/**
 * Send email when affiliate withdrawal is marked as PAID
 */
function send_affiliate_withdrawal_paid_email($user, $withdrawal, $config = null) {
    if (!$user || empty($user['email'])) return ['success' => false, 'error' => 'No email provided'];
    
    $amountFormatted = '₦' . number_format((float)$withdrawal['amount'], 2);
    $maskedAccount = mask_account_number($withdrawal['account_number']);
    $bankName = htmlspecialchars($withdrawal['bank_name'] ?? 'Bank Transfer');
    $ref = !empty($withdrawal['payment_reference']) ? htmlspecialchars($withdrawal['payment_reference']) : 'Manual Bank Transfer';
    $name = htmlspecialchars($user['fullName'] ?? $user['username'] ?? 'Affiliate Partner');
    $date = !empty($withdrawal['processed_at']) ? date('d M Y, h:i A', strtotime($withdrawal['processed_at'])) : date('d M Y');

    $subject = 'Your CINJELLY Affiliate Withdrawal Has Been Paid';
    $htmlContent = '
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Affiliate Withdrawal Paid</title></head>
    <body style="margin:0;padding:0;background-color:#080203;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#e4e4e7;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080203;padding:40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="580" style="max-width:580px;background-color:#120507;border:1px solid #2e1015;border-radius:16px;overflow:hidden;padding:32px 28px;text-align:left;">
              <tr>
                <td style="border-bottom:1px solid #2e1015;padding-bottom:20px;">
                  <span style="display:inline-block;background-color:#d31d38;color:#ffffff;font-weight:900;font-size:14px;letter-spacing:1px;padding:6px 12px;border-radius:8px;">CINJELLY</span>
                  <span style="color:#34d399;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:10px;">• Payout Confirmed</span>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 0 20px 0;">
                  <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:800;">Withdrawal Successfully Paid!</h2>
                  <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6;">Hello <strong>' . $name . '</strong>,</p>
                  <p style="margin:8px 0 20px 0;color:#a1a1aa;font-size:14px;line-height:1.6;">Your affiliate withdrawal of <strong>' . $amountFormatted . '</strong> has been successfully reviewed and transferred to your bank account.</p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080203;border:1px solid #2e1015;border-radius:12px;padding:16px;margin-bottom:24px;">
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;">Payout Amount</td>
                      <td style="padding:8px 0;color:#34d399;font-size:18px;font-weight:900;text-align:right;">' . $amountFormatted . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Bank Destination</td>
                      <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #1a080b;">' . $bankName . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Account Number</td>
                      <td style="padding:8px 0;color:#ffffff;font-size:13px;font-family:monospace;font-weight:600;text-align:right;border-top:1px solid #1a080b;">' . $maskedAccount . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Payment Reference</td>
                      <td style="padding:8px 0;color:#cbd5e1;font-size:13px;font-family:monospace;font-weight:600;text-align:right;border-top:1px solid #1a080b;">' . $ref . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Status</td>
                      <td style="padding:8px 0;color:#34d399;font-size:13px;font-weight:800;text-align:right;border-top:1px solid #1a080b;">PAID</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Processed Date</td>
                      <td style="padding:8px 0;color:#a1a1aa;font-size:12px;text-align:right;border-top:1px solid #1a080b;">' . $date . '</td>
                    </tr>
                  </table>

                  <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">Thank you for being a valued CINJELLY referral partner. Keep sharing your code to earn more commissions!</p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #2e1015;padding-top:20px;text-align:center;">
                  <p style="margin:0;color:#52525b;font-size:11px;">CINJELLY Stream &copy; ' . date('Y') . '. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    ';

    try {
        return send_smtp_email($user['email'], $subject, $htmlContent, $config);
    } catch (Exception $e) {
        error_log("[AFFILIATE EMAIL ERROR] Failed to send paid email: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Send email when affiliate withdrawal is DECLINED
 */
function send_affiliate_withdrawal_declined_email($user, $withdrawal, $config = null) {
    if (!$user || empty($user['email'])) return ['success' => false, 'error' => 'No email provided'];

    $amountFormatted = '₦' . number_format((float)$withdrawal['amount'], 2);
    $maskedAccount = mask_account_number($withdrawal['account_number']);
    $bankName = htmlspecialchars($withdrawal['bank_name'] ?? 'Bank Transfer');
    $reason = htmlspecialchars($withdrawal['decline_reason'] ?? 'Incorrect bank details or administrative notice');
    $name = htmlspecialchars($user['fullName'] ?? $user['username'] ?? 'Affiliate Partner');
    $date = !empty($withdrawal['processed_at']) ? date('d M Y, h:i A', strtotime($withdrawal['processed_at'])) : date('d M Y');

    $subject = 'CINJELLY Affiliate Withdrawal Declined';
    $htmlContent = '
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Affiliate Withdrawal Declined</title></head>
    <body style="margin:0;padding:0;background-color:#080203;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#e4e4e7;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080203;padding:40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="580" style="max-width:580px;background-color:#120507;border:1px solid #2e1015;border-radius:16px;overflow:hidden;padding:32px 28px;text-align:left;">
              <tr>
                <td style="border-bottom:1px solid #2e1015;padding-bottom:20px;">
                  <span style="display:inline-block;background-color:#d31d38;color:#ffffff;font-weight:900;font-size:14px;letter-spacing:1px;padding:6px 12px;border-radius:8px;">CINJELLY</span>
                  <span style="color:#f87171;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:10px;">• Withdrawal Declined</span>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 0 20px 0;">
                  <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:800;">Withdrawal Request Update</h2>
                  <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6;">Hello <strong>' . $name . '</strong>,</p>
                  <p style="margin:8px 0 20px 0;color:#a1a1aa;font-size:14px;line-height:1.6;">Your affiliate withdrawal request for <strong>' . $amountFormatted . '</strong> was declined by an administrator.</p>
                  
                  <div style="background-color:#2a080c;border:1px solid #f87171;border-radius:12px;padding:16px;margin-bottom:20px;">
                    <div style="color:#fca5a5;font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:4px;">Decline Reason:</div>
                    <div style="color:#ffffff;font-size:14px;font-weight:600;line-height:1.5;">' . $reason . '</div>
                  </div>

                  <div style="background-color:#062314;border:1px solid #059669;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
                    <p style="margin:0;color:#34d399;font-size:13px;line-height:1.5;font-weight:600;">
                      ✓ Balance Restored: The withdrawal amount of <strong>' . $amountFormatted . '</strong> has been returned to your available affiliate earnings and is available immediately for your next request.
                    </p>
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080203;border:1px solid #2e1015;border-radius:12px;padding:16px;margin-bottom:24px;">
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;">Requested Amount</td>
                      <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:800;text-align:right;">' . $amountFormatted . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Bank</td>
                      <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #1a080b;">' . $bankName . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Account</td>
                      <td style="padding:8px 0;color:#ffffff;font-size:13px;font-family:monospace;text-align:right;border-top:1px solid #1a080b;">' . $maskedAccount . '</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Status</td>
                      <td style="padding:8px 0;color:#f87171;font-size:13px;font-weight:800;text-align:right;border-top:1px solid #1a080b;">DECLINED</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#71717a;font-size:12px;text-transform:uppercase;font-weight:700;border-top:1px solid #1a080b;">Date</td>
                      <td style="padding:8px 0;color:#a1a1aa;font-size:12px;text-align:right;border-top:1px solid #1a080b;">' . $date . '</td>
                    </tr>
                  </table>

                  <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">Please double-check your bank details and submit a new withdrawal request when ready.</p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #2e1015;padding-top:20px;text-align:center;">
                  <p style="margin:0;color:#52525b;font-size:11px;">CINJELLY Stream &copy; ' . date('Y') . '. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    ';

    try {
        return send_smtp_email($user['email'], $subject, $htmlContent, $config);
    } catch (Exception $e) {
        error_log("[AFFILIATE EMAIL ERROR] Failed to send decline email: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

