import mysql from 'mysql2/promise';
import crypto from 'crypto';

export interface JellyfinConfig {
  serverUrl: string;
  adminUsername: string;
  adminPassword?: string;
  adminPasswordFull?: string;
  apiKey: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  jellyfinUserId?: string;
  subscriptionStatus: 'Active' | 'Expired' | 'Disabled';
  paymentStatus: 'Paid' | 'Unpaid';
  registrationDate: string;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  accountStatus: 'Active' | 'Expired' | 'Disabled';
  role: 'admin' | 'user';
}

export let mysqlAvailable = false;
export let mysqlErrorMsg: string | null = null;

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
  keepAliveInitialDelay: 10000
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

    // Create persistent sessions table to keep user logins intact across server restarts/compiles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        expiresAt BIGINT NOT NULL,
        jellyfinToken VARCHAR(255) NULL
      )
    `);
    
    console.log('[MySQL] Database tables checked and ready.');
    mysqlAvailable = true;
    mysqlErrorMsg = null;
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
    // Priority: Environment variables (isolated backend configuration)
    const envUrl = process.env.JELLYFIN_SERVER_URL;
    const envUsername = process.env.JELLYFIN_ADMIN_USERNAME;
    const envPassword = process.env.JELLYFIN_ADMIN_PASSWORD;
    const envApiKey = process.env.JELLYFIN_API_KEY;

    if (envUrl && envUsername && envApiKey) {
      return {
        serverUrl: envUrl,
        adminUsername: envUsername,
        adminPasswordFull: envPassword,
        apiKey: envApiKey
      };
    }

    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const [rows]: any = await pool.query('SELECT * FROM system_config WHERE id = "main" LIMIT 1');
    if (rows && rows.length > 0) {
      return {
        serverUrl: rows[0].serverUrl,
        adminUsername: rows[0].adminUsername,
        adminPasswordFull: rows[0].adminPasswordFull,
        apiKey: rows[0].apiKey
      };
    }
    return null;
  },

  async saveConfig(config: JellyfinConfig): Promise<void> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    await pool.query(`
      INSERT INTO system_config (id, serverUrl, adminUsername, adminPasswordFull, apiKey)
      VALUES ('main', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        serverUrl = VALUES(serverUrl),
        adminUsername = VALUES(adminUsername),
        adminPasswordFull = VALUES(adminPasswordFull),
        apiKey = VALUES(apiKey)
    `, [config.serverUrl, config.adminUsername, config.adminPasswordFull || null, config.apiKey]);
  },

  async getUsers(): Promise<UserRecord[]> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const [rows]: any = await pool.query('SELECT * FROM users');
    return rows;
  },

  async getUserById(id: string): Promise<UserRecord | undefined> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const cleanUsername = username.toLowerCase().trim();
    const [rows]: any = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const cleanEmail = email.toLowerCase().trim();
    const [rows]: any = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (rows && rows.length > 0) return rows[0];
    return undefined;
  },

  async createUser(user: Omit<UserRecord, 'id' | 'registrationDate'>): Promise<UserRecord> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const id = crypto.randomUUID();
    const registrationDate = new Date().toISOString();
    const newUser: UserRecord = {
      ...user,
      id,
      registrationDate
    };

    await pool.query(`
      INSERT INTO users (
        id, fullName, username, email, passwordHash, jellyfinUserId, 
        subscriptionStatus, paymentStatus, registrationDate, 
        subscriptionStartDate, subscriptionExpiryDate, accountStatus, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      newUser.role
    ]);
    return newUser;
  },

  async updateUser(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    if (!mysqlAvailable) {
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
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
      throw new Error(`MySQL Connection Error: ${mysqlErrorMsg || 'Access denied'}`);
    }

    const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async getSession(token: string): Promise<{ userId: string; expiresAt: number; jellyfinToken: string } | null> {
    if (!mysqlAvailable) return null;
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
    if (!mysqlAvailable) return;
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
    if (!mysqlAvailable) return;
    try {
      await pool.query('UPDATE sessions SET jellyfinToken = ? WHERE token = ?', [jellyfinToken, token]);
    } catch (err) {
      console.error('Error updating session Jellyfin token in DB:', err);
    }
  },

  async deleteSession(token: string): Promise<void> {
    if (!mysqlAvailable) return;
    try {
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    } catch (err) {
      console.error('Error deleting session from DB:', err);
    }
  },

  async cleanupExpiredSessions(): Promise<void> {
    if (!mysqlAvailable) return;
    try {
      await pool.query('DELETE FROM sessions WHERE expiresAt < ?', [Date.now()]);
    } catch (err) {
      console.error('Error cleaning up sessions:', err);
    }
  }
};
