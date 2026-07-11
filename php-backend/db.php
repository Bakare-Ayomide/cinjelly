<?php
/**
 * Database access layer for the PHP cPanel backend.
 * Replicates server/db.ts exactly to maintain compatibility with existing MySQL tables.
 */

// Load database configuration from environment variables or use default cPanel credentials
define('DB_HOST', getenv('DB_HOST') ?: '131.153.147.178');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_USER', getenv('DB_USER') ?: 'zerolord_cinjelly');
define('DB_PASS', getenv('DB_PASSWORD') ?: '@f33rinimi');
define('DB_NAME', getenv('DB_NAME') ?: 'zerolord_cinjelly');

class DB {
    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo === null) {
            try {
                $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ];
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (PDOException $e) {
                // Return JSON error response if connection fails
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
                exit;
            }
        }
        return self::$pdo;
    }

    public static function initDb() {
        $pdo = self::getConnection();
        
        // Create users table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                fullName VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                passwordHash VARCHAR(255) NOT NULL,
                jellyfinUserId VARCHAR(255) NULL,
                subscriptionStatus VARCHAR(50) NOT NULL DEFAULT 'Disabled',
                paymentStatus VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
                registrationDate VARCHAR(255) NOT NULL,
                subscriptionStartDate VARCHAR(255) NULL,
                subscriptionExpiryDate VARCHAR(255) NULL,
                accountStatus VARCHAR(50) NOT NULL DEFAULT 'Disabled',
                role VARCHAR(50) NOT NULL DEFAULT 'user'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create system_config table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS system_config (
                id VARCHAR(255) PRIMARY KEY,
                serverUrl VARCHAR(255) NOT NULL,
                adminUsername VARCHAR(255) NOT NULL,
                adminPasswordFull TEXT NULL,
                apiKey TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create persistent sessions table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                expiresAt BIGINT NOT NULL,
                jellyfinToken VARCHAR(255) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    public static function hashPassword($password) {
        $salt = bin2hex(random_bytes(16));
        // PBKDF2 SHA-512, 1000 iterations, 64-byte key length (128 hex characters)
        $hash = hash_pbkdf2('sha512', $password, $salt, 1000, 128, false);
        return "$salt:$hash";
    }

    public static function verifyPassword($password, $storedHash) {
        $parts = explode(':', $storedHash);
        if (count($parts) < 2) return false;
        $salt = $parts[0];
        $hash = $parts[1];
        $verifyHash = hash_pbkdf2('sha512', $password, $salt, 1000, 128, false);
        return hash_equals($hash, $verifyHash);
    }

    public static function generateUUID() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    public static function getConfig() {
        // Priority 1: Environment variables
        $envUrl = getenv('JELLYFIN_SERVER_URL');
        $envUsername = getenv('JELLYFIN_ADMIN_USERNAME');
        $envPassword = getenv('JELLYFIN_ADMIN_PASSWORD');
        $envApiKey = getenv('JELLYFIN_API_KEY');

        if ($envUrl && $envUsername && $envApiKey) {
            return [
                'serverUrl' => $envUrl,
                'adminUsername' => $envUsername,
                'adminPasswordFull' => $envPassword,
                'apiKey' => $envApiKey
            ];
        }

        // Priority 2: Database
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM system_config WHERE id = "main" LIMIT 1');
        $stmt->execute();
        $row = $stmt->fetch();
        if ($row) {
            return [
                'serverUrl' => $row['serverUrl'],
                'adminUsername' => $row['adminUsername'],
                'adminPasswordFull' => $row['adminPasswordFull'],
                'apiKey' => $row['apiKey']
            ];
        }
        return null;
    }

    public static function saveConfig($config) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey)
            VALUES ("main", ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                serverUrl = VALUES(serverUrl),
                adminUsername = VALUES(adminUsername),
                adminPasswordFull = VALUES(adminPasswordFull),
                apiKey = VALUES(apiKey)
        ');
        $stmt->execute([
            $config['serverUrl'],
            $config['adminUsername'],
            $config['adminPasswordFull'] ?? null,
            $config['apiKey']
        ]);
    }

    public static function getUsers() {
        $pdo = self::getConnection();
        $stmt = $pdo->query('SELECT * FROM users');
        return $stmt->fetchAll();
    }

    public static function getUserById($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getUserByUsername($username) {
        $pdo = self::getConnection();
        $cleanUsername = strtolower(trim($username));
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(username) = ?');
        $stmt->execute([$cleanUsername]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getUserByEmail($email) {
        $pdo = self::getConnection();
        $cleanEmail = strtolower(trim($email));
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = ?');
        $stmt->execute([$cleanEmail]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function createUser($user) {
        $pdo = self::getConnection();
        $id = self::generateUUID();
        $registrationDate = date(DATE_ISO8601);
        
        $stmt = $pdo->prepare('
            INSERT INTO users (
                id, fullName, username, email, passwordHash, jellyfinUserId, 
                subscriptionStatus, paymentStatus, registrationDate, 
                subscriptionStartDate, subscriptionExpiryDate, accountStatus, role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $stmt->execute([
            $id,
            $user['fullName'],
            $user['username'],
            $user['email'],
            $user['passwordHash'],
            $user['jellyfinUserId'] ?? null,
            $user['subscriptionStatus'] ?? 'Disabled',
            $user['paymentStatus'] ?? 'Unpaid',
            $registrationDate,
            $user['subscriptionStartDate'] ?? null,
            $user['subscriptionExpiryDate'] ?? null,
            $user['accountStatus'] ?? 'Disabled',
            $user['role'] ?? 'user'
        ]);

        return array_merge($user, [
            'id' => $id,
            'registrationDate' => $registrationDate
        ]);
    }

    public static function updateUser($id, $updates) {
        $pdo = self::getConnection();
        if (empty($updates)) {
            return self::getUserById($id);
        }

        $queryParts = [];
        $values = [];

        foreach ($updates as $key => $val) {
            $queryParts[] = "`$key` = ?";
            $values[] = $val;
        }

        $values[] = $id;

        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $queryParts) . " WHERE id = ?");
        $stmt->execute($values);

        return self::getUserById($id);
    }

    public static function deleteUser($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    public static function getSession($token) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE token = ?');
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if ($row) {
            return [
                'userId' => $row['userId'],
                'expiresAt' => (float)$row['expiresAt'],
                'jellyfinToken' => $row['jellyfinToken'] ?: ''
            ];
        }
        return null;
    }

    public static function createSession($token, $userId, $expiresAt, $jellyfinToken = '') {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO sessions (token, userId, expiresAt, jellyfinToken)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                userId = VALUES(userId),
                expiresAt = VALUES(expiresAt),
                jellyfinToken = VALUES(jellyfinToken)
        ');
        $stmt->execute([$token, $userId, (int)$expiresAt, $jellyfinToken]);
    }

    public static function updateSessionJellyfinToken($token, $jellyfinToken) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('UPDATE sessions SET jellyfinToken = ? WHERE token = ?');
        $stmt->execute([$jellyfinToken, $token]);
    }

    public static function deleteSession($token) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
        $stmt->execute([$token]);
    }

    public static function cleanupExpiredSessions() {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE expiresAt < ?');
        // Convert current milliseconds
        $nowMs = round(microtime(true) * 1000);
        $stmt->execute([$nowMs]);
    }

    public static function checkSubscriptionExpiries() {
        $config = self::getConfig();
        if (!$config) {
            error_log("[Expiry Job] Skipping: Jellyfin not configured.");
            return 0;
        }

        require_once __DIR__ . '/jellyfin.php';
        $jellyfin = new JellyfinService($config);
        $users = self::getUsers();
        $expiredCount = 0;

        foreach ($users as $user) {
            if ($user['role'] === 'admin') continue;

            if ($user['subscriptionStatus'] === 'Active' && !empty($user['subscriptionExpiryDate'])) {
                $expiryTime = strtotime($user['subscriptionExpiryDate']);
                if ($expiryTime < time()) {
                    error_log("[Expiry Job] User " . $user['username'] . " subscription expired. Disabling access...");
                    
                    self::updateUser($user['id'], [
                        'subscriptionStatus' => 'Expired',
                        'accountStatus' => 'Expired'
                    ]);

                    if (!empty($user['jellyfinUserId'])) {
                        try {
                            $jellyfin->setUserDisabledStatus($user['jellyfinUserId'], true);
                            error_log("[Expiry Job] Successfully disabled Jellyfin account for " . $user['username']);
                        } catch (Exception $e) {
                            error_log("[Expiry Job] Failed to disable Jellyfin account for " . $user['username'] . ": " . $e->getMessage());
                        }
                    }
                    $expiredCount++;
                }
            }
        }
        return $expiredCount;
    }
}
