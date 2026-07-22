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
            androidDownloadUrl: rows[0].androidDownloadUrl || ''
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
      INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey, defaultCommission, bankAccountNo, bankName, bankBeneficiary, bankInstructions, chatbotInfo, chatbotInstructions, contactEmail, contactPhone, contactWhatsApp, contactOther, iosDownloadUrl, androidDownloadUrl)
      VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        androidDownloadUrl = VALUES(androidDownloadUrl)
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
      config.androidDownloadUrl || null
    ]);
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

  async createUser(user: Omit<UserRecord, 'id' | 'registrationDate'>): Promise<UserRecord> {
    const id = crypto.randomUUID();
    const registrationDate = new Date().toISOString();
    const newUser: UserRecord = {
      ...user,
      id,
      registrationDate
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
        isAffiliate, affiliateCode, referredBy, disabledAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      newUser.disabledAt || null
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
  }
};
