<?php
/**
 * Subscription Expiration Cron Script for PHP cPanel.
 * Recommended setup: Run once daily via cPanel Cron Jobs.
 * Command: php /home/your_cpanel_username/public_html/php-backend/expiry-cron.php
 */

// Restrict access to CLI (Command Line Interface) only to prevent random visitors from triggering it.
// You can also access it via browser using a secure secret token if needed: ?token=your_secret_cron_token
define('CRON_TOKEN', 'secret_cron_token_change_me');

if (php_sapi_name() !== 'cli' && (!isset($_GET['token']) || $_GET['token'] !== CRON_TOKEN)) {
    http_response_code(403);
    echo "Access denied. This script is secured for CLI usage only, or requires a valid security token.";
    exit;
}

// Ensure the JSON header is not sent for CLI cron output
if (php_sapi_name() !== 'cli') {
    header('Content-Type: text/plain');
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jellyfin.php';

try {
    echo "[" . date('Y-m-d H:i:s') . "] Starting subscription expiry check...\n";
    DB::initDb();
    $expiredCount = DB::checkSubscriptionExpiries();
    echo "[" . date('Y-m-d H:i:s') . "] Audit completed. Successfully expired and disabled {$expiredCount} users.\n";
} catch (Exception $e) {
    echo "[" . date('Y-m-d H:i:s') . "] Error running subscription audit: " . $e->getMessage() . "\n";
    error_log("Cron Error: " . $e->getMessage());
}
