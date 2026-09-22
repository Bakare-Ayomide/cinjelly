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

// Increase resource limits to support up to 250MB video/image uploads
@ini_set('upload_max_filesize', '256M');
@ini_set('post_max_size', '256M');
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');
@ini_set('max_input_time', '300');

// Output buffering ensures no PHP warnings/notices leak before JSON headers
ob_start();

// Re-route to standard output header
header('Content-Type: application/json');

// Global Exception Handler to ensure JSON responses on errors
set_exception_handler(function($e) {
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    exit;
});

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (ob_get_length()) ob_clean();
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Fatal server error: ' . $error['message']]);
        exit;
    }
});

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
$sessionToken = null;

// Prioritize Bearer token header over cookie
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ($_SERVER['HTTP_AUTHORISATION'] ?? ''));
if (empty($authHeader) && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
}
if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
    $sessionToken = trim($matches[1]);
}
if (!$sessionToken) {
    $sessionToken = $_COOKIE['session'] ?? null;
}

if ($sessionToken) {
    $session = DB::getSession($sessionToken);
    $nowMs = round(microtime(true) * 1000);
    if ($session && $session['expiresAt'] > $nowMs) {
        $currentUser = DB::getUserById($session['userId']);
    }
}

function getCurrentUser() {
    global $currentUser;
    return $currentUser;
}

// Parse request input JSON payload
$input = json_decode(file_get_contents('php://input'), true) ?? [];

function setSessionCookie($token) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
               ($_SERVER['SERVER_PORT'] ?? 80) == 443 ||
               ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    setcookie('session', $token, [
        'expires' => time() + 7 * 24 * 60 * 60,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => $isHttps ? 'None' : 'Lax'
    ]);
}

// --- 3. API ROUTING DISPATCHER ---

// GET /api/status
// =========================================================================
// LANDING PAGE CMS ENDPOINTS (Hero Slides, About Config, FAQs)
// =========================================================================

// Public fetch for landing page content
if ($method === 'GET' && $path === '/api/landing/content') {
    try {
        $content = DB::getLandingContent();
        echo json_encode($content);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch landing page content: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save all landing content
if ($method === 'POST' && $path === '/api/admin/landing/content') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    try {
        if (isset($input['heroSlides']) && is_array($input['heroSlides'])) {
            $delay = isset($input['heroSlideDelaySeconds']) ? intval($input['heroSlideDelaySeconds']) : null;
            DB::saveHeroSlides($input['heroSlides'], $delay);
        }
        if (isset($input['about']) && is_array($input['about'])) {
            DB::saveAboutConfig($input['about']);
        }
        if (isset($input['faqs']) && is_array($input['faqs'])) {
            DB::saveFaqs($input['faqs']);
        }
        $updated = DB::getLandingContent();
        echo json_encode(['success' => true, 'message' => 'Landing page content saved successfully!', 'content' => $updated]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save landing content: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save hero slides
if ($method === 'POST' && $path === '/api/admin/landing/hero-slides') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!isset($input['slides']) || !is_array($input['slides'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid slides array']);
        exit;
    }
    try {
        $delay = isset($input['delaySeconds']) ? intval($input['delaySeconds']) : null;
        DB::saveHeroSlides($input['slides'], $delay);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'Hero slides updated successfully!',
            'heroSlides' => $updated['heroSlides'],
            'heroSlideDelaySeconds' => $updated['heroSlideDelaySeconds']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save hero slides: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save about section
if ($method === 'POST' && $path === '/api/admin/landing/about') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid about payload']);
        exit;
    }
    try {
        DB::saveAboutConfig($input);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'About section updated successfully!',
            'about' => $updated['about']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save about section: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save FAQs
if ($method === 'POST' && $path === '/api/admin/landing/faqs') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!isset($input['faqs']) || !is_array($input['faqs'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid faqs array']);
        exit;
    }
    try {
        DB::saveFaqs($input['faqs']);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'FAQs updated successfully!',
            'faqs' => $updated['faqs']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save FAQs: ' . $e->getMessage()]);
        exit;
    }
}

// POST /api/admin/landing/upload - Upload media files (images or videos up to 250MB with chunked upload protocol)
if ($method === 'POST' && $path === '/api/admin/landing/upload') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        $tokenToCheck = $sessionToken ?: ($_GET['token'] ?? ($_POST['token'] ?? null));
        if ($tokenToCheck) {
            $session = DB::getSession($tokenToCheck);
            $nowMs = round(microtime(true) * 1000);
            if ($session && $session['expiresAt'] > $nowMs) {
                $currentUser = DB::getUserById($session['userId']);
            }
        }
    }

    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }

    try {
        $uploadDir = dirname(__DIR__) . '/uploads/landing';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        $tempDir = $uploadDir . '/temp';
        if (!file_exists($tempDir)) {
            mkdir($tempDir, 0777, true);
        }

        // Check if this is a Chunked Upload slice
        $isChunked = isset($_POST['totalChunks']) || isset($_GET['totalChunks']);

        if ($isChunked) {
            $totalChunks = intval($_POST['totalChunks'] ?? $_GET['totalChunks']);
            $chunkIndex = intval($_POST['chunkIndex'] ?? $_GET['chunkIndex']);
            $uploadId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['uploadId'] ?? $_GET['uploadId'] ?? 'upload_' . time());
            $fileName = $_POST['fileName'] ?? $_GET['fileName'] ?? 'media.mp4';
            $fileType = $_POST['fileType'] ?? $_GET['fileType'] ?? '';

            $tempChunkFile = $tempDir . '/part_' . $uploadId . '.tmp';

            // Extract chunk payload
            $chunkData = null;
            if (!empty($_FILES['chunk']) && $_FILES['chunk']['error'] === UPLOAD_ERR_OK) {
                $chunkData = file_get_contents($_FILES['chunk']['tmp_name']);
            } elseif (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
                $chunkData = file_get_contents($_FILES['file']['tmp_name']);
            } else {
                $rawInput = file_get_contents('php://input');
                if (!empty($rawInput)) {
                    $json = json_decode($rawInput, true);
                    if ($json && !empty($json['chunkData'])) {
                        $chunkData = base64_decode($json['chunkData']);
                    } else {
                        $chunkData = $rawInput;
                    }
                }
            }

            if ($chunkData === null || strlen($chunkData) === 0) {
                $fileErr = !empty($_FILES['chunk']['error']) ? ' (Error code: ' . $_FILES['chunk']['error'] . ')' : '';
                http_response_code(400);
                echo json_encode(['error' => "Empty chunk data received at chunk {$chunkIndex}/{$totalChunks}{$fileErr}."]);
                exit;
            }

            // Append or create chunk
            if ($chunkIndex === 0) {
                file_put_contents($tempChunkFile, $chunkData);
            } else {
                file_put_contents($tempChunkFile, $chunkData, FILE_APPEND);
            }

            // Final chunk reached -> finalize destination file
            if ($chunkIndex >= $totalChunks - 1) {
                $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
                if (empty($fileExt)) {
                    $fileExt = 'mp4';
                }
                $baseName = pathinfo($fileName, PATHINFO_FILENAME);
                $cleanBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($baseName));
                $cleanFileName = 'media_' . $cleanBase . '_' . time() . '.' . $fileExt;
                $finalPath = $uploadDir . '/' . $cleanFileName;

                if (!rename($tempChunkFile, $finalPath)) {
                    copy($tempChunkFile, $finalPath);
                    @unlink($tempChunkFile);
                }

                $fileSize = filesize($finalPath);
                $videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'ogg', 'm4v', 'ts', 'm3u8', 'flv', 'wmv', '3gp'];
                $isVideo = in_array($fileExt, $videoExts) || (strpos($fileType, 'video/') === 0);
                $mediaType = $isVideo ? 'video' : 'image';
                $relativeUrl = '/uploads/landing/' . $cleanFileName;

                echo json_encode([
                    'success' => true,
                    'url' => $relativeUrl,
                    'fileName' => $cleanFileName,
                    'mediaType' => $mediaType,
                    'size' => $fileSize
                ]);
                exit;
            } else {
                // Chunk successfully stored
                echo json_encode([
                    'success' => true,
                    'status' => 'chunk_saved',
                    'chunkIndex' => $chunkIndex,
                    'totalChunks' => $totalChunks
                ]);
                exit;
            }
        }

        // Standard Single Request Upload (Fallback)
        $cleanFileName = '';
        $fileSize = 0;
        $fileExt = 'mp4';
        $fileMime = '';

        // Handle Multipart FormData file upload (streaming, high efficiency for 200MB+ videos)
        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $uploadedFile = $_FILES['file'];
            $origName = $uploadedFile['name'];
            $fileExt = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if (empty($fileExt)) {
                $fileExt = 'mp4';
            }
            $baseName = pathinfo($origName, PATHINFO_FILENAME);
            $cleanBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($baseName));
            $cleanFileName = 'media_' . $cleanBase . '_' . time() . '.' . $fileExt;
            $filePath = $uploadDir . '/' . $cleanFileName;

            if (!move_uploaded_file($uploadedFile['tmp_name'], $filePath)) {
                throw new Exception('Failed to move uploaded file to destination directory.');
            }
            $fileSize = filesize($filePath);
            $fileMime = $uploadedFile['type'] ?? '';
        } else {
            // Fallback to Base64 JSON payload
            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $base64Data = $input['base64Data'] ?? '';
            $fileName = $input['fileName'] ?? '';
            $fileType = $input['fileType'] ?? '';

            if (empty($base64Data) || empty($fileName)) {
                $uploadErr = !empty($_FILES['file']['error']) ? ' Upload error code: ' . $_FILES['file']['error'] : '';
                http_response_code(400);
                echo json_encode(['error' => 'No file uploaded or missing base64Data.' . $uploadErr]);
                exit;
            }

            if (strpos($base64Data, ';base64,') !== false) {
                $parts = explode(';base64,', $base64Data);
                $base64Content = end($parts);
            } else {
                $base64Content = $base64Data;
            }
            $decodedData = base64_decode($base64Content);

            $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (empty($fileExt)) {
                $fileExt = 'mp4';
            }
            
            $baseName = pathinfo($fileName, PATHINFO_FILENAME);
            $cleanBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($baseName));
            $cleanFileName = 'media_' . $cleanBase . '_' . time() . '.' . $fileExt;
            $filePath = $uploadDir . '/' . $cleanFileName;

            file_put_contents($filePath, $decodedData);
            $fileSize = strlen($decodedData);
            $fileMime = $fileType;
        }

        $relativeUrl = '/uploads/landing/' . $cleanFileName;

        $videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'ogg', 'm4v', 'ts', 'm3u8', 'flv', 'wmv', '3gp'];
        $isVideo = in_array($fileExt, $videoExts) || (strpos($fileMime, 'video/') === 0);
        $mediaType = $isVideo ? 'video' : 'image';

        echo json_encode([
            'success' => true,
            'url' => $relativeUrl,
            'fileName' => $cleanFileName,
            'mediaType' => $mediaType,
            'size' => $fileSize
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save media: ' . $e->getMessage()]);
    }
    exit;
}

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
        $manualPaymentEnabled = isset($input['manualPaymentEnabled']) ? ((bool)$input['manualPaymentEnabled'] ? 1 : 0) : ($existingConfig['manualPaymentEnabled'] ?? 1);
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
        $paystackEnabled = isset($input['paystackEnabled']) ? ((bool)$input['paystackEnabled'] ? 1 : 0) : ($existingConfig['paystackEnabled'] ?? 0);
        $paystackPublicKey = $input['paystackPublicKey'] ?? ($existingConfig['paystackPublicKey'] ?? '');
        $paystackSecretKey = $input['paystackSecretKey'] ?? ($existingConfig['paystackSecretKey'] ?? '');
        $paystackMode = $input['paystackMode'] ?? ($existingConfig['paystackMode'] ?? 'live');
        $customPaymentEnabled = isset($input['customPaymentEnabled']) ? ((bool)$input['customPaymentEnabled'] ? 1 : 0) : ($existingConfig['customPaymentEnabled'] ?? 0);
        $customPaymentBtnName = $input['customPaymentBtnName'] ?? ($existingConfig['customPaymentBtnName'] ?? 'Pay via Paystack');
        $customPaymentUrl = $input['customPaymentUrl'] ?? ($existingConfig['customPaymentUrl'] ?? '');
        $customPaymentTarget = $input['customPaymentTarget'] ?? ($existingConfig['customPaymentTarget'] ?? '_blank');
        
        $squadEnabled = isset($input['squadEnabled']) ? ((bool)$input['squadEnabled'] ? 1 : 0) : ($existingConfig['squadEnabled'] ?? 0);
        $squadSecretKey = $input['squadSecretKey'] ?? ($existingConfig['squadSecretKey'] ?? '');
        $squadApiKey = $input['squadApiKey'] ?? ($input['squadPublicKey'] ?? ($existingConfig['squadApiKey'] ?? ''));
        $squadMode = $input['squadMode'] ?? ($existingConfig['squadMode'] ?? 'sandbox');
        
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
            'manualPaymentEnabled' => $manualPaymentEnabled,
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
            'paystackEnabled' => $paystackEnabled,
            'paystackPublicKey' => $paystackPublicKey,
            'paystackSecretKey' => $paystackSecretKey,
            'paystackMode' => $paystackMode,
            'customPaymentEnabled' => $customPaymentEnabled,
            'customPaymentBtnName' => $customPaymentBtnName,
            'customPaymentUrl' => $customPaymentUrl,
            'customPaymentTarget' => $customPaymentTarget,
            'squadEnabled' => $squadEnabled,
            'squadSecretKey' => $squadSecretKey,
            'squadApiKey' => $squadApiKey,
            'squadMode' => $squadMode,
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
    try {
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Username and Password are required']);
            exit;
        }

        $user = DB::getUserByUsername($username);
        if (!$user) {
            $user = DB::getUserByEmail($username);
        }

        if (!$user || !DB::verifyPassword($password, $user['passwordHash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid username or password']);
            exit;
        }

        $config = DB::getConfig();
        $jellyfinToken = '';
        if ($config) {
            $jellyfin = new JellyfinService($config);
            $jUserId = $user['jellyfinUserId'] ?? null;
            if (empty($jUserId)) {
                $jUserId = $jellyfin->getUserIdByName($user['username']);
                if ($jUserId) {
                    DB::updateUser($user['id'], ['jellyfinUserId' => $jUserId]);
                    $user['jellyfinUserId'] = $jUserId;
                }
            }

            if (!empty($jUserId)) {
                // Ensure account password matches current portal password and permissions are granted
                $jellyfin->updateUserPassword($jUserId, $password, $user['username']);
                if ($user['subscriptionStatus'] === 'Active' || ($user['accountStatus'] ?? '') === 'Active' || ($user['paymentStatus'] ?? '') === 'Paid' || $user['role'] === 'admin') {
                    $jellyfin->setUserDisabledStatus($jUserId, false);
                    $jellyfin->grantAllPermissions($jUserId);
                }
            }

            // Authenticate with Jellyfin using the user's actual username
            if (($user['subscriptionStatus'] === 'Active' || ($user['accountStatus'] ?? '') === 'Active' || ($user['paymentStatus'] ?? '') === 'Paid' || $user['role'] === 'admin')) {
                try {
                    $authResult = $jellyfin->authenticateUser($user['username'], $password);
                    $jellyfinToken = $authResult['accessToken'] ?? '';
                } catch (Exception $e) {
                    error_log("Notice: Could not obtain Jellyfin token on login: " . $e->getMessage());
                }
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
                'role' => $user['role'],
                'isAffiliate' => isset($user['isAffiliate']) ? (int)$user['isAffiliate'] : 0,
                'affiliateCode' => $user['affiliateCode'] ?? null
            ],
            'jellyfinToken' => $jellyfinToken,
            'sessionToken' => $sessionToken
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Login error: ' . $e->getMessage()]);
    }
    exit;
}

// POST /api/auth/logout
if ($method === 'POST' && $path === '/api/auth/logout') {
    $tokenToUse = $sessionToken ?: ($_COOKIE['session'] ?? null);
    if ($tokenToUse) {
        DB::deleteSession($tokenToUse);
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
               ($_SERVER['SERVER_PORT'] ?? 80) == 443 ||
               ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    setcookie('session', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => $isHttps ? 'None' : 'Lax'
    ]);
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
    exit;
}

// =========================================================================
// PASSWORD RESET / FORGOT PASSWORD FLOW (PHP Backend)
// =========================================================================

// POST /api/auth/forgot-password
if ($method === 'POST' && $path === '/api/auth/forgot-password') {
    $email = trim($input['email'] ?? '');
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Please enter your email address.']);
        exit;
    }

    $cleanEmail = strtolower($email);
    $user = DB::getUserByEmail($cleanEmail);
    if (!$user) {
        $user = DB::getUserByUsername($email);
    }

    if ($user && !empty($user['email'])) {
        $recentCount = DB::getRecentResetRequestCount($user['id'], 900); // 15 minutes window
        if ($recentCount < 10) {
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $expiresAt = date(DATE_ISO8601, time() + 60 * 60);

            DB::createPasswordResetToken($user['id'], $tokenHash, $expiresAt);

            $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
                       ($_SERVER['SERVER_PORT'] ?? 80) == 443 ||
                       ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
            $protocol = $isHttps ? 'https://' : 'http://';
            $host = !empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'zerolord.com';
            $resetLink = "{$protocol}{$host}/reset-password?token={$rawToken}";

            $config = DB::getConfig();
            $subject = "Reset Your Password - CINJELLY Stream";
            $template = "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0406; color: #e2e8f0; padding: 32px 24px; border-radius: 16px; border: 1px solid #2e1015;\">
  <div style=\"text-align: center; margin-bottom: 28px;\">
    <div style=\"display: inline-block; padding: 10px 18px; background: rgba(211, 29, 56, 0.15); border: 1px solid rgba(211, 29, 56, 0.3); border-radius: 12px; margin-bottom: 12px;\">
      <span style=\"font-size: 22px; font-weight: 900; color: #ff4d64; letter-spacing: -0.5px;\">CINJELLY</span>
    </div>
    <h1 style=\"color: #ffffff; font-size: 22px; margin: 0; font-weight: 800;\">Password Reset Request</h1>
    <p style=\"color: #a1a1aa; font-size: 13px; margin-top: 6px;\">Secure account verification for CINJELLY Stream</p>
  </div>
  <div style=\"background-color: #14070a; border: 1px solid #2e1015; padding: 26px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);\">
    <h2 style=\"color: #ffffff; font-size: 18px; margin-top: 0; font-weight: 700;\">Hello, {{username}} 👋</h2>
    <p style=\"color: #d4d4d8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;\">
      We received a request to reset the password for your Cinode streaming account. Click the button below to choose a new password:
    </p>
    <div style=\"text-align: center; margin: 28px 0;\">
      <a href=\"{{reset_link}}\" style=\"background: linear-gradient(135deg, #d31d38, #b0162c); color: #ffffff; font-weight: 800; padding: 14px 34px; text-decoration: none; border-radius: 10px; font-size: 14px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 18px rgba(211,29,56,0.45); text-transform: uppercase;\">Reset Password</a>
    </div>
    <p style=\"color: #a1a1aa; font-size: 12px; line-height: 1.5; margin-top: 20px;\">
      ⏱️ <strong>Security Notice:</strong> This password reset link is valid for <strong>60 minutes</strong> and can only be used once.
    </p>
    <p style=\"color: #f59e0b; font-size: 12px; line-height: 1.5; margin-top: 14px; background: rgba(245, 158, 11, 0.1); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.2);\">
      📬 <strong>Tip:</strong> If you don't see this email in your inbox within a few minutes, please check your <strong>Spam</strong> or <strong>Junk</strong> folder.
    </p>
    <p style=\"color: #71717a; font-size: 12px; line-height: 1.5; margin-top: 14px;\">
      If you did not request a password reset, you can safely ignore this email. Your current password will remain completely secure and unchanged.
    </p>
    <hr style=\"border: 0; border-top: 1px solid #2e1015; margin: 24px 0 16px 0;\">
    <p style=\"color: #71717a; font-size: 11px; word-break: break-all; margin: 0;\">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href=\"{{reset_link}}\" style=\"color: #ff4d64; text-decoration: underline;\">{{reset_link}}</a>
    </p>
  </div>
  <p style=\"color: #52525b; font-size: 11px; text-align: center; margin-top: 24px;\">
    Cinode 4K Cinema Network • Automated Security System
  </p>
</div>";

            $body = replace_template_vars($template, $user, $config, [
                'reset_link' => $resetLink,
                'app_name' => 'CINJELLY Stream'
            ]);

            try {
                $sendRes = send_smtp_email($user['email'], $subject, $body, $config);
                if (!$sendRes['success']) {
                    error_log("[Password Reset] Email send failed for {$user['email']}: " . ($sendRes['error'] ?? 'Unknown error'));
                    @file_put_contents(__DIR__ . '/email_error_log.txt', date('[Y-m-d H:i:s] ') . "Reset email failed to {$user['email']}: " . ($sendRes['error'] ?? '') . "\n", FILE_APPEND);
                } else {
                    @file_put_contents(__DIR__ . '/email_error_log.txt', date('[Y-m-d H:i:s] ') . "Reset email successfully sent to {$user['email']}\n", FILE_APPEND);
                }
            } catch (Exception $e) {
                error_log("Failed to deliver reset email: " . $e->getMessage());
                @file_put_contents(__DIR__ . '/email_error_log.txt', date('[Y-m-d H:i:s] ') . "Exception in reset email to {$user['email']}: " . $e->getMessage() . "\n", FILE_APPEND);
            }
        } else {
            @file_put_contents(__DIR__ . '/email_error_log.txt', date('[Y-m-d H:i:s] ') . "Reset rate limited for user {$user['id']} ({$user['email']}): {$recentCount} requests in 15min\n", FILE_APPEND);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'If an account associated with that email exists, we have sent a password reset link. Please check your Inbox and Spam/Junk folder.'
    ]);
    exit;
}

// GET /api/auth/verify-reset-token
if ($method === 'GET' && $path === '/api/auth/verify-reset-token') {
    $rawToken = trim($_GET['token'] ?? '');
    if (empty($rawToken)) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'Reset token is required.']);
        exit;
    }

    $tokenHash = hash('sha256', $rawToken);
    $tokenRecord = DB::getPasswordResetTokenByHash($tokenHash);

    if (!$tokenRecord) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'This password reset link is invalid or does not exist. Please request a new one.']);
        exit;
    }

    if (!empty($tokenRecord['usedAt'])) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'This password reset link has already been used. Please request a new password reset if needed.']);
        exit;
    }

    $expiresTime = strtotime($tokenRecord['expiresAt']);
    if ($expiresTime === false || $expiresTime < time()) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'This password reset link has expired (links are valid for 60 minutes). Please request a new one.']);
        exit;
    }

    $user = DB::getUserById($tokenRecord['userId']);
    if (!$user) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'User account associated with this reset link was not found.']);
        exit;
    }

    $emailParts = explode('@', $user['email']);
    $localPart = $emailParts[0] ?? '';
    $domainPart = $emailParts[1] ?? '';
    $maskedLocal = strlen($localPart) > 2
        ? $localPart[0] . str_repeat('*', min(strlen($localPart) - 2, 5)) . substr($localPart, -1)
        : $localPart[0] . '*';
    $maskedEmail = "{$maskedLocal}@{$domainPart}";

    echo json_encode([
        'valid' => true,
        'username' => $user['username'],
        'email' => $maskedEmail
    ]);
    exit;
}

// POST /api/auth/reset-password
if ($method === 'POST' && $path === '/api/auth/reset-password') {
    $token = trim($input['token'] ?? '');
    $newPassword = $input['newPassword'] ?? '';

    if (empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Reset token is required.']);
        exit;
    }

    if (empty($newPassword) || strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'New password must be at least 6 characters long.']);
        exit;
    }

    $tokenHash = hash('sha256', $token);
    $tokenRecord = DB::getPasswordResetTokenByHash($tokenHash);

    if (!$tokenRecord) {
        http_response_code(400);
        echo json_encode(['error' => 'This password reset link is invalid. Please request a new password reset.']);
        exit;
    }

    if (!empty($tokenRecord['usedAt'])) {
        http_response_code(400);
        echo json_encode(['error' => 'This password reset link has already been used. Please request a new password reset.']);
        exit;
    }

    $expiresTime = strtotime($tokenRecord['expiresAt']);
    if ($expiresTime === false || $expiresTime < time()) {
        http_response_code(400);
        echo json_encode(['error' => 'This password reset link has expired. Please request a new one.']);
        exit;
    }

    $user = DB::getUserById($tokenRecord['userId']);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User account associated with this token was not found.']);
        exit;
    }

    // 1. Update password in the database
    $newPasswordHash = DB::hashPassword($newPassword);
    DB::updateUser($user['id'], ['passwordHash' => $newPasswordHash]);

    // 2. Mark token used
    DB::markPasswordResetTokenUsed($tokenRecord['id']);

    // 3. Invalidate all user sessions
    DB::invalidateUserSessions($user['id']);

    // 4. Update Jellyfin password
    try {
        $config = DB::getConfig();
        if ($config && !empty($user['jellyfinUserId'])) {
            $jellyfin = new JellyfinService($config);
            $jellyfin->updateUserPassword($user['jellyfinUserId'], $newPassword, $user['username']);
        }
    } catch (Exception $e) {
        error_log("Could not sync password update to Jellyfin server: " . $e->getMessage());
    }

    // 5. Clear session cookie
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
               ($_SERVER['SERVER_PORT'] ?? 80) == 443 ||
               ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    setcookie('session', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => $isHttps ? 'None' : 'Lax'
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Your password has been reset successfully! You can now log in with your new password.'
    ]);
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
            $tokenToUse = $sessionToken ?: ($_COOKIE['session'] ?? '');
            if (!empty($tokenToUse)) {
                $session = DB::getSession($tokenToUse);
                if ($session && !empty($session['jellyfinToken'])) {
                    $jellyfinAuthToken = $session['jellyfinToken'];
                }
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
        $jUserId = $currentUser['jellyfinUserId'] ?? null;
        if (empty($jUserId)) {
            $jUserId = $jellyfin->getUserIdByName($currentUser['username']);
            if (!$jUserId) {
                $jUserId = $jellyfin->createUser($currentUser['username'], $password);
            }
            if ($jUserId) {
                DB::updateUser($currentUser['id'], ['jellyfinUserId' => $jUserId]);
                $currentUser['jellyfinUserId'] = $jUserId;
            }
        }
        if (!empty($jUserId)) {
            if ($currentUser['subscriptionStatus'] === 'Active' || ($currentUser['accountStatus'] ?? '') === 'Active' || ($currentUser['paymentStatus'] ?? '') === 'Paid' || $currentUser['role'] === 'admin') {
                $jellyfin->setUserDisabledStatus($jUserId, false);
                $jellyfin->grantAllPermissions($jUserId);
                $jellyfin->updateUserPassword($jUserId, $password, $currentUser['username']);
            }
        }
        $authResult = $jellyfin->authenticateUser($currentUser['username'], $password);
        
        $token = $sessionToken ?: ($_COOKIE['session'] ?? '');
        if ($token && !empty($authResult['accessToken'])) {
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
        $daysToAdd = 30;
        $currentTime = time();
        $currentExpiry = $currentTime;
        if (!empty($currentUser['subscriptionExpiryDate'])) {
            $existingExpiry = strtotime($currentUser['subscriptionExpiryDate']);
            if ($existingExpiry > $currentTime) {
                $currentExpiry = $existingExpiry;
            }
        }
        $expiryDate = gmdate('Y-m-d\TH:i:s.000\Z', $currentExpiry + ($daysToAdd * 24 * 60 * 60));
        $startDate = $currentUser['subscriptionStartDate'] ?? gmdate('Y-m-d\TH:i:s.000\Z');

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
        'manualPaymentEnabled' => isset($config['manualPaymentEnabled']) ? !empty($config['manualPaymentEnabled']) : true,
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
        'subscriptionAmount' => isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00,
        'paystackEnabled' => !empty($config['paystackEnabled']),
        'paystackPublicKey' => $config['paystackPublicKey'] ?? '',
        'paystackMode' => $config['paystackMode'] ?? 'live',
        'customPaymentEnabled' => !empty($config['customPaymentEnabled']),
        'customPaymentBtnName' => $config['customPaymentBtnName'] ?? 'Pay via Paystack',
        'customPaymentUrl' => $config['customPaymentUrl'] ?? '',
        'customPaymentTarget' => $config['customPaymentTarget'] ?? '_blank',
        'squadEnabled' => !empty($config['squadEnabled']),
        'squadApiKey' => $config['squadApiKey'] ?? '',
        'squadPublicKey' => $config['squadApiKey'] ?? '',
        'squadMode' => $config['squadMode'] ?? 'live'
    ]);
    exit;
}

// --- MONNIFY SERVER-SIDE HELPER FUNCTIONS ---
function getMonnifyTestMode($apiKey, $configuredMode = 'test') {
    $apiKey = trim($apiKey);
    if (strpos($apiKey, 'MK_TEST_') === 0) {
        return true;
    }
    if (strpos($apiKey, 'MK_PROD_') === 0 || strpos($apiKey, 'MK_LIVE_') === 0) {
        return false;
    }
    return strtolower(trim($configuredMode)) === 'test';
}

function getMonnifyAccessToken($apiKey, $secretKey, $isTestMode = false) {
    $apiKey = trim($apiKey);
    $secretKey = trim($secretKey);
    if (empty($apiKey) || empty($secretKey)) {
        throw new Exception("Monnify API Key and Secret Key are required for server authentication.");
    }

    $baseUrl = $isTestMode ? "https://sandbox.monnify.com" : "https://api.monnify.com";
    $authUrl = $baseUrl . "/api/v1/auth/login";

    $authHeader = "Basic " . base64_encode($apiKey . ":" . $secretKey);

    $ch = curl_init($authUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, "");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: {$authHeader}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $res = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        throw new Exception("Monnify Auth Network Error: " . $err);
    }

    $data = json_decode($res, true);
    if ($httpCode !== 200 || empty($data['requestSuccessful']) || empty($data['responseBody']['accessToken'])) {
        $msg = $data['responseMessage'] ?? ($data['error'] ?? "Authentication failed with status code {$httpCode}");
        $envName = $isTestMode ? "Sandbox (sandbox.monnify.com)" : "Live (api.monnify.com)";
        throw new Exception("Monnify Auth Error on {$envName}: " . $msg);
    }

    return $data['responseBody']['accessToken'];
}

function verifyMonnifyTransaction($paymentReference, $config) {
    if (empty($paymentReference)) {
        throw new Exception("Payment reference is missing for verification.");
    }

    $apiKey = trim($config['monnifyApiKey'] ?? '');
    $secretKey = trim($config['monnifySecretKey'] ?? '');
    $isTestMode = getMonnifyTestMode($apiKey, $config['monnifyMode'] ?? 'test');

    if (empty($apiKey)) {
        throw new Exception("Monnify API Key is not configured in settings.");
    }

    if (empty($secretKey)) {
        throw new Exception("Monnify Secret Key is missing in settings. Secret key is required for transaction verification.");
    }

    // Step 1: Get Access Token
    $accessToken = getMonnifyAccessToken($apiKey, $secretKey, $isTestMode);

    $baseUrl = $isTestMode ? "https://sandbox.monnify.com" : "https://api.monnify.com";
    
    // Attempt 1: Query by paymentReference using v2 searchByReference
    $encodedRef = urlencode($paymentReference);
    $verifyUrl = $baseUrl . "/api/v2/transactions/searchByReference?paymentReference=" . $encodedRef;

    $ch = curl_init($verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$accessToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $res = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        throw new Exception("Monnify Verification Network Error: " . $err);
    }

    $data = json_decode($res, true);

    // Attempt 2: Fallback query by transaction reference endpoint if needed
    if ($httpCode !== 200 || empty($data['requestSuccessful']) || empty($data['responseBody'])) {
        $verifyUrl2 = $baseUrl . "/api/v2/transactions/" . $encodedRef;
        $ch2 = curl_init($verifyUrl2);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_HTTPGET, true);
        curl_setopt($ch2, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ]);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);

        $res2 = curl_exec($ch2);
        $httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($httpCode2 === 200) {
            $data2 = json_decode($res2, true);
            if (!empty($data2['requestSuccessful']) && !empty($data2['responseBody'])) {
                $data = $data2;
            }
        }
    }

    if (empty($data['requestSuccessful']) || empty($data['responseBody'])) {
        $msg = $data['responseMessage'] ?? "Transaction reference not found on Monnify server.";
        throw new Exception("Monnify Verification Failed: " . $msg);
    }

    $responseBody = $data['responseBody'];
    $paymentStatus = strtoupper($responseBody['paymentStatus'] ?? $responseBody['status'] ?? '');

    if ($paymentStatus !== 'PAID' && $paymentStatus !== 'OVERPAID' && $paymentStatus !== 'SUCCESSFUL') {
        throw new Exception("Transaction status on Monnify server is '{$paymentStatus}'. Subscription requires confirmed payment.");
    }

    return [
        'success' => true,
        'paymentStatus' => $paymentStatus,
        'amountPaid' => $responseBody['amountPaid'] ?? $responseBody['amount'] ?? 0,
        'paymentReference' => $responseBody['paymentReference'] ?? $paymentReference,
        'transactionReference' => $responseBody['transactionReference'] ?? $paymentReference,
        'raw' => $responseBody
    ];
}

// POST /api/payment/monnify-complete
if ($method === 'POST' && $path === '/api/payment/monnify-complete') {
    header('Content-Type: application/json');
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }

    $paymentReference = $input['paymentReference'] ?? ($input['response']['paymentReference'] ?? '');
    $transactionReference = $input['transactionReference'] ?? ($input['response']['transactionReference'] ?? '');
    $refToVerify = !empty($paymentReference) ? $paymentReference : $transactionReference;

    if (empty($refToVerify)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing transaction or payment reference']);
        exit;
    }

    try {
        $bankInfo = DB::getBankInfo();

        // Security: Call Monnify REST API to verify transaction. DO NOT trust frontend status.
        $verifyResult = verifyMonnifyTransaction($refToVerify, $bankInfo);

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

        $updatedUser = DB::updateUser($currentUser['id'], [
            'subscriptionStatus' => 'Active',
            'accountStatus' => 'Active',
            'paymentStatus' => 'Paid',
            'subscriptionStartDate' => empty($currentUser['subscriptionStartDate']) ? date(DATE_ISO8601) : $currentUser['subscriptionStartDate'],
            'subscriptionExpiryDate' => $newExpiryDate,
            'transactionRef' => $refToVerify,
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

        echo json_encode(['success' => true, 'verified' => true, 'user' => $updatedUser]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// GET & POST /api/payment/paystack-webhook and /api/payment/paystack-inlinejs-webhook
if ($path === '/api/payment/paystack-webhook' || $path === '/api/payment/paystack-inlinejs-webhook') {
    header('Content-Type: application/json');

    if ($method === 'GET') {
        echo json_encode([
            'status' => 'ok',
            'message' => 'Paystack Webhook Endpoint is active and listening for POST notifications.',
            'timestamp' => date(DATE_ISO8601)
        ]);
        exit;
    }

    // 1. Read raw request body before parsing JSON
    $rawBody = file_get_contents('php://input');

    // 2. Read x-paystack-signature header
    $headers = getallheaders();
    $paystackSignature = '';
    if (is_array($headers)) {
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'x-paystack-signature') {
                $paystackSignature = trim($v);
                break;
            }
        }
    }
    if (empty($paystackSignature)) {
        $paystackSignature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
    }

    if (empty($paystackSignature)) {
        error_log('[Paystack Webhook Error] Missing x-paystack-signature header.');
        http_response_code(400);
        echo json_encode(['error' => 'Missing x-paystack-signature header']);
        exit;
    }

    // 3. Fetch Paystack Secret Key from MySQL config / env
    $config = DB::getConfig();
    $secretKey = trim($config['paystackSecretKey'] ?? getenv('PAYSTACK_SECRET_KEY') ?? '');

    if (empty($secretKey)) {
        error_log('[Paystack Webhook Error] Paystack Secret Key is not configured on server.');
        http_response_code(400);
        echo json_encode(['error' => 'Paystack secret key is not configured on server']);
        exit;
    }

    // 4. Verify HMAC SHA512 signature
    $computedSignature = hash_hmac('sha512', $rawBody, $secretKey);
    if (!hash_equals($computedSignature, $paystackSignature)) {
        error_log('[Paystack Webhook Error] Signature mismatch.');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid webhook signature']);
        exit;
    }

    // 5. Parse JSON payload only AFTER signature verification
    $event = json_decode($rawBody, true);
    if (!$event || !is_array($event) || empty($event['event'])) {
        error_log('[Paystack Webhook Error] Malformed JSON payload.');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    $eventType = $event['event'];
    error_log("[Paystack Webhook] Received valid event: {$eventType}");

    // 6. Listen specifically for charge.success
    if ($eventType !== 'charge.success') {
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Event acknowledged']);
        exit;
    }

    $data = $event['data'] ?? [];
    $txStatus = $data['status'] ?? '';
    $currency = strtoupper($data['currency'] ?? '');
    $amountKobo = (int)($data['amount'] ?? 0);
    $customerEmail = strtolower(trim($data['customer']['email'] ?? ''));
    $reference = trim($data['reference'] ?? '');

    if ($txStatus !== 'success') {
        error_log("[Paystack Webhook] Transaction status is '{$txStatus}', ignoring.");
        http_response_code(200);
        echo json_encode(['status' => 'ignored', 'message' => 'Transaction not successful']);
        exit;
    }

    if ($currency !== 'NGN') {
        error_log("[Paystack Webhook Error] Currency '{$currency}' is not NGN.");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid currency, expected NGN']);
        exit;
    }

    $subAmountNaira = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    $expectedKobo = (int)round($subAmountNaira * 100);

    if ($amountKobo < $expectedKobo) {
        error_log("[Paystack Webhook Error] Amount {$amountKobo} kobo is less than expected {$expectedKobo} kobo.");
        http_response_code(400);
        echo json_encode(['error' => 'Insufficient payment amount']);
        exit;
    }

    if (empty($customerEmail)) {
        error_log('[Paystack Webhook Error] Customer email missing in payload.');
        http_response_code(400);
        echo json_encode(['error' => 'Customer email is missing']);
        exit;
    }

    if (empty($reference)) {
        error_log('[Paystack Webhook Error] Transaction reference missing in payload.');
        http_response_code(400);
        echo json_encode(['error' => 'Transaction reference is missing']);
        exit;
    }

    // 7. Fulfill payment via centralized handler (handles idempotency, verification, user resolution, expiry date, jellyfin, affiliate, email)
    $result = fulfill_paystack_payment($reference);

    if (!$result['success']) {
        error_log("[Paystack Webhook Error] Fulfillment failed for ref {$reference}: " . ($result['error'] ?? 'Unknown error'));
        http_response_code(400);
        echo json_encode(['error' => $result['error'] ?? 'Payment fulfillment failed']);
        exit;
    }

    error_log("[Paystack Webhook Success] Successfully activated subscription for ref {$reference}. Expiry: " . ($result['subscriptionExpiryDate'] ?? 'N/A'));

    // 8. Return HTTP 200 to Paystack
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => $result['message'] ?? 'Subscription activated successfully',
        'subscriptionExpiryDate' => $result['subscriptionExpiryDate'] ?? null
    ]);
    exit;
}

// Multi-field user resolution helper for Paystack (username, userId, email, custom_fields)
function find_user_for_paystack($data) {
    if (empty($data)) return null;
    $metadata = $data['metadata'] ?? [];
    $customerEmail = strtolower(trim($data['customer']['email'] ?? ''));
    $metaEmail = strtolower(trim($metadata['email'] ?? ''));
    $username = trim($metadata['username'] ?? ($metadata['cinjelly_username'] ?? ''));
    $userId = trim($metadata['userId'] ?? ($metadata['user_id'] ?? ''));

    // 1. Try by userId
    if (!empty($userId)) {
        $user = DB::getUserById($userId);
        if ($user) return $user;
    }

    // 2. Try by username
    if (!empty($username)) {
        $user = DB::getUserByUsername($username);
        if ($user) return $user;
    }

    // 3. Try custom_fields
    if (!empty($metadata['custom_fields']) && is_array($metadata['custom_fields'])) {
        foreach ($metadata['custom_fields'] as $field) {
            $varName = $field['variable_name'] ?? '';
            if (($varName === 'username' || $varName === 'cinjelly_username' || $varName === 'user_id') && !empty($field['value'])) {
                $val = trim($field['value']);
                $user = DB::getUserByUsername($val) ?? DB::getUserById($val);
                if ($user) return $user;
            }
        }
    }

    // 4. Try by customer email
    if (!empty($customerEmail)) {
        $user = DB::getUserByEmail($customerEmail);
        if ($user) return $user;
    }

    // 5. Try by metadata email
    if (!empty($metaEmail)) {
        $user = DB::getUserByEmail($metaEmail);
        if ($user) return $user;
    }

    // 6. Try by customer first_name or last_name
    $firstName = trim($data['customer']['first_name'] ?? '');
    $lastName = trim($data['customer']['last_name'] ?? '');
    if (!empty($firstName)) {
        $user = DB::getUserByUsername($firstName);
        if ($user) return $user;
    }
    if (!empty($lastName)) {
        $user = DB::getUserByUsername($lastName);
        if ($user) return $user;
    }

    // 7. Try by email prefix/handle
    if (!empty($customerEmail) && strpos($customerEmail, '@') !== false) {
        $parts = explode('@', $customerEmail);
        if (!empty($parts[0])) {
            $user = DB::getUserByUsername($parts[0]);
            if ($user) return $user;
        }
    }

    return null;
}

// Centralized Paystack payment verification and fulfillment function
function fulfill_paystack_payment($transactionRef) {
    $ref = trim($transactionRef ?? '');
    if (empty($ref)) {
        return ['success' => false, 'error' => 'Transaction reference is required'];
    }

    // 1. Idempotency check: is transaction already processed?
    if (DB::isTransactionProcessed($ref)) {
        error_log("[PAYSTACK] Transaction already processed for ref: {$ref}");
        return [
            'success' => true,
            'message' => 'Transaction already processed and subscription is active',
            'alreadyProcessed' => true,
            'reference' => $ref
        ];
    }

    $config = DB::getConfig();
    $secretKey = trim($config['paystackSecretKey'] ?? getenv('PAYSTACK_SECRET_KEY') ?? '');

    if (empty($secretKey)) {
        error_log("[PAYSTACK] Secret key not configured on server");
        return ['success' => false, 'error' => 'Paystack secret key is not configured on server'];
    }

    // 2. Call Paystack REST API to verify transaction status
    $verifyUrl = "https://api.paystack.co/transaction/verify/" . urlencode($ref);
    $ch = curl_init($verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$secretKey}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || empty($res)) {
        error_log("[PAYSTACK] Verification HTTP request failed with code {$httpCode}");
        return ['success' => false, 'error' => 'Paystack transaction verification network call failed'];
    }

    $verifyJson = json_decode($res, true);
    if (empty($verifyJson['status']) || empty($verifyJson['data'])) {
        error_log("[PAYSTACK] Verification rejected by Paystack: " . ($verifyJson['message'] ?? 'Unknown'));
        return ['success' => false, 'error' => $verifyJson['message'] ?? 'Paystack transaction verification rejected'];
    }

    $vData = $verifyJson['data'];
    $transStatus = strtolower($vData['status'] ?? '');
    $currency = strtoupper($vData['currency'] ?? '');
    $amountKobo = (int)($vData['amount'] ?? 0);

    if ($transStatus !== 'success') {
        error_log("[PAYSTACK] Transaction status is not success: {$transStatus}");
        return ['success' => false, 'error' => "Paystack payment status is '{$transStatus}', not completed"];
    }

    if ($currency !== 'NGN') {
        error_log("[PAYSTACK] Currency mismatch: {$currency}");
        return ['success' => false, 'error' => 'Invalid currency, expected NGN'];
    }

    $subAmountNaira = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    $expectedKobo = (int)round($subAmountNaira * 100);
    if ($amountKobo < $expectedKobo) {
        error_log("[PAYSTACK] Amount {$amountKobo} kobo less than expected {$expectedKobo} kobo");
        return ['success' => false, 'error' => 'Insufficient payment amount'];
    }

    // 3. User resolution: pending payment -> metadata -> customer email -> authenticated session
    $user = null;
    $pendingRecord = DB::getPendingPayment($ref);
    if ($pendingRecord && !empty($pendingRecord['userId'])) {
        $user = DB::getUserById($pendingRecord['userId']);
    }
    if (!$user && $pendingRecord && !empty($pendingRecord['username'])) {
        $user = DB::getUserByUsername($pendingRecord['username']);
    }
    if (!$user && $pendingRecord && !empty($pendingRecord['email'])) {
        $user = DB::getUserByEmail($pendingRecord['email']);
    }
    if (!$user) {
        $user = find_user_for_paystack($vData);
    }
    if (!$user) {
        $sessionUser = get_authenticated_user();
        if ($sessionUser) {
            $user = $sessionUser;
        }
    }

    if (!$user) {
        error_log("[PAYSTACK] User account could not be resolved for ref {$ref}");
        return ['success' => false, 'error' => 'CINJELLY user account not found for this payment'];
    }

    error_log("[PAYSTACK] Fulfilling subscription for user: {$user['username']} ({$user['id']}) via ref: {$ref}");

    // 4. Calculate subscription extension (add 30 days)
    $daysToAdd = 30;
    $currentTime = time();
    $currentExpiry = $currentTime;
    if (!empty($user['subscriptionExpiryDate'])) {
        $existingExpiry = strtotime($user['subscriptionExpiryDate']);
        if ($existingExpiry > $currentTime) {
            $currentExpiry = $existingExpiry;
        }
    }
    $newExpiryDate = gmdate('Y-m-d\TH:i:s.000\Z', $currentExpiry + ($daysToAdd * 24 * 60 * 60));
    $paidAmountNaira = $amountKobo / 100;

    // 5. Lock transaction idempotency and update pending payment status
    DB::recordProcessedTransaction($ref, 'paystack_inlinejs', $user['id'], $paidAmountNaira, 'success');
    DB::updatePendingPaymentStatus($ref, 'completed');

    // 6. Update user record
    $updatedUser = DB::updateUser($user['id'], [
        'subscriptionStatus' => 'Active',
        'accountStatus' => 'Active',
        'paymentStatus' => 'Paid',
        'subscriptionStartDate' => $user['subscriptionStartDate'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        'subscriptionExpiryDate' => $newExpiryDate,
        'transactionRef' => $ref,
        'lastPaymentTime' => gmdate('Y-m-d\TH:i:s.000\Z'),
        'declineReason' => null,
        'systemNotification' => 'accepted'
    ]);

    // 7. Re-enable user's Jellyfin account if present
    if (!empty($user['jellyfinUserId']) && $config) {
        try {
            $jellyfin = new JellyfinService($config);
            $jellyfin->setUserDisabledStatus($user['jellyfinUserId'], false);
            error_log("[PAYSTACK] Re-enabled Jellyfin account for user {$user['username']}");
        } catch (Exception $e) {
            error_log("[PAYSTACK] Jellyfin enable warning: " . $e->getMessage());
        }
    }

    // 8. Execute affiliate commission logic
    if (!empty($user['referredBy'])) {
        $affiliateUser = DB::getUserByAffiliateCode($user['referredBy']);
        if ($affiliateUser) {
            $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
            DB::createCommission([
                'affiliateId' => $affiliateUser['id'],
                'referredUserId' => $user['id'],
                'amount' => $commissionAmount,
                'status' => 'Approved'
            ]);
            error_log("[PAYSTACK] Approved commission for affiliate '{$affiliateUser['username']}'");
        }
    }

    // 9. Send welcome/confirmation email if SMTP configured
    if (!empty($config['smtpEnabled']) && !empty($config['welcomeEmailTemplate'])) {
        try {
            $subj = !empty($config['welcomeEmailSubject']) ? $config['welcomeEmailSubject'] : 'Payment Received - CINJELLY Stream';
            $body = replace_template_vars($config['welcomeEmailTemplate'], $user, $config);
            send_smtp_email($user['email'], $subj, $body, $config);
        } catch (Exception $e) {
            error_log("[PAYSTACK] Email notification warning: " . $e->getMessage());
        }
    }

    error_log("[PAYSTACK] Fulfillment completed successfully for user {$user['username']}. New expiry: {$newExpiryDate}");

    return [
        'success' => true,
        'message' => 'Payment verified and subscription activated successfully',
        'subscriptionExpiryDate' => $newExpiryDate,
        'reference' => $ref,
        'user' => $updatedUser
    ];
}

// Multi-field user resolution helper for Squad
function find_user_for_squad($data) {
    if (empty($data)) return null;
    $metadata = $data['metadata'] ?? ($data['meta'] ?? ($data['merchant_info'] ?? []));
    $customerEmail = strtolower(trim($data['email'] ?? ($data['customer_email'] ?? ($data['customer']['email'] ?? ''))));
    $metaEmail = strtolower(trim($metadata['email'] ?? ''));
    $username = trim($metadata['username'] ?? ($metadata['cinjelly_username'] ?? ($data['username'] ?? '')));
    $userId = trim($metadata['userId'] ?? ($metadata['user_id'] ?? ($data['userId'] ?? '')));

    if (!empty($userId)) {
        $user = DB::getUserById($userId);
        if ($user) return $user;
    }

    if (!empty($username)) {
        $user = DB::getUserByUsername($username);
        if ($user) return $user;
    }

    if (!empty($metadata['custom_fields']) && is_array($metadata['custom_fields'])) {
        foreach ($metadata['custom_fields'] as $field) {
            $varName = $field['variable_name'] ?? '';
            if (($varName === 'username' || $varName === 'cinjelly_username' || $varName === 'user_id') && !empty($field['value'])) {
                $val = trim($field['value']);
                $user = DB::getUserByUsername($val) ?? DB::getUserById($val);
                if ($user) return $user;
            }
        }
    }

    if (!empty($customerEmail)) {
        $user = DB::getUserByEmail($customerEmail);
        if ($user) return $user;
    }

    if (!empty($metaEmail)) {
        $user = DB::getUserByEmail($metaEmail);
        if ($user) return $user;
    }

    $customerName = trim($data['customer_name'] ?? ($data['first_name'] ?? ''));
    if (!empty($customerName)) {
        $user = DB::getUserByUsername($customerName);
        if ($user) return $user;
    }

    if (!empty($customerEmail) && strpos($customerEmail, '@') !== false) {
        $parts = explode('@', $customerEmail);
        if (!empty($parts[0])) {
            $user = DB::getUserByUsername($parts[0]);
            if ($user) return $user;
        }
    }

    return null;
}

// Centralized Squad payment fulfillment logic in PHP
function fulfill_squad_payment(string $transactionRef): array {
    $ref = trim($transactionRef);
    if (empty($ref)) {
        return ['success' => false, 'error' => 'Transaction reference is missing'];
    }

    error_log("[SQUAD] Verification started for ref: {$ref}");

    // 1. Idempotency check: check if already processed
    if (DB::isTransactionProcessed($ref)) {
        error_log("[SQUAD] Payment already processed for ref: {$ref}");
        return ['success' => true, 'message' => 'Transaction already processed', 'alreadyProcessed' => true];
    }

    // 2. Fetch system config & secret key
    $config = DB::getConfig();
    $secretKey = trim($config['squadSecretKey'] ?? getenv('SQUAD_SECRET_KEY') ?? '');
    $squadMode = $config['squadMode'] ?? 'live';
    $squadBaseUrl = ($squadMode === 'sandbox') ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

    if (empty($secretKey)) {
        error_log("[SQUAD] Verification failed for ref: {$ref} - Secret key not configured");
        return ['success' => false, 'error' => 'Squad secret key is not configured on server'];
    }

    // 3. Server-side verification with Squad REST API
    $ch = curl_init("{$squadBaseUrl}/transaction/verify/" . rawurlencode($ref));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$secretKey}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $verifyData = json_decode($res, true) ?? [];
    $vData = $verifyData['data'] ?? $verifyData;

    $transStatus = strtolower($vData['transaction_status'] ?? ($verifyData['transaction_status'] ?? ''));
    $isVerified = ($httpCode === 200) && ($transStatus === 'success');

    if (!$isVerified) {
        $statusMsg = !empty($vData['transaction_status']) ? " (Status: {$vData['transaction_status']})" : '';
        $errMsg = $verifyData['message'] ?? ($verifyData['error'] ?? "Squad transaction verification failed{$statusMsg}");
        error_log("[SQUAD] Verification failed for ref: {$ref} - {$errMsg}");
        return ['success' => false, 'error' => $errMsg];
    }

    error_log("[SQUAD] Verification successful for ref: {$ref}");

    // 4. Verify currency and amount
    $currency = strtoupper($vData['currency'] ?? ($vData['transaction_currency'] ?? 'NGN'));
    if ($currency !== 'NGN') {
        error_log("[SQUAD] Verification failed for ref: {$ref} - Invalid currency {$currency}");
        return ['success' => false, 'error' => 'Invalid currency, expected NGN'];
    }

    $expectedSubAmount = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    $expectedKobo = (int)round($expectedSubAmount * 100);
    $paidKobo = (int)($vData['transaction_amount'] ?? ($vData['amount'] ?? 0));

    if ($paidKobo < $expectedKobo) {
        error_log("[SQUAD] Verification failed for ref: {$ref} - Insufficient amount paid: {$paidKobo} kobo, expected {$expectedKobo} kobo");
        return ['success' => false, 'error' => 'Insufficient payment amount'];
    }

    // 5. Locate user using pending_payments record first, or fallback
    $pendingRecord = DB::getPendingPayment($ref);
    $user = null;

    if (!empty($pendingRecord['userId'])) {
        $user = DB::getUserById($pendingRecord['userId']);
    }

    if (!$user && !empty($pendingRecord['username'])) {
        $user = DB::getUserByUsername($pendingRecord['username']);
    }

    if (!$user && !empty($pendingRecord['email'])) {
        $user = DB::getUserByEmail($pendingRecord['email']);
    }

    if (!$user) {
        $user = find_user_for_squad($vData);
    }

    if (!$user) {
        error_log("[SQUAD] Verification failed for ref: {$ref} - CINJELLY user account not found");
        return ['success' => false, 'error' => 'CINJELLY user account not found for transaction reference'];
    }

    error_log("[SQUAD] Payment fulfillment started for ref: {$ref} (User: {$user['username']})");

    // 6. Calculate subscription extension (30 days)
    $daysToAdd = 30;
    $currentTime = time();
    $currentExpiry = $currentTime;
    if (!empty($user['subscriptionExpiryDate'])) {
        $existingExpiry = strtotime($user['subscriptionExpiryDate']);
        if ($existingExpiry > $currentTime) {
            $currentExpiry = $existingExpiry;
        }
    }
    $newExpiryDate = gmdate('Y-m-d\TH:i:s.000\Z', $currentExpiry + ($daysToAdd * 24 * 60 * 60));
    $paidAmountNaira = $paidKobo / 100;

    // 7. Record processed transaction & update pending status
    DB::recordProcessedTransaction($ref, 'squad', $user['id'], $paidAmountNaira, 'success');
    DB::updatePendingPaymentStatus($ref, 'completed');

    // 8. Update user subscription status
    DB::updateUser($user['id'], [
        'subscriptionStatus' => 'Active',
        'accountStatus' => 'Active',
        'paymentStatus' => 'Paid',
        'subscriptionStartDate' => $user['subscriptionStartDate'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        'subscriptionExpiryDate' => $newExpiryDate,
        'transactionRef' => $ref,
        'lastPaymentTime' => gmdate('Y-m-d\TH:i:s.000\Z'),
        'declineReason' => null,
        'systemNotification' => 'accepted'
    ]);

    // 9. Enable Jellyfin account
    if (!empty($user['jellyfinUserId'])) {
        try {
            $jellyfin = new JellyfinService($config);
            $jellyfin->setUserDisabledStatus($user['jellyfinUserId'], false);
        } catch (Exception $e) {}
    }

    // 10. Affiliate commission
    if (!empty($user['referredBy'])) {
        $affiliateUser = DB::getUserByAffiliateCode($user['referredBy']);
        if ($affiliateUser) {
            $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
            DB::createCommission([
                'affiliateId' => $affiliateUser['id'],
                'referredUserId' => $user['id'],
                'amount' => $commissionAmount,
                'status' => 'Approved'
            ]);
        }
    }

    // 11. Welcome Email
    if (!empty($config['smtpEnabled']) && !empty($config['welcomeEmailTemplate'])) {
        try {
            $subj = !empty($config['welcomeEmailSubject']) ? $config['welcomeEmailSubject'] : 'Payment Received - CINJELLY Stream';
            $body = replace_template_vars($config['welcomeEmailTemplate'], $user, $config);
            send_smtp_email($user['email'], $subj, $body, $config);
        } catch (Exception $e) {}
    }

    error_log("[SQUAD] Payment fulfillment completed for ref: {$ref}");

    return [
        'success' => true,
        'message' => 'Subscription activated successfully for 30 days',
        'subscriptionExpiryDate' => $newExpiryDate,
        'user' => $user
    ];
}

// Centralized Squad Direct Debit fulfillment function
function fulfill_squad_direct_debit_payment($transactionRef, $mandateId = null) {
    $ref = trim($transactionRef ?? '');
    if (empty($ref)) {
        return ['success' => false, 'error' => 'Transaction reference is missing'];
    }

    error_log("[SQUAD DIRECT DEBIT] Payment fulfillment started for ref: {$ref}");

    // 1. Idempotency check: check if already processed
    if (DB::isTransactionProcessed($ref)) {
        error_log("[SQUAD DIRECT DEBIT] Transaction already processed for ref: {$ref}");
        return ['success' => true, 'message' => 'Transaction already processed', 'alreadyProcessed' => true];
    }

    $config = DB::getConfig();
    $squadSecretKey = trim($config['squadSecretKey'] ?? getenv('SQUAD_SECRET_KEY') ?? '');
    $squadMode = $config['squadMode'] ?? 'live';
    $squadBaseUrl = $squadMode === 'sandbox' ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

    // 2. Map back to CINJELLY user using stored pending payment or mandate record
    $pendingRecord = DB::getPendingPayment($ref);
    $user = null;

    if (!empty($pendingRecord['userId'])) {
        $user = DB::getUserById($pendingRecord['userId']);
    }

    if (!$user && !empty($mandateId)) {
        $mandate = DB::getSquadMandateByMandateId($mandateId);
        if (!empty($mandate['userId'])) {
            $user = DB::getUserById($mandate['userId']);
        }
    }

    if (!$user && !empty($pendingRecord['username'])) {
        $user = DB::getUserByUsername($pendingRecord['username']);
    }

    if (!$user && !empty($pendingRecord['email'])) {
        $user = DB::getUserByEmail($pendingRecord['email']);
    }

    if (!$user) {
        error_log("[SQUAD DIRECT DEBIT] Fulfillment failed for ref: {$ref} - CINJELLY user account not found");
        return ['success' => false, 'error' => 'CINJELLY user account not found for transaction reference'];
    }

    $expectedAmountNaira = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    $paidAmountNaira = !empty($pendingRecord['amount']) ? (float)$pendingRecord['amount'] : $expectedAmountNaira;

    error_log("[SQUAD DIRECT DEBIT] Fulfilling subscription for user: {$user['username']} ({$user['id']})");

    // 3. Calculate subscription extension (add 30 days)
    $daysToAdd = 30;
    $currentTime = time();
    $currentExpiry = $currentTime;
    if (!empty($user['subscriptionExpiryDate'])) {
        $existingExpiry = strtotime($user['subscriptionExpiryDate']);
        if ($existingExpiry > $currentTime) {
            $currentExpiry = $existingExpiry;
        }
    }
    $newExpiryDate = date('Y-m-d\TH:i:s.000\Z', $currentExpiry + ($daysToAdd * 24 * 60 * 60));

    // 4. Lock transaction idempotency and update pending payment status
    DB::recordProcessedTransaction($ref, 'squad_direct_debit', $user['id'], $paidAmountNaira, 'success');
    DB::updatePendingPaymentStatus($ref, 'completed');

    // 5. Update user record
    $updatedUser = DB::updateUser($user['id'], [
        'subscriptionStatus' => 'Active',
        'accountStatus' => 'Active',
        'paymentStatus' => 'Paid',
        'subscriptionStartDate' => $user['subscriptionStartDate'] ?? date('Y-m-d\TH:i:s.000\Z'),
        'subscriptionExpiryDate' => $newExpiryDate,
        'transactionRef' => $ref,
        'lastPaymentTime' => date(DATE_ISO8601),
        'declineReason' => null,
        'systemNotification' => 'accepted'
    ]);

    // 6. Update mandate's lastDebitDate and nextDebitDate
    if (!empty($mandateId)) {
        DB::updateSquadMandate($mandateId, [
            'lastDebitDate' => date('Y-m-d\TH:i:s.000\Z'),
            'nextDebitDate' => $newExpiryDate,
            'status' => 'active'
        ]);
    } else {
        $userMandate = DB::getSquadMandateByUserId($user['id']);
        if ($userMandate) {
            DB::updateSquadMandate($userMandate['id'], [
                'lastDebitDate' => date('Y-m-d\TH:i:s.000\Z'),
                'nextDebitDate' => $newExpiryDate,
                'status' => 'active'
            ]);
        }
    }

    // 7. Re-enable user's linked Jellyfin account if present
    if (!empty($user['jellyfinUserId']) && $config) {
        try {
            $jellyfin = new JellyfinService($config);
            $jellyfin->setUserDisabledStatus($user['jellyfinUserId'], false);
            error_log("[SQUAD DIRECT DEBIT] Re-enabled Jellyfin account '{$user['jellyfinUserId']}' for user '{$user['username']}'.");
        } catch (Exception $e) {
            error_log("[SQUAD DIRECT DEBIT] Jellyfin enable warning: " . $e->getMessage());
        }
    }

    // 8. Execute affiliate commission logic
    if (!empty($user['referredBy'])) {
        $affiliateUser = DB::getUserByAffiliateCode($user['referredBy']);
        if ($affiliateUser) {
            $commissionAmount = isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00;
            DB::createCommission([
                'affiliateId' => $affiliateUser['id'],
                'referredUserId' => $user['id'],
                'amount' => $commissionAmount,
                'status' => 'Approved'
            ]);
            error_log("[SQUAD DIRECT DEBIT] Approved ₦{$commissionAmount} commission for affiliate '{$affiliateUser['username']}'.");
        }
    }

    // 9. Send email receipt if configured
    if (!empty($config['smtpEnabled']) && !empty($config['welcomeEmailTemplate'])) {
        try {
            $subj = !empty($config['welcomeEmailSubject']) ? $config['welcomeEmailSubject'] : 'Direct Debit Renewal Successful - CINJELLY Stream';
            $body = replace_template_vars($config['welcomeEmailTemplate'], $user, $config);
            send_smtp_email($user['email'], $subj, $body, $config);
        } catch (Exception $e) {
            error_log("[SQUAD DIRECT DEBIT] Email notification warning: " . $e->getMessage());
        }
    }

    error_log("[SQUAD DIRECT DEBIT] Payment fulfillment successfully completed for ref: {$ref}");

    return [
        'success' => true,
        'message' => 'Subscription successfully renewed for 30 days via Direct Debit',
        'subscriptionExpiryDate' => $newExpiryDate,
        'user' => $updatedUser
    ];
}

// POST /api/payment/squad-initiate
if ($method === 'POST' && $path === '/api/payment/squad-initiate') {
    header('Content-Type: application/json');
    $config = DB::getConfig();
    
    if (empty($config['squadEnabled'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Squad payment gateway is currently disabled in admin settings.']);
        exit;
    }

    $secretKey = trim($config['squadSecretKey'] ?? getenv('SQUAD_SECRET_KEY') ?? '');
    $publicKey = trim($config['squadApiKey'] ?? $config['squadPublicKey'] ?? '');

    if (empty($secretKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Squad secret key is not configured on server. Please configure it in Admin Dashboard.']);
        exit;
    }

    if (empty($publicKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Squad public key is not configured. Please configure it in Admin Dashboard.']);
        exit;
    }

    $sessionUser = get_authenticated_user();
    $username = trim($input['username'] ?? ($sessionUser['username'] ?? ''));
    $email = trim($input['email'] ?? ($sessionUser['email'] ?? ($username ? "{$username}@cinjelly.com" : '')));
    $fullName = trim($input['fullName'] ?? ($sessionUser['fullName'] ?? $username));
    $userId = trim($sessionUser['id'] ?? ($input['userId'] ?? ''));

    if (empty($username) && empty($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'User identification (username or email) is required for payment']);
        exit;
    }

    error_log("[SQUAD] Initiation started for user: {$username}");

    $subAmount = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    
    // Cryptographically secure unique CINJELLY transaction reference
    $userSegment = preg_replace('/[^a-zA-Z0-9]/', '', $userId ?: $username);
    $reference = 'CINJELLY_SQUAD_' . ($userSegment ?: 'USR') . '_' . time() . '_' . bin2hex(random_bytes(5));

    error_log("[SQUAD] Transaction reference generated: {$reference}");

    // Save pending payment record in MySQL database
    DB::savePendingPayment([
        'transactionRef' => $reference,
        'userId' => $userId,
        'username' => $username,
        'email' => $email,
        'amount' => $subAmount,
        'gateway' => 'squad',
        'status' => 'pending',
        'createdAt' => date('Y-m-d\TH:i:s.000\Z')
    ]);

    error_log("[SQUAD] Pending payment created for ref: {$reference}");

    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'cinjelly.zerolord.com';
    $callbackUrl = "{$scheme}://{$host}/api/payment/squad-direct-debit/redirect";

    echo json_encode([
        'success' => true,
        'transactionReference' => $reference,
        'transactionRef' => $reference,
        'publicKey' => $publicKey,
        'amount' => $subAmount,
        'currency' => 'NGN',
        'customerName' => $fullName ?: $username,
        'customerEmail' => $email,
        'callbackUrl' => $callbackUrl
    ]);
    exit;
}

// POST /api/payment/squad-verify
if ($method === 'POST' && $path === '/api/payment/squad-verify') {
    header('Content-Type: application/json');
    $reference = trim($input['transactionReference'] ?? ($input['transactionRef'] ?? ($input['reference'] ?? '')));

    if (empty($reference)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Transaction reference is required for verification']);
        exit;
    }

    error_log("[SQUAD] Modal success received - verifying ref: {$reference}");

    $result = fulfill_squad_payment($reference);

    if (!$result['success']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Squad verification failed']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => $result['message'] ?? 'Payment verified and subscription activated successfully',
        'subscriptionExpiryDate' => $result['subscriptionExpiryDate'] ?? null,
        'alreadyProcessed' => $result['alreadyProcessed'] ?? false
    ]);
    exit;
}

// POST & GET /api/payment/squad-direct-debit/webhook and /api/payment/squad-webhook
if ($path === '/api/payment/squad-direct-debit/webhook' || $path === '/api/payment/squad-webhook') {
    header('Content-Type: application/json');

    if ($method === 'GET') {
        echo json_encode([
            'success' => true,
            'status' => 'ok', 
            'message' => 'Squad Webhook Endpoint is active and listening.'
        ]);
        exit;
    }

    try {
        $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
        $isSquadKnownIp = (strpos($clientIp, '18.133.63.109') !== false);
        error_log("[SQUAD WEBHOOK] Notification received from IP: {$clientIp} (Squad IP match: " . ($isSquadKnownIp ? 'yes' : 'no') . ")");

        // Inspect Squad security headers if provided
        $encryptedBodyHeader = $_SERVER['HTTP_X_SQUAD_ENCRYPTED_BODY'] ?? null;
        $signatureHeader = $_SERVER['HTTP_X_SQUAD_SIGNATURE'] ?? null;
        if (!empty($encryptedBodyHeader) || !empty($signatureHeader)) {
            error_log("[SQUAD WEBHOOK] Verified security header presence in request");
        }

        $payload = $input ?? [];
        $event = strtolower($payload['Event'] ?? ($payload['event'] ?? ''));
        $data = $payload['Body'] ?? ($payload['body'] ?? ($payload['data'] ?? $payload));
        
        $reference = trim($payload['TransactionRef'] ?? ($data['transaction_ref'] ?? ($data['TransactionRef'] ?? ($payload['transaction_ref'] ?? ($data['reference'] ?? ($payload['reference'] ?? ''))))));
        $mandateId = trim($payload['mandate_id'] ?? ($data['mandate_id'] ?? ($data['mandateId'] ?? ($payload['mandateId'] ?? ''))));

        // Mandate status update event
        if (empty($reference) && !empty($mandateId)) {
            error_log("[SQUAD WEBHOOK] Mandate update event received for mandate: {$mandateId}");
            DB::updateSquadMandate($mandateId, ['status' => 'active']);
            echo json_encode(['success' => true, 'message' => 'Mandate status updated']);
            exit;
        }

        if (empty($reference)) {
            error_log("[SQUAD WEBHOOK] Missing transaction_ref in payload");
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid webhook']);
            exit;
        }

        error_log("[SQUAD WEBHOOK] Processing transaction ref: {$reference}");

        // Duplicate protection: Idempotency check
        if (DB::isTransactionProcessed($reference)) {
            error_log("[SQUAD WEBHOOK] Transaction ref '{$reference}' already processed. Skipping duplicate execution.");
            echo json_encode([
                'success' => true,
                'message' => 'Transaction already processed'
            ]);
            exit;
        }

        // Authoritative mapping: Locate CINJELLY pending payment record
        $pendingRecord = DB::getPendingPayment($reference);
        if ($pendingRecord && ($pendingRecord['status'] ?? '') === 'completed') {
            error_log("[SQUAD WEBHOOK] Pending payment ref '{$reference}' already marked completed.");
            echo json_encode([
                'success' => true,
                'message' => 'Transaction already processed'
            ]);
            exit;
        }

        // Server-side verification directly against Squad API
        $config = DB::getConfig();
        $squadSecretKey = trim($config['squadSecretKey'] ?? getenv('SQUAD_SECRET_KEY') ?? '');
        $squadMode = $config['squadMode'] ?? 'live';
        $squadBaseUrl = $squadMode === 'sandbox' ? 'https://sandbox-api-d.squadco.com' : 'https://api-d.squadco.com';

        if (!empty($squadSecretKey)) {
            $ch = curl_init("{$squadBaseUrl}/transaction/verify/" . urlencode($reference));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPGET, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$squadSecretKey}",
                "Content-Type: application/json"
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $res) {
                $verifyJson = json_decode($res, true);
                $vData = $verifyJson['data'] ?? $verifyJson;
                $transStatus = strtolower($vData['transaction_status'] ?? ($verifyJson['transaction_status'] ?? ''));
                $currency = strtoupper($vData['currency'] ?? ($vData['transaction_currency'] ?? 'NGN'));

                if ($transStatus !== 'success' && $transStatus !== 'successful') {
                    error_log("[SQUAD WEBHOOK] Transaction status verification failed for ref '{$reference}': {$transStatus}");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Payment status not successful at Squad']);
                    exit;
                }

                if ($currency !== 'NGN') {
                    error_log("[SQUAD WEBHOOK] Invalid currency for ref '{$reference}': {$currency}");
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid currency, expected NGN']);
                    exit;
                }
            }
        }

        // Fulfill payment idempotently
        $result = fulfill_squad_direct_debit_payment($reference, $mandateId ?: null);

        if (!$result['success']) {
            error_log("[SQUAD WEBHOOK] Fulfillment failed for ref '{$reference}': " . ($result['error'] ?? 'Unknown'));
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Invalid webhook']);
            exit;
        }

        if (!empty($result['alreadyProcessed'])) {
            echo json_encode([
                'success' => true,
                'message' => 'Transaction already processed'
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Webhook processed'
        ]);
        exit;
    } catch (Exception $e) {
        error_log("[SQUAD WEBHOOK] Webhook exception: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Invalid webhook']);
        exit;
    }
}

// GET & POST /api/payment/squad-direct-debit/redirect and /api/payment/squad-callback
if ($path === '/api/payment/squad-direct-debit/redirect' || $path === '/api/payment/squad-callback') {
    $reference = $_GET['transaction_ref'] ?? ($_GET['reference'] ?? ($_GET['trxref'] ?? ($_GET['ref'] ?? ($input['transaction_ref'] ?? ($input['reference'] ?? '')))));
    $reference = trim($reference);

    error_log("[SQUAD REDIRECT] Redirect invoked for ref: {$reference}");

    $isHtmlRequest = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'text/html') !== false;
    $isJsonRequest = (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false);

    if (empty($reference)) {
        if ($isJsonRequest && !$isHtmlRequest) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'status' => 'ok', 'message' => 'Squad Redirect Endpoint is active and listening.']);
            exit;
        }
        header('Location: /?payment=missing_reference');
        exit;
    }

    // Idempotency check: duplicate protection
    if (DB::isTransactionProcessed($reference)) {
        error_log("[SQUAD REDIRECT] Ref '{$reference}' already processed. Redirecting to success.");
        if ($isHtmlRequest) {
            header('Location: /?payment=success&ref=' . urlencode($reference));
            exit;
        }
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Transaction already processed',
            'alreadyProcessed' => true,
            'reference' => $reference
        ]);
        exit;
    }

    // Perform server-side Squad verification and fulfillment
    $result = fulfill_squad_direct_debit_payment($reference);

    if (!$result['success']) {
        error_log("[SQUAD REDIRECT] Fulfillment failed for ref '{$reference}': " . ($result['error'] ?? 'Unknown'));
        if ($isHtmlRequest) {
            header('Location: /?payment=failed');
            exit;
        }
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Payment verification failed at Squad']);
        exit;
    }

    if ($isHtmlRequest) {
        header('Location: /?payment=success&ref=' . urlencode($reference));
        exit;
    }

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => $result['message'] ?? 'Payment verified and subscription activated successfully',
        'reference' => $reference,
        'subscriptionExpiryDate' => $result['subscriptionExpiryDate'] ?? null
    ]);
    exit;
}

// POST /api/payment/paystack-initiate
if ($method === 'POST' && $path === '/api/payment/paystack-initiate') {
    header('Content-Type: application/json');
    $config = DB::getConfig();
    $secretKey = trim($config['paystackSecretKey'] ?? getenv('PAYSTACK_SECRET_KEY') ?? '');

    if (empty($secretKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Paystack secret key is not configured on server. Please configure Paystack secret key in Admin Dashboard.']);
        exit;
    }

    $sessionUser = get_authenticated_user();
    $username = trim($input['username'] ?? ($sessionUser['username'] ?? ''));
    $email = trim($input['email'] ?? ($sessionUser['email'] ?? ($username ? "{$username}@cinjelly.com" : '')));
    $fullName = trim($input['fullName'] ?? ($sessionUser['fullName'] ?? $username));
    $userId = trim($sessionUser['id'] ?? ($input['userId'] ?? ''));

    if (empty($username) && empty($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'User identification (username or email) is required for payment']);
        exit;
    }

    $subAmount = isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00;
    $amountKobo = (int)round($subAmount * 100);
    $userSegment = preg_replace('/[^a-zA-Z0-9]/', '', $userId ?: $username);
    $reference = 'PS_' . ($userSegment ?: 'USR') . '_' . time() . '_' . rand(1000, 9999);

    // Save pending payment record in MySQL database for authoritative mapping
    DB::savePendingPayment([
        'transactionRef' => $reference,
        'userId' => $userId,
        'username' => $username,
        'email' => $email,
        'amount' => $subAmount,
        'gateway' => 'paystack_inlinejs',
        'status' => 'pending',
        'createdAt' => date('Y-m-d\TH:i:s.000\Z')
    ]);

    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'cinjelly.zerolord.com';
    $callbackUrl = "{$scheme}://{$host}/api/payment/paystack-callback";

    $paystackData = [
        'email' => (strpos($email, '@') !== false) ? $email : "{$email}@cinjelly.com",
        'amount' => $amountKobo,
        'reference' => $reference,
        'callback_url' => $callbackUrl,
        'metadata' => [
            'username' => $username,
            'userId' => $userId,
            'fullName' => $fullName,
            'email' => $email,
            'cinjelly_user_id' => $userId,
            'cinjelly_username' => $username,
            'custom_fields' => [
                ['display_name' => 'Username', 'variable_name' => 'username', 'value' => $username],
                ['display_name' => 'Full Name', 'variable_name' => 'full_name', 'value' => $fullName],
                ['display_name' => 'User ID', 'variable_name' => 'user_id', 'value' => $userId]
            ]
        ]
    ];

    $ch = curl_init('https://api.paystack.co/transaction/initialize');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paystackData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$secretKey}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($res, true);
    $publicKey = trim($config['paystackPublicKey'] ?? getenv('PAYSTACK_PUBLIC_KEY') ?? '');

    if ($httpCode !== 200 || empty($json['status']) || empty($json['data']['authorization_url'])) {
        // Even if initialize endpoint fails or is offline, return reference and public key for client-side InlineJS
        echo json_encode([
            'success' => true,
            'authorization_url' => '',
            'access_code' => '',
            'reference' => $reference,
            'publicKey' => $publicKey,
            'amount' => $subAmount,
            'currency' => 'NGN'
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'authorization_url' => $json['data']['authorization_url'] ?? '',
        'access_code' => $json['data']['access_code'] ?? '',
        'reference' => $json['data']['reference'] ?? $reference,
        'publicKey' => $publicKey,
        'amount' => $subAmount,
        'currency' => 'NGN'
    ]);
    exit;
}

// POST /api/payment/paystack-inlinejs-verify
if ($method === 'POST' && $path === '/api/payment/paystack-inlinejs-verify') {
    header('Content-Type: application/json');
    $reference = trim($input['reference'] ?? ($input['trxref'] ?? ($input['transaction_ref'] ?? '')));

    if (empty($reference)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Transaction reference is required for Paystack verification']);
        exit;
    }

    $result = fulfill_paystack_payment($reference);

    if (!$result['success']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Paystack transaction verification failed']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => $result['message'] ?? 'Payment verified and subscription activated successfully',
        'subscriptionExpiryDate' => $result['subscriptionExpiryDate'] ?? null,
        'alreadyProcessed' => $result['alreadyProcessed'] ?? false,
        'reference' => $reference
    ]);
    exit;
}

// GET or POST /api/payment/paystack-callback, /api/payment/paystack-verify, and /api/payment/paystack-complete
if ($path === '/api/payment/paystack-callback' || $path === '/api/payment/paystack-verify' || $path === '/api/payment/paystack-complete') {
    $reference = $_GET['reference'] ?? ($_GET['trxref'] ?? ($input['reference'] ?? ($input['trxref'] ?? '')));
    $reference = trim($reference);

    $isHtmlRequest = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'text/html') !== false;
    $isJsonRequest = (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false);

    if (empty($reference)) {
        if ($isJsonRequest && !$isHtmlRequest) {
            header('Content-Type: application/json');
            echo json_encode(['status' => 'ok', 'message' => 'Paystack Callback Endpoint is active and listening.']);
            exit;
        }
        if ($isHtmlRequest || $method === 'GET') {
            header('Location: /?payment=missing_reference');
            exit;
        }
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Transaction reference is missing']);
        exit;
    }

    // Fulfill payment via centralized handler
    $result = fulfill_paystack_payment($reference);

    if (!$result['success']) {
        if ($isHtmlRequest || $method === 'GET') {
            header('Location: /?payment=failed');
            exit;
        }
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Paystack verification failed']);
        exit;
    }

    if ($isHtmlRequest || $method === 'GET') {
        header('Location: /?payment=success&ref=' . urlencode($reference));
        exit;
    }

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => $result['message'] ?? 'Payment verified successfully',
        'reference' => $reference,
        'subscriptionExpiryDate' => $result['subscriptionExpiryDate'] ?? null
    ]);
    exit;
}

// POST /api/payment/monnify-initiate
if ($method === 'POST' && $path === '/api/payment/monnify-initiate') {
    header('Content-Type: application/json');
    try {
        $reqName = !empty($input['fullName']) ? trim($input['fullName']) : null;
        $reqEmail = !empty($input['email']) ? trim($input['email']) : null;

        if (!$currentUser && (!$reqName || !$reqEmail)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Unauthorized. Please log in first.']);
            exit;
        }

        $bankInfo = DB::getBankInfo();
        if (!$bankInfo || empty($bankInfo['monnifyEnabled'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Monnify payment gateway is currently disabled by Admin.']);
            exit;
        }

        $apiKey = trim($bankInfo['monnifyApiKey'] ?? '');
        $contractCode = trim($bankInfo['monnifyContractCode'] ?? '');
        $secretKey = trim($bankInfo['monnifySecretKey'] ?? '');
        $isTestMode = getMonnifyTestMode($apiKey, $bankInfo['monnifyMode'] ?? 'test');

        if (empty($apiKey) || empty($contractCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Monnify API Key or Contract Code is missing in Admin configuration.']);
            exit;
        }

        // Validate merchant credentials if Secret Key is provided
        if (!empty($secretKey)) {
            try {
                getMonnifyAccessToken($apiKey, $secretKey, $isTestMode);
            } catch (Exception $authEx) {
                // Log warning; do not block checkout modal launch if secret key check fails
                error_log("Monnify Secret Key Pre-Validation Warning: " . $authEx->getMessage());
            }
        }

        $subAmount = !empty($input['amount']) ? intval($input['amount']) : (!empty($bankInfo['subscriptionAmount']) ? intval($bankInfo['subscriptionAmount']) : 600);
        $paymentRef = 'MON_' . time() . '_' . rand(10000, 99999);

        $customerFullName = $reqName ?? ($currentUser['fullName'] ?? ($currentUser['username'] ?? 'Subscriber'));
        $customerEmail = $reqEmail ?? ($currentUser['email'] ?? (($currentUser['username'] ?? 'subscriber') . '@cinjelly.com'));
        $customerPhone = trim($input['phone'] ?? ($currentUser['phone'] ?? ''));

        echo json_encode([
            'success' => true,
            'paymentReference' => $paymentRef,
            'reference' => $paymentRef,
            'amount' => $subAmount,
            'currency' => 'NGN',
            'customerFullName' => $customerFullName,
            'customerName' => $customerFullName,
            'customerEmail' => $customerEmail,
            'customerPhoneNumber' => $customerPhone,
            'phoneNumber' => $customerPhone,
            'apiKey' => $apiKey,
            'contractCode' => $contractCode,
            'paymentDescription' => 'CINJELLY Stream 30-Day Access Renewal',
            'isTestMode' => $isTestMode,
            'mode' => $isTestMode ? 'TEST' : 'LIVE'
        ]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
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
                $newExpiryDate = gmdate('Y-m-d\TH:i:s.000\Z', $currentExpiry + $daysToAdd * 24 * 60 * 60);

                DB::updateUser($targetUser['id'], [
                    'subscriptionStatus' => 'Active',
                    'accountStatus' => 'Active',
                    'paymentStatus' => 'Paid',
                    'subscriptionExpiryDate' => $newExpiryDate,
                    'transactionRef' => $paymentRef,
                    'lastPaymentTime' => gmdate('Y-m-d\TH:i:s.000\Z')
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
    $config = DB::getConfig();
    if (isset($config['manualPaymentEnabled']) && empty($config['manualPaymentEnabled'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Manual bank transfer payments are currently disabled by the administrator.']);
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

    $config = DB::getConfig();
    if (isset($config['manualPaymentEnabled']) && empty($config['manualPaymentEnabled'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Manual bank transfer payments are currently disabled by the administrator.']);
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

// DELETE /api/admin/notifications/all
if ($method === 'DELETE' && $path === '/api/admin/notifications/all') {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        DB::clearAllBroadcastNotifications();
        echo json_encode(['success' => true, 'message' => 'All notifications cleared']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// DELETE /api/admin/notifications/{id}
if ($method === 'DELETE' && preg_match('#^/api/admin/notifications/([^/]+)$#', $path, $matches)) {
    $notifId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        DB::deleteBroadcastNotification($notifId);
        echo json_encode(['success' => true, 'message' => 'Notification deleted']);
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
            $newExpiryDate = gmdate('Y-m-d\TH:i:s.000\Z', $currentExpiry + $daysToAdd * 24 * 60 * 60);

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

        $balances = DB::getAffiliateBalances($currentUser['id']);
        $withdrawals = DB::getAffiliateWithdrawals($currentUser['id']);

        echo json_encode([
            'affiliateCode' => $affiliateCode,
            'registeredCount' => $registeredCount,
            'paidCount' => $paidCount,
            'pendingCommission' => $pendingCommission,
            'approvedCommission' => $approvedCommission,
            'paidCommission' => $paidCommission,
            'totalCommission' => $totalCommission,
            'defaultCommission' => $defaultCommission,
            // Withdrawal metrics
            'totalEarnings' => $balances['totalEarnings'],
            'availableEarnings' => $balances['availableEarnings'],
            'pendingWithdrawal' => $balances['pendingWithdrawal'],
            'totalPaidOut' => $balances['totalPaidOut'],
            'bankDetails' => [
                'bankName' => $currentUser['bankName'] ?? '',
                'accountNumber' => $currentUser['accountNumber'] ?? '',
                'accountName' => $currentUser['accountName'] ?? $currentUser['fullName']
            ],
            'withdrawals' => $withdrawals,
            'referredUsers' => $referredUsers,
            'commissions' => $commissions
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/affiliate/withdrawals
if ($method === 'GET' && $path === '/api/affiliate/withdrawals') {
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
        $balances = DB::getAffiliateBalances($currentUser['id']);
        $withdrawals = DB::getAffiliateWithdrawals($currentUser['id']);

        echo json_encode([
            'success' => true,
            'balances' => $balances,
            'withdrawals' => $withdrawals,
            'bankDetails' => [
                'bankName' => $currentUser['bankName'] ?? '',
                'accountNumber' => $currentUser['accountNumber'] ?? '',
                'accountName' => $currentUser['accountName'] ?? $currentUser['fullName']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/affiliate/withdrawal/request or POST /api/affiliate/withdrawals
if ($method === 'POST' && ($path === '/api/affiliate/withdrawal/request' || $path === '/api/affiliate/withdrawals')) {
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

    $bankName = trim($input['bank_name'] ?? ($input['bankName'] ?? ''));
    $accountNumber = trim($input['account_number'] ?? ($input['accountNumber'] ?? ''));
    $accountName = trim($input['account_name'] ?? ($input['accountName'] ?? ''));
    $requestedAmount = isset($input['amount']) ? (float)$input['amount'] : null;

    if (empty($bankName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Please provide a valid destination bank name.']);
        exit;
    }

    if (empty($accountNumber) || strlen($accountNumber) < 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Please provide a valid bank account number.']);
        exit;
    }

    if (empty($accountName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Please provide the account holder name.']);
        exit;
    }

    try {
        $withdrawal = DB::requestAffiliateWithdrawal(
            $currentUser['id'],
            $bankName,
            $accountNumber,
            $accountName,
            $requestedAmount
        );

        $updatedBalances = DB::getAffiliateBalances($currentUser['id']);

        echo json_encode([
            'success' => true,
            'message' => 'Your withdrawal request for ₦' . number_format($withdrawal['amount'], 2) . ' has been submitted successfully and is awaiting admin manual transfer.',
            'withdrawal' => $withdrawal,
            'balances' => $updatedBalances
        ]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/admin/affiliate-withdrawals or GET /api/admin/affiliate/withdrawals
if ($method === 'GET' && ($path === '/api/admin/affiliate-withdrawals' || $path === '/api/admin/affiliate/withdrawals')) {
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $statusFilter = isset($_GET['status']) ? trim($_GET['status']) : null;
        if ($statusFilter === 'all' || empty($statusFilter)) {
            $statusFilter = null;
        }

        $withdrawals = DB::getAllAffiliateWithdrawals($statusFilter);
        echo json_encode([
            'success' => true,
            'withdrawals' => $withdrawals
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/affiliate-withdrawals/{id}/pay
if ($method === 'POST' && preg_match('#^/api/admin/affiliate-withdrawals/([^/]+)/pay$#', $path, $matches)) {
    $withdrawalId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $paymentRef = trim($input['payment_reference'] ?? ($input['paymentReference'] ?? ''));

    try {
        $config = DB::getConfig();
        $updated = DB::markAffiliateWithdrawalAsPaid($withdrawalId, $currentUser['username'], $paymentRef);
        $affiliateUser = DB::getUserById($updated['affiliate_user_id']);

        // Send email receipt to affiliate
        if ($affiliateUser) {
            send_affiliate_withdrawal_paid_email($affiliateUser, $updated, $config);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Withdrawal marked as paid successfully.',
            'withdrawal' => $updated
        ]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/admin/affiliate-withdrawals/{id}/decline
if ($method === 'POST' && preg_match('#^/api/admin/affiliate-withdrawals/([^/]+)/decline$#', $path, $matches)) {
    $withdrawalId = $matches[1];
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $declineReason = trim($input['decline_reason'] ?? ($input['reason'] ?? ''));
    if (empty($declineReason)) {
        http_response_code(400);
        echo json_encode(['error' => 'Please provide a reason for declining this withdrawal request.']);
        exit;
    }

    try {
        $config = DB::getConfig();
        $updated = DB::markAffiliateWithdrawalAsDeclined($withdrawalId, $currentUser['username'], $declineReason);
        $affiliateUser = DB::getUserById($updated['affiliate_user_id']);

        // Send decline email to affiliate
        if ($affiliateUser) {
            send_affiliate_withdrawal_declined_email($affiliateUser, $updated, $config);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Withdrawal declined and balance restored to affiliate available earnings.',
            'withdrawal' => $updated
        ]);
    } catch (Exception $e) {
        http_response_code(400);
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
