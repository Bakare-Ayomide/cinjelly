<?php
/**
 * Master Router for PHP cPanel Backend.
 * Handles CORS, Cookieless/Cookie sessions, integrated cURL proxy for /jellyfin,
 * and routing for all portal APIs.
 */

// Enable error logging but disable display errors to prevent corrupting JSON responses
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Re-route to standard output header
header('Content-Type: application/json');

// --- CORS HEADERS ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: " . $origin);
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Emby-Authorization, X-MediaBrowser-Token, X-Emby-Token");

// Pre-flight OPTIONS handling
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Include models and database
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jellyfin.php';
require_once __DIR__ . '/email.php';

try {
    DB::initDb();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}

// Extract clean request path
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Normalize path when hosted in cPanel subfolders (strip out prefix before '/api' or '/jellyfin')
$apiPos = strpos($path, '/api/');
$jfPos = strpos($path, '/jellyfin');

if ($apiPos !== false) {
    $path = substr($path, $apiPos); // e.g. "/api/status"
} elseif ($jfPos !== false) {
    $path = substr($path, $jfPos); // e.g. "/jellyfin/Users/..."
}

$path = rtrim($path, '/');
if (empty($path)) $path = '/';

$method = $_SERVER['REQUEST_METHOD'];

// --- 1. INTEGRATED JELLYFIN REVERSE PROXY ---
if (strpos($path, '/jellyfin') === 0) {
    $config = DB::getConfig();
    if (!$config || empty($config['serverUrl'])) {
        http_response_code(503);
        echo json_encode(['error' => 'Jellyfin server not configured yet.']);
        exit;
    }

    $targetUrl = rtrim($config['serverUrl'], '/');
    $subPath = substr($path, strlen('/jellyfin'));
    if (!empty($_SERVER['QUERY_STRING'])) {
        $subPath .= '?' . $_SERVER['QUERY_STRING'];
    }
    
    $fullTarget = $targetUrl . $subPath;

    $ch = curl_init($fullTarget);
    
    // Extract and forward incoming headers (filtering Host and Content-Length)
    $headers = [];
    foreach (getallheaders() as $key => $val) {
        $lowerKey = strtolower($key);
        if ($lowerKey !== 'host' && $lowerKey !== 'content-length' && $lowerKey !== 'accept-encoding') {
            $headers[] = "$key: $val";
        }
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true); // Retrieve target response headers
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    if ($method !== 'GET' && $method !== 'OPTIONS') {
        $body = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        http_response_code(502);
        header('Content-Type: text/plain');
        echo "Error connecting to media server: " . $err;
        exit;
    }

    $headerSize = $info['header_size'];
    $responseHeadersStr = substr($response, 0, $headerSize);
    $responseBody = substr($response, $headerSize);

    // Forward response headers back to the browser
    $responseHeadersLines = explode("\r\n", $responseHeadersStr);
    foreach ($responseHeadersLines as $line) {
        if (empty($line)) continue;
        if (strpos(strtolower($line), 'http/') === 0) {
            header($line);
        } else {
            $lowerLine = strtolower($line);
            // Avoid forwarding duplicate CORS/Compression or broken transfer-encoding headers
            if (strpos($lowerLine, 'transfer-encoding:') === false && 
                strpos($lowerLine, 'access-control-allow-') === false &&
                strpos($lowerLine, 'content-security-policy:') === false) {
                header($line);
            }
        }
    }

    // Output raw proxied response body (video stream, JSON metadata, images, etc.)
    echo $responseBody;
    exit;
}

// --- 2. AUTH SESSION MIDDLEWARE ---
$currentUser = null;
$sessionToken = $_COOKIE['session'] ?? null;
if ($sessionToken) {
    $session = DB::getSession($sessionToken);
    $nowMs = round(microtime(true) * 1000);
    if ($session && $session['expiresAt'] > $nowMs) {
        $currentUser = DB::getUserById($session['userId']);
    }
}

// Parse request input JSON payload
$input = json_decode(file_get_contents('php://input'), true) ?? [];

function setSessionCookie($token) {
    // Set 7 days session cookie (Using sameSite=None, Secure=True to support iframe embedding)
    setcookie('session', $token, [
        'expires' => time() + 7 * 24 * 60 * 60,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'None'
    ]);
}

// --- 3. API ROUTING DISPATCHER ---

// GET /api/status
if ($method === 'GET' && $path === '/api/status') {
    $config = DB::getConfig();
    $users = DB::getUsers();
    $hasAdmin = false;
    foreach ($users as $u) {
        if ($u['role'] === 'admin') {
            $hasAdmin = true;
            break;
        }
    }

    echo json_encode([
        'configured' => !empty($config),
        'hasAdmin' => $hasAdmin,
        'serverUrl' => $config ? $config['serverUrl'] : '',
        'adminUsername' => $config ? $config['adminUsername'] : '',
        'mysqlAvailable' => true,
        'mysqlError' => null,
        'iosDownloadUrl' => $config ? ($config['iosDownloadUrl'] ?? '') : '',
        'androidDownloadUrl' => $config ? ($config['androidDownloadUrl'] ?? '') : ''
    ]);
    exit;
}

// POST /api/setup
if ($method === 'POST' && $path === '/api/setup') {
    $fullName = $input['fullName'] ?? '';
    $username = $input['username'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    if (empty($fullName) || empty($username) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required to run setup']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Media Server is not configured. Please set the database configurations or environmental variables first.'
        ]);
        exit;
    }

    $jellyfin = new JellyfinService($config);
    if (!$jellyfin->verifyConnection()) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Could not connect to Media Server using the backend credentials. Please check your system variables.'
        ]);
        exit;
    }

    try {
        $adminUser = DB::createUser([
            'fullName' => $fullName,
            'username' => trim($username),
            'email' => strtolower(trim($email)),
            'passwordHash' => DB::hashPassword($password),
            'subscriptionStatus' => 'Active',
            'paymentStatus' => 'Paid',
            'accountStatus' => 'Active',
            'role' => 'admin'
        ]);

        try {
            $jUserId = $jellyfin->getUserIdByName(trim($username));
            if (!$jUserId) {
                $jUserId = $jellyfin->createUser(trim($username), $password);
            }
            DB::updateUser($adminUser['id'], ['jellyfinUserId' => $jUserId]);
        } catch (Exception $e) {
            error_log("Could not auto-create admin user in Jellyfin: " . $e->getMessage());
        }

        $sessionToken = DB::generateUUID();
        $expiresAt = (round(microtime(true) * 1000) + 7 * 24 * 60 * 60 * 1000);
        DB::createSession($sessionToken, $adminUser['id'], $expiresAt);
        setSessionCookie($sessionToken);

        echo json_encode(['success' => true, 'message' => 'Portal initialized successfully!']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Support GET and POST to /api/admin/config for administrators and bootstrapping
if ($path === '/api/admin/config') {
    if ($method === 'GET') {
        if (!$currentUser || $currentUser['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized. Admin session required.']);
            exit;
        }
        $config = DB::getConfig() ?: [
            'serverUrl' => '',
            'adminUsername' => '',
            'adminPasswordFull' => '',
            'apiKey' => '',
            'defaultCommission' => 100.00
        ];
        echo json_encode($config);
        exit;
    }
    
    if ($method === 'POST') {
        $existingConfig = DB::getConfig();
        $users = DB::getUsers();
        $hasAdmin = false;
        foreach ($users as $u) {
            if ($u['role'] === 'admin') {
                $hasAdmin = true;
                break;
            }
        }
        $isAllowed = ($currentUser && $currentUser['role'] === 'admin') || !$existingConfig || !$hasAdmin;
        
        if (!$isAllowed) {
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized.']);
            exit;
        }
        
        $serverUrl = $input['serverUrl'] ?? ($existingConfig['serverUrl'] ?? '');
        $adminUsername = $input['adminUsername'] ?? ($existingConfig['adminUsername'] ?? '');
        $adminPasswordFull = $input['adminPasswordFull'] ?? ($existingConfig['adminPasswordFull'] ?? '');
        $apiKey = $input['apiKey'] ?? ($existingConfig['apiKey'] ?? '');
        $defaultCommission = isset($input['defaultCommission']) ? (float)$input['defaultCommission'] : ($existingConfig['defaultCommission'] ?? 100.00);
        $bankAccountNo = $input['bankAccountNo'] ?? ($existingConfig['bankAccountNo'] ?? '');
        $bankName = $input['bankName'] ?? ($existingConfig['bankName'] ?? '');
        $bankBeneficiary = $input['bankBeneficiary'] ?? ($existingConfig['bankBeneficiary'] ?? '');
        $bankInstructions = $input['bankInstructions'] ?? ($existingConfig['bankInstructions'] ?? '');
        $chatbotInfo = $input['chatbotInfo'] ?? ($existingConfig['chatbotInfo'] ?? '');
        $chatbotInstructions = $input['chatbotInstructions'] ?? ($existingConfig['chatbotInstructions'] ?? '');
        $contactEmail = $input['contactEmail'] ?? ($existingConfig['contactEmail'] ?? '');
        $contactPhone = $input['contactPhone'] ?? ($existingConfig['contactPhone'] ?? '');
        $contactWhatsApp = $input['contactWhatsApp'] ?? ($existingConfig['contactWhatsApp'] ?? '');
        $contactOther = $input['contactOther'] ?? ($existingConfig['contactOther'] ?? '');
        $iosDownloadUrl = $input['iosDownloadUrl'] ?? ($existingConfig['iosDownloadUrl'] ?? '');
        $androidDownloadUrl = $input['androidDownloadUrl'] ?? ($existingConfig['androidDownloadUrl'] ?? '');
        $monnifyEnabled = isset($input['monnifyEnabled']) ? ((bool)$input['monnifyEnabled'] ? 1 : 0) : ($existingConfig['monnifyEnabled'] ?? 0);
        $monnifyApiKey = $input['monnifyApiKey'] ?? ($existingConfig['monnifyApiKey'] ?? '');
        $monnifyContractCode = $input['monnifyContractCode'] ?? ($existingConfig['monnifyContractCode'] ?? '');
        $monnifySecretKey = $input['monnifySecretKey'] ?? ($existingConfig['monnifySecretKey'] ?? '');
        $monnifyMode = $input['monnifyMode'] ?? ($existingConfig['monnifyMode'] ?? 'live');
        $subscriptionAmount = isset($input['subscriptionAmount']) ? (float)$input['subscriptionAmount'] : ($existingConfig['subscriptionAmount'] ?? 600.00);
        
        $newConfig = [
            'serverUrl' => $serverUrl,
            'adminUsername' => $adminUsername,
            'adminPasswordFull' => $adminPasswordFull,
            'apiKey' => $apiKey,
            'defaultCommission' => $defaultCommission,
            'bankAccountNo' => $bankAccountNo,
            'bankName' => $bankName,
            'bankBeneficiary' => $bankBeneficiary,
            'bankInstructions' => $bankInstructions,
            'chatbotInfo' => $chatbotInfo,
            'chatbotInstructions' => $chatbotInstructions,
            'contactEmail' => $contactEmail,
            'contactPhone' => $contactPhone,
            'contactWhatsApp' => $contactWhatsApp,
            'contactOther' => $contactOther,
            'iosDownloadUrl' => $iosDownloadUrl,
            'androidDownloadUrl' => $androidDownloadUrl,
            'monnifyEnabled' => $monnifyEnabled,
            'monnifyApiKey' => $monnifyApiKey,
            'monnifyContractCode' => $monnifyContractCode,
            'monnifySecretKey' => $monnifySecretKey,
            'monnifyMode' => $monnifyMode,
            'subscriptionAmount' => $subscriptionAmount,
            'smtpEnabled' => isset($input['smtpEnabled']) ? ((bool)$input['smtpEnabled'] ? 1 : 0) : ($existingConfig['smtpEnabled'] ?? 0),
            'smtpHost' => $input['smtpHost'] ?? ($existingConfig['smtpHost'] ?? ''),
            'smtpPort' => isset($input['smtpPort']) ? (int)$input['smtpPort'] : ($existingConfig['smtpPort'] ?? 587),
            'smtpSecure' => isset($input['smtpSecure']) ? ((bool)$input['smtpSecure'] ? 1 : 0) : ($existingConfig['smtpSecure'] ?? 0),
            'smtpUser' => $input['smtpUser'] ?? ($existingConfig['smtpUser'] ?? ''),
            'smtpPass' => isset($input['smtpPass']) ? $input['smtpPass'] : ($existingConfig['smtpPass'] ?? ''),
            'smtpFromName' => $input['smtpFromName'] ?? ($existingConfig['smtpFromName'] ?? ''),
            'smtpFromEmail' => $input['smtpFromEmail'] ?? ($existingConfig['smtpFromEmail'] ?? ''),
            'emailVerificationEnabled' => isset($input['emailVerificationEnabled']) ? ((bool)$input['emailVerificationEnabled'] ? 1 : 0) : ($existingConfig['emailVerificationEnabled'] ?? 0),
            'emailVerificationSubject' => $input['emailVerificationSubject'] ?? ($existingConfig['emailVerificationSubject'] ?? ''),
            'emailVerificationTemplate' => $input['emailVerificationTemplate'] ?? ($existingConfig['emailVerificationTemplate'] ?? ''),
            'welcomeEmailSubject' => $input['welcomeEmailSubject'] ?? ($existingConfig['welcomeEmailSubject'] ?? ''),
            'welcomeEmailTemplate' => $input['welcomeEmailTemplate'] ?? ($existingConfig['welcomeEmailTemplate'] ?? ''),
            'notificationEmailSubject' => $input['notificationEmailSubject'] ?? ($existingConfig['notificationEmailSubject'] ?? ''),
            'notificationEmailTemplate' => $input['notificationEmailTemplate'] ?? ($existingConfig['notificationEmailTemplate'] ?? '')
        ];
        
        DB::saveConfig($newConfig);

        $warning = '';
        if (!empty($serverUrl) && !empty($apiKey)) {
            try {
                $jellyfin = new JellyfinService($newConfig);
                if (!$jellyfin->verifyConnection()) {
                    $warning = ' Warning: Could not connect to Media Server with these credentials. Please check Media Server URL and API Key.';
                }
            } catch (Exception $e) {
                $warning = ' Warning: Media Server verification failed.';
            }
        }
        
        echo json_encode(['success' => true, 'message' => 'System settings, SMTP options, and Email templates saved in the database!' . $warning]);
        exit;
    }
}

// POST /api/admin/smtp-test
if ($method === 'POST' && $path === '/api/admin/smtp-test') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }

    $dbConfig = DB::getConfig() ?: [];
    $testEmail = !empty($input['testEmail']) ? trim($input['testEmail']) : '';
    $smtpHost = !empty($input['smtpHost']) ? trim($input['smtpHost']) : ($dbConfig['smtpHost'] ?? '');
    $smtpPort = isset($input['smtpPort']) && $input['smtpPort'] !== '' ? (int)$input['smtpPort'] : ($dbConfig['smtpPort'] ?? 587);
    $smtpSecure = isset($input['smtpSecure']) ? (!empty($input['smtpSecure']) ? 1 : 0) : ($dbConfig['smtpSecure'] ?? 0);
    $smtpUser = !empty($input['smtpUser']) ? trim($input['smtpUser']) : ($dbConfig['smtpUser'] ?? '');
    $smtpPass = (isset($input['smtpPass']) && $input['smtpPass'] !== '') ? $input['smtpPass'] : ($dbConfig['smtpPass'] ?? '');
    $smtpFromName = !empty($input['smtpFromName']) ? trim($input['smtpFromName']) : ($dbConfig['smtpFromName'] ?? 'CINJELLY Stream');
    $smtpFromEmail = !empty($input['smtpFromEmail']) ? trim($input['smtpFromEmail']) : ($dbConfig['smtpFromEmail'] ?? $smtpUser);
    $customSubject = $input['customSubject'] ?? '';
    $customHtml = $input['customHtml'] ?? '';

    if (empty($testEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient test email address is required']);
        exit;
    }

    $customConfig = (!empty($smtpHost) && !empty($smtpUser)) ? [
        'smtpEnabled' => 1,
        'smtpHost' => $smtpHost,
        'smtpPort' => $smtpPort,
        'smtpSecure' => $smtpSecure,
        'smtpUser' => $smtpUser,
        'smtpPass' => $smtpPass,
        'smtpFromName' => $smtpFromName,
        'smtpFromEmail' => $smtpFromEmail
    ] : null;

    $configObj = $customConfig ?: $dbConfig;

    if (!empty($customHtml)) {
        $dummyUser = ['username' => 'AdminTest', 'fullName' => 'Admin Tester', 'email' => $testEmail];
        $replacedSubj = replace_template_vars($customSubject ?: 'Test Email Preview', $dummyUser, $configObj);
        $replacedHtml = replace_template_vars($customHtml, $dummyUser, $configObj);
        $emailResult = send_smtp_email($testEmail, $replacedSubj, $replacedHtml, $configObj);
        if ($emailResult['success']) {
            echo json_encode(['success' => true, 'message' => "Test preview email delivered to {$testEmail}"]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => $emailResult['error'] ?? 'Failed to send email']);
        }
        exit;
    }

    $testSubj = "CINJELLY Stream - SMTP Connection Test";
    $testHtml = "<div style='font-family:sans-serif;padding:20px;background:#11131e;color:#fff;'><h2>SMTP Connection Successful</h2><p>Your SMTP server settings are correctly configured!</p></div>";
    $emailResult = send_smtp_email($testEmail, $testSubj, $testHtml, $configObj);

    if ($emailResult['success']) {
        echo json_encode(['success' => true, 'message' => "SMTP connection verified! Test email successfully delivered to {$testEmail}."]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => $emailResult['error'] ?? 'SMTP test failed']);
    }
    exit;
}

// POST /api/admin/send-email
if ($method === 'POST' && $path === '/api/admin/send-email') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }

    $targetUserId = $input['targetUserId'] ?? '';
    $targetType = $input['targetType'] ?? 'all';
    $subject = $input['subject'] ?? '';
    $bodyHtml = $input['bodyHtml'] ?? '';

    if (empty($subject) || empty($bodyHtml)) {
        http_response_code(400);
        echo json_encode(['error' => 'Subject and Email HTML Body are required.']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config || empty($config['smtpEnabled'])) {
        http_response_code(400);
        echo json_encode(['error' => 'SMTP is not enabled. Please configure and enable SMTP settings in Admin Panel first.']);
        exit;
    }

    $allUsers = DB::getUsers();
    $recipients = [];

    if ($targetType === 'single' && !empty($targetUserId)) {
        foreach ($allUsers as $u) {
            if (($u['id'] ?? '') === $targetUserId) {
                $recipients[] = $u;
                break;
            }
        }
    } else if ($targetType === 'active') {
        foreach ($allUsers as $u) {
            if (($u['subscriptionStatus'] ?? '') === 'Active') {
                $recipients[] = $u;
            }
        }
    } else if ($targetType === 'unpaid') {
        foreach ($allUsers as $u) {
            if (($u['paymentStatus'] ?? '') === 'Unpaid') {
                $recipients[] = $u;
            }
        }
    } else {
        $recipients = $allUsers;
    }

    if (empty($recipients)) {
        http_response_code(400);
        echo json_encode(['error' => 'No recipients found for the selected target.']);
        exit;
    }

    $sentCount = 0;
    $failedCount = 0;

    foreach ($recipients as $u) {
        if (empty($u['email'])) continue;
        $replacedSubj = replace_template_vars($subject, $u, $config);
        $replacedHtml = replace_template_vars($bodyHtml, $u, $config);

        $res = send_smtp_email($u['email'], $replacedSubj, $replacedHtml, $config);
        if ($res['success']) {
            $sentCount++;
        } else {
            $failedCount++;
        }
    }

    echo json_encode([
        'success' => true,
        'message' => "Campaign email sent successfully to {$sentCount} recipient(s)." . ($failedCount > 0 ? " ({$failedCount} failed)" : ""),
        'sentCount' => $sentCount,
        'failedCount' => $failedCount
    ]);
    exit;
}

// POST /api/auth/resend-verification
if ($method === 'POST' && $path === '/api/auth/resend-verification') {
    $email = $input['email'] ?? '';
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email address is required']);
        exit;
    }

    $user = DB::getUserByEmail($email) ?: DB::getUserByUsername($email);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User account not found with that email/username']);
        exit;
    }

    if (!empty($user['emailVerified']) && $user['emailVerified'] == 1) {
        echo json_encode(['success' => true, 'message' => 'Your email address is already verified! You can proceed to log in.']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config || empty($config['smtpEnabled'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email delivery is not enabled or configured on this server.']);
        exit;
    }

    $token = DB::generateUUID();
    $expires = date(DATE_ISO8601, time() + 24 * 60 * 60);

    DB::updateUser($user['id'], [
        'verificationToken' => $token,
        'verificationTokenExpires' => $expires
    ]);

    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? 'zerolord.com';
    $verifyLink = "{$protocol}{$host}/api/auth/verify-email?token={$token}";

    $subject = !empty($config['emailVerificationSubject']) ? $config['emailVerificationSubject'] : 'Verify Your Email Address - CINJELLY Stream';
    $template = !empty($config['emailVerificationTemplate']) ? $config['emailVerificationTemplate'] : "Welcome {{fullName}}, please verify your account by clicking <a href='{{verification_url}}'>here</a>.";

    $body = replace_template_vars($template, $user, $config, ['verification_url' => $verifyLink]);
    $res = send_smtp_email($user['email'], $subject, $body, $config);

    if ($res['success']) {
        echo json_encode(['success' => true, 'message' => "Verification email sent to {$user['email']}. Please check your inbox or spam folder."]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Failed to send verification email: ' . ($res['error'] ?? 'Unknown error')]);
    }
    exit;
}

// GET /api/auth/verify-email
if ($method === 'GET' && $path === '/api/auth/verify-email') {
    $token = $_GET['token'] ?? '';
    if (empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Verification token is required']);
        exit;
    }

    $pdo = DB::getConnection();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE verificationToken = ? LIMIT 1');
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or expired verification token.']);
        exit;
    }

    DB::updateUser($user['id'], [
        'emailVerified' => 1,
        'verificationToken' => null,
        'verificationTokenExpires' => null
    ]);

    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><title>Email Verified</title><style>body{background:#0b0d14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#11131e;border:1px solid #1e293b;padding:40px;border-radius:16px;text-align:center;max-width:400px;}.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;}</style></head><body><div class='card'><h2>Email Verified!</h2><p>Your email has been successfully verified. You can now log into CINJELLY Stream.</p><a class='btn' href='/'>Continue to Login</a></div></body></html>";
    exit;
}

// POST /api/auth/register
if ($method === 'POST' && $path === '/api/auth/register') {
    $fullName = $input['fullName'] ?? '';
    $username = $input['username'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    $referredBy = $input['referredBy'] ?? '';

    if (empty($fullName) || empty($username) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'All fields are required']);
        exit;
    }

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 6 characters long']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config) {
        http_response_code(500);
        echo json_encode(['error' => 'Streaming server integration is not yet active. Please contact administrator.']);
        exit;
    }

    if (!empty($referredBy)) {
        $affiliateUser = DB::getUserByAffiliateCode($referredBy);
        if (!$affiliateUser) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid affiliate referral code']);
            exit;
        }
    }

    if (DB::getUserByUsername($username)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username is already taken']);
        exit;
    }

    if (DB::getUserByEmail($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email address is already registered']);
        exit;
    }

    $jellyfin = new JellyfinService($config);
    $jellyfinUserId = '';

    try {
        $existingJellyfinId = $jellyfin->getUserIdByName($username);
        if ($existingJellyfinId) {
            $jellyfinUserId = $existingJellyfinId;
            $jellyfin->grantAllPermissions($existingJellyfinId);
        } else {
            $jellyfinUserId = $jellyfin->createUser($username, $password);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => 'Jellyfin integration failed: ' . $e->getMessage()]);
        exit;
    }

    try {
        $newUser = DB::createUser([
            'fullName' => $fullName,
            'username' => trim($username),
            'email' => strtolower(trim($email)),
            'passwordHash' => DB::hashPassword($password),
            'jellyfinUserId' => $jellyfinUserId,
            'subscriptionStatus' => 'Expired',
            'paymentStatus' => 'Unpaid',
            'accountStatus' => 'Expired',
            'role' => 'user',
            'referredBy' => !empty($referredBy) ? trim($referredBy) : null
        ]);

        try {
            $jellyfin->setUserDisabledStatus($jellyfinUserId, true);
        } catch (Exception $e) {
            error_log("Failed to disable initial Jellyfin user: " . $e->getMessage());
        }

        $sessionToken = DB::generateUUID();
        $expiresAt = (round(microtime(true) * 1000) + 7 * 24 * 60 * 60 * 1000);
        DB::createSession($sessionToken, $newUser['id'], $expiresAt);
        setSessionCookie($sessionToken);

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $newUser['id'],
                'fullName' => $newUser['fullName'],
                'username' => $newUser['username'],
                'email' => $newUser['email'],
                'subscriptionStatus' => $newUser['subscriptionStatus'],
                'paymentStatus' => $newUser['paymentStatus'],
                'role' => $newUser['role'],
                'referredBy' => $newUser['referredBy'] ?? null
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Internal registration failure: ' . $e->getMessage()]);
    }
    exit;
}

// POST /api/auth/login
if ($method === 'POST' && $path === '/api/auth/login') {
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and Password are required']);
        exit;
    }

    $user = DB::getUserByUsername($username);
    if (!$user || !DB::verifyPassword($password, $user['passwordHash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password']);
        exit;
    }

    $config = DB::getConfig();
    $jellyfinToken = '';
    if ($config) {
        $jellyfin = new JellyfinService($config);
        try {
            $authResult = $jellyfin->authenticateUser($username, $password);
            $jellyfinToken = $authResult['accessToken'];
        } catch (Exception $e) {
            error_log("Failed to pre-auth user with Jellyfin: " . $e->getMessage());
        }
    }

    $sessionToken = DB::generateUUID();
    $expiresAt = (round(microtime(true) * 1000) + 7 * 24 * 60 * 60 * 1000);
    DB::createSession($sessionToken, $user['id'], $expiresAt, $jellyfinToken);
    setSessionCookie($sessionToken);

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'fullName' => $user['fullName'],
            'username' => $user['username'],
            'email' => $user['email'],
            'subscriptionStatus' => $user['subscriptionStatus'],
            'paymentStatus' => $user['paymentStatus'],
            'subscriptionExpiryDate' => $user['subscriptionExpiryDate'] ?? null,
            'role' => $user['role']
        ],
        'jellyfinToken' => $jellyfinToken
    ]);
    exit;
}

// POST /api/auth/logout
if ($method === 'POST' && $path === '/api/auth/logout') {
    $token = $_COOKIE['session'] ?? null;
    if ($token) {
        DB::deleteSession($token);
    }
    setcookie('session', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'None'
    ]);
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
    exit;
}

// GET /api/auth/me
if ($method === 'GET' && $path === '/api/auth/me') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $config = DB::getConfig();
    $jellyfinAuthToken = '';

    if ($currentUser['role'] === 'admin' || $currentUser['subscriptionStatus'] === 'Active') {
        if ($config && !empty($currentUser['jellyfinUserId'])) {
            $session = DB::getSession($_COOKIE['session'] ?? '');
            if ($session && !empty($session['jellyfinToken'])) {
                $jellyfinAuthToken = $session['jellyfinToken'];
            }
        }
    }

    echo json_encode([
        'user' => [
            'id' => $currentUser['id'],
            'fullName' => $currentUser['fullName'],
            'username' => $currentUser['username'],
            'email' => $currentUser['email'],
            'subscriptionStatus' => $currentUser['subscriptionStatus'],
            'paymentStatus' => $currentUser['paymentStatus'],
            'subscriptionStartDate' => $currentUser['subscriptionStartDate'] ?? null,
            'subscriptionExpiryDate' => $currentUser['subscriptionExpiryDate'] ?? null,
            'jellyfinUserId' => $currentUser['jellyfinUserId'] ?? null,
            'role' => $currentUser['role'],
            'isAffiliate' => isset($currentUser['isAffiliate']) ? (bool)$currentUser['isAffiliate'] : false,
            'affiliateCode' => $currentUser['affiliateCode'] ?? null,
            'referredBy' => $currentUser['referredBy'] ?? null,
            'declineReason' => $currentUser['declineReason'] ?? null,
            'systemNotification' => $currentUser['systemNotification'] ?? null
        ],
        'jellyfinToken' => $jellyfinAuthToken
    ]);
    exit;
}

// POST /api/auth/clear-notification
if ($method === 'POST' && $path === '/api/auth/clear-notification') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        DB::updateUser($currentUser['id'], ['systemNotification' => null]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/auth/jellyfin-token
if ($method === 'POST' && $path === '/api/auth/jellyfin-token') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $password = $input['password'] ?? '';
    if (empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password is required']);
        exit;
    }

    if (!DB::verifyPassword($password, $currentUser['passwordHash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid password']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config) {
        http_response_code(500);
        echo json_encode(['error' => 'System not configured']);
        exit;
    }

    try {
        $jellyfin = new JellyfinService($config);
        $authResult = $jellyfin->authenticateUser($currentUser['username'], $password);
        
        $token = $_COOKIE['session'] ?? '';
        if ($token) {
            DB::updateSessionJellyfinToken($token, $authResult['accessToken']);
        }

        echo json_encode(['success' => true, 'jellyfinToken' => $authResult['accessToken']]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => 'Jellyfin sync failed: ' . $e->getMessage()]);
    }
    exit;
}

// POST /api/payment/simulate
if ($method === 'POST' && $path === '/api/payment/simulate') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $config = DB::getConfig();
    if (!$config) {
        http_response_code(500);
        echo json_encode(['error' => 'System not configured']);
        exit;
    }

    try {
        $startDate = date(DATE_ISO8601);
        $expiryDate = date(DATE_ISO8601, strtotime('+30 days'));

        DB::updateUser($currentUser['id'], [
            'subscriptionStatus' => 'Active',
            'paymentStatus' => 'Paid',
            'accountStatus' => 'Active',
            'subscriptionStartDate' => $startDate,
            'subscriptionExpiryDate' => $expiryDate
        ]);

        if (!empty($currentUser['jellyfinUserId'])) {
            $jellyfin = new JellyfinService($config);
            $jellyfin->setUserDisabledStatus($currentUser['jellyfinUserId'], false);
        }

        // Generate affiliate commission if user has a valid referral
        if (!empty($currentUser['referredBy'])) {
            $affiliateUser = DB::getUserByAffiliateCode($currentUser['referredBy']);
            if ($affiliateUser) {
                $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
                DB::createCommission([
                    'affiliateId' => $affiliateUser['id'],
                    'referredUserId' => $currentUser['id'],
                    'amount' => $commissionAmount,
                    'status' => 'Approved'
                ]);
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Subscription successfully activated for 30 days! Jellyfin access enabled.',
            'subscriptionExpiryDate' => $expiryDate
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process simulated payment: ' . $e->getMessage()]);
    }
    exit;
}

// GET /api/payment/bank-info
if ($method === 'GET' && $path === '/api/payment/bank-info') {
    $config = DB::getConfig();
    echo json_encode([
        'bankAccountNo' => $config['bankAccountNo'] ?? '',
        'bankName' => $config['bankName'] ?? '',
        'bankBeneficiary' => $config['bankBeneficiary'] ?? '',
        'bankInstructions' => $config['bankInstructions'] ?? '',
        'chatbotInfo' => $config['chatbotInfo'] ?? '',
        'chatbotInstructions' => $config['chatbotInstructions'] ?? '',
        'contactEmail' => $config['contactEmail'] ?? '',
        'contactPhone' => $config['contactPhone'] ?? '',
        'contactWhatsApp' => $config['contactWhatsApp'] ?? '',
        'contactOther' => $config['contactOther'] ?? '',
        'monnifyEnabled' => !empty($config['monnifyEnabled']),
        'monnifyApiKey' => $config['monnifyApiKey'] ?? '',
        'monnifyContractCode' => $config['monnifyContractCode'] ?? '',
        'monnifyMode' => $config['monnifyMode'] ?? 'live',
        'subscriptionAmount' => isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00
    ]);
    exit;
}

// POST /api/payment/monnify-complete
if ($method === 'POST' && $path === '/api/payment/monnify-complete') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $paymentReference = $input['paymentReference'] ?? ($input['response']['paymentReference'] ?? '');
    $transactionReference = $input['transactionReference'] ?? ($input['response']['transactionReference'] ?? '');
    $status = $input['paymentStatus'] ?? ($input['response']['paymentStatus'] ?? 'PAID');

    if (empty($paymentReference) && empty($transactionReference)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing transaction or payment reference']);
        exit;
    }

    try {
        $config = DB::getConfig();
        $daysToAdd = 30;
        $currentExpiry = time();
        if (!empty($currentUser['subscriptionExpiryDate'])) {
            $existingExpiry = strtotime($currentUser['subscriptionExpiryDate']);
            if ($existingExpiry > time()) {
                $currentExpiry = $existingExpiry;
            }
        }
        $newExpiryDate = date(DATE_ISO8601, $currentExpiry + $daysToAdd * 24 * 60 * 60);

        $refToSave = !empty($paymentReference) ? $paymentReference : $transactionReference;

        $updatedUser = DB::updateUser($currentUser['id'], [
            'subscriptionStatus' => 'Active',
            'accountStatus' => 'Active',
            'paymentStatus' => 'Paid',
            'subscriptionStartDate' => empty($currentUser['subscriptionStartDate']) ? date(DATE_ISO8601) : $currentUser['subscriptionStartDate'],
            'subscriptionExpiryDate' => $newExpiryDate,
            'transactionRef' => $refToSave,
            'lastPaymentTime' => date(DATE_ISO8601),
            'declineReason' => null,
            'systemNotification' => 'accepted'
        ]);

        // Enable Jellyfin user if linked
        if (!empty($currentUser['jellyfinUserId']) && $config) {
            try {
                $jellyfin = new JellyfinService($config);
                $jellyfin->setUserDisabledStatus($currentUser['jellyfinUserId'], false);
            } catch (Exception $e) {
                // Ignore jellyfin error
            }
        }

        // Send welcome email if SMTP configured
        if ($config && !empty($config['smtpEnabled']) && !empty($config['welcomeEmailTemplate'])) {
            try {
                $subj = !empty($config['welcomeEmailSubject']) ? $config['welcomeEmailSubject'] : 'Payment Received - CINJELLY Stream';
                $body = replace_template_vars($config['welcomeEmailTemplate'], $currentUser, $config);
                send_smtp_email($currentUser['email'], $subj, $body, $config);
            } catch (Exception $e) {
                // Ignore email error
            }
        }

        // Calculate affiliate commission if user was referred
        if (!empty($currentUser['referredBy'])) {
            $affiliateUser = DB::getUserByAffiliateCode($currentUser['referredBy']);
            if ($affiliateUser) {
                $commissionAmount = ($config && isset($config['defaultCommission'])) ? (float)$config['defaultCommission'] : 100.00;
                DB::createCommission([
                    'affiliateId' => $affiliateUser['id'],
                    'referredUserId' => $currentUser['id'],
                    'amount' => $commissionAmount,
                    'status' => 'Approved'
                ]);
            }
        }

        echo json_encode(['success' => true, 'user' => $updatedUser]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET & POST /api/payment/monnify-webhook and /api/monnify/webhook
if ($path === '/api/payment/monnify-webhook' || $path === '/api/monnify/webhook') {
    if ($method === 'GET') {
        echo json_encode([
            'status' => 'active',
            'message' => 'Monnify payment webhook endpoint is live and listening for transaction events.',
            'requestSuccessful' => true,
            'responseCode' => '0'
        ]);
        exit;
    }
    if ($method === 'POST') {
        $email = $input['eventData']['customer']['email'] ?? ($input['customerEmail'] ?? '');
        $paymentRef = $input['eventData']['paymentReference'] ?? ($input['paymentReference'] ?? '');
        $paymentStatus = $input['eventData']['paymentStatus'] ?? ($input['paymentStatus'] ?? '');

        if (!empty($email) && ($paymentStatus === 'PAID' || $paymentStatus === 'SUCCESSFUL')) {
            $users = DB::getUsers();
            $targetUser = null;
            foreach ($users as $u) {
                if (strtolower($u['email']) === strtolower($email)) {
                    $targetUser = $u;
                    break;
                }
            }

            if ($targetUser) {
                $config = DB::getConfig();
                $daysToAdd = 30;
                $currentExpiry = time();
                if (!empty($targetUser['subscriptionExpiryDate'])) {
                    $existingExpiry = strtotime($targetUser['subscriptionExpiryDate']);
                    if ($existingExpiry > time()) {
                        $currentExpiry = $existingExpiry;
                    }
                }
                $newExpiryDate = date(DATE_ISO8601, $currentExpiry + $daysToAdd * 24 * 60 * 60);

                DB::updateUser($targetUser['id'], [
                    'subscriptionStatus' => 'Active',
                    'accountStatus' => 'Active',
                    'paymentStatus' => 'Paid',
                    'subscriptionExpiryDate' => $newExpiryDate,
                    'transactionRef' => $paymentRef,
                    'lastPaymentTime' => date(DATE_ISO8601)
                ]);

                if (!empty($targetUser['jellyfinUserId']) && $config) {
                    try {
                        $jellyfin = new JellyfinService($config);
                        $jellyfin->setUserDisabledStatus($targetUser['jellyfinUserId'], false);
                    } catch (Exception $e) {}
                }
            }
        }

        echo json_encode(['requestSuccessful' => true, 'responseCode' => '0', 'responseMessage' => 'Webhook processed']);
        exit;
    }
}

// POST /api/payment/request-verification
if ($method === 'POST' && $path === '/api/payment/request-verification') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        $updatedUser = DB::updateUser($currentUser['id'], [
            'paymentStatus' => 'Pending Verification'
        ]);
        echo json_encode(['success' => true, 'user' => $updatedUser]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/payment/upload-receipt
if ($method === 'POST' && $path === '/api/payment/upload-receipt') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $base64Data = $input['base64Data'] ?? '';
    $fileName = $input['fileName'] ?? '';
    $phone = $input['phone'] ?? '';
    $transactionRef = $input['transactionRef'] ?? '';

    if (empty($base64Data) || empty($fileName) || empty($phone)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing base64Data, fileName, or phone number']);
        exit;
    }

    try {
        $monthFolder = date('Y-m');
        $uploadDir = dirname(__DIR__) . '/uploads/receipts/' . $monthFolder;
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (strpos($base64Data, ';base64,') !== false) {
            $parts = explode(';base64,', $base64Data);
            $base64Image = end($parts);
        } else {
            $base64Image = $base64Data;
        }
        $decodedData = base64_decode($base64Image);

        $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
        if (empty($fileExt)) {
            $fileExt = 'png';
        }
        $cleanFileName = $currentUser['username'] . '_' . time() . '.' . $fileExt;
        $filePath = $uploadDir . '/' . $cleanFileName;

        file_put_contents($filePath, $decodedData);
        $relativeUrl = '/uploads/receipts/' . $monthFolder . '/' . $cleanFileName;

        $updatedUser = DB::updateUser($currentUser['id'], [
            'paymentStatus' => 'Pending Verification',
            'receiptUrl' => $relativeUrl,
            'phone' => $phone,
            'transactionRef' => !empty($transactionRef) ? $transactionRef : null,
            'lastPaymentTime' => date(DATE_ISO8601)
        ]);

        echo json_encode(['success' => true, 'user' => $updatedUser, 'receiptUrl' => $relativeUrl]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/admin/users
if ($method === 'GET' && $path === '/api/admin/users') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    try {
        $searchQuery = strtolower(trim($_GET['search'] ?? ''));
        $users = DB::getUsers();

        if ($searchQuery !== '') {
            $filtered = [];
            foreach ($users as $u) {
                if (strpos(strtolower($u['fullName'] ?? ''), $searchQuery) !== false ||
                    strpos(strtolower($u['username'] ?? ''), $searchQuery) !== false ||
                    strpos(strtolower($u['email'] ?? ''), $searchQuery) !== false) {
                    $filtered[] = $u;
                }
            }
            $users = $filtered;
        }

        echo json_encode($users);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/users (Create User)
if ($method === 'POST' && $path === '/api/admin/users') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    $fullName = $input['fullName'] ?? '';
    $username = $input['username'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    $subscriptionStatus = $input['subscriptionStatus'] ?? 'Disabled';
    $paymentStatus = $input['paymentStatus'] ?? 'Unpaid';
    $accountStatus = $input['accountStatus'] ?? 'Disabled';
    $role = $input['role'] ?? 'user';
    $subscriptionExpiryDate = $input['subscriptionExpiryDate'] ?? null;
    $referredBy = $input['referredBy'] ?? null;
    $isAffiliate = isset($input['isAffiliate']) ? (int)$input['isAffiliate'] : 0;
    $affiliateCode = $input['affiliateCode'] ?? null;

    if (empty($fullName) || empty($username) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Full Name, Username, Email, and Password are required.']);
        exit;
    }

    try {
        if (DB::getUserByUsername($username)) {
            http_response_code(400);
            echo json_encode(['error' => 'Username is already taken']);
            exit;
        }

        if (DB::getUserByEmail($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email address is already registered']);
            exit;
        }

        $config = DB::getConfig();
        $jellyfinUserId = '';

        if ($config) {
            $jellyfin = new JellyfinService($config);
            try {
                $existingJUserId = $jellyfin->getUserIdByName($username);
                if ($existingJUserId) {
                    $jellyfinUserId = $existingJUserId;
                    $jellyfin->grantAllPermissions($existingJUserId);
                } else {
                    $jellyfinUserId = $jellyfin->createUser($username, $password);
                }

                if ($subscriptionStatus !== 'Active') {
                    $jellyfin->setUserDisabledStatus($jellyfinUserId, true);
                }
            } catch (Exception $err) {
                error_log("Jellyfin user sync failed on admin create: " . $err->getMessage());
            }
        }

        $newUser = DB::createUser([
            'fullName' => $fullName,
            'username' => trim($username),
            'email' => strtolower(trim($email)),
            'passwordHash' => DB::hashPassword($password),
            'jellyfinUserId' => !empty($jellyfinUserId) ? $jellyfinUserId : null,
            'subscriptionStatus' => $subscriptionStatus,
            'paymentStatus' => $paymentStatus,
            'accountStatus' => $accountStatus,
            'role' => $role,
            'subscriptionStartDate' => $subscriptionStatus === 'Active' ? date(DATE_ISO8601) : null,
            'subscriptionExpiryDate' => $subscriptionExpiryDate,
            'referredBy' => $referredBy,
            'isAffiliate' => $isAffiliate,
            'affiliateCode' => $affiliateCode
        ]);

        echo json_encode($newUser);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// PUT /api/admin/users/{id} (Update User)
if ($method === 'PUT' && preg_match('#^/api/admin/users/([^/]+)$#', $path, $matches)) {
    $targetUserId = $matches[1];

    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    try {
        $targetUser = DB::getUserById($targetUserId);
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        $fullName = $input['fullName'] ?? null;
        $username = $input['username'] ?? null;
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        $subscriptionStatus = $input['subscriptionStatus'] ?? null;
        $paymentStatus = $input['paymentStatus'] ?? null;
        $accountStatus = $input['accountStatus'] ?? null;
        $role = $input['role'] ?? null;
        $subscriptionStartDate = $input['subscriptionStartDate'] ?? null;
        $subscriptionExpiryDate = $input['subscriptionExpiryDate'] ?? null;
        $referredBy = $input['referredBy'] ?? null;
        $isAffiliate = isset($input['isAffiliate']) ? (int)$input['isAffiliate'] : null;
        $affiliateCode = $input['affiliateCode'] ?? null;

        if ($username !== null && strtolower(trim($username)) !== strtolower($targetUser['username'])) {
            if (DB::getUserByUsername($username)) {
                http_response_code(400);
                echo json_encode(['error' => 'Username is already taken']);
                exit;
            }
        }

        if ($email !== null && strtolower(trim($email)) !== strtolower($targetUser['email'])) {
            if (DB::getUserByEmail($email)) {
                http_response_code(400);
                echo json_encode(['error' => 'Email address is already registered']);
                exit;
            }
        }

        $updates = [];
        if ($fullName !== null) $updates['fullName'] = $fullName;
        if ($username !== null) $updates['username'] = trim($username);
        if ($email !== null) $updates['email'] = strtolower(trim($email));
        if ($subscriptionStatus !== null) $updates['subscriptionStatus'] = $subscriptionStatus;
        if ($paymentStatus !== null) $updates['paymentStatus'] = $paymentStatus;
        if ($accountStatus !== null) $updates['accountStatus'] = $accountStatus;
        if ($role !== null) $updates['role'] = $role;
        if ($subscriptionStartDate !== null) $updates['subscriptionStartDate'] = $subscriptionStartDate;
        if ($subscriptionExpiryDate !== null) $updates['subscriptionExpiryDate'] = $subscriptionExpiryDate;
        if ($referredBy !== null) $updates['referredBy'] = $referredBy;
        if ($isAffiliate !== null) $updates['isAffiliate'] = $isAffiliate;
        if ($affiliateCode !== null) $updates['affiliateCode'] = $affiliateCode;

        if (!empty($password)) {
            $updates['passwordHash'] = DB::hashPassword($password);
        }

        $updatedUser = DB::updateUser($targetUserId, $updates);

        // Sync with Jellyfin if subscriptionStatus or password changed
        $config = DB::getConfig();
        if ($config && !empty($targetUser['jellyfinUserId'])) {
            $jellyfin = new JellyfinService($config);
            try {
                if ($subscriptionStatus !== null) {
                    $isDisabled = ($subscriptionStatus !== 'Active');
                    $jellyfin->setUserDisabledStatus($targetUser['jellyfinUserId'], $isDisabled);
                }
                if (!empty($password)) {
                    $jellyfin->updateUserPassword($targetUser['jellyfinUserId'], $password);
                }
            } catch (Exception $err) {
                error_log("Jellyfin sync failed on admin update: " . $err->getMessage());
            }
        }

        echo json_encode($updatedUser);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// DELETE /api/admin/users/{id} (Delete User)
if ($method === 'DELETE' && preg_match('#^/api/admin/users/([^/]+)$#', $path, $matches)) {
    $targetUserId = $matches[1];

    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    try {
        $targetUser = DB::getUserById($targetUserId);
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        // Delete locally
        DB::deleteUser($targetUserId);

        // Delete from Jellyfin
        $config = DB::getConfig();
        if ($config && !empty($targetUser['jellyfinUserId'])) {
            $jellyfin = new JellyfinService($config);
            try {
                $jellyfin->deleteUser($targetUser['jellyfinUserId']);
            } catch (Exception $err) {
                error_log("Jellyfin user deletion failed: " . $err->getMessage());
            }
        }

        echo json_encode(['success' => true, 'message' => 'User deleted successfully']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/users/{id}/subscription
if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/subscription$#', $path, $matches)) {
    $targetUserId = $matches[1];
    
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    $action = $input['action'] ?? '';
    
    try {
        $targetUser = DB::getUserById($targetUserId);
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        $config = DB::getConfig();
        if (!$config) {
            http_response_code(500);
            echo json_encode(['error' => 'System not configured']);
            exit;
        }

        $jellyfin = new JellyfinService($config);
        $updates = [];
        $isDisabledInJellyfin = false;

        if ($action === 'activate' || $action === 'reactivate') {
            $startDate = date(DATE_ISO8601);
            $expiryDate = date(DATE_ISO8601, strtotime('+30 days'));

            $updates = [
                'subscriptionStatus' => 'Active',
                'paymentStatus' => 'Paid',
                'accountStatus' => 'Active',
                'subscriptionStartDate' => $startDate,
                'subscriptionExpiryDate' => $expiryDate,
                'disabledAt' => null
            ];
            $isDisabledInJellyfin = false;

            // Generate affiliate commission if user has a valid referral
            if (!empty($targetUser['referredBy'])) {
                $affiliateUser = DB::getUserByAffiliateCode($targetUser['referredBy']);
                if ($affiliateUser) {
                    $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
                    DB::createCommission([
                        'affiliateId' => $affiliateUser['id'],
                        'referredUserId' => $targetUser['id'],
                        'amount' => $commissionAmount,
                        'status' => 'Approved'
                    ]);
                }
            }
        } else if ($action === 'extend') {
            $currentExpiry = !empty($targetUser['subscriptionExpiryDate']) ? strtotime($targetUser['subscriptionExpiryDate']) : time();
            $newExpiryTime = max($currentExpiry, time()) + 30 * 24 * 60 * 60;
            $newExpiryDate = date(DATE_ISO8601, $newExpiryTime);

            $updates = [
                'subscriptionStatus' => 'Active',
                'paymentStatus' => 'Paid',
                'accountStatus' => 'Active',
                'subscriptionExpiryDate' => $newExpiryDate,
                'disabledAt' => null
            ];
            $isDisabledInJellyfin = false;

            // Generate affiliate commission if user has a valid referral
            if (!empty($targetUser['referredBy'])) {
                $affiliateUser = DB::getUserByAffiliateCode($targetUser['referredBy']);
                if ($affiliateUser) {
                    $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
                    DB::createCommission([
                        'affiliateId' => $affiliateUser['id'],
                        'referredUserId' => $targetUser['id'],
                        'amount' => $commissionAmount,
                        'status' => 'Approved'
                    ]);
                }
            }
        } else if ($action === 'disable') {
            $updates = [
                'subscriptionStatus' => 'Disabled',
                'accountStatus' => 'Disabled',
                'disabledAt' => date(DATE_ISO8601)
            ];
            $isDisabledInJellyfin = true;
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action provided']);
            exit;
        }

        $updatedUser = DB::updateUser($targetUserId, $updates);

        if (!empty($targetUser['jellyfinUserId'])) {
            $jellyfin->setUserDisabledStatus($targetUser['jellyfinUserId'], $isDisabledInJellyfin);
        }

        echo json_encode(['success' => true, 'user' => $updatedUser]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Admin action failed: ' . $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/users/{id}/affiliate
if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/affiliate$#', $path, $matches)) {
    $targetUserId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin access required.']);
        exit;
    }

    $isAffiliate = isset($input['isAffiliate']) ? (int)$input['isAffiliate'] : 0;
    $affiliateCode = trim($input['affiliateCode'] ?? '');

    try {
        $targetUser = DB::getUserById($targetUserId);
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        if ($isAffiliate) {
            if (empty($affiliateCode)) {
                $affiliateCode = strtoupper(substr($targetUser['username'], 0, 4)) . rand(100, 999);
            }
            
            $existing = DB::getUserByAffiliateCode($affiliateCode);
            if ($existing && $existing['id'] !== $targetUserId) {
                http_response_code(400);
                echo json_encode(['error' => 'Affiliate code is already taken']);
                exit;
            }

            $updatedUser = DB::updateUser($targetUserId, [
                'isAffiliate' => 1,
                'affiliateCode' => $affiliateCode
            ]);
        } else {
            $updatedUser = DB::updateUser($targetUserId, [
                'isAffiliate' => 0
            ]);
        }

        echo json_encode(['success' => true, 'user' => $updatedUser]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/admin/commissions
if ($method === 'GET' && $path === '/api/admin/commissions') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $commissions = DB::getCommissions();
        $users = DB::getUsers();
        $userMap = [];
        foreach ($users as $u) {
            $userMap[$u['id']] = $u;
        }

        $result = [];
        foreach ($commissions as $c) {
            $affiliate = $userMap[$c['affiliateId']] ?? null;
            $referred = $userMap[$c['referredUserId']] ?? null;
            $result[] = [
                'id' => $c['id'],
                'affiliateId' => $c['affiliateId'],
                'affiliateName' => $affiliate ? $affiliate['fullName'] : 'Unknown',
                'affiliateUsername' => $affiliate ? $affiliate['username'] : 'Unknown',
                'referredUserId' => $c['referredUserId'],
                'referredName' => $referred ? $referred['fullName'] : 'Unknown',
                'referredUsername' => $referred ? $referred['username'] : 'Unknown',
                'amount' => (float)$c['amount'],
                'status' => $c['status'],
                'createdAt' => $c['createdAt'],
                'updatedAt' => $c['updatedAt']
            ];
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/commissions/{id}/status
if ($method === 'POST' && preg_match('#^/api/admin/commissions/([^/]+)/status$#', $path, $matches)) {
    $commissionId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $status = $input['status'] ?? '';
    if ($status !== 'Pending' && $status !== 'Approved' && $status !== 'Paid') {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid commission status']);
        exit;
    }

    try {
        DB::updateCommissionStatus($commissionId, $status);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/admin/affiliates
if ($method === 'GET' && $path === '/api/admin/affiliates') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $allUsers = DB::getUsers();
        $affiliates = [];
        foreach ($allUsers as $u) {
            if (!empty($u['isAffiliate']) && $u['isAffiliate'] == 1) {
                $affiliates[] = $u;
            }
        }

        $result = [];
        foreach ($affiliates as $affiliate) {
            $commissions = DB::getCommissionsByAffiliate($affiliate['id']);
            $referredUsers = [];
            $registeredCount = 0;
            $paidCount = 0;

            foreach ($allUsers as $u) {
                if (!empty($u['referredBy']) && strtolower(trim($u['referredBy'])) === strtolower(trim($affiliate['affiliateCode'] ?? ''))) {
                    $registeredCount++;
                    $isPaid = ($u['paymentStatus'] === 'Paid' || $u['subscriptionStatus'] === 'Active');
                    if ($isPaid) {
                        $paidCount++;
                    }
                    $referredUsers[] = [
                        'id' => $u['id'],
                        'fullName' => $u['fullName'],
                        'username' => $u['username'],
                        'email' => $u['email'],
                        'registrationDate' => $u['registrationDate'],
                        'paymentStatus' => $u['paymentStatus'],
                        'subscriptionStatus' => $u['subscriptionStatus']
                    ];
                }
            }

            $pendingCommission = 0.0;
            $approvedCommission = 0.0;
            $paidCommission = 0.0;
            $totalCommission = 0.0;

            foreach ($commissions as $c) {
                $amt = (float)$c['amount'];
                $totalCommission += $amt;
                if ($c['status'] === 'Pending') {
                    $pendingCommission += $amt;
                } else if ($c['status'] === 'Approved') {
                    $approvedCommission += $amt;
                } else if ($c['status'] === 'Paid') {
                    $paidCommission += $amt;
                }
            }

            $result[] = [
                'id' => $affiliate['id'],
                'fullName' => $affiliate['fullName'],
                'username' => $affiliate['username'],
                'email' => $affiliate['email'],
                'affiliateCode' => $affiliate['affiliateCode'],
                'registrationDate' => $affiliate['registrationDate'],
                'registeredCount' => $registeredCount,
                'paidCount' => $paidCount,
                'pendingCommission' => $pendingCommission,
                'approvedCommission' => $approvedCommission,
                'paidCommission' => $paidCommission,
                'totalCommission' => $totalCommission,
                'referredUsers' => $referredUsers,
                'commissions' => $commissions
            ];
        }

        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/media/requests
if ($method === 'POST' && $path === '/api/media/requests') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $type = $input['type'] ?? '';
    $title = $input['title'] ?? '';
    $releaseYear = $input['releaseYear'] ?? null;
    $season = $input['season'] ?? null;
    $episode = $input['episode'] ?? null;

    if (empty($type) || empty($title)) {
        http_response_code(400);
        echo json_encode(['error' => 'Type and Title are required']);
        exit;
    }

    try {
        $record = DB::createMediaRequest([
            'userId' => $currentUser['id'],
            'username' => $currentUser['username'],
            'type' => $type,
            'title' => $title,
            'releaseYear' => $releaseYear,
            'season' => $season,
            'episode' => $episode
        ]);
        echo json_encode(['success' => true, 'request' => $record]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/media/requests
if ($method === 'GET' && $path === '/api/media/requests') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $requests = DB::getMediaRequests();
        if ($currentUser['role'] === 'admin') {
            echo json_encode($requests);
        } else {
            $filtered = [];
            foreach ($requests as $r) {
                if ($r['userId'] === $currentUser['id']) {
                    $filtered[] = $r;
                }
            }
            echo json_encode($filtered);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// PUT /api/admin/media/requests/{id}
if ($method === 'PUT' && preg_match('#^/api/admin/media/requests/([^/]+)$#', $path, $matches)) {
    $requestId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $status = $input['status'] ?? '';
    if ($status !== 'Pending' && $status !== 'Approved' && $status !== 'Declined') {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        exit;
    }

    try {
        DB::updateMediaRequestStatus($requestId, $status);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/notifications/broadcast
if ($method === 'POST' && $path === '/api/admin/notifications/broadcast') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $title = $input['title'] ?? '';
    $message = $input['message'] ?? '';
    $imageUrl = $input['imageUrl'] ?? null;
    $targetType = $input['targetType'] ?? 'all';
    $targetUserId = $input['targetUserId'] ?? null;

    if (empty($title) || empty($message) || empty($targetType)) {
        http_response_code(400);
        echo json_encode(['error' => 'Title, message, and targetType are required']);
        exit;
    }

    try {
        $record = DB::createBroadcastNotification([
            'title' => $title,
            'message' => $message,
            'imageUrl' => $imageUrl,
            'targetType' => $targetType,
            'targetUserId' => $targetType === 'user' ? $targetUserId : null
        ]);
        echo json_encode(['success' => true, 'notification' => $record]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/admin/notifications/all
if ($method === 'GET' && $path === '/api/admin/notifications/all') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        $allNotifs = DB::getBroadcastNotifications();
        echo json_encode($allNotifs);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/notifications/upload
if ($method === 'POST' && $path === '/api/admin/notifications/upload') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $base64Data = $input['base64Data'] ?? '';
    $fileName = $input['fileName'] ?? '';

    if (empty($base64Data) || empty($fileName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing base64Data or fileName']);
        exit;
    }

    try {
        $uploadDir = dirname(__DIR__) . '/uploads/notifications';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (strpos($base64Data, ';base64,') !== false) {
            $parts = explode(';base64,', $base64Data);
            $base64Image = end($parts);
        } else {
            $base64Image = $base64Data;
        }
        $decodedData = base64_decode($base64Image);

        $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
        if (empty($fileExt)) {
            $fileExt = 'png';
        }
        $cleanFileName = 'notif_' . time() . '.' . $fileExt;
        $filePath = $uploadDir . '/' . $cleanFileName;

        file_put_contents($filePath, $decodedData);
        $relativeUrl = '/uploads/notifications/' . $cleanFileName;

        echo json_encode(['success' => true, 'url' => $relativeUrl]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/notifications/broadcast
if ($method === 'GET' && $path === '/api/notifications/broadcast') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $allNotifs = DB::getBroadcastNotifications();
        $filtered = [];

        foreach ($allNotifs as $n) {
            $isTarget = false;
            if ($n['targetType'] === 'all') {
                $isTarget = true;
            } else if ($n['targetType'] === 'affiliate' && !empty($currentUser['isAffiliate']) && $currentUser['isAffiliate'] == 1) {
                $isTarget = true;
            } else if ($n['targetType'] === 'paid' && $currentUser['subscriptionStatus'] === 'Active') {
                $isTarget = true;
            } else if ($n['targetType'] === 'free' && $currentUser['subscriptionStatus'] !== 'Active') {
                $isTarget = true;
            } else if ($n['targetType'] === 'user' && !empty($n['targetUserId']) && $n['targetUserId'] === $currentUser['id']) {
                $isTarget = true;
            }

            if ($isTarget) {
                $filtered[] = $n;
            }
        }

        echo json_encode($filtered);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/payments/verify
if ($method === 'POST' && $path === '/api/admin/payments/verify') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $userId = $input['userId'] ?? '';
    $action = $input['action'] ?? '';
    $declineReason = $input['declineReason'] ?? '';

    if (empty($userId) || empty($action)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing userId or action']);
        exit;
    }

    try {
        $userToVerify = DB::getUserById($userId);
        if (!$userToVerify) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        $config = DB::getConfig();

        if ($action === 'accept') {
            $daysToAdd = 30;
            $currentExpiry = time();
            if (!empty($userToVerify['subscriptionExpiryDate'])) {
                $existingExpiry = strtotime($userToVerify['subscriptionExpiryDate']);
                if ($existingExpiry > time()) {
                    $currentExpiry = $existingExpiry;
                }
            }
            $newExpiryDate = date(DATE_ISO8601, $currentExpiry + $daysToAdd * 24 * 60 * 60);

            $updatedUser = DB::updateUser($userId, [
                'subscriptionStatus' => 'Active',
                'accountStatus' => 'Active',
                'paymentStatus' => 'Paid',
                'subscriptionExpiryDate' => $newExpiryDate,
                'declineReason' => null,
                'systemNotification' => 'accepted'
            ]);

            if (!empty($userToVerify['jellyfinUserId']) && $config) {
                try {
                    $jellyfin = new JellyfinService($config);
                    $jellyfin->setUserDisabledStatus($userToVerify['jellyfinUserId'], false);
                } catch (Exception $e) {
                    // Ignore or log
                }
            }

            if ($config && !empty($config['smtpEnabled']) && !empty($config['welcomeEmailTemplate'])) {
                try {
                    $subj = !empty($config['welcomeEmailSubject']) ? $config['welcomeEmailSubject'] : 'Welcome to CINJELLY Stream!';
                    $body = replace_template_vars($config['welcomeEmailTemplate'], $userToVerify, $config);
                    send_smtp_email($userToVerify['email'], $subj, $body, $config);
                } catch (Exception $e) {
                    // Ignore email error
                }
            }

            // Generate affiliate commission if user has a valid referral
            if (!empty($userToVerify['referredBy'])) {
                $affiliateUser = DB::getUserByAffiliateCode($userToVerify['referredBy']);
                if ($affiliateUser) {
                    $commissionAmount = ($config && isset($config['defaultCommission'])) ? (float)$config['defaultCommission'] : 100.00;
                    DB::createCommission([
                        'affiliateId' => $affiliateUser['id'],
                        'referredUserId' => $userToVerify['id'],
                        'amount' => $commissionAmount,
                        'status' => 'Approved'
                    ]);
                }
            }

            echo json_encode(['success' => true, 'user' => $updatedUser]);

        } elseif ($action === 'decline') {
            $updatedUser = DB::updateUser($userId, [
                'paymentStatus' => 'Unpaid',
                'declineReason' => !empty($declineReason) ? $declineReason : 'Payment verification failed',
                'systemNotification' => 'declined'
            ]);

            echo json_encode(['success' => true, 'user' => $updatedUser]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
        }

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/affiliate/stats
if ($method === 'GET' && $path === '/api/affiliate/stats') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    if (empty($currentUser['isAffiliate'])) {
        http_response_code(403);
        echo json_encode(['error' => 'User is not registered as an affiliate']);
        exit;
    }

    try {
        $config = DB::getConfig();
        $defaultCommission = ($config && isset($config['defaultCommission'])) ? (float)$config['defaultCommission'] : 100.00;
        $affiliateCode = $currentUser['affiliateCode'];
        $users = DB::getUsers();
        $commissions = DB::getCommissionsByAffiliate($currentUser['id']);

        $referredUsers = [];
        $registeredCount = 0;
        $paidCount = 0;

        foreach ($users as $u) {
            if ($u['referredBy'] === $affiliateCode) {
                $registeredCount++;
                $isPaid = ($u['paymentStatus'] === 'Paid' || $u['subscriptionStatus'] === 'Active');
                if ($isPaid) {
                    $paidCount++;
                }
                $referredUsers[] = [
                    'id' => $u['id'],
                    'fullName' => $u['fullName'],
                    'username' => $u['username'],
                    'registrationDate' => $u['registrationDate'],
                    'paymentStatus' => $u['paymentStatus'],
                    'subscriptionStatus' => $u['subscriptionStatus']
                ];
            }
        }

        $pendingCommission = 0.0;
        $approvedCommission = 0.0;
        $paidCommission = 0.0;
        $totalCommission = 0.0;

        foreach ($commissions as $c) {
            $amt = (float)$c['amount'];
            $totalCommission += $amt;
            if ($c['status'] === 'Pending') {
                $pendingCommission += $amt;
            } else if ($c['status'] === 'Approved') {
                $approvedCommission += $amt;
            } else if ($c['status'] === 'Paid') {
                $paidCommission += $amt;
            }
        }

        echo json_encode([
            'affiliateCode' => $affiliateCode,
            'registeredCount' => $registeredCount,
            'paidCount' => $paidCount,
            'pendingCommission' => $pendingCommission,
            'approvedCommission' => $approvedCommission,
            'paidCommission' => $paidCommission,
            'totalCommission' => $totalCommission,
            'defaultCommission' => $defaultCommission,
            'referredUsers' => $referredUsers,
            'commissions' => $commissions
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/affiliate/join
if ($method === 'POST' && $path === '/api/affiliate/join') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $affiliateCode = strtoupper(substr($currentUser['username'], 0, 4)) . rand(100, 999);
        $updatedUser = DB::updateUser($currentUser['id'], [
            'isAffiliate' => 1,
            'affiliateCode' => $affiliateCode
        ]);

        echo json_encode(['success' => true, 'user' => [
            'id' => $updatedUser['id'],
            'fullName' => $updatedUser['fullName'],
            'username' => $updatedUser['username'],
            'email' => $updatedUser['email'],
            'subscriptionStatus' => $updatedUser['subscriptionStatus'],
            'paymentStatus' => $updatedUser['paymentStatus'],
            'role' => $updatedUser['role'],
            'isAffiliate' => (bool)$updatedUser['isAffiliate'],
            'affiliateCode' => $updatedUser['affiliateCode']
        ]]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/run-expiry-check
if ($method === 'POST' && $path === '/api/admin/run-expiry-check') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        $count = DB::checkSubscriptionExpiries();
        echo json_encode(['success' => true, 'expiredCount' => $count]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// If no route matches, return 404
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found: ' . $method . ' ' . $path]);
exit;
