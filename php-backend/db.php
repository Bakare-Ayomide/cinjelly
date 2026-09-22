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
        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN manualPaymentEnabled TINYINT(1) NOT NULL DEFAULT 1");
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

        // Create affiliate_withdrawals table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
                id VARCHAR(255) PRIMARY KEY,
                affiliate_user_id VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                bank_name VARCHAR(255) NOT NULL,
                account_number VARCHAR(100) NOT NULL,
                account_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                admin_note TEXT NULL,
                requested_at VARCHAR(255) NOT NULL,
                processed_at VARCHAR(255) NULL,
                processed_by VARCHAR(255) NULL,
                payment_reference VARCHAR(255) NULL,
                decline_reason TEXT NULL,
                created_at VARCHAR(255) NOT NULL,
                updated_at VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        try {
            $pdo->exec("CREATE INDEX idx_affiliate_user_withdrawals ON affiliate_withdrawals (affiliate_user_id)");
        } catch (Exception $e) {}
        try {
            $pdo->exec("CREATE INDEX idx_affiliate_withdrawal_status ON affiliate_withdrawals (status)");
        } catch (Exception $e) {}

        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN bankName VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN accountNumber VARCHAR(100) NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN accountName VARCHAR(255) NULL");
        } catch (Exception $e) {}

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

                try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN heroSlideDelaySeconds INT NOT NULL DEFAULT 5");
        } catch (Exception $e) {}

        // Create landing_hero_slides table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS landing_hero_slides (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                tagline VARCHAR(255) NULL,
                year VARCHAR(50) NULL,
                rating VARCHAR(50) NULL,
                quality VARCHAR(50) NULL,
                duration VARCHAR(100) NULL,
                mediaType VARCHAR(50) NOT NULL DEFAULT 'image',
                mediaUrl TEXT NOT NULL,
                posterUrl TEXT NULL,
                announcement TEXT NULL,
                slideOrder INT NOT NULL DEFAULT 0,
                isActive TINYINT(1) NOT NULL DEFAULT 1,
                createdAt VARCHAR(255) NOT NULL,
                updatedAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create landing_about table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS landing_about (
                id VARCHAR(255) PRIMARY KEY,
                header VARCHAR(255) NOT NULL,
                badge VARCHAR(255) NULL,
                subtitle VARCHAR(255) NULL,
                contentHtml LONGTEXT NOT NULL,
                imageUrl TEXT NULL,
                imageAlt VARCHAR(255) NULL,
                captionTitle VARCHAR(255) NULL,
                captionDesc VARCHAR(255) NULL,
                featurePillsJson TEXT NULL,
                cardsJson TEXT NULL,
                updatedAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Create landing_faqs table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS landing_faqs (
                id VARCHAR(255) PRIMARY KEY,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                faqOrder INT NOT NULL DEFAULT 0,
                isActive TINYINT(1) NOT NULL DEFAULT 1,
                createdAt VARCHAR(255) NOT NULL,
                updatedAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Seed initial slides if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_hero_slides");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $seedSlides = [
                    ['slide-evil-dead', 'EVIL DEAD', 'CINODE 4K STREAMING NETWORK • ₦600 UNLIMITED PASS', '1981 - 2023', '9.9', '4K Remaster', 'Franchise Boxset', 'image', '', '', "Bruce Campbell and Sam Raimi's legendary Evil Dead universe is fully remastered in 4K HDR. Stream unrated cuts and behind-the-scenes specials with zero buffer on Cinode.", 0, 1, $now, $now],
                    ['slide-dune-2', 'DUNE: PART TWO', 'IMAX ENHANCED 4K HDR • 45MBPS DIRECT STREAM', '2024', '9.8', '4K Ultra HD', '2h 46m', 'image', 'https://image.tmdb.org/t/p/original/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg', "Denis Villeneuve's cinematic masterwork is now streaming in full 4K HDR. Experience Paul Atreides' destiny on any TV, PC, or mobile device with zero buffering.", 1, 1, $now, $now],
                    ['slide-stranger-things', 'STRANGER THINGS', 'COMPLETE 4K BINGE • OFFLINE DOWNLOADS READY', '2025', '9.9', '4K BINGE', 'All Seasons', 'image', 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg', 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg', 'Every season of Stranger Things available in stunning 4K HDR. Save full episodes directly to your iOS or Android app to watch on the go without mobile data lag.', 2, 1, $now, $now],
                    ['slide-arcane', 'ARCANE', 'CRITICALLY ACCLAIMED MASTERPIECE • 9.9/10 RATING', '2024', '9.9', '4K HDR', 'Season 1 & 2', 'image', 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg', 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg', 'Experience the visual triumph of Piltover and Zaun. Stream every high-stakes episode in pristine 4K resolution with synchronized English/multi-language subtitles.', 3, 1, $now, $now],
                    ['slide-gladiator', 'GLADIATOR II', 'EPIC ACTION BLOCKBUSTER • UNTHROTTLED PLAYBACK', '2024', '9.4', '4K HDR', '2h 28m', 'image', 'https://image.tmdb.org/t/p/original/euYIwmqkmz95mnXvufEmbL6ovhZ.jpg', 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg', "Lucius enters the Colosseum in Ridley Scott's monumental return to ancient Rome. Stream with instant 1-click seeking and zero buffering on Cinode.", 4, 1, $now, $now]
                ];
                $ins = $pdo->prepare("INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($seedSlides as $s) {
                    $ins->execute($s);
                }
            }
        } catch (Exception $e) {}

        // Seed initial about if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_about");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $ins = $pdo->prepare("INSERT INTO landing_about (id, header, badge, subtitle, contentHtml, imageUrl, imageAlt, captionTitle, captionDesc, featurePillsJson, cardsJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $ins->execute([
                    'main',
                    'About',
                    "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
                    'Cinode: Unthrottled 4K Streaming for Everyone',
                    '<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p><p>With a dedicated 45Mbps direct-play infrastructure, you bypass aggressive streaming compression to enjoy theater-quality audio, crystal-clear visuals, personalized watch histories, and instant movie requests.</p><p>One single ₦600/month pass gives you unhindered access across Smart TVs, Android, iPhone, iPad, Windows, and Mac with synchronized playback and offline mobile downloads.</p>',
                    '',
                    'Cinode 4K Cinema Engine',
                    'Direct Cloud Storage Architecture',
                    '10,000+ Hours of 4K Remastered Cinema & TV Series',
                    json_encode(["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"]),
                    json_encode([
                        ['id' => 'c1', 'title' => 'Zero Buffer Engine', 'desc' => 'Direct-play 45Mbps video streams backed by dedicated high-speed storage. Movies and series launch instantly without waiting.', 'icon' => 'Zap'],
                        ['id' => 'c2', 'title' => 'Any Screen, Everywhere', 'desc' => 'Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device. Seamless playback synchronization.', 'icon' => 'Tv'],
                        ['id' => 'c3', 'title' => 'Offline Downloads', 'desc' => 'Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.', 'icon' => 'Smartphone']
                    ]),
                    $now
                ]);
            }
        } catch (Exception $e) {}

        // Seed initial FAQs if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_faqs");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $seedFaqs = [
                    ['faq-1', 'What is Cinode Streaming Network?', 'Cinode is a high-speed private media streaming portal engineered for smooth, ad-free streaming of curated blockbuster movies, full franchises, and TV series directly on your phone, smart TV, or laptop.', 0, 1, $now, $now],
                    ['faq-2', 'How does the ₦600 subscription work?', 'We keep premium streaming ultra-affordable. A single flat subscription fee of ₦600 unlocks 30 full days of unlimited, ad-free streaming in 4K HDR. You can renew instantly using Paystack, Monnify, Squad, or direct bank transfer.', 1, 1, $now, $now],
                    ['faq-3', 'Can I watch offline on my mobile phone?', 'Yes! Download our official mobile client apps to save your favorite movies and series directly to your device and watch offline anywhere without using mobile data.', 2, 1, $now, $now],
                    ['faq-4', 'How do I connect the Mobile App?', 'When you open the mobile app for the first time, simply enter our Server Address: https://cinode.zerolord.com and sign in with your Cinode portal account credentials.', 3, 1, $now, $now],
                    ['faq-5', 'Can I request movies that are not available?', 'Absolutely! Our portal includes a built-in Content Request system. Simply submit the title you want, and our system will fetch and add it to the library.', 4, 1, $now, $now]
                ];
                $ins = $pdo->prepare("INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
                foreach ($seedFaqs as $f) {
                    $ins->execute($f);
                }
            }
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

        // Create password_reset_tokens table for secure forgot password recovery
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                tokenHash VARCHAR(255) NOT NULL,
                expiresAt VARCHAR(255) NOT NULL,
                usedAt VARCHAR(255) NULL,
                createdAt VARCHAR(255) NOT NULL,
                INDEX idx_reset_token_hash (tokenHash),
                INDEX idx_reset_user_id (userId)
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
            'manualPaymentEnabled' => isset($row['manualPaymentEnabled']) ? (int)$row['manualPaymentEnabled'] : 1,
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
                bankAccountNo, bankName, bankBeneficiary, bankInstructions, manualPaymentEnabled, 
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
            VALUES ("main", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            isset($config['manualPaymentEnabled']) ? (int)$config['manualPaymentEnabled'] : 1,
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

    public static function invalidateUserSessions($userId) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE userId = ?');
        $stmt->execute([$userId]);
    }

    public static function createPasswordResetToken($userId, $tokenHash, $expiresAt) {
        $pdo = self::getConnection();
        $id = 'rst_' . time() . '_' . bin2hex(random_bytes(4));
        $createdAt = date(DATE_ISO8601);

        $stmt = $pdo->prepare("
            INSERT INTO password_reset_tokens (id, userId, tokenHash, expiresAt, usedAt, createdAt)
            VALUES (?, ?, ?, ?, NULL, ?)
        ");
        $stmt->execute([$id, $userId, $tokenHash, $expiresAt, $createdAt]);
        return $id;
    }

    public static function getPasswordResetTokenByHash($tokenHash) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("
            SELECT * FROM password_reset_tokens WHERE tokenHash = ? ORDER BY createdAt DESC LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function markPasswordResetTokenUsed($id) {
        $pdo = self::getConnection();
        $usedAt = date(DATE_ISO8601);
        $stmt = $pdo->prepare("UPDATE password_reset_tokens SET usedAt = ? WHERE id = ?");
        $stmt->execute([$usedAt, $id]);
    }

    public static function getRecentResetRequestCount($userId, $windowSeconds = 120) {
        $pdo = self::getConnection();
        $cutoff = date(DATE_ISO8601, time() - $windowSeconds);
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count FROM password_reset_tokens WHERE userId = ? AND createdAt >= ?
        ");
        $stmt->execute([$userId, $cutoff]);
        $row = $stmt->fetch();
        return $row ? (int)$row['count'] : 0;
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

    public static function getAffiliateBalances($affiliateUserId) {
        $pdo = self::getConnection();

        // 1. Total commissions earned (all non-declined commissions)
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) AS totalEarned
            FROM commissions
            WHERE affiliateId = ? AND status != 'Declined'
        ");
        $stmt->execute([$affiliateUserId]);
        $totalEarned = (float)$stmt->fetchColumn();

        // 2. Pending withdrawals (currently reserved)
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) AS pendingAmount
            FROM affiliate_withdrawals
            WHERE affiliate_user_id = ? AND status = 'pending'
        ");
        $stmt->execute([$affiliateUserId]);
        $pendingAmount = (float)$stmt->fetchColumn();

        // 3. Settled / paid withdrawals
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) AS paidAmount
            FROM affiliate_withdrawals
            WHERE affiliate_user_id = ? AND status = 'paid'
        ");
        $stmt->execute([$affiliateUserId]);
        $paidAmount = (float)$stmt->fetchColumn();

        // High precision integer cents/kobo calculation
        $totalEarnedCents = (int)round($totalEarned * 100);
        $pendingCents = (int)round($pendingAmount * 100);
        $paidCents = (int)round($paidAmount * 100);
        $availableCents = max(0, $totalEarnedCents - $pendingCents - $paidCents);

        $availableAmount = round($availableCents / 100, 2);

        return [
            'totalEarnings' => round($totalEarned, 2),
            'pendingWithdrawal' => round($pendingAmount, 2),
            'totalPaidOut' => round($paidAmount, 2),
            'availableEarnings' => $availableAmount,
            'totalEarningsCents' => $totalEarnedCents,
            'pendingCents' => $pendingCents,
            'paidCents' => $paidCents,
            'availableCents' => $availableCents
        ];
    }

    public static function requestAffiliateWithdrawal($affiliateUserId, $bankName, $accountNumber, $accountName, $requestedAmount = null) {
        $pdo = self::getConnection();
        
        $pdo->beginTransaction();
        try {
            // Lock user row and commissions for this affiliate to avoid race conditions
            $stmtLock = $pdo->prepare("SELECT id, bankName, accountNumber, accountName FROM users WHERE id = ? FOR UPDATE");
            $stmtLock->execute([$affiliateUserId]);
            $userRow = $stmtLock->fetch();
            if (!$userRow) {
                throw new Exception("Affiliate user record not found.");
            }

            // Lock pending withdrawals
            $stmtPending = $pdo->prepare("SELECT id FROM affiliate_withdrawals WHERE affiliate_user_id = ? AND status = 'pending' FOR UPDATE");
            $stmtPending->execute([$affiliateUserId]);
            $stmtPending->fetchAll();

            // Calculate exact balance with locks held
            $stmtComms = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE affiliateId = ? AND status != 'Declined'");
            $stmtComms->execute([$affiliateUserId]);
            $totalEarned = (float)$stmtComms->fetchColumn();

            $stmtWithPending = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM affiliate_withdrawals WHERE affiliate_user_id = ? AND status = 'pending'");
            $stmtWithPending->execute([$affiliateUserId]);
            $pendingWith = (float)$stmtWithPending->fetchColumn();

            $stmtWithPaid = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM affiliate_withdrawals WHERE affiliate_user_id = ? AND status = 'paid'");
            $stmtWithPaid->execute([$affiliateUserId]);
            $paidWith = (float)$stmtWithPaid->fetchColumn();

            $totalEarnedCents = (int)round($totalEarned * 100);
            $pendingCents = (int)round($pendingWith * 100);
            $paidCents = (int)round($paidWith * 100);
            $availableCents = max(0, $totalEarnedCents - $pendingCents - $paidCents);
            $availableAmount = round($availableCents / 100, 2);

            if ($availableCents <= 0) {
                throw new Exception("You have no available affiliate balance to withdraw.");
            }

            // Strict single-amount check: requested must match available balance
            if ($requestedAmount !== null) {
                $reqCents = (int)round(((float)$requestedAmount) * 100);
                if ($reqCents !== $availableCents) {
                    if ($reqCents < $availableCents) {
                        throw new Exception("You must withdraw your full available earnings of ₦" . number_format($availableAmount, 2));
                    } else {
                        throw new Exception("Withdrawal amount cannot exceed your available earnings of ₦" . number_format($availableAmount, 2));
                    }
                }
            }

            $finalAmount = $availableAmount;
            $id = self::generateUUID();
            $now = date(DATE_ISO8601);

            $stmtInsert = $pdo->prepare("
                INSERT INTO affiliate_withdrawals (
                    id, affiliate_user_id, amount, bank_name, account_number, account_name,
                    status, admin_note, requested_at, processed_at, processed_by, payment_reference,
                    decline_reason, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    'pending', NULL, ?, NULL, NULL, NULL,
                    NULL, ?, ?
                )
            ");
            $stmtInsert->execute([
                $id,
                $affiliateUserId,
                $finalAmount,
                trim($bankName),
                trim($accountNumber),
                trim($accountName),
                $now,
                $now,
                $now
            ]);

            // Save user bank details for subsequent pre-fills
            $stmtUpdateBank = $pdo->prepare("UPDATE users SET bankName = ?, accountNumber = ?, accountName = ? WHERE id = ?");
            $stmtUpdateBank->execute([trim($bankName), trim($accountNumber), trim($accountName), $affiliateUserId]);

            $pdo->commit();

            return [
                'id' => $id,
                'affiliate_user_id' => $affiliateUserId,
                'amount' => $finalAmount,
                'bank_name' => trim($bankName),
                'account_number' => trim($accountNumber),
                'account_name' => trim($accountName),
                'status' => 'pending',
                'requested_at' => $now,
                'created_at' => $now,
                'updated_at' => $now
            ];
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function getAffiliateWithdrawals($affiliateUserId) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("
            SELECT * FROM affiliate_withdrawals
            WHERE affiliate_user_id = ?
            ORDER BY created_at DESC
        ");
        $stmt->execute([$affiliateUserId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['amount'] = (float)$r['amount'];
        }
        return $rows;
    }

    public static function getAffiliateWithdrawalById($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("
            SELECT w.*, 
                   u.fullName, 
                   u.fullName AS full_name, 
                   u.fullName AS affiliateName, 
                   u.username, 
                   u.username AS affiliateUsername, 
                   u.email, 
                   u.email AS affiliateEmail,
                   u.phone,
                   u.accountStatus
            FROM affiliate_withdrawals w
            LEFT JOIN users u ON w.affiliate_user_id = u.id
            WHERE w.id = ?
        ");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row) {
            $row['amount'] = (float)$row['amount'];
            $row['fullName'] = $row['fullName'] ?? ($row['affiliateName'] ?? '');
            $row['full_name'] = $row['fullName'];
            $row['username'] = $row['username'] ?? ($row['affiliateUsername'] ?? '');
            $row['email'] = $row['email'] ?? ($row['affiliateEmail'] ?? '');
            return $row;
        }
        return null;
    }

    public static function getAllAffiliateWithdrawals($statusFilter = null) {
        $pdo = self::getConnection();
        if ($statusFilter && in_array(strtolower($statusFilter), ['pending', 'paid', 'declined', 'cancelled'])) {
            $stmt = $pdo->prepare("
                SELECT w.*, 
                       u.fullName, 
                       u.fullName AS full_name, 
                       u.fullName AS affiliateName, 
                       u.username, 
                       u.username AS affiliateUsername, 
                       u.email, 
                       u.email AS affiliateEmail,
                       u.phone,
                       u.accountStatus
                FROM affiliate_withdrawals w
                LEFT JOIN users u ON w.affiliate_user_id = u.id
                WHERE w.status = ?
                ORDER BY w.created_at DESC
            ");
            $stmt->execute([strtolower($statusFilter)]);
        } else {
            $stmt = $pdo->query("
                SELECT w.*, 
                       u.fullName, 
                       u.fullName AS full_name, 
                       u.fullName AS affiliateName, 
                       u.username, 
                       u.username AS affiliateUsername, 
                       u.email, 
                       u.email AS affiliateEmail,
                       u.phone,
                       u.accountStatus
                FROM affiliate_withdrawals w
                LEFT JOIN users u ON w.affiliate_user_id = u.id
                ORDER BY w.created_at DESC
            ");
        }
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['amount'] = (float)$r['amount'];
            $r['fullName'] = $r['fullName'] ?? ($r['affiliateName'] ?? '');
            $r['full_name'] = $r['fullName'];
            $r['username'] = $r['username'] ?? ($r['affiliateUsername'] ?? '');
            $r['email'] = $r['email'] ?? ($r['affiliateEmail'] ?? '');
        }
        return $rows;
    }

    public static function markAffiliateWithdrawalAsPaid($withdrawalId, $adminUsername, $paymentReference = null) {
        $pdo = self::getConnection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT * FROM affiliate_withdrawals WHERE id = ? FOR UPDATE");
            $stmt->execute([$withdrawalId]);
            $withdrawal = $stmt->fetch();
            if (!$withdrawal) {
                throw new Exception("Withdrawal request not found.");
            }
            if ($withdrawal['status'] !== 'pending') {
                throw new Exception("Only pending withdrawals can be marked as paid. Current status: " . $withdrawal['status']);
            }

            $now = date(DATE_ISO8601);
            $cleanRef = !empty($paymentReference) ? trim($paymentReference) : null;

            $stmtUpdate = $pdo->prepare("
                UPDATE affiliate_withdrawals
                SET status = 'paid',
                    processed_at = ?,
                    processed_by = ?,
                    payment_reference = ?,
                    updated_at = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([$now, $adminUsername, $cleanRef, $now, $withdrawalId]);

            $pdo->commit();

            return self::getAffiliateWithdrawalById($withdrawalId);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function markAffiliateWithdrawalAsDeclined($withdrawalId, $adminUsername, $declineReason) {
        $pdo = self::getConnection();
        $pdo->beginTransaction();
        try {
            if (empty(trim($declineReason))) {
                throw new Exception("A decline reason is mandatory.");
            }

            $stmt = $pdo->prepare("SELECT * FROM affiliate_withdrawals WHERE id = ? FOR UPDATE");
            $stmt->execute([$withdrawalId]);
            $withdrawal = $stmt->fetch();
            if (!$withdrawal) {
                throw new Exception("Withdrawal request not found.");
            }
            if ($withdrawal['status'] !== 'pending') {
                throw new Exception("Only pending withdrawals can be declined. Current status: " . $withdrawal['status']);
            }

            $now = date(DATE_ISO8601);
            $stmtUpdate = $pdo->prepare("
                UPDATE affiliate_withdrawals
                SET status = 'declined',
                    decline_reason = ?,
                    processed_at = ?,
                    processed_by = ?,
                    updated_at = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([trim($declineReason), $now, $adminUsername, $now, $withdrawalId]);

            $pdo->commit();

            return self::getAffiliateWithdrawalById($withdrawalId);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
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

    public static function deleteBroadcastNotification($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare('DELETE FROM broadcast_notifications WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public static function clearAllBroadcastNotifications() {
        $pdo = self::getConnection();
        return $pdo->exec('DELETE FROM broadcast_notifications');
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

    public static function getLandingContent() {
        $pdo = self::getConnection();
        $heroSlideDelaySeconds = 5;
        try {
            $stmt = $pdo->query("SELECT heroSlideDelaySeconds FROM system_config WHERE id = 'main'");
            $row = $stmt->fetch();
            if ($row && !empty($row['heroSlideDelaySeconds'])) {
                $heroSlideDelaySeconds = intval($row['heroSlideDelaySeconds']);
            }
        } catch (Exception $e) {}

        $heroSlides = [];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_hero_slides ORDER BY slideOrder ASC, createdAt ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as $r) {
                $heroSlides[] = [
                    'id' => $r['id'],
                    'title' => $r['title'],
                    'tagline' => $r['tagline'] ?? '',
                    'year' => $r['year'] ?? '',
                    'rating' => $r['rating'] ?? '',
                    'quality' => $r['quality'] ?? '',
                    'duration' => $r['duration'] ?? '',
                    'mediaType' => $r['mediaType'] ?? 'image',
                    'mediaUrl' => $r['mediaUrl'] ?? '',
                    'posterUrl' => $r['posterUrl'] ?? '',
                    'announcement' => $r['announcement'] ?? '',
                    'slideOrder' => intval($r['slideOrder'] ?? 0),
                    'isActive' => boolval($r['isActive'] ?? 1)
                ];
            }
        } catch (Exception $e) {}

        $about = [
            'header' => 'About',
            'badge' => "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
            'subtitle' => 'Cinode: Unthrottled 4K Streaming for Everyone',
            'contentHtml' => '<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p>',
            'imageUrl' => '',
            'imageAlt' => 'Cinode 4K Cinema Engine',
            'captionTitle' => 'Direct Cloud Storage Architecture',
            'captionDesc' => '10,000+ Hours of 4K Remastered Cinema & TV Series',
            'featurePills' => ["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"],
            'cards' => []
        ];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_about WHERE id = 'main'");
            $ab = $stmt->fetch();
            if ($ab) {
                $pills = !empty($ab['featurePillsJson']) ? json_decode($ab['featurePillsJson'], true) : [];
                $cards = !empty($ab['cardsJson']) ? json_decode($ab['cardsJson'], true) : [];
                $about = [
                    'header' => $ab['header'] ?? 'About',
                    'badge' => $ab['badge'] ?? '',
                    'subtitle' => $ab['subtitle'] ?? '',
                    'contentHtml' => $ab['contentHtml'] ?? '',
                    'imageUrl' => $ab['imageUrl'] ?? '',
                    'imageAlt' => $ab['imageAlt'] ?? '',
                    'captionTitle' => $ab['captionTitle'] ?? '',
                    'captionDesc' => $ab['captionDesc'] ?? '',
                    'featurePills' => is_array($pills) ? $pills : [],
                    'cards' => is_array($cards) ? $cards : []
                ];
            }
        } catch (Exception $e) {}

        $faqs = [];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_faqs ORDER BY faqOrder ASC, createdAt ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as $r) {
                $faqs[] = [
                    'id' => $r['id'],
                    'question' => $r['question'],
                    'answer' => $r['answer'],
                    'faqOrder' => intval($r['faqOrder'] ?? 0),
                    'isActive' => boolval($r['isActive'] ?? 1)
                ];
            }
        } catch (Exception $e) {}

        return [
            'heroSlides' => $heroSlides,
            'heroSlideDelaySeconds' => $heroSlideDelaySeconds,
            'about' => $about,
            'faqs' => $faqs
        ];
    }

    public static function saveHeroSlides($slides, $delaySeconds = null) {
        $pdo = self::getConnection();
        if ($delaySeconds !== null) {
            $stmt = $pdo->prepare("UPDATE system_config SET heroSlideDelaySeconds = ? WHERE id = 'main'");
            $stmt->execute([intval($delaySeconds)]);
        }

        $pdo->exec("DELETE FROM landing_hero_slides");
        $ins = $pdo->prepare("
            INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $now = date(DATE_ISO8601);
        foreach ($slides as $idx => $s) {
            $id = !empty($s['id']) ? $s['id'] : 'slide-' . time() . '-' . $idx;
            $title = $s['title'] ?? 'Untitled Movie';
            $tagline = $s['tagline'] ?? '';
            $year = $s['year'] ?? '';
            $rating = $s['rating'] ?? '9.0';
            $quality = $s['quality'] ?? '4K HDR';
            $duration = $s['duration'] ?? '';
            $mediaType = $s['mediaType'] ?? 'image';
            $mediaUrl = $s['mediaUrl'] ?? '';
            $posterUrl = $s['posterUrl'] ?? '';
            $announcement = $s['announcement'] ?? '';
            $slideOrder = isset($s['slideOrder']) ? intval($s['slideOrder']) : $idx;
            $isActive = isset($s['isActive']) ? ($s['isActive'] ? 1 : 0) : 1;

            $ins->execute([$id, $title, $tagline, $year, $rating, $quality, $duration, $mediaType, $mediaUrl, $posterUrl, $announcement, $slideOrder, $isActive, $now, $now]);
        }
    }

    public static function saveAboutConfig($about) {
        $pdo = self::getConnection();
        $pillsJson = json_encode($about['featurePills'] ?? []);
        $cardsJson = json_encode($about['cards'] ?? []);
        $now = date(DATE_ISO8601);

        $stmt = $pdo->prepare("
            INSERT INTO landing_about (id, header, badge, subtitle, contentHtml, imageUrl, imageAlt, captionTitle, captionDesc, featurePillsJson, cardsJson, updatedAt)
            VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                header = VALUES(header),
                badge = VALUES(badge),
                subtitle = VALUES(subtitle),
                contentHtml = VALUES(contentHtml),
                imageUrl = VALUES(imageUrl),
                imageAlt = VALUES(imageAlt),
                captionTitle = VALUES(captionTitle),
                captionDesc = VALUES(captionDesc),
                featurePillsJson = VALUES(featurePillsJson),
                cardsJson = VALUES(cardsJson),
                updatedAt = VALUES(updatedAt)
        ");
        $stmt->execute([
            $about['header'] ?? 'About',
            $about['badge'] ?? '',
            $about['subtitle'] ?? '',
            $about['contentHtml'] ?? '',
            $about['imageUrl'] ?? '',
            $about['imageAlt'] ?? '',
            $about['captionTitle'] ?? '',
            $about['captionDesc'] ?? '',
            $pillsJson,
            $cardsJson,
            $now
        ]);
    }

    public static function saveFaqs($faqs) {
        $pdo = self::getConnection();
        $pdo->exec("DELETE FROM landing_faqs");
        $ins = $pdo->prepare("
            INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $now = date(DATE_ISO8601);
        foreach ($faqs as $idx => $f) {
            $id = !empty($f['id']) ? $f['id'] : 'faq-' . time() . '-' . $idx;
            $question = $f['question'] ?? ($f['q'] ?? '');
            $answer = $f['answer'] ?? ($f['a'] ?? '');
            $faqOrder = isset($f['faqOrder']) ? intval($f['faqOrder']) : $idx;
            $isActive = isset($f['isActive']) ? ($f['isActive'] ? 1 : 0) : 1;

            $ins->execute([$id, $question, $answer, $faqOrder, $isActive, $now, $now]);
        }
    }
}
