<?php
/**
 * Database access layer for the PHP cPanel backend.
 * Replicates server/db.ts exactly to maintain compatibility with existing MySQL tables.
 */

// Load database configuration from environment variables or use default cPanel credentials
// Use correct cPanel credentials directly to avoid any cPanel environment variable pollution
define('DB_HOST', '131.153.147.178');
define('DB_PORT', '3306');
define('DB_USER', 'zerolord_cinjelly');
define('DB_PASS', '@f33rinimi');
define('DB_NAME', 'zerolord_cinjelly');

class DB {
    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo === null) {
            // Try local connection first (localhost, 127.0.0.1), then fall back to external IP
            $hostsToTry = ['localhost', '127.0.0.1', DB_HOST];

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 2, // 2 second timeout per attempt for fast fallback
            ];

            $lastException = null;
            foreach ($hostsToTry as $host) {
                try {
                    $dsn = "mysql:host=" . $host . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    self::$pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
                    break; // Connection succeeded!
                } catch (PDOException $e) {
                    $lastException = $e;
                }
            }

            if (self::$pdo === null) {
                // Log the exact error internally for debugging
                $logMsg = date('[Y-m-d H:i:s] ') . "DB connection failed. Tried hosts: [" . implode(', ', $hostsToTry) . "]. Error: " . ($lastException ? $lastException->getMessage() : 'Unknown') . "\n";
                @file_put_contents(__DIR__ . '/db_error_log.txt', $logMsg, FILE_APPEND);

                // Return JSON error response if connection fails
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(['error' => 'Database connection failed.']);
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

        // Run ALTER TABLE columns internally to guarantee updates on existing setups
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN isAffiliate TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN affiliateCode VARCHAR(100) NULL UNIQUE");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN referredBy VARCHAR(100) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN disabledAt VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN receiptUrl TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN declineReason TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN transactionRef VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN lastPaymentTime VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN systemNotification TEXT NULL");
        } catch (Exception $e) {}

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

        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN defaultCommission DECIMAL(10,2) NOT NULL DEFAULT 100.00");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN bankAccountNo VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN bankName VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN bankBeneficiary VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN bankInstructions TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN chatbotInfo TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN chatbotInstructions TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN contactEmail VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN contactPhone VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN contactWhatsApp VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN contactOther TEXT NULL");
        } catch (Exception $e) {}

        // Create persistent sessions table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                expiresAt BIGINT NOT NULL,
                jellyfinToken VARCHAR(255) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create commissions table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS commissions (
                id VARCHAR(255) PRIMARY KEY,
                affiliateId VARCHAR(255) NOT NULL,
                referredUserId VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                createdAt VARCHAR(255) NOT NULL,
                updatedAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Seed default Jellyfin configurations if the system_config table is empty
        try {
            $count = $pdo->query("SELECT COUNT(*) FROM system_config")->fetchColumn();
            if ($count == 0) {
                $stmt = $pdo->prepare("
                    INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey, defaultCommission)
                    VALUES ('main', ?, ?, ?, ?, 100.00)
                ");
                $stmt->execute([
                    'https://cinode.zerolord.com',
                    'duwit',
                    '@f33rinimi',
                    '79ee2e15ee1f47fd881188ef4da13391'
                ]);
            }
        } catch (Exception $e) {
            // Ignore seeding errors silently
        }
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

        // Priority 2: Database
        $row = null;
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare('SELECT * FROM system_config WHERE id = "main" LIMIT 1');
            $stmt->execute();
            $row = $stmt->fetch();
        } catch (Exception $e) {
            // Ignore if tables are not set up yet
        }

        if ($row) {
            return [
                'serverUrl' => $envUrl ?: $row['serverUrl'],
                'adminUsername' => $envUsername ?: $row['adminUsername'],
                'adminPasswordFull' => $envPassword ?: $row['adminPasswordFull'],
                'apiKey' => $envApiKey ?: $row['apiKey'],
                'defaultCommission' => isset($row['defaultCommission']) ? (float)$row['defaultCommission'] : 100.00,
                'bankAccountNo' => $row['bankAccountNo'] ?? '',
                'bankName' => $row['bankName'] ?? '',
                'bankBeneficiary' => $row['bankBeneficiary'] ?? '',
                'bankInstructions' => $row['bankInstructions'] ?? '',
                'chatbotInfo' => $row['chatbotInfo'] ?? '',
                'chatbotInstructions' => $row['chatbotInstructions'] ?? '',
                'contactEmail' => $row['contactEmail'] ?? '',
                'contactPhone' => $row['contactPhone'] ?? '',
                'contactWhatsApp' => $row['contactWhatsApp'] ?? '',
                'contactOther' => $row['contactOther'] ?? ''
            ];
        }

        if ($envUrl && $envUsername && $envApiKey) {
            return [
                'serverUrl' => $envUrl,
                'adminUsername' => $envUsername,
                'adminPasswordFull' => $envPassword,
                'apiKey' => $envApiKey,
                'defaultCommission' => 100.00
            ];
        }

        return null;
    }

    public static function saveConfig($config) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('
            INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey, defaultCommission, bankAccountNo, bankName, bankBeneficiary, bankInstructions, chatbotInfo, chatbotInstructions, contactEmail, contactPhone, contactWhatsApp, contactOther)
            VALUES ("main", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                serverUrl = VALUES(serverUrl),
                adminUsername = VALUES(adminUsername),
                adminPasswordFull = VALUES(adminPasswordFull),
                apiKey = VALUES(apiKey),
                defaultCommission = VALUES(defaultCommission),
                bankAccountNo = VALUES(bankAccountNo),
                bankName = VALUES(bankName),
                bankBeneficiary = VALUES(bankBeneficiary),
                bankInstructions = VALUES(bankInstructions),
                chatbotInfo = VALUES(chatbotInfo),
                chatbotInstructions = VALUES(chatbotInstructions),
                contactEmail = VALUES(contactEmail),
                contactPhone = VALUES(contactPhone),
                contactWhatsApp = VALUES(contactWhatsApp),
                contactOther = VALUES(contactOther)
        ');
        $stmt->execute([
            $config['serverUrl'],
            $config['adminUsername'],
            $config['adminPasswordFull'] ?? null,
            $config['apiKey'],
            isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00,
            $config['bankAccountNo'] ?? null,
            $config['bankName'] ?? null,
            $config['bankBeneficiary'] ?? null,
            $config['bankInstructions'] ?? null,
            $config['chatbotInfo'] ?? null,
            $config['chatbotInstructions'] ?? null,
            $config['contactEmail'] ?? null,
            $config['contactPhone'] ?? null,
            $config['contactWhatsApp'] ?? null,
            $config['contactOther'] ?? null
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
                subscriptionStartDate, subscriptionExpiryDate, accountStatus, role,
                isAffiliate, affiliateCode, referredBy, disabledAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            $user['role'] ?? 'user',
            $user['isAffiliate'] ?? 0,
            $user['affiliateCode'] ?? null,
            $user['referredBy'] ?? null,
            $user['disabledAt'] ?? null
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
                        'accountStatus' => 'Expired',
                        'disabledAt' => date(DATE_ISO8601)
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

    public static function getUserByAffiliateCode($code) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(affiliateCode) = ? AND isAffiliate = 1');
        $stmt->execute([strtolower(trim($code))]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function createCommission($commission) {
        $pdo = self::getConnection();
        $id = self::generateUUID();
        $now = date(DATE_ISO8601);
        $stmt = $pdo->prepare('
            INSERT INTO commissions (id, affiliateId, referredUserId, amount, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $commission['affiliateId'],
            $commission['referredUserId'],
            $commission['amount'],
            $commission['status'] ?? 'Pending',
            $now,
            $now
        ]);
        return [
            'id' => $id,
            'affiliateId' => $commission['affiliateId'],
            'referredUserId' => $commission['referredUserId'],
            'amount' => $commission['amount'],
            'status' => $commission['status'] ?? 'Pending',
            'createdAt' => $now,
            'updatedAt' => $now
        ];
    }

    public static function getCommissions() {
        $pdo = self::getConnection();
        $stmt = $pdo->query('SELECT * FROM commissions ORDER BY createdAt DESC');
        return $stmt->fetchAll();
    }

    public static function getCommissionsByAffiliate($affiliateId) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM commissions WHERE affiliateId = ? ORDER BY createdAt DESC');
        $stmt->execute([$affiliateId]);
        return $stmt->fetchAll();
    }

    public static function updateCommissionStatus($id, $status) {
        $pdo = self::getConnection();
        $now = date(DATE_ISO8601);
        $stmt = $pdo->prepare('UPDATE commissions SET status = ?, updatedAt = ? WHERE id = ?');
        $stmt->execute([$status, $now, $id]);
    }
}
