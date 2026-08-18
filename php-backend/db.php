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
    private static $inited = false;

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
        if (self::$inited) return;

        $flagFile = sys_get_temp_dir() . '/cinjelly_db_v2.flag';
        if (file_exists($flagFile) && (time() - filemtime($flagFile) < 3600)) {
            self::$inited = true;
            return;
        }

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
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN emailVerified TINYINT(1) NOT NULL DEFAULT 1");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN verificationToken VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN verificationTokenExpires VARCHAR(255) NULL");
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
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN iosDownloadUrl TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN androidDownloadUrl TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpHost VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpPort INT NOT NULL DEFAULT 587");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpSecure TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpUser VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpPass TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpFromName VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN smtpFromEmail VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN emailVerificationEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN emailVerificationSubject VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN emailVerificationTemplate LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN welcomeEmailSubject VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN welcomeEmailTemplate LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN notificationEmailSubject VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN notificationEmailTemplate LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN monnifyEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN monnifyApiKey VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN monnifyContractCode VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN monnifySecretKey TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN monnifyMode VARCHAR(50) NOT NULL DEFAULT 'live'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN subscriptionAmount DECIMAL(10,2) NOT NULL DEFAULT 600.00");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN customPaymentEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN customPaymentBtnName VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN customPaymentUrl TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN customPaymentTarget VARCHAR(50) NOT NULL DEFAULT '_blank'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN paystackEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN paystackPublicKey VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN paystackSecretKey TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN paystackMode VARCHAR(50) NOT NULL DEFAULT 'live'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSecretKey TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadApiKey TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadMode VARCHAR(50) NOT NULL DEFAULT 'live'");
        } catch (Exception $e) {}

        // Squad SFTP Fallback Configuration Columns
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpEnabled TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpHost VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpPort INT NOT NULL DEFAULT 22");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpUsername VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpPassword TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpPrivateKey LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpRemoteDir VARCHAR(255) NOT NULL DEFAULT '/notifications'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpProcessingDir VARCHAR(255) NOT NULL DEFAULT './storage/sftp'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpGpgPrivateKey LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpGpgPassphrase TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpPollInterval INT NOT NULL DEFAULT 15");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpLastSync VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpLastFile VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpLastTxRef VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpLastError TEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN squadSftpLastStatus VARCHAR(50) NOT NULL DEFAULT 'Idle'");
        } catch (Exception $e) {}

        // Create squad_sftp_logs table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS squad_sftp_logs (
                id VARCHAR(255) PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                filename VARCHAR(255) NULL,
                txRef VARCHAR(255) NULL,
                metadata LONGTEXT NULL,
                createdAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create processed_transactions table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS processed_transactions (
                reference VARCHAR(255) PRIMARY KEY,
                gateway VARCHAR(50) NOT NULL,
                userId VARCHAR(255) NULL,
                amount DECIMAL(10,2) NULL,
                status VARCHAR(50) NOT NULL,
                createdAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create pending_payments table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS pending_payments (
                transactionRef VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                gateway VARCHAR(50) NOT NULL DEFAULT 'squad',
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                createdAt VARCHAR(255) NOT NULL
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

        // Create media_requests table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS media_requests (
                id VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                releaseYear VARCHAR(50) NULL,
                season VARCHAR(50) NULL,
                episode VARCHAR(50) NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                createdAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create broadcast_notifications table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS broadcast_notifications (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                imageUrl TEXT NULL,
                targetType VARCHAR(50) NOT NULL DEFAULT 'all',
                createdAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $pdo->exec("ALTER TABLE broadcast_notifications ADD COLUMN targetUserId VARCHAR(255) NULL");
        } catch (Exception $e) {}

        // Create squad_mandates table for Direct Debit recurring billing
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS squad_mandates (
                id VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                mandateId VARCHAR(255) NOT NULL,
                mandateReference VARCHAR(255) NULL,
                accountNumber VARCHAR(50) NULL,
                bankCode VARCHAR(50) NULL,
                bankName VARCHAR(255) NULL,
                accountName VARCHAR(255) NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 600.00,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                startDate VARCHAR(255) NULL,
                endDate VARCHAR(255) NULL,
                lastDebitDate VARCHAR(255) NULL,
                nextDebitDate VARCHAR(255) NULL,
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
        @file_put_contents($flagFile, '1');
        self::$inited = true;
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

    public static function getBankInfo() {
        return self::getConfig();
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

        if (!$row || !is_array($row)) {
            $row = [];
        }

        return [
            'serverUrl' => !empty($row['serverUrl']) ? $row['serverUrl'] : $envUrl,
            'adminUsername' => !empty($row['adminUsername']) ? $row['adminUsername'] : $envUsername,
            'adminPasswordFull' => !empty($row['adminPasswordFull']) ? $row['adminPasswordFull'] : $envPassword,
            'apiKey' => !empty($row['apiKey']) ? $row['apiKey'] : $envApiKey,
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
            'contactOther' => $row['contactOther'] ?? '',
            'iosDownloadUrl' => $row['iosDownloadUrl'] ?? '',
            'androidDownloadUrl' => $row['androidDownloadUrl'] ?? '',
            'smtpEnabled' => isset($row['smtpEnabled']) ? (int)$row['smtpEnabled'] : 0,
            'smtpHost' => $row['smtpHost'] ?? '',
            'smtpPort' => isset($row['smtpPort']) ? (int)$row['smtpPort'] : 587,
            'smtpSecure' => isset($row['smtpSecure']) ? (int)$row['smtpSecure'] : 0,
            'smtpUser' => $row['smtpUser'] ?? '',
            'smtpPass' => $row['smtpPass'] ?? '',
            'smtpFromName' => $row['smtpFromName'] ?? '',
            'smtpFromEmail' => $row['smtpFromEmail'] ?? '',
            'emailVerificationEnabled' => isset($row['emailVerificationEnabled']) ? (int)$row['emailVerificationEnabled'] : 0,
            'emailVerificationSubject' => $row['emailVerificationSubject'] ?? '',
            'emailVerificationTemplate' => $row['emailVerificationTemplate'] ?? '',
            'welcomeEmailSubject' => $row['welcomeEmailSubject'] ?? '',
            'welcomeEmailTemplate' => $row['welcomeEmailTemplate'] ?? '',
            'notificationEmailSubject' => $row['notificationEmailSubject'] ?? '',
            'notificationEmailTemplate' => $row['notificationEmailTemplate'] ?? '',
            'monnifyEnabled' => isset($row['monnifyEnabled']) ? (int)$row['monnifyEnabled'] : 0,
            'monnifyApiKey' => $row['monnifyApiKey'] ?? '',
            'monnifyContractCode' => $row['monnifyContractCode'] ?? '',
            'monnifySecretKey' => $row['monnifySecretKey'] ?? '',
            'monnifyMode' => $row['monnifyMode'] ?? 'live',
            'subscriptionAmount' => isset($row['subscriptionAmount']) ? (float)$row['subscriptionAmount'] : 600.00,
            'customPaymentEnabled' => isset($row['customPaymentEnabled']) ? (int)$row['customPaymentEnabled'] : 0,
            'customPaymentBtnName' => $row['customPaymentBtnName'] ?? 'Pay via Paystack',
            'customPaymentUrl' => $row['customPaymentUrl'] ?? '',
            'customPaymentTarget' => $row['customPaymentTarget'] ?? '_blank',
            'paystackEnabled' => isset($row['paystackEnabled']) ? (int)$row['paystackEnabled'] : 0,
            'paystackPublicKey' => $row['paystackPublicKey'] ?? '',
            'paystackSecretKey' => $row['paystackSecretKey'] ?? '',
            'paystackMode' => $row['paystackMode'] ?? 'live',
            'squadEnabled' => isset($row['squadEnabled']) ? (int)$row['squadEnabled'] : 0,
            'squadSecretKey' => $row['squadSecretKey'] ?? '',
            'squadApiKey' => $row['squadApiKey'] ?? '',
            'squadMode' => $row['squadMode'] ?? 'live',
            'squadSftpEnabled' => isset($row['squadSftpEnabled']) ? (int)$row['squadSftpEnabled'] : 0,
            'squadSftpHost' => $row['squadSftpHost'] ?? '',
            'squadSftpPort' => isset($row['squadSftpPort']) ? (int)$row['squadSftpPort'] : 22,
            'squadSftpUsername' => $row['squadSftpUsername'] ?? '',
            'squadSftpPassword' => $row['squadSftpPassword'] ?? '',
            'squadSftpPrivateKey' => $row['squadSftpPrivateKey'] ?? '',
            'squadSftpRemoteDir' => $row['squadSftpRemoteDir'] ?? '/notifications',
            'squadSftpProcessingDir' => $row['squadSftpProcessingDir'] ?? './storage/sftp',
            'squadSftpGpgPrivateKey' => $row['squadSftpGpgPrivateKey'] ?? '',
            'squadSftpGpgPassphrase' => $row['squadSftpGpgPassphrase'] ?? '',
            'squadSftpPollInterval' => isset($row['squadSftpPollInterval']) ? (int)$row['squadSftpPollInterval'] : 15,
            'squadSftpLastSync' => $row['squadSftpLastSync'] ?? '',
            'squadSftpLastFile' => $row['squadSftpLastFile'] ?? '',
            'squadSftpLastTxRef' => $row['squadSftpLastTxRef'] ?? '',
            'squadLastError' => $row['squadLastError'] ?? '',
            'squadSftpLastError' => $row['squadSftpLastError'] ?? '',
            'squadSftpLastStatus' => $row['squadSftpLastStatus'] ?? 'Idle'
        ];
    }

    public static function saveConfig($config) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('
            REPLACE INTO system_config (
                id, serverUrl, adminUsername, adminPasswordFull, apiKey, defaultCommission, 
                bankAccountNo, bankName, bankBeneficiary, bankInstructions, 
                chatbotInfo, chatbotInstructions, contactEmail, contactPhone, contactWhatsApp, contactOther, 
                iosDownloadUrl, androidDownloadUrl,
                smtpEnabled, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromName, smtpFromEmail,
                emailVerificationEnabled, emailVerificationSubject, emailVerificationTemplate,
                welcomeEmailSubject, welcomeEmailTemplate, notificationEmailSubject, notificationEmailTemplate,
                monnifyEnabled, monnifyApiKey, monnifyContractCode, monnifySecretKey, monnifyMode, subscriptionAmount,
                customPaymentEnabled, customPaymentBtnName, customPaymentUrl, customPaymentTarget,
                paystackEnabled, paystackPublicKey, paystackSecretKey, paystackMode,
                squadEnabled, squadSecretKey, squadApiKey, squadMode,
                squadSftpEnabled, squadSftpHost, squadSftpPort, squadSftpUsername, squadSftpPassword, squadSftpPrivateKey,
                squadSftpRemoteDir, squadSftpProcessingDir, squadSftpGpgPrivateKey, squadSftpGpgPassphrase,
                squadSftpPollInterval, squadSftpLastSync, squadSftpLastFile, squadSftpLastTxRef, squadSftpLastError, squadSftpLastStatus
            )
            VALUES ("main", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $config['serverUrl'] ?? '',
            $config['adminUsername'] ?? '',
            $config['adminPasswordFull'] ?? null,
            $config['apiKey'] ?? '',
            isset($config['defaultCommission']) ? (float)$config['defaultCommission'] : 100.00,
            $config['bankAccountNo'] ?? '',
            $config['bankName'] ?? '',
            $config['bankBeneficiary'] ?? '',
            $config['bankInstructions'] ?? '',
            $config['chatbotInfo'] ?? '',
            $config['chatbotInstructions'] ?? '',
            $config['contactEmail'] ?? '',
            $config['contactPhone'] ?? '',
            $config['contactWhatsApp'] ?? '',
            $config['contactOther'] ?? '',
            $config['iosDownloadUrl'] ?? '',
            $config['androidDownloadUrl'] ?? '',
            isset($config['smtpEnabled']) ? (int)$config['smtpEnabled'] : 0,
            $config['smtpHost'] ?? '',
            isset($config['smtpPort']) ? (int)$config['smtpPort'] : 587,
            isset($config['smtpSecure']) ? (int)$config['smtpSecure'] : 0,
            $config['smtpUser'] ?? '',
            $config['smtpPass'] ?? '',
            $config['smtpFromName'] ?? '',
            $config['smtpFromEmail'] ?? '',
            isset($config['emailVerificationEnabled']) ? (int)$config['emailVerificationEnabled'] : 0,
            $config['emailVerificationSubject'] ?? '',
            $config['emailVerificationTemplate'] ?? '',
            $config['welcomeEmailSubject'] ?? '',
            $config['welcomeEmailTemplate'] ?? '',
            $config['notificationEmailSubject'] ?? '',
            $config['notificationEmailTemplate'] ?? '',
            isset($config['monnifyEnabled']) ? (int)$config['monnifyEnabled'] : 0,
            $config['monnifyApiKey'] ?? '',
            $config['monnifyContractCode'] ?? '',
            $config['monnifySecretKey'] ?? '',
            $config['monnifyMode'] ?? 'live',
            isset($config['subscriptionAmount']) ? (float)$config['subscriptionAmount'] : 600.00,
            isset($config['customPaymentEnabled']) ? (int)$config['customPaymentEnabled'] : 0,
            $config['customPaymentBtnName'] ?? 'Pay via Paystack',
            $config['customPaymentUrl'] ?? '',
            $config['customPaymentTarget'] ?? '_blank',
            isset($config['paystackEnabled']) ? (int)$config['paystackEnabled'] : 0,
            $config['paystackPublicKey'] ?? '',
            $config['paystackSecretKey'] ?? '',
            $config['paystackMode'] ?? 'live',
            isset($config['squadEnabled']) ? (int)$config['squadEnabled'] : 0,
            $config['squadSecretKey'] ?? '',
            $config['squadApiKey'] ?? '',
            $config['squadMode'] ?? 'live',
            isset($config['squadSftpEnabled']) ? (int)$config['squadSftpEnabled'] : 0,
            $config['squadSftpHost'] ?? '',
            isset($config['squadSftpPort']) ? (int)$config['squadSftpPort'] : 22,
            $config['squadSftpUsername'] ?? '',
            $config['squadSftpPassword'] ?? '',
            $config['squadSftpPrivateKey'] ?? '',
            $config['squadSftpRemoteDir'] ?? '/notifications',
            $config['squadSftpProcessingDir'] ?? './storage/sftp',
            $config['squadSftpGpgPrivateKey'] ?? '',
            $config['squadSftpGpgPassphrase'] ?? '',
            isset($config['squadSftpPollInterval']) ? (int)$config['squadSftpPollInterval'] : 15,
            $config['squadSftpLastSync'] ?? '',
            $config['squadSftpLastFile'] ?? '',
            $config['squadSftpLastTxRef'] ?? '',
            $config['squadSftpLastError'] ?? '',
            $config['squadSftpLastStatus'] ?? 'Idle'
        ]);
    }

    public static function createSftpLog($action, $status, $message, $filename = null, $txRef = null, $metadata = null) {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare('
                INSERT INTO squad_sftp_logs (id, action, status, message, filename, txRef, metadata, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $id = 'sftp_log_' . time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8);
            $stmt->execute([
                $id,
                $action,
                $status,
                $message,
                $filename,
                $txRef,
                $metadata ? (is_string($metadata) ? $metadata : json_encode($metadata)) : null,
                date('c')
            ]);
            return $id;
        } catch (Exception $e) {
            return null;
        }
    }

    public static function getSftpLogs($limit = 100) {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare('SELECT * FROM squad_sftp_logs ORDER BY createdAt DESC LIMIT ?');
            $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll();
        } catch (Exception $e) {
            return [];
        }
    }

    public static function clearSftpLogs() {
        try {
            $pdo = self::getConnection();
            $pdo->exec('DELETE FROM squad_sftp_logs');
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public static function updateSftpStatus($status, $lastFile = null, $lastTxRef = null, $lastError = null) {
        try {
            $pdo = self::getConnection();
            $fields = [
                'squadSftpLastStatus = ?',
                'squadSftpLastSync = ?'
            ];
            $params = [$status, date('c')];

            if ($lastFile !== null) {
                $fields[] = 'squadSftpLastFile = ?';
                $params[] = $lastFile;
            }
            if ($lastTxRef !== null) {
                $fields[] = 'squadSftpLastTxRef = ?';
                $params[] = $lastTxRef;
            }
            if ($lastError !== null) {
                $fields[] = 'squadSftpLastError = ?';
                $params[] = $lastError;
            }

            $params[] = 'main';
            $sql = 'UPDATE system_config SET ' . implode(', ', $fields) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public static function isTransactionProcessed($reference) {
        if (empty($reference)) return false;
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare('SELECT reference FROM processed_transactions WHERE reference = ?');
            $stmt->execute([$reference]);
            return (bool)$stmt->fetchColumn();
        } catch (Exception $e) {
            return false;
        }
    }

    public static function recordProcessedTransaction($reference, $gateway, $userId, $amount, $status) {
        if (empty($reference)) return;
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare('
                INSERT INTO processed_transactions (reference, gateway, userId, amount, status, createdAt)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status)
            ');
            $stmt->execute([
                $reference,
                $gateway,
                $userId ?: null,
                $amount ?: 0,
                $status ?: "success",
                date(DATE_ISO8601)
            ]);
        } catch (Exception $e) {
            error_log("[PHP DB] Error recording processed transaction: " . $e->getMessage());
        }
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

    public static function createMediaRequest($req) {
        $pdo = self::getConnection();
        $id = self::generateUUID();
        $now = date(DATE_ISO8601);
        $stmt = $pdo->prepare('
            INSERT INTO media_requests (id, userId, username, type, title, releaseYear, season, episode, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending", ?)
        ');
        $stmt->execute([
            $id,
            $req['userId'],
            $req['username'],
            $req['type'],
            $req['title'],
            $req['releaseYear'] ?? null,
            $req['season'] ?? null,
            $req['episode'] ?? null,
            $now
        ]);
        return array_merge($req, [
            'id' => $id,
            'status' => 'Pending',
            'createdAt' => $now
        ]);
    }

    public static function getMediaRequests() {
        $pdo = self::getConnection();
        $stmt = $pdo->query('SELECT * FROM media_requests ORDER BY createdAt DESC');
        return $stmt->fetchAll();
    }

    public static function updateMediaRequestStatus($id, $status) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('UPDATE media_requests SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    public static function createBroadcastNotification($notif) {
        $pdo = self::getConnection();
        $id = self::generateUUID();
        $now = date(DATE_ISO8601);
        $stmt = $pdo->prepare('
            INSERT INTO broadcast_notifications (id, title, message, imageUrl, targetType, targetUserId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $notif['title'],
            $notif['message'],
            $notif['imageUrl'] ?? null,
            $notif['targetType'],
            $notif['targetUserId'] ?? null,
            $now
        ]);
        return array_merge($notif, [
            'id' => $id,
            'createdAt' => $now
        ]);
    }

    public static function getBroadcastNotifications() {
        $pdo = self::getConnection();
        $stmt = $pdo->query('SELECT * FROM broadcast_notifications ORDER BY createdAt DESC');
        return $stmt->fetchAll();
    }

    public static function savePendingPayment($record) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO pending_payments (transactionRef, userId, username, email, amount, gateway, status, createdAt)
            VALUES (:transactionRef, :userId, :username, :email, :amount, :gateway, :status, :createdAt)
            ON DUPLICATE KEY UPDATE
              userId = VALUES(userId),
              username = VALUES(username),
              email = VALUES(email),
              amount = VALUES(amount),
              gateway = VALUES(gateway),
              status = VALUES(status)
        ");
        $stmt->execute([
            ':transactionRef' => $record['transactionRef'],
            ':userId' => $record['userId'],
            ':username' => $record['username'],
            ':email' => $record['email'],
            ':amount' => $record['amount'],
            ':gateway' => $record['gateway'] ?? 'squad',
            ':status' => $record['status'] ?? 'pending',
            ':createdAt' => $record['createdAt'] ?? date(DATE_ISO8601)
        ]);
    }

    public static function getPendingPayment($transactionRef) {
        if (empty($transactionRef)) return null;
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM pending_payments WHERE transactionRef = :transactionRef");
        $stmt->execute([':transactionRef' => $transactionRef]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updatePendingPaymentStatus($transactionRef, $status) {
        if (empty($transactionRef)) return;
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("UPDATE pending_payments SET status = :status WHERE transactionRef = :transactionRef");
        $stmt->execute([':status' => $status, ':transactionRef' => $transactionRef]);
    }

    public static function saveSquadMandate($mandate) {
        if (empty($mandate) || empty($mandate['id'])) return;
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO squad_mandates (id, userId, mandateId, mandateReference, accountNumber, bankCode, bankName, accountName, amount, status, startDate, endDate, lastDebitDate, nextDebitDate, createdAt, updatedAt)
            VALUES (:id, :userId, :mandateId, :mandateReference, :accountNumber, :bankCode, :bankName, :accountName, :amount, :status, :startDate, :endDate, :lastDebitDate, :nextDebitDate, :createdAt, :updatedAt)
            ON DUPLICATE KEY UPDATE
              mandateId = VALUES(mandateId),
              mandateReference = VALUES(mandateReference),
              accountNumber = VALUES(accountNumber),
              bankCode = VALUES(bankCode),
              bankName = VALUES(bankName),
              accountName = VALUES(accountName),
              amount = VALUES(amount),
              status = VALUES(status),
              startDate = VALUES(startDate),
              endDate = VALUES(endDate),
              lastDebitDate = VALUES(lastDebitDate),
              nextDebitDate = VALUES(nextDebitDate),
              updatedAt = VALUES(updatedAt)
        ");
        $stmt->execute([
            ':id' => $mandate['id'],
            ':userId' => $mandate['userId'],
            ':mandateId' => $mandate['mandateId'],
            ':mandateReference' => $mandate['mandateReference'] ?? null,
            ':accountNumber' => $mandate['accountNumber'] ?? null,
            ':bankCode' => $mandate['bankCode'] ?? null,
            ':bankName' => $mandate['bankName'] ?? null,
            ':accountName' => $mandate['accountName'] ?? null,
            ':amount' => $mandate['amount'] ?? 600.00,
            ':status' => $mandate['status'] ?? 'pending',
            ':startDate' => $mandate['startDate'] ?? null,
            ':endDate' => $mandate['endDate'] ?? null,
            ':lastDebitDate' => $mandate['lastDebitDate'] ?? null,
            ':nextDebitDate' => $mandate['nextDebitDate'] ?? null,
            ':createdAt' => $mandate['createdAt'] ?? date(DATE_ISO8601),
            ':updatedAt' => $mandate['updatedAt'] ?? date(DATE_ISO8601)
        ]);
    }

    public static function getSquadMandateByUserId($userId) {
        if (empty($userId)) return null;
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM squad_mandates WHERE userId = :userId ORDER BY createdAt DESC LIMIT 1");
        $stmt->execute([':userId' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getSquadMandateByMandateId($mandateId) {
        if (empty($mandateId)) return null;
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM squad_mandates WHERE mandateId = :mandateId OR id = :id LIMIT 1");
        $stmt->execute([':mandateId' => $mandateId, ':id' => $mandateId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updateSquadMandate($idOrMandateId, $updates) {
        if (empty($idOrMandateId) || empty($updates)) return;
        $pdo = self::getConnection();
        $fields = [];
        $params = [];
        foreach ($updates as $k => $v) {
            if ($k !== 'id') {
                $fields[] = "{$k} = :{$k}";
                $params[":{$k}"] = $v;
            }
        }
        $fields[] = "updatedAt = :updatedAt";
        $params[':updatedAt'] = date(DATE_ISO8601);
        $params[':id1'] = $idOrMandateId;
        $params[':id2'] = $idOrMandateId;

        $sql = "UPDATE squad_mandates SET " . implode(', ', $fields) . " WHERE id = :id1 OR mandateId = :id2";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    public static function getAllSquadMandates() {
        $pdo = self::getConnection();
        $stmt = $pdo->query("SELECT * FROM squad_mandates ORDER BY createdAt DESC");
        return $stmt->fetchAll() ?: [];
    }

    public static function getActiveSquadMandatesDueForRenewal() {
        $pdo = self::getConnection();
        $stmt = $pdo->query("SELECT * FROM squad_mandates WHERE status = 'active' ORDER BY createdAt DESC");
        return $stmt->fetchAll() ?: [];
    }
}
