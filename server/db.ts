import mysql from 'mysql2/promise';
import crypto from 'crypto';

export interface JellyfinConfig {
  serverUrl: string;
  adminUsername: string;
  adminPassword?: string;
  adminPasswordFull?: string;
  apiKey: string;
  defaultCommission?: number;
  bankAccountNo?: string;
  bankName?: string;
  bankBeneficiary?: string;
  bankInstructions?: string;
  chatbotInfo?: string;
  chatbotInstructions?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsApp?: string;
  contactOther?: string;
  iosDownloadUrl?: string;
  androidDownloadUrl?: string;
  // SMTP Configuration
  smtpEnabled?: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  // Email Verification & Template Settings
  emailVerificationEnabled?: number;
  emailVerificationSubject?: string;
  emailVerificationTemplate?: string;
  welcomeEmailSubject?: string;
  welcomeEmailTemplate?: string;
  notificationEmailSubject?: string;
  notificationEmailTemplate?: string;
  // Monnify & Subscription Settings
  monnifyEnabled?: number;
  monnifyApiKey?: string;
  monnifyContractCode?: string;
  monnifySecretKey?: string;
  monnifyMode?: string;
  subscriptionAmount?: number;
  // Paystack & Custom Payment Settings
  paystackEnabled?: number;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  paystackMode?: string;
  customPaymentEnabled?: number;
  customPaymentBtnName?: string;
  customPaymentUrl?: string;
  customPaymentTarget?: string;
  // Squad Payment Settings
  squadEnabled?: number;
  squadSecretKey?: string;
  squadApiKey?: string;
  squadPublicKey?: string;
  squadMode?: string;
  // Squad SFTP Settings
  squadSftpEnabled?: number;
  squadSftpHost?: string;
  squadSftpPort?: number;
  squadSftpUsername?: string;
  squadSftpPassword?: string;
  squadSftpPrivateKey?: string;
  squadSftpRemoteDir?: string;
  squadSftpProcessingDir?: string;
  squadSftpGpgPrivateKey?: string;
  squadSftpGpgPassphrase?: string;
  squadSftpPollInterval?: number;
  squadSftpLastSync?: string;
  squadSftpLastFile?: string;
  squadSftpLastTxRef?: string;
  squadSftpLastError?: string;
  squadSftpLastStatus?: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  jellyfinUserId?: string;
  subscriptionStatus: 'Active' | 'Expired' | 'Disabled';
  paymentStatus: 'Paid' | 'Unpaid' | 'Pending Verification';
  registrationDate: string;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  accountStatus: 'Active' | 'Expired' | 'Disabled';
  role: 'admin' | 'user';
  isAffiliate?: number;
  affiliateCode?: string;
  referredBy?: string;
  disabledAt?: string;
  receiptUrl?: string;
  declineReason?: string;
  phone?: string;
  transactionRef?: string;
  lastPaymentTime?: string;
  systemNotification?: string;
  emailVerified?: number;
  verificationToken?: string;
  verificationTokenExpires?: string;
}

export interface CommissionRecord {
  id: string;
  affiliateId: string;
  referredUserId: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Paid';
  createdAt: string;
  updatedAt: string;
}

export interface MediaRequestRecord {
  id: string;
  userId: string;
  username: string;
  type: 'movie' | 'show';
  title: string;
  releaseYear?: string;
  season?: string;
  episode?: string;
  status: 'Pending' | 'Approved' | 'Declined';
  createdAt: string;
}

export interface BroadcastNotificationRecord {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  targetType: 'all' | 'affiliate' | 'paid' | 'free' | 'user';
  targetUserId?: string;
  createdAt: string;
}

export interface PendingPaymentRecord {
  transactionRef: string;
  userId: string;
  username: string;
  email: string;
  amount: number;
  gateway: string;
  status: string;
  createdAt: string;
}

export interface SquadMandateRecord {
  id: string;
  userId: string;
  mandateId: string;
  mandateReference?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  accountName?: string;
  amount: number;
  status: 'pending' | 'pending_otp' | 'active' | 'cancelled' | 'failed';
  startDate?: string;
  endDate?: string;
  lastDebitDate?: string;
  nextDebitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SquadSftpLogRecord {
  id: string;
  event: string;
  status: 'info' | 'success' | 'warning' | 'error';
  filename?: string;
  transactionRef?: string;
  message: string;
  createdAt: string;
}

export let mysqlAvailable = false;
export let mysqlErrorMsg: string | null = null;

// Memory sandbox fallback for local dev/preview
const memoryConfig: JellyfinConfig = {
  serverUrl: 'https://cinode.zerolord.com',
  adminUsername: 'duwit',
  adminPasswordFull: '@f33rinimi',
  apiKey: '79ee2e15ee1f47fd881188ef4da13391',
  defaultCommission: 100.00
};
export let localSystemConfig: JellyfinConfig | null = memoryConfig;
export const localUsers: UserRecord[] = [];
export const localCommissions: CommissionRecord[] = [];
export const localMediaRequests: MediaRequestRecord[] = [];
export const localBroadcastNotifications: BroadcastNotificationRecord[] = [];
export const localSessions = new Map<string, { userId: string; expiresAt: number; jellyfinToken: string }>();
export const localProcessedTxs = new Set<string>();
export const localPendingPayments = new Map<string, PendingPaymentRecord>();
export const localSquadMandates: SquadMandateRecord[] = [];
export const localSquadSftpLogs: SquadSftpLogRecord[] = [];

// Create connection pool to the user's MySQL database
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '131.153.147.178',
  port: Number(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'zerolord_cinjelly',
  password: process.env.DB_PASSWORD || '@f33rinimi',
  database: process.env.DB_NAME || 'zerolord_cinjelly',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000, // 10 seconds timeout for fast failover
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Initialize database tables
export async function initDb() {
  try {
    console.log('[MySQL] Initializing connection and checking tables...');
    
    // Test connection with a timeout/query
    await pool.query('SELECT 1');
    
    // Create users table
    await pool.query(`
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
      )
    `);

    // Alter columns in users to ensure support for affiliates/expiires
    try { await pool.query("ALTER TABLE users ADD COLUMN isAffiliate TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN affiliateCode VARCHAR(100) NULL UNIQUE"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN referredBy VARCHAR(100) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN disabledAt VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN receiptUrl TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN declineReason TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN phone VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN transactionRef VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN lastPaymentTime VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN systemNotification TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN emailVerified TINYINT(1) NOT NULL DEFAULT 1"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN verificationToken VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN verificationTokenExpires VARCHAR(255) NULL"); } catch (e) {}

    // Create system_config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id VARCHAR(255) PRIMARY KEY,
        serverUrl VARCHAR(255) NOT NULL,
        adminUsername VARCHAR(255) NOT NULL,
        adminPasswordFull TEXT NULL,
        apiKey TEXT NOT NULL
      )
    `);

    try { await pool.query("ALTER TABLE system_config ADD COLUMN defaultCommission DECIMAL(10,2) NOT NULL DEFAULT 100.00"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN bankAccountNo VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN bankName VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN bankBeneficiary VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN bankInstructions TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN chatbotInfo TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN chatbotInstructions TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN contactEmail VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN contactPhone VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN contactWhatsApp VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN contactOther TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN iosDownloadUrl TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN androidDownloadUrl TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpHost VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpPort INT NOT NULL DEFAULT 587"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpSecure TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpUser VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpPass TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpFromName VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN smtpFromEmail VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN emailVerificationEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN emailVerificationSubject VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN emailVerificationTemplate LONGTEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN welcomeEmailSubject VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN welcomeEmailTemplate LONGTEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN notificationEmailSubject VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN notificationEmailTemplate LONGTEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN monnifyEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN monnifyApiKey VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN monnifyContractCode VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN monnifySecretKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN monnifyMode VARCHAR(50) NOT NULL DEFAULT 'live'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN subscriptionAmount DECIMAL(10,2) NOT NULL DEFAULT 600.00"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN paystackEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN paystackPublicKey VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN paystackSecretKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN paystackMode VARCHAR(50) NOT NULL DEFAULT 'live'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN customPaymentEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN customPaymentBtnName VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN customPaymentUrl TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN customPaymentTarget VARCHAR(50) NOT NULL DEFAULT '_blank'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSecretKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadApiKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadMode VARCHAR(50) NOT NULL DEFAULT 'live'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpEnabled TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpHost VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpPort INT NOT NULL DEFAULT 22"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpUsername VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpPassword TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpPrivateKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpRemoteDir VARCHAR(255) NOT NULL DEFAULT '/notifications'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpProcessingDir VARCHAR(255) NOT NULL DEFAULT './storage/sftp'"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpGpgPrivateKey TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpGpgPassphrase TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpPollInterval INT NOT NULL DEFAULT 15"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpLastSync VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpLastFile VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpLastTxRef VARCHAR(255) NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpLastError TEXT NULL"); } catch (e) {}
    try { await pool.query("ALTER TABLE system_config ADD COLUMN squadSftpLastStatus VARCHAR(50) NOT NULL DEFAULT 'Idle'"); } catch (e) {}

    // Create squad_sftp_logs table for diagnostic logging
    await pool.query(`
      CREATE TABLE IF NOT EXISTS squad_sftp_logs (
        id VARCHAR(255) PRIMARY KEY,
        event VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'info',
        filename VARCHAR(255) NULL,
        transactionRef VARCHAR(255) NULL,
        message TEXT NOT NULL,
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create processed_transactions table to prevent duplicate webhooks / idempotency lock
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_transactions (
        reference VARCHAR(255) PRIMARY KEY,
        gateway VARCHAR(50) NOT NULL,
        userId VARCHAR(255) NULL,
        amount DECIMAL(10,2) NULL,
        status VARCHAR(50) NOT NULL,
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create pending_payments table for storing checkout initiation records
    await pool.query(`
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
    `);

    // Create persistent sessions table to keep user logins intact across server restarts/compiles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        expiresAt BIGINT NOT NULL,
        jellyfinToken VARCHAR(255) NULL
      )
    `);

    // Create commissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id VARCHAR(255) PRIMARY KEY,
        affiliateId VARCHAR(255) NOT NULL,
        referredUserId VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        createdAt VARCHAR(255) NOT NULL,
        updatedAt VARCHAR(255) NOT NULL
      )
    `);

    // Create media_requests table
    await pool.query(`
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
    `);

    // Create broadcast_notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_notifications (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        imageUrl TEXT NULL,
        targetType VARCHAR(50) NOT NULL DEFAULT 'all',
        createdAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try { await pool.query("ALTER TABLE broadcast_notifications ADD COLUMN targetUserId VARCHAR(255) NULL"); } catch (e) {}

    // Create squad_mandates table for Direct Debit recurring billing
    await pool.query(`
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
    `);
    
    console.log('[MySQL] Database tables checked and ready.');
    mysqlAvailable = true;
    mysqlErrorMsg = null;

    // Check if system_config table is empty, if so, seed it with user's MySQL credentials!
    try {
      const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM system_config');
      if (rows && rows[0] && rows[0].count === 0) {
        console.log('[MySQL] Seeding empty database with Jellyfin server configurations...');
        await pool.query(`
          INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey, defaultCommission)
          VALUES ('main', ?, ?, ?, ?, 100.00)
        `, [
          'https://cinode.zerolord.com',
          'duwit',
          '@f33rinimi',
          '79ee2e15ee1f47fd881188ef4da13391'
        ]);
      }
    } catch (seedErr: any) {
      console.error('[MySQL] Seeding error:', seedErr.message);
    }

  } catch (err: any) {
    console.error('[MySQL] Connection or initialization error:', err.message);
    mysqlAvailable = false;
    mysqlErrorMsg = err.message;
  }
}

// Password Hashing helpers
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch {
    return false;
  }
}

export const db = {
  async getConfig(): Promise<JellyfinConfig | null> {
    const envUrl = process.env.JELLYFIN_SERVER_URL;
    const envUsername = process.env.JELLYFIN_ADMIN_USERNAME;
    const envPassword = process.env.JELLYFIN_ADMIN_PASSWORD;
    const envApiKey = process.env.JELLYFIN_API_KEY;

    let dbConfig: JellyfinConfig | null = null;
    if (mysqlAvailable) {
      try {
        const [rows]: any = await pool.query('SELECT * FROM system_config WHERE id = "main" LIMIT 1');
        if (rows && rows.length > 0) {
          dbConfig = {
            serverUrl: rows[0].serverUrl,
            adminUsername: rows[0].adminUsername,
            adminPasswordFull: rows[0].adminPasswordFull,
            apiKey: rows[0].apiKey,
            defaultCommission: rows[0].defaultCommission !== undefined ? Number(rows[0].defaultCommission) : 100.00,
            bankAccountNo: rows[0].bankAccountNo || '',
            bankName: rows[0].bankName || '',
            bankBeneficiary: rows[0].bankBeneficiary || '',
            bankInstructions: rows[0].bankInstructions || '',
            chatbotInfo: rows[0].chatbotInfo || '',
            chatbotInstructions: rows[0].chatbotInstructions || '',
            contactEmail: rows[0].contactEmail || '',
            contactPhone: rows[0].contactPhone || '',
            contactWhatsApp: rows[0].contactWhatsApp || '',
            contactOther: rows[0].contactOther || '',
            iosDownloadUrl: rows[0].iosDownloadUrl || '',
            androidDownloadUrl: rows[0].androidDownloadUrl || '',
            smtpEnabled: rows[0].smtpEnabled !== undefined ? Number(rows[0].smtpEnabled) : 0,
            smtpHost: rows[0].smtpHost || '',
            smtpPort: rows[0].smtpPort ? Number(rows[0].smtpPort) : 587,
            smtpSecure: rows[0].smtpSecure !== undefined ? Number(rows[0].smtpSecure) : 0,
            smtpUser: rows[0].smtpUser || '',
            smtpPass: rows[0].smtpPass || '',
            smtpFromName: rows[0].smtpFromName || 'CINJELLY Stream',
            smtpFromEmail: rows[0].smtpFromEmail || '',
            emailVerificationEnabled: rows[0].emailVerificationEnabled !== undefined ? Number(rows[0].emailVerificationEnabled) : 0,
            emailVerificationSubject: rows[0].emailVerificationSubject || '',
            emailVerificationTemplate: rows[0].emailVerificationTemplate || '',
            welcomeEmailSubject: rows[0].welcomeEmailSubject || '',
            welcomeEmailTemplate: rows[0].welcomeEmailTemplate || '',
            notificationEmailSubject: rows[0].notificationEmailSubject || '',
            notificationEmailTemplate: rows[0].notificationEmailTemplate || '',
            monnifyEnabled: rows[0].monnifyEnabled !== undefined ? Number(rows[0].monnifyEnabled) : 0,
            monnifyApiKey: rows[0].monnifyApiKey || '',
            monnifyContractCode: rows[0].monnifyContractCode || '',
            monnifySecretKey: rows[0].monnifySecretKey || '',
            monnifyMode: rows[0].monnifyMode || 'live',
            subscriptionAmount: rows[0].subscriptionAmount !== undefined ? Number(rows[0].subscriptionAmount) : 600.00,
            customPaymentEnabled: rows[0].customPaymentEnabled !== undefined ? Number(rows[0].customPaymentEnabled) : 0,
            customPaymentBtnName: rows[0].customPaymentBtnName || 'Pay via Paystack',
            customPaymentUrl: rows[0].customPaymentUrl || '',
            customPaymentTarget: rows[0].customPaymentTarget || '_blank',
            paystackEnabled: rows[0].paystackEnabled !== undefined ? Number(rows[0].paystackEnabled) : 0,
            paystackPublicKey: rows[0].paystackPublicKey || '',
            paystackSecretKey: rows[0].paystackSecretKey || '',
            paystackMode: rows[0].paystackMode || 'live',
            squadEnabled: rows[0].squadEnabled !== undefined ? Number(rows[0].squadEnabled) : 0,
            squadSecretKey: rows[0].squadSecretKey || '',
            squadApiKey: rows[0].squadApiKey || '',
            squadMode: rows[0].squadMode || 'live',
            squadSftpEnabled: rows[0].squadSftpEnabled !== undefined ? Number(rows[0].squadSftpEnabled) : 0,
            squadSftpHost: rows[0].squadSftpHost || '',
            squadSftpPort: rows[0].squadSftpPort ? Number(rows[0].squadSftpPort) : 22,
            squadSftpUsername: rows[0].squadSftpUsername || '',
            squadSftpPassword: rows[0].squadSftpPassword || '',
            squadSftpPrivateKey: rows[0].squadSftpPrivateKey || '',
            squadSftpRemoteDir: rows[0].squadSftpRemoteDir || '/notifications',
            squadSftpProcessingDir: rows[0].squadSftpProcessingDir || './storage/sftp',
            squadSftpGpgPrivateKey: rows[0].squadSftpGpgPrivateKey || '',
            squadSftpGpgPassphrase: rows[0].squadSftpGpgPassphrase || '',
            squadSftpPollInterval: rows[0].squadSftpPollInterval ? Number(rows[0].squadSftpPollInterval) : 15,
            squadSftpLastSync: rows[0].squadSftpLastSync || '',
            squadSftpLastFile: rows[0].squadSftpLastFile || '',
            squadSftpLastTxRef: rows[0].squadSftpLastTxRef || '',
            squadSftpLastError: rows[0].squadSftpLastError || '',
            squadSftpLastStatus: rows[0].squadSftpLastStatus || 'Idle'
          };
        }
      } catch (err) {
        console.error('Error fetching config from MySQL:', err);
      }
    } else {
      dbConfig = localSystemConfig;
    }

    if (dbConfig) {
      return {
        ...dbConfig,
        serverUrl: envUrl || dbConfig.serverUrl,
        adminUsername: envUsername || dbConfig.adminUsername,
        adminPasswordFull: envPassword || dbConfig.adminPasswordFull,
        apiKey: envApiKey || dbConfig.apiKey
      };
    }

    if (envUrl && envUsername && envApiKey) {
      return {
        serverUrl: envUrl,
        adminUsername: envUsername,
        adminPasswordFull: envPassword,
        apiKey: envApiKey,
        defaultCommission: 100.00
      };
    }

    return null;
  },

  async saveConfig(config: JellyfinConfig): Promise<void> {
    if (!mysqlAvailable) {
      localSystemConfig = config;
      return;
    }

    await pool.query(`
      INSERT INTO system_config (
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
        squadSftpRemoteDir, squadSftpProcessingDir, squadSftpGpgPrivateKey, squadSftpGpgPassphrase, squadSftpPollInterval
      )
      VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        contactOther = VALUES(contactOther),
        iosDownloadUrl = VALUES(iosDownloadUrl),
        androidDownloadUrl = VALUES(androidDownloadUrl),
        smtpEnabled = VALUES(smtpEnabled),
        smtpHost = VALUES(smtpHost),
        smtpPort = VALUES(smtpPort),
        smtpSecure = VALUES(smtpSecure),
        smtpUser = VALUES(smtpUser),
        smtpPass = VALUES(smtpPass),
        smtpFromName = VALUES(smtpFromName),
        smtpFromEmail = VALUES(smtpFromEmail),
        emailVerificationEnabled = VALUES(emailVerificationEnabled),
        emailVerificationSubject = VALUES(emailVerificationSubject),
        emailVerificationTemplate = VALUES(emailVerificationTemplate),
        welcomeEmailSubject = VALUES(welcomeEmailSubject),
        welcomeEmailTemplate = VALUES(welcomeEmailTemplate),
        notificationEmailSubject = VALUES(notificationEmailSubject),
        notificationEmailTemplate = VALUES(notificationEmailTemplate),
        monnifyEnabled = VALUES(monnifyEnabled),
        monnifyApiKey = VALUES(monnifyApiKey),
        monnifyContractCode = VALUES(monnifyContractCode),
        monnifySecretKey = VALUES(monnifySecretKey),
        monnifyMode = VALUES(monnifyMode),
        subscriptionAmount = VALUES(subscriptionAmount),
        customPaymentEnabled = VALUES(customPaymentEnabled),
        customPaymentBtnName = VALUES(customPaymentBtnName),
        customPaymentUrl = VALUES(customPaymentUrl),
        customPaymentTarget = VALUES(customPaymentTarget),
        paystackEnabled = VALUES(paystackEnabled),
        paystackPublicKey = VALUES(paystackPublicKey),
        paystackSecretKey = VALUES(paystackSecretKey),
        paystackMode = VALUES(paystackMode),
        squadEnabled = VALUES(squadEnabled),
        squadSecretKey = VALUES(squadSecretKey),
        squadApiKey = VALUES(squadApiKey),
        squadMode = VALUES(squadMode),
        squadSftpEnabled = VALUES(squadSftpEnabled),
        squadSftpHost = VALUES(squadSftpHost),
        squadSftpPort = VALUES(squadSftpPort),
        squadSftpUsername = VALUES(squadSftpUsername),
        squadSftpPassword = IF(VALUES(squadSftpPassword) IS NOT NULL AND VALUES(squadSftpPassword) != '', VALUES(squadSftpPassword), squadSftpPassword),
        squadSftpPrivateKey = IF(VALUES(squadSftpPrivateKey) IS NOT NULL AND VALUES(squadSftpPrivateKey) != '', VALUES(squadSftpPrivateKey), squadSftpPrivateKey),
        squadSftpRemoteDir = VALUES(squadSftpRemoteDir),
        squadSftpProcessingDir = VALUES(squadSftpProcessingDir),
        squadSftpGpgPrivateKey = IF(VALUES(squadSftpGpgPrivateKey) IS NOT NULL AND VALUES(squadSftpGpgPrivateKey) != '', VALUES(squadSftpGpgPrivateKey), squadSftpGpgPrivateKey),
        squadSftpGpgPassphrase = IF(VALUES(squadSftpGpgPassphrase) IS NOT NULL AND VALUES(squadSftpGpgPassphrase) != '', VALUES(squadSftpGpgPassphrase), squadSftpGpgPassphrase),
        squadSftpPollInterval = VALUES(squadSftpPollInterval)
    `, [
      config.serverUrl, 
      config.adminUsername, 
      config.adminPasswordFull || null, 
      config.apiKey,
      config.defaultCommission !== undefined ? Number(config.defaultCommission) : 100.00,
      config.bankAccountNo || null,
      config.bankName || null,
      config.bankBeneficiary || null,
      config.bankInstructions || null,
      config.chatbotInfo || null,
      config.chatbotInstructions || null,
      config.contactEmail || null,
      config.contactPhone || null,
      config.contactWhatsApp || null,
      config.contactOther || null,
      config.iosDownloadUrl || null,
      config.androidDownloadUrl || null,
      config.smtpEnabled !== undefined ? Number(config.smtpEnabled) : 0,
      config.smtpHost || null,
      config.smtpPort ? Number(config.smtpPort) : 587,
      config.smtpSecure !== undefined ? Number(config.smtpSecure) : 0,
      config.smtpUser || null,
      config.smtpPass || null,
      config.smtpFromName || null,
      config.smtpFromEmail || null,
      config.emailVerificationEnabled !== undefined ? Number(config.emailVerificationEnabled) : 0,
      config.emailVerificationSubject || null,
      config.emailVerificationTemplate || null,
      config.welcomeEmailSubject || null,
      config.welcomeEmailTemplate || null,
      config.notificationEmailSubject || null,
      config.notificationEmailTemplate || null,
      config.monnifyEnabled !== undefined ? Number(config.monnifyEnabled) : 0,
      config.monnifyApiKey || null,
      config.monnifyContractCode || null,
      config.monnifySecretKey || null,
      config.monnifyMode || 'live',
      config.subscriptionAmount !== undefined ? Number(config.subscriptionAmount) : 600.00,
      config.customPaymentEnabled !== undefined ? Number(config.customPaymentEnabled) : 0,
      config.customPaymentBtnName || null,
      config.customPaymentUrl || null,
      config.customPaymentTarget || '_blank',
      config.paystackEnabled !== undefined ? Number(config.paystackEnabled) : 0,
      config.paystackPublicKey || null,
      config.paystackSecretKey || null,
      config.paystackMode || 'live',
      config.squadEnabled !== undefined ? Number(config.squadEnabled) : 0,
      config.squadSecretKey || null,
      config.squadApiKey || null,
      config.squadMode || 'live',
      config.squadSftpEnabled !== undefined ? Number(config.squadSftpEnabled) : 0,
      config.squadSftpHost || null,
      config.squadSftpPort ? Number(config.squadSftpPort) : 22,
      config.squadSftpUsername || null,
      config.squadSftpPassword || null,
      config.squadSftpPrivateKey || null,
      config.squadSftpRemoteDir || '/notifications',
      config.squadSftpProcessingDir || './storage/sftp',
      config.squadSftpGpgPrivateKey || null,
      config.squadSftpGpgPassphrase || null,
      config.squadSftpPollInterval ? Number(config.squadSftpPollInterval) : 15
    ]);
  },

  async isTransactionProcessed(reference: string): Promise<boolean> {
    if (!reference) return false;
    if (!mysqlAvailable) {
      return localProcessedTxs.has(reference);
    }
    try {
      const [rows]: any = await pool.query('SELECT reference FROM processed_transactions WHERE reference = ?', [reference]);
      return rows && rows.length > 0;
    } catch (e) {
      return false;
    }
  },

  async recordProcessedTransaction(reference: string, gateway: string, userId: string, amount: number, status: string): Promise<void> {
    if (!reference) return;
    if (!mysqlAvailable) {
      localProcessedTxs.add(reference);
      return;
    }
    try {
      await pool.query(
        'INSERT INTO processed_transactions (reference, gateway, userId, amount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
        [reference, gateway, userId || null, amount || 0, status || 'success', new Date().toISOString()]
      );
    } catch (e) {
      console.error('[MySQL] Error recording processed transaction:', e);
    }
  },

  async getUsers(): Promise<UserRecord[]> {
    if (!mysqlAvailable) {
      return localUsers;
    }

    const [rows]: any = await pool.query('SELECT * FROM users');
    return rows;
  },

  async getUserById(id: string): Promise<UserRecord | undefined> {
    if (!mysqlAvailable) {
      return localUsers.find(u => u.id === id);
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    const cleanUsername = username.toLowerCase().trim();
    if (!mysqlAvailable) {
      return localUsers.find(u => u.username.toLowerCase().trim() === cleanUsername);
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const cleanEmail = email.toLowerCase().trim();
    if (!mysqlAvailable) {
      return localUsers.find(u => u.email.toLowerCase().trim() === cleanEmail);
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async getUserByVerificationToken(token: string): Promise<UserRecord | undefined> {
    if (!token) return undefined;
    const cleanToken = token.trim();
    if (!mysqlAvailable) {
      return localUsers.find(u => u.verificationToken === cleanToken);
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE verificationToken = ?', [cleanToken]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async createUser(user: Omit<UserRecord, 'id' | 'registrationDate'>): Promise<UserRecord> {
    const id = crypto.randomUUID();
    const registrationDate = new Date().toISOString();
    const newUser: UserRecord = {
      ...user,
      id,
      registrationDate,
      emailVerified: user.emailVerified !== undefined ? user.emailVerified : 1
    };

    if (!mysqlAvailable) {
      localUsers.push(newUser);
      return newUser;
    }

    await pool.query(`
      INSERT INTO users (
        id, fullName, username, email, passwordHash, jellyfinUserId, 
        subscriptionStatus, paymentStatus, registrationDate, 
        subscriptionStartDate, subscriptionExpiryDate, accountStatus, role,
        isAffiliate, affiliateCode, referredBy, disabledAt,
        emailVerified, verificationToken, verificationTokenExpires
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      newUser.fullName,
      newUser.username,
      newUser.email,
      newUser.passwordHash,
      newUser.jellyfinUserId || null,
      newUser.subscriptionStatus,
      newUser.paymentStatus,
      registrationDate,
      newUser.subscriptionStartDate || null,
      newUser.subscriptionExpiryDate || null,
      newUser.accountStatus,
      newUser.role,
      newUser.isAffiliate || 0,
      newUser.affiliateCode || null,
      newUser.referredBy || null,
      newUser.disabledAt || null,
      newUser.emailVerified !== undefined ? newUser.emailVerified : 1,
      newUser.verificationToken || null,
      newUser.verificationTokenExpires || null
    ]);
    return newUser;
  },

  async getUserByAffiliateCode(code: string): Promise<UserRecord | undefined> {
    const cleanCode = code.toUpperCase().trim();
    if (!mysqlAvailable) {
      return localUsers.find(u => u.affiliateCode && u.affiliateCode.toUpperCase().trim() === cleanCode);
    }
    const [rows]: any = await pool.query('SELECT * FROM users WHERE UPPER(affiliateCode) = ?', [cleanCode]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async createCommission(commission: Omit<CommissionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommissionRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommissionRecord = {
      ...commission,
      id,
      createdAt: now,
      updatedAt: now
    };
    if (!mysqlAvailable) {
      localCommissions.push(record);
      return record;
    }
    await pool.query(`
      INSERT INTO commissions (id, affiliateId, referredUserId, amount, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, record.affiliateId, record.referredUserId, record.amount, record.status, record.createdAt, record.updatedAt]);
    return record;
  },

  async getCommissions(): Promise<CommissionRecord[]> {
    if (!mysqlAvailable) {
      return localCommissions;
    }
    const [rows]: any = await pool.query('SELECT * FROM commissions ORDER BY createdAt DESC');
    return rows;
  },

  async getCommissionsByAffiliate(affiliateId: string): Promise<CommissionRecord[]> {
    if (!mysqlAvailable) {
      return localCommissions.filter(c => c.affiliateId === affiliateId);
    }
    const [rows]: any = await pool.query('SELECT * FROM commissions WHERE affiliateId = ? ORDER BY createdAt DESC', [affiliateId]);
    return rows;
  },

  async updateCommissionStatus(id: string, status: 'Pending' | 'Approved' | 'Paid'): Promise<void> {
    const now = new Date().toISOString();
    if (!mysqlAvailable) {
      const idx = localCommissions.findIndex(c => c.id === id);
      if (idx !== -1) {
        localCommissions[idx].status = status;
        localCommissions[idx].updatedAt = now;
      }
      return;
    }
    await pool.query('UPDATE commissions SET status = ?, updatedAt = ? WHERE id = ?', [status, now, id]);
  },

  async updateUser(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    if (!mysqlAvailable) {
      const idx = localUsers.findIndex(u => u.id === id);
      if (idx !== -1) {
        localUsers[idx] = { ...localUsers[idx], ...updates };
        return localUsers[idx];
      }
      return null;
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return (await this.getUserById(id)) || null;
    }

    const queryParts: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      queryParts.push(`\`${key}\` = ?`);
      values.push(val);
    }

    values.push(id);

    await pool.query(`
      UPDATE users 
      SET ${queryParts.join(', ')}
      WHERE id = ?
    `, values);

    return (await this.getUserById(id)) || null;
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!mysqlAvailable) {
      const idx = localUsers.findIndex(u => u.id === id);
      if (idx !== -1) {
        localUsers.splice(idx, 1);
        return true;
      }
      return false;
    }

    const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getSession(token: string): Promise<{ userId: string; expiresAt: number; jellyfinToken: string } | null> {
    if (!mysqlAvailable) {
      return localSessions.get(token) || null;
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM sessions WHERE token = ?', [token]);
      if (rows && rows.length > 0) {
        return {
          userId: rows[0].userId,
          expiresAt: Number(rows[0].expiresAt),
          jellyfinToken: rows[0].jellyfinToken || ''
        };
      }
    } catch (err) {
      console.error('Error fetching session from DB:', err);
    }
    return null;
  },

  async createSession(token: string, userId: string, expiresAt: number, jellyfinToken: string = ''): Promise<void> {
    if (!mysqlAvailable) {
      localSessions.set(token, { userId, expiresAt, jellyfinToken });
      return;
    }
    try {
      await pool.query(`
        INSERT INTO sessions (token, userId, expiresAt, jellyfinToken)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          userId = VALUES(userId),
          expiresAt = VALUES(expiresAt),
          jellyfinToken = VALUES(jellyfinToken)
      `, [token, userId, expiresAt, jellyfinToken]);
    } catch (err) {
      console.error('Error saving session to DB:', err);
    }
  },

  async updateSessionJellyfinToken(token: string, jellyfinToken: string): Promise<void> {
    if (!mysqlAvailable) {
      const sess = localSessions.get(token);
      if (sess) {
        sess.jellyfinToken = jellyfinToken;
      }
      return;
    }
    try {
      await pool.query('UPDATE sessions SET jellyfinToken = ? WHERE token = ?', [jellyfinToken, token]);
    } catch (err) {
      console.error('Error updating session Jellyfin token in DB:', err);
    }
  },

  async deleteSession(token: string): Promise<void> {
    if (!mysqlAvailable) {
      localSessions.delete(token);
      return;
    }
    try {
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    } catch (err) {
      console.error('Error deleting session from DB:', err);
    }
  },

  async cleanupExpiredSessions(): Promise<void> {
    if (!mysqlAvailable) {
      const now = Date.now();
      for (const [token, sess] of localSessions.entries()) {
        if (sess.expiresAt < now) {
          localSessions.delete(token);
        }
      }
      return;
    }
    try {
      await pool.query('DELETE FROM sessions WHERE expiresAt < ?', [Date.now()]);
    } catch (err) {
      console.error('Error cleaning up sessions:', err);
    }
  },

  async createMediaRequest(req: Omit<MediaRequestRecord, 'id' | 'createdAt' | 'status'>): Promise<MediaRequestRecord> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record: MediaRequestRecord = {
      ...req,
      id,
      status: 'Pending',
      createdAt
    };

    if (!mysqlAvailable) {
      localMediaRequests.push(record);
      return record;
    }

    await pool.query(`
      INSERT INTO media_requests (id, userId, username, type, title, releaseYear, season, episode, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `, [id, record.userId, record.username, record.type, record.title, record.releaseYear || null, record.season || null, record.episode || null, createdAt]);

    return record;
  },

  async getMediaRequests(): Promise<MediaRequestRecord[]> {
    if (!mysqlAvailable) {
      return localMediaRequests;
    }
    const [rows]: any = await pool.query('SELECT * FROM media_requests ORDER BY createdAt DESC');
    return rows;
  },

  async updateMediaRequestStatus(id: string, status: 'Pending' | 'Approved' | 'Declined'): Promise<void> {
    if (!mysqlAvailable) {
      const idx = localMediaRequests.findIndex(r => r.id === id);
      if (idx !== -1) {
        localMediaRequests[idx].status = status;
      }
      return;
    }
    await pool.query('UPDATE media_requests SET status = ? WHERE id = ?', [status, id]);
  },

  async createBroadcastNotification(notif: Omit<BroadcastNotificationRecord, 'id' | 'createdAt'>): Promise<BroadcastNotificationRecord> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record: BroadcastNotificationRecord = {
      ...notif,
      id,
      createdAt
    };

    if (!mysqlAvailable) {
      localBroadcastNotifications.push(record);
      return record;
    }

    await pool.query(`
      INSERT INTO broadcast_notifications (id, title, message, imageUrl, targetType, targetUserId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, record.title, record.message, record.imageUrl || null, record.targetType, record.targetUserId || null, createdAt]);

    return record;
  },

  async getBroadcastNotifications(): Promise<BroadcastNotificationRecord[]> {
    if (!mysqlAvailable) {
      return localBroadcastNotifications;
    }
    const [rows]: any = await pool.query('SELECT * FROM broadcast_notifications ORDER BY createdAt DESC');
    return rows;
  },

  async savePendingPayment(record: PendingPaymentRecord): Promise<void> {
    if (!mysqlAvailable) {
      localPendingPayments.set(record.transactionRef, record);
      return;
    }
    try {
      await pool.query(`
        INSERT INTO pending_payments (transactionRef, userId, username, email, amount, gateway, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          userId = VALUES(userId),
          username = VALUES(username),
          email = VALUES(email),
          amount = VALUES(amount),
          gateway = VALUES(gateway),
          status = VALUES(status)
      `, [
        record.transactionRef,
        record.userId,
        record.username,
        record.email,
        record.amount,
        record.gateway || 'squad',
        record.status || 'pending',
        record.createdAt || new Date().toISOString()
      ]);
    } catch (err) {
      console.error('Error saving pending payment to DB:', err);
    }
  },

  async getPendingPayment(transactionRef: string): Promise<PendingPaymentRecord | null> {
    if (!transactionRef) return null;
    if (!mysqlAvailable) {
      return localPendingPayments.get(transactionRef) || null;
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM pending_payments WHERE transactionRef = ?', [transactionRef]);
      if (rows && rows.length > 0) {
        return {
          transactionRef: rows[0].transactionRef,
          userId: rows[0].userId,
          username: rows[0].username,
          email: rows[0].email,
          amount: Number(rows[0].amount),
          gateway: rows[0].gateway,
          status: rows[0].status,
          createdAt: rows[0].createdAt
        };
      }
    } catch (err) {
      console.error('Error fetching pending payment from DB:', err);
    }
    return null;
  },

  async updatePendingPaymentStatus(transactionRef: string, status: string): Promise<void> {
    if (!transactionRef) return;
    if (!mysqlAvailable) {
      const rec = localPendingPayments.get(transactionRef);
      if (rec) rec.status = status;
      return;
    }
    try {
      await pool.query('UPDATE pending_payments SET status = ? WHERE transactionRef = ?', [status, transactionRef]);
    } catch (err) {
      console.error('Error updating pending payment status in DB:', err);
    }
  },

  async saveSquadMandate(mandate: SquadMandateRecord): Promise<void> {
    if (!mandate || !mandate.id) return;
    if (!mysqlAvailable) {
      const idx = localSquadMandates.findIndex(m => m.id === mandate.id || (mandate.mandateId && m.mandateId === mandate.mandateId));
      if (idx >= 0) {
        localSquadMandates[idx] = { ...localSquadMandates[idx], ...mandate };
      } else {
        localSquadMandates.push(mandate);
      }
      return;
    }
    try {
      await pool.query(`
        INSERT INTO squad_mandates (id, userId, mandateId, mandateReference, accountNumber, bankCode, bankName, accountName, amount, status, startDate, endDate, lastDebitDate, nextDebitDate, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      `, [
        mandate.id,
        mandate.userId,
        mandate.mandateId,
        mandate.mandateReference || null,
        mandate.accountNumber || null,
        mandate.bankCode || null,
        mandate.bankName || null,
        mandate.accountName || null,
        mandate.amount || 600.00,
        mandate.status || 'pending',
        mandate.startDate || null,
        mandate.endDate || null,
        mandate.lastDebitDate || null,
        mandate.nextDebitDate || null,
        mandate.createdAt || new Date().toISOString(),
        mandate.updatedAt || new Date().toISOString()
      ]);
    } catch (err) {
      console.error('Error saving squad mandate to DB:', err);
    }
  },

  async getSquadMandateByUserId(userId: string): Promise<SquadMandateRecord | null> {
    if (!userId) return null;
    if (!mysqlAvailable) {
      return localSquadMandates.find(m => m.userId === userId && m.status !== 'cancelled') || null;
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM squad_mandates WHERE userId = ? ORDER BY createdAt DESC LIMIT 1', [userId]);
      if (rows && rows.length > 0) {
        return rows[0] as SquadMandateRecord;
      }
    } catch (err) {
      console.error('Error fetching squad mandate by userId from DB:', err);
    }
    return null;
  },

  async getSquadMandateByMandateId(mandateId: string): Promise<SquadMandateRecord | null> {
    if (!mandateId) return null;
    if (!mysqlAvailable) {
      return localSquadMandates.find(m => m.mandateId === mandateId || m.id === mandateId) || null;
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM squad_mandates WHERE mandateId = ? OR id = ? LIMIT 1', [mandateId, mandateId]);
      if (rows && rows.length > 0) {
        return rows[0] as SquadMandateRecord;
      }
    } catch (err) {
      console.error('Error fetching squad mandate by mandateId from DB:', err);
    }
    return null;
  },

  async updateSquadMandate(idOrMandateId: string, updates: Partial<SquadMandateRecord>): Promise<void> {
    if (!idOrMandateId) return;
    const updatedAt = new Date().toISOString();
    if (!mysqlAvailable) {
      const idx = localSquadMandates.findIndex(m => m.id === idOrMandateId || m.mandateId === idOrMandateId);
      if (idx >= 0) {
        localSquadMandates[idx] = { ...localSquadMandates[idx], ...updates, updatedAt };
      }
      return;
    }
    try {
      const fields: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(val);
        }
      }
      fields.push('updatedAt = ?');
      values.push(updatedAt);
      values.push(idOrMandateId);
      values.push(idOrMandateId);

      await pool.query(`UPDATE squad_mandates SET ${fields.join(', ')} WHERE id = ? OR mandateId = ?`, values);
    } catch (err) {
      console.error('Error updating squad mandate in DB:', err);
    }
  },

  async getAllSquadMandates(): Promise<SquadMandateRecord[]> {
    if (!mysqlAvailable) {
      return [...localSquadMandates];
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM squad_mandates ORDER BY createdAt DESC');
      return (rows || []) as SquadMandateRecord[];
    } catch (err) {
      console.error('Error fetching all squad mandates from DB:', err);
      return [];
    }
  },

  async getActiveSquadMandatesDueForRenewal(): Promise<SquadMandateRecord[]> {
    const all = await this.getAllSquadMandates();
    const active = all.filter(m => m.status === 'active');
    return active;
  },

  async getUserByTransactionRef(transactionRef: string): Promise<UserRecord | undefined> {
    if (!transactionRef) return undefined;
    const cleanRef = transactionRef.trim();
    if (!mysqlAvailable) {
      return localUsers.find(u => u.transactionRef === cleanRef);
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM users WHERE transactionRef = ? LIMIT 1', [cleanRef]);
      if (rows && rows.length > 0) return rows[0];
    } catch (e) {
      console.error('Error fetching user by transactionRef from DB:', e);
    }
    return undefined;
  },

  async createSftpLog(log: SquadSftpLogRecord): Promise<void> {
    if (!mysqlAvailable) {
      localSquadSftpLogs.unshift(log);
      if (localSquadSftpLogs.length > 200) localSquadSftpLogs.pop();
      return;
    }
    try {
      await pool.query(
        'INSERT INTO squad_sftp_logs (id, event, status, filename, transactionRef, message, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [log.id, log.event, log.status, log.filename || null, log.transactionRef || null, log.message, log.createdAt]
      );
    } catch (e) {
      console.error('Error inserting squad SFTP log:', e);
    }
  },

  async getSftpLogs(limit: number = 100): Promise<SquadSftpLogRecord[]> {
    if (!mysqlAvailable) {
      return localSquadSftpLogs.slice(0, limit);
    }
    try {
      const [rows]: any = await pool.query('SELECT * FROM squad_sftp_logs ORDER BY createdAt DESC LIMIT ?', [limit]);
      return (rows || []) as SquadSftpLogRecord[];
    } catch (e) {
      console.error('Error fetching squad SFTP logs:', e);
      return [];
    }
  },

  async clearSftpLogs(): Promise<void> {
    if (!mysqlAvailable) {
      localSquadSftpLogs.length = 0;
      return;
    }
    try {
      await pool.query('DELETE FROM squad_sftp_logs');
    } catch (e) {
      console.error('Error clearing squad SFTP logs:', e);
    }
  },

  async updateSftpStatus(updates: { lastSync?: string; lastFile?: string; lastTxRef?: string; lastError?: string; lastStatus?: string }): Promise<void> {
    if (!mysqlAvailable) {
      if (localSystemConfig) {
        if (updates.lastSync !== undefined) localSystemConfig.squadSftpLastSync = updates.lastSync;
        if (updates.lastFile !== undefined) localSystemConfig.squadSftpLastFile = updates.lastFile;
        if (updates.lastTxRef !== undefined) localSystemConfig.squadSftpLastTxRef = updates.lastTxRef;
        if (updates.lastError !== undefined) localSystemConfig.squadSftpLastError = updates.lastError;
        if (updates.lastStatus !== undefined) localSystemConfig.squadSftpLastStatus = updates.lastStatus;
      }
      return;
    }
    try {
      const fields: string[] = [];
      const values: any[] = [];
      if (updates.lastSync !== undefined) { fields.push('squadSftpLastSync = ?'); values.push(updates.lastSync); }
      if (updates.lastFile !== undefined) { fields.push('squadSftpLastFile = ?'); values.push(updates.lastFile); }
      if (updates.lastTxRef !== undefined) { fields.push('squadSftpLastTxRef = ?'); values.push(updates.lastTxRef); }
      if (updates.lastError !== undefined) { fields.push('squadSftpLastError = ?'); values.push(updates.lastError); }
      if (updates.lastStatus !== undefined) { fields.push('squadSftpLastStatus = ?'); values.push(updates.lastStatus); }

      if (fields.length > 0) {
        await pool.query(`UPDATE system_config SET ${fields.join(', ')} WHERE id = 'main'`, values);
      }
    } catch (e) {
      console.error('Error updating squad SFTP status:', e);
    }
  }
};
