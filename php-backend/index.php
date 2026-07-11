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

try {
    DB::initDb();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
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
        'mysqlError' => null
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
            'error' => 'Jellyfin Server is not configured. Please set the database configurations or environmental variables first.'
        ]);
        exit;
    }

    $jellyfin = new JellyfinService($config);
    if (!$jellyfin->verifyConnection()) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Could not connect to Jellyfin Server using the backend environment credentials. Please check your system variables.'
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
            'apiKey' => ''
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
        
        $serverUrl = $input['serverUrl'] ?? '';
        $adminUsername = $input['adminUsername'] ?? '';
        $adminPasswordFull = $input['adminPasswordFull'] ?? '';
        $apiKey = $input['apiKey'] ?? '';
        
        if (empty($serverUrl) || empty($adminUsername) || empty($apiKey)) {
            http_response_code(400);
            echo json_encode(['error' => 'Server URL, Admin Username, and API Key are required.']);
            exit;
        }
        
        $newConfig = [
            'serverUrl' => $serverUrl,
            'adminUsername' => $adminUsername,
            'adminPasswordFull' => $adminPasswordFull,
            'apiKey' => $apiKey
        ];
        
        $jellyfin = new JellyfinService($newConfig);
        if (!$jellyfin->verifyConnection()) {
            http_response_code(400);
            echo json_encode(['error' => 'Could not connect to the Jellyfin Server with these credentials. Please verify the URL and API Key are correct and that the Jellyfin server is running and accessible.']);
            exit;
        }
        
        DB::saveConfig($newConfig);
        echo json_encode(['success' => true, 'message' => 'Jellyfin configuration updated and saved in the database!']);
        exit;
    }
}

// POST /api/auth/register
if ($method === 'POST' && $path === '/api/auth/register') {
    $fullName = $input['fullName'] ?? '';
    $username = $input['username'] ?? '';
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

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
            'role' => 'user'
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
                'role' => $newUser['role']
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
            'role' => $currentUser['role']
        ],
        'jellyfinToken' => $jellyfinAuthToken
    ]);
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
                'subscriptionExpiryDate' => $expiryDate
            ];
            $isDisabledInJellyfin = false;
        } else if ($action === 'extend') {
            $currentExpiry = !empty($targetUser['subscriptionExpiryDate']) ? strtotime($targetUser['subscriptionExpiryDate']) : time();
            $newExpiryTime = max($currentExpiry, time()) + 30 * 24 * 60 * 60;
            $newExpiryDate = date(DATE_ISO8601, $newExpiryTime);

            $updates = [
                'subscriptionStatus' => 'Active',
                'paymentStatus' => 'Paid',
                'accountStatus' => 'Active',
                'subscriptionExpiryDate' => $newExpiryDate
            ];
            $isDisabledInJellyfin = false;
        } else if ($action === 'disable') {
            $updates = [
                'subscriptionStatus' => 'Disabled',
                'accountStatus' => 'Disabled'
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
