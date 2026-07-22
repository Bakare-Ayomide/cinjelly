import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword, UserRecord, initDb, mysqlAvailable, mysqlErrorMsg } from './server/db.js';
import { JellyfinService } from './server/jellyfin.js';

const app = express();
const PORT = 3000;

// Sessions memory store is replaced with persistent MySQL DB sessions to survive server restarts/compiles
// and prevent unauthorized access or 403 errors during active development sessions.

// JSON body parser (applied BEFORE other handlers, but we must make sure it doesn't break proxy)
app.use((req, res, next) => {
  // If request is for Jellyfin, skip body parsing so http-proxy-middleware can stream it natively
  if (req.url.startsWith('/jellyfin')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Custom Cookies and Session parser
app.use(async (req: any, res, next) => {
  const cookiesHeader = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  
  cookiesHeader.split(';').forEach((cookie: string) => {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx !== -1) {
      const key = cookie.substring(0, eqIdx).trim();
      const val = cookie.substring(eqIdx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  
  req.cookies = cookies;
  
  const token = cookies.session;
  if (token) {
    const session = await db.getSession(token);
    if (session && session.expiresAt > Date.now()) {
      try {
        const user = await db.getUserById(session.userId);
        if (user) {
          req.user = user;
        }
      } catch (err) {
        console.error('Error fetching session user:', err);
      }
    }
  }
  next();
});

// Dynamic Jellyfin Proxy
let activeProxy: any = null;
let activeTargetUrl = '';

const jellyfinProxy = async (req: any, res: any, next: any) => {
  try {
    const config = await db.getConfig();
    if (!config || !config.serverUrl) {
      return res.status(503).json({ error: 'Jellyfin server not configured yet.' });
    }

    const target = config.serverUrl.replace(/\/$/, '');

    if (!activeProxy || activeTargetUrl !== target) {
      activeTargetUrl = target;
      activeProxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: {
          '^/jellyfin': '' // remove /jellyfin when proxying to server
        },
        ws: true,
        on: {
          error: (err, req, res: any) => {
            console.error('Jellyfin proxy connection error:', err.message);
            if (res && typeof res.status === 'function') {
              res.status(502).send('Error connecting to media server. Please verify Jellyfin URL is reachable.');
            } else if (res && typeof res.end === 'function') {
              res.end();
            }
          }
        }
      });
    }

    return activeProxy(req, res, next);
  } catch (err: any) {
    next(err);
  }
};

// Mount the proxy
app.use('/jellyfin', jellyfinProxy);

// --- API Endpoints ---

// Check server status (Has config, Has users)
app.get('/api/status', async (req, res) => {
  try {
    if (!mysqlAvailable) {
      await initDb();
    }

    const config = await db.getConfig();
    const users = await db.getUsers();
    const hasAdmin = users.some(u => u.role === 'admin');

    res.json({
      configured: !!config,
      hasAdmin,
      serverUrl: config?.serverUrl || '',
      adminUsername: config?.adminUsername || '',
      mysqlAvailable: mysqlAvailable,
      mysqlError: mysqlAvailable ? null : (mysqlErrorMsg || 'Sandbox Memory Fallback Mode active'),
      iosDownloadUrl: config?.iosDownloadUrl || '',
      androidDownloadUrl: config?.androidDownloadUrl || ''
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MySQL connection diagnostic test endpoint for Vercel
app.get('/api/db-test', async (req, res) => {
  const host = process.env.DB_HOST || '131.153.147.178';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'zerolord_cinjelly';
  const database = process.env.DB_NAME || 'zerolord_cinjelly';
  
  try {
    await initDb();
    if (mysqlAvailable) {
      return res.json({
        success: true,
        message: 'Successfully connected to MySQL database!',
        connectionDetails: { host, port, user, database }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'MySQL connection failed.',
        error: mysqlErrorMsg,
        connectionDetails: { host, port, user, database },
        possibleCauses: [
          'cPanel Remote MySQL is blocking Vercel IP addresses. Ensure "%" is added under cPanel -> Remote MySQL.',
          'Port 3306 firewall block on cPanel server.',
          'Database credentials mismatch in Vercel environment variables.'
        ]
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to execute MySQL test.',
      error: err.message,
      code: err.code || 'UNKNOWN',
      connectionDetails: { host, port, user, database }
    });
  }
});

// Initial Setup Wizard: create the system administrator using backend environment configurations
app.post('/api/setup', async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required to run setup' });
    }

    // Load active config strictly from the backend environment variables
    const config = await db.getConfig();
    if (!config) {
      return res.status(400).json({ 
        error: 'Jellyfin Server is not configured. Please set the JELLYFIN_SERVER_URL, JELLYFIN_ADMIN_USERNAME, JELLYFIN_ADMIN_PASSWORD, and JELLYFIN_API_KEY environment variables first.' 
      });
    }

    // Try connecting to Jellyfin using the environment configuration to make sure it's valid
    const jellyfin = new JellyfinService(config);
    const connectionOk = await jellyfin.verifyConnection();

    if (!connectionOk) {
      return res.status(400).json({ 
        error: 'Could not connect to Jellyfin Server using the backend environment credentials. Please check your system variables.' 
      });
    }

    // Create the system administrator account (hashed password)
    const adminUser = await db.createUser({
      fullName,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      subscriptionStatus: 'Active',
      paymentStatus: 'Paid',
      accountStatus: 'Active',
      role: 'admin'
    });

    // Automatically synchronize/create the user on the Jellyfin server too!
    try {
      let jUserId = await jellyfin.getUserIdByName(username.trim());
      if (!jUserId) {
        console.log(`Creating user "${username}" on Jellyfin Server...`);
        jUserId = await jellyfin.createUser(username.trim(), password);
      }
      
      await db.updateUser(adminUser.id, { jellyfinUserId: jUserId });
    } catch (err: any) {
      console.warn('Could not auto-create admin user in Jellyfin:', err.message);
    }

    // Sign them in automatically
    const sessionToken = crypto.randomUUID();
    await db.createSession(sessionToken, adminUser.id, Date.now() + 7 * 24 * 60 * 60 * 1000);

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Portal initialized successfully!' });
  } catch (err: any) {
    console.error('Setup failed:', err);
    res.status(500).json({ error: err.message || 'Setup failed' });
  }
});

// Admin config update
app.get('/api/admin/config', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }
  const config = await db.getConfig() || {
    serverUrl: '',
    adminUsername: '',
    adminPasswordFull: '',
    apiKey: ''
  };
  res.json(config);
});

app.post('/api/admin/config', async (req: any, res) => {
  const existingConfig = await db.getConfig();
  const isAllowed = (req.user && req.user.role === 'admin') || !existingConfig;
  
  if (!isAllowed) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  
  const { 
    serverUrl, 
    adminUsername, 
    adminPasswordFull, 
    apiKey, 
    defaultCommission, 
    bankAccountNo, 
    bankName, 
    bankBeneficiary, 
    bankInstructions,
    chatbotInfo,
    chatbotInstructions,
    contactEmail,
    contactPhone,
    contactWhatsApp,
    contactOther,
    iosDownloadUrl,
    androidDownloadUrl
  } = req.body;
  if (!serverUrl || !adminUsername || !apiKey) {
    return res.status(400).json({ error: 'Server URL, Admin Username, and API Key are required.' });
  }
  
  const newConfig = {
    serverUrl,
    adminUsername,
    adminPasswordFull,
    apiKey,
    defaultCommission: defaultCommission !== undefined ? Number(defaultCommission) : 100.00,
    bankAccountNo: bankAccountNo || '',
    bankName: bankName || '',
    bankBeneficiary: bankBeneficiary || '',
    bankInstructions: bankInstructions || '',
    chatbotInfo: chatbotInfo || '',
    chatbotInstructions: chatbotInstructions || '',
    contactEmail: contactEmail || '',
    contactPhone: contactPhone || '',
    contactWhatsApp: contactWhatsApp || '',
    contactOther: contactOther || '',
    iosDownloadUrl: iosDownloadUrl || '',
    androidDownloadUrl: androidDownloadUrl || ''
  };
  
  const jellyfin = new JellyfinService(newConfig);
  const connectionOk = await jellyfin.verifyConnection();
  if (!connectionOk) {
    return res.status(400).json({ error: 'Could not connect to the Jellyfin Server with these credentials. Please verify the URL and API Key are correct and that the Jellyfin server is running and accessible.' });
  }
  
  await db.saveConfig(newConfig);
  res.json({ success: true, message: 'Configuration and payment information updated and saved in the database!' });
});

// Authentication
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, password, referredBy } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const config = await db.getConfig();
    if (!config) {
      return res.status(500).json({ error: 'Streaming server integration is not yet active. Please contact administrator.' });
    }

    if (referredBy) {
      const affiliateUser = await db.getUserByAffiliateCode(referredBy);
      if (!affiliateUser) {
        return res.status(400).json({ error: 'Invalid affiliate referral code' });
      }
    }

    // Check if user already exists
    const existingUsername = await db.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    const jellyfin = new JellyfinService(config);
    let jellyfinUserId = '';

    // 1. Create matching user account on Jellyfin Server dynamically!
    try {
      let existingJellyfinId = await jellyfin.getUserIdByName(username.trim());
      if (existingJellyfinId) {
        jellyfinUserId = existingJellyfinId;
        // Ensure they have full access to watch all movies and shows
        await jellyfin.grantAllPermissions(existingJellyfinId);
      } else {
        jellyfinUserId = await jellyfin.createUser(username.trim(), password);
      }
    } catch (err: any) {
      console.error('Failed to register user in Jellyfin:', err.message);
      return res.status(400).json({ error: `Jellyfin integration failed: ${err.message}` });
    }

    // 2. Create user record in our database
    const newUser = await db.createUser({
      fullName,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      jellyfinUserId,
      subscriptionStatus: 'Expired',
      paymentStatus: 'Unpaid',
      accountStatus: 'Expired',
      role: 'user',
      referredBy: referredBy ? referredBy.trim().toUpperCase() : undefined
    });

    // Disable account in Jellyfin initially since they are Unpaid/Expired!
    try {
      await jellyfin.setUserDisabledStatus(jellyfinUserId, true);
    } catch (err) {
      console.error('Failed to disable initial Jellyfin user:', err);
    }

    // Log user in automatically
    const sessionToken = crypto.randomUUID();
    await db.createSession(sessionToken, newUser.id, Date.now() + 7 * 24 * 60 * 60 * 1000);

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        subscriptionStatus: newUser.subscriptionStatus,
        paymentStatus: newUser.paymentStatus,
        role: newUser.role
      }
    });
  } catch (err: any) {
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Internal registration failure' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and Password are required' });
    }

    const user = await db.getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const config = await db.getConfig();
    let jellyfinToken = '';
    if (config) {
      const jellyfin = new JellyfinService(config);
      try {
        const authResult = await jellyfin.authenticateUser(username.trim(), password);
        jellyfinToken = authResult.accessToken;
      } catch (err) {
        console.error('Failed to pre-auth user with Jellyfin:', err);
      }
    }

    const sessionToken = crypto.randomUUID();
    await db.createSession(sessionToken, user.id, Date.now() + 7 * 24 * 60 * 60 * 1000, jellyfinToken);

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        paymentStatus: user.paymentStatus,
        subscriptionExpiryDate: user.subscriptionExpiryDate,
        role: user.role
      },
      jellyfinToken
    });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Internal login failure' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) {
    await db.deleteSession(token);
  }
  res.clearCookie('session');
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await db.getConfig();
    let jellyfinAuthToken = '';

    if (req.user.role === 'admin' || req.user.subscriptionStatus === 'Active') {
      if (config && req.user.jellyfinUserId) {
        const token = req.cookies?.session;
        const session = await db.getSession(token);
        if (session && session.jellyfinToken) {
          jellyfinAuthToken = session.jellyfinToken;
        }
      }
    }

    res.json({
      user: {
        id: req.user.id,
        fullName: req.user.fullName,
        username: req.user.username,
        email: req.user.email,
        subscriptionStatus: req.user.subscriptionStatus,
        paymentStatus: req.user.paymentStatus,
        subscriptionStartDate: req.user.subscriptionStartDate,
        subscriptionExpiryDate: req.user.subscriptionExpiryDate,
        jellyfinUserId: req.user.jellyfinUserId,
        role: req.user.role,
        isAffiliate: !!req.user.isAffiliate,
        affiliateCode: req.user.affiliateCode,
        referredBy: req.user.referredBy,
        declineReason: req.user.declineReason,
        systemNotification: req.user.systemNotification
      },
      jellyfinToken: jellyfinAuthToken
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ error: err.message || 'Internal session validation error' });
  }
});

// POST /api/auth/clear-notification
app.post('/api/auth/clear-notification', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await db.updateUser(req.user.id, { systemNotification: null });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to request auto-login setup if they are active but token is missing from session
app.post('/api/auth/jellyfin-token', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  // Verify portal password
  if (!verifyPassword(password, req.user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const config = await db.getConfig();
  if (!config) return res.status(500).json({ error: 'System not configured' });

  try {
    const jellyfin = new JellyfinService(config);
    const authResult = await jellyfin.authenticateUser(req.user.username, password);
    
    // Save token in active session
    const token = req.cookies?.session;
    if (token) {
      await db.updateSessionJellyfinToken(token, authResult.accessToken);
    }

    res.json({ success: true, jellyfinToken: authResult.accessToken });
  } catch (err: any) {
    res.status(400).json({ error: `Jellyfin sync failed: ${err.message}` });
  }
});

// Subscription Management & Simulation
app.post('/api/payment/simulate', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const config = await db.getConfig();
  if (!config) {
    return res.status(500).json({ error: 'System not configured' });
  }

  try {
    const userRecord = await db.getUserById(req.user.id);
    if (!userRecord) {
      return res.status(404).json({ error: 'User not found' });
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + 30); // 30 days expiration

    const updatedUser = await db.updateUser(req.user.id, {
      subscriptionStatus: 'Active',
      paymentStatus: 'Paid',
      accountStatus: 'Active',
      subscriptionStartDate: startDate.toISOString(),
      subscriptionExpiryDate: expiryDate.toISOString()
    });

    // Automatically re-enable Jellyfin account
    if (userRecord.jellyfinUserId) {
      const jellyfin = new JellyfinService(config);
      await jellyfin.setUserDisabledStatus(userRecord.jellyfinUserId, false);
    }

    // Generate affiliate commission if user has a valid referral
    if (userRecord.referredBy) {
      const affiliateUser = await db.getUserByAffiliateCode(userRecord.referredBy);
      if (affiliateUser) {
        const commissionAmount = config.defaultCommission !== undefined ? Number(config.defaultCommission) : 100.00;
        await db.createCommission({
          affiliateId: affiliateUser.id,
          referredUserId: userRecord.id,
          amount: commissionAmount,
          status: 'Approved'
        });
      }
    }

    res.json({
      success: true,
      message: 'Subscription successfully activated for 30 days! Jellyfin access enabled.',
      subscriptionExpiryDate: expiryDate.toISOString()
    });
  } catch (err: any) {
    console.error('Payment simulation failed:', err);
    res.status(500).json({ error: 'Failed to process simulated payment' });
  }
});

// GET /api/payment/bank-info
app.get('/api/payment/bank-info', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const config = await db.getConfig();
    if (!config) {
      return res.status(500).json({ error: 'System not configured' });
    }
    res.json({
      bankAccountNo: config.bankAccountNo || '',
      bankName: config.bankName || '',
      bankBeneficiary: config.bankBeneficiary || '',
      bankInstructions: config.bankInstructions || '',
      chatbotInfo: config.chatbotInfo || '',
      chatbotInstructions: config.chatbotInstructions || '',
      contactEmail: config.contactEmail || '',
      contactPhone: config.contactPhone || '',
      contactWhatsApp: config.contactWhatsApp || '',
      contactOther: config.contactOther || ''
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/request-verification
app.post('/api/payment/request-verification', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const updatedUser = await db.updateUser(req.user.id, {
      paymentStatus: 'Pending Verification'
    });
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/upload-receipt
app.post('/api/payment/upload-receipt', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { base64Data, fileName, phone, transactionRef } = req.body;
    if (!base64Data || !fileName || !phone) {
      return res.status(400).json({ error: 'Missing base64Data, fileName, or phone number' });
    }

    const date = new Date();
    const monthFolder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const relativeDir = path.join('uploads', 'receipts', monthFolder);
    const distDirPath = path.join(process.cwd(), 'dist', relativeDir);
    const publicDirPath = path.join(process.cwd(), 'public', relativeDir);

    if (!fs.existsSync(distDirPath)) {
      fs.mkdirSync(distDirPath, { recursive: true });
    }
    try {
      if (!fs.existsSync(publicDirPath)) {
        fs.mkdirSync(publicDirPath, { recursive: true });
      }
    } catch (e) {}

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    const fileExt = path.extname(fileName) || '.png';
    const cleanFileName = `${req.user.username}_${Date.now()}${fileExt}`;

    const distFilePath = path.join(distDirPath, cleanFileName);
    fs.writeFileSync(distFilePath, buffer);

    try {
      const publicFilePath = path.join(publicDirPath, cleanFileName);
      fs.writeFileSync(publicFilePath, buffer);
    } catch (e) {}

    const relativeUrl = `/uploads/receipts/${monthFolder}/${cleanFileName}`;

    const updatedUser = await db.updateUser(req.user.id, {
      paymentStatus: 'Pending Verification',
      receiptUrl: relativeUrl,
      phone,
      transactionRef: transactionRef || null,
      lastPaymentTime: date.toISOString()
    });

    res.json({ success: true, user: updatedUser, receiptUrl: relativeUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/payments/verify
app.post('/api/admin/payments/verify', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden: Admin only' });
  }

  const { userId, action, declineReason } = req.body;
  if (!userId || !action) {
    return res.status(400).json({ error: 'Missing userId or action' });
  }

  try {
    const userToVerify = await db.getUserById(userId);
    if (!userToVerify) {
      return res.status(404).json({ error: 'User not found' });
    }

    const config = await db.getConfig();

    if (action === 'accept') {
      const daysToAdd = 30;
      let currentExpiry = Date.now();
      if (userToVerify.subscriptionExpiryDate) {
        const existingExpiry = new Date(userToVerify.subscriptionExpiryDate).getTime();
        if (existingExpiry > Date.now()) {
          currentExpiry = existingExpiry;
        }
      }
      const newExpiryDate = new Date(currentExpiry + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

      const updatedUser = await db.updateUser(userId, {
        subscriptionStatus: 'Active',
        accountStatus: 'Active',
        paymentStatus: 'Paid',
        subscriptionExpiryDate: newExpiryDate,
        declineReason: null,
        systemNotification: 'accepted'
      });

      if (userToVerify.jellyfinUserId && config) {
        try {
          const jellyfin = new JellyfinService(config);
          await jellyfin.setUserDisabledStatus(userToVerify.jellyfinUserId, false);
        } catch (e: any) {
          console.error(`[Admin Verify] Jellyfin sync failed for user ${userToVerify.username}:`, e.message);
        }
      }

      if (userToVerify.referredBy) {
        const affiliateUser = await db.getUserByAffiliateCode(userToVerify.referredBy);
        if (affiliateUser) {
          const commissionAmount = config?.defaultCommission !== undefined ? Number(config.defaultCommission) : 100.00;
          await db.createCommission({
            affiliateId: affiliateUser.id,
            referredUserId: userToVerify.id,
            amount: commissionAmount,
            status: 'Approved'
          });
        }
      }

      return res.json({ success: true, user: updatedUser });

    } else if (action === 'decline') {
      const updatedUser = await db.updateUser(userId, {
        paymentStatus: 'Unpaid',
        declineReason: declineReason || 'Payment verification failed',
        systemNotification: 'declined'
      });

      return res.json({ success: true, user: updatedUser });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin User Management
app.get('/api/admin/users', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const searchQuery = (req.query.search || '').toString().toLowerCase().trim();
    let users = await db.getUsers();

    if (searchQuery) {
      users = users.filter(u => 
        u.fullName.toLowerCase().includes(searchQuery) ||
        u.username.toLowerCase().includes(searchQuery) ||
        u.email.toLowerCase().includes(searchQuery)
      );
    }

    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Create User
app.post('/api/admin/users', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  const { fullName, username, email, password, subscriptionStatus, paymentStatus, accountStatus, role, subscriptionExpiryDate, referredBy, isAffiliate, affiliateCode } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: 'Full Name, Username, Email, and Password are required.' });
  }

  try {
    const existingUserByUsername = await db.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const existingUserByEmail = await db.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    const config = await db.getConfig();
    let jellyfinUserId = '';

    if (config) {
      const jellyfin = new JellyfinService(config);
      try {
        const existingJUserId = await jellyfin.getUserIdByName(username);
        if (existingJUserId) {
          jellyfinUserId = existingJUserId;
          await jellyfin.grantAllPermissions(existingJUserId);
        } else {
          jellyfinUserId = await jellyfin.createUser(username, password);
        }

        if (subscriptionStatus !== 'Active') {
          await jellyfin.setUserDisabledStatus(jellyfinUserId, true);
        }
      } catch (err: any) {
        console.error('Jellyfin user sync failed on admin create:', err.message);
      }
    }

    const newUser = await db.createUser({
      fullName,
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      jellyfinUserId: jellyfinUserId || null,
      subscriptionStatus: subscriptionStatus || 'Disabled',
      paymentStatus: paymentStatus || 'Unpaid',
      accountStatus: accountStatus || 'Disabled',
      role: role || 'user',
      subscriptionStartDate: subscriptionStatus === 'Active' ? new Date().toISOString() : null,
      subscriptionExpiryDate: subscriptionExpiryDate || null,
      referredBy: referredBy || null,
      isAffiliate: isAffiliate ? 1 : 0,
      affiliateCode: affiliateCode || null
    });

    res.json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Update User
app.put('/api/admin/users/:id', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  const targetUserId = req.params.id;
  const { fullName, username, email, password, subscriptionStatus, paymentStatus, accountStatus, role, subscriptionStartDate, subscriptionExpiryDate, referredBy, isAffiliate, affiliateCode } = req.body;

  try {
    const targetUser = await db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (username && username.toLowerCase() !== targetUser.username.toLowerCase()) {
      const duplicate = await db.getUserByUsername(username);
      if (duplicate) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const duplicate = await db.getUserByEmail(email);
      if (duplicate) {
        return res.status(400).json({ error: 'Email address is already registered' });
      }
    }

    const updates: any = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (username !== undefined) updates.username = username.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (subscriptionStatus !== undefined) updates.subscriptionStatus = subscriptionStatus;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (accountStatus !== undefined) updates.accountStatus = accountStatus;
    if (role !== undefined) updates.role = role;
    if (subscriptionStartDate !== undefined) updates.subscriptionStartDate = subscriptionStartDate;
    if (subscriptionExpiryDate !== undefined) updates.subscriptionExpiryDate = subscriptionExpiryDate;
    if (referredBy !== undefined) updates.referredBy = referredBy;
    if (isAffiliate !== undefined) updates.isAffiliate = isAffiliate ? 1 : 0;
    if (affiliateCode !== undefined) updates.affiliateCode = affiliateCode;

    if (password) {
      updates.passwordHash = hashPassword(password);
    }

    const updatedUser = await db.updateUser(targetUserId, updates);

    // Sync status and password if updated
    const config = await db.getConfig();
    if (config && targetUser.jellyfinUserId) {
      const jellyfin = new JellyfinService(config);
      try {
        if (subscriptionStatus !== undefined) {
          const isDisabled = subscriptionStatus !== 'Active';
          await jellyfin.setUserDisabledStatus(targetUser.jellyfinUserId, isDisabled);
        }
        if (password) {
          await jellyfin.updateUserPassword(targetUser.jellyfinUserId, password);
        }
      } catch (err: any) {
        console.error('Jellyfin sync failed on admin update:', err.message);
      }
    }

    res.json(updatedUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete User
app.delete('/api/admin/users/:id', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  const targetUserId = req.params.id;

  try {
    const targetUser = await db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete locally
    await db.deleteUser(targetUserId);

    // Delete from Jellyfin
    const config = await db.getConfig();
    if (config && targetUser.jellyfinUserId) {
      const jellyfin = new JellyfinService(config);
      try {
        await jellyfin.deleteUser(targetUser.jellyfinUserId);
      } catch (err: any) {
        console.error('Jellyfin user deletion failed:', err.message);
      }
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin manage subscription status manually
app.post('/api/admin/users/:id/subscription', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  const { action } = req.body; 
  const targetUserId = req.params.id;

  try {
    const targetUser = await db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const config = await db.getConfig();
    if (!config) {
      return res.status(500).json({ error: 'System not configured' });
    }

    const jellyfin = new JellyfinService(config);
    let updates: Partial<UserRecord> = {};
    let isDisabledInJellyfin = false;

    if (action === 'activate' || action === 'reactivate') {
      const start = new Date();
      const expiry = new Date();
      expiry.setDate(start.getDate() + 30);

      updates = {
        subscriptionStatus: 'Active',
        paymentStatus: 'Paid',
        accountStatus: 'Active',
        subscriptionStartDate: start.toISOString(),
        subscriptionExpiryDate: expiry.toISOString()
      };
      isDisabledInJellyfin = false;
    } else if (action === 'extend') {
      const currentExpiry = targetUser.subscriptionExpiryDate ? new Date(targetUser.subscriptionExpiryDate) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
      newExpiry.setDate(newExpiry.getDate() + 30);

      updates = {
        subscriptionStatus: 'Active',
        paymentStatus: 'Paid',
        accountStatus: 'Active',
        subscriptionExpiryDate: newExpiry.toISOString()
      };
      isDisabledInJellyfin = false;
    } else if (action === 'disable') {
      updates = {
        subscriptionStatus: 'Disabled',
        accountStatus: 'Disabled'
      };
      isDisabledInJellyfin = true;
    } else {
      return res.status(400).json({ error: 'Invalid action provided' });
    }

    // Update locally
    const updatedUser = await db.updateUser(targetUserId, updates);

    // Sync to Jellyfin instantly!
    if (targetUser.jellyfinUserId) {
      await jellyfin.setUserDisabledStatus(targetUser.jellyfinUserId, isDisabledInJellyfin);
    }

    // Generate affiliate commission if user has a valid referral
    if ((action === 'activate' || action === 'reactivate' || action === 'extend') && targetUser.referredBy) {
      const affiliateUser = await db.getUserByAffiliateCode(targetUser.referredBy);
      if (affiliateUser) {
        const commissionAmount = config.defaultCommission !== undefined ? Number(config.defaultCommission) : 100.00;
        await db.createCommission({
          affiliateId: affiliateUser.id,
          referredUserId: targetUser.id,
          amount: commissionAmount,
          status: 'Approved'
        });
      }
    }

    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error(`Admin action ${action} failed for user ${targetUserId}:`, err);
    res.status(500).json({ error: `Admin action failed: ${err.message}` });
  }
});

// Admin trigger manual daily job check
app.post('/api/admin/run-expiry-check', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const count = await checkSubscriptionExpiries();
  res.json({ success: true, expiredCount: count });
});

// --- AFFILIATE PROGRAM ENDPOINTS ---

// POST /api/affiliate/join
app.post('/api/affiliate/join', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const affiliateCode = req.user.username.toUpperCase().slice(0, 4) + Math.floor(100 + Math.random() * 900);
    const updatedUser = await db.updateUser(req.user.id, {
      isAffiliate: 1,
      affiliateCode
    });

    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/affiliate/stats
app.get('/api/affiliate/stats', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await db.getUserById(req.user.id);
  if (!user || !user.isAffiliate) {
    return res.status(403).json({ error: 'User is not registered as an affiliate' });
  }

  try {
    const config = await db.getConfig();
    const defaultCommission = config?.defaultCommission !== undefined ? Number(config.defaultCommission) : 100.00;
    const affiliateCode = user.affiliateCode || '';
    const users = await db.getUsers();
    const commissions = await db.getCommissionsByAffiliate(user.id);

    const referredUsers = [];
    let registeredCount = 0;
    let paidCount = 0;

    for (const u of users) {
      if (u.referredBy && u.referredBy.toUpperCase() === affiliateCode.toUpperCase()) {
        registeredCount++;
        const isPaid = u.paymentStatus === 'Paid' || u.subscriptionStatus === 'Active';
        if (isPaid) {
          paidCount++;
        }
        referredUsers.push({
          id: u.id,
          fullName: u.fullName,
          username: u.username,
          registrationDate: u.registrationDate,
          paymentStatus: u.paymentStatus,
          subscriptionStatus: u.subscriptionStatus
        });
      }
    }

    let pendingCommission = 0.0;
    let approvedCommission = 0.0;
    let paidCommission = 0.0;
    let totalCommission = 0.0;

    for (const c of commissions) {
      const amt = Number(c.amount);
      totalCommission += amt;
      if (c.status === 'Pending') {
        pendingCommission += amt;
      } else if (c.status === 'Approved') {
        approvedCommission += amt;
      } else if (c.status === 'Paid') {
        paidCommission += amt;
      }
    }

    res.json({
      affiliateCode,
      registeredCount,
      paidCount,
      pendingCommission,
      approvedCommission,
      paidCommission,
      totalCommission,
      defaultCommission,
      referredUsers,
      commissions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/affiliate
app.post('/api/admin/users/:id/affiliate', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  const targetUserId = req.params.id;
  const isAffiliate = req.body.isAffiliate ? 1 : 0;
  let affiliateCode = (req.body.affiliateCode || '').trim();

  try {
    const targetUser = await db.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (isAffiliate) {
      if (!affiliateCode) {
        affiliateCode = targetUser.username.toUpperCase().slice(0, 4) + Math.floor(100 + Math.random() * 900);
      }

      const existing = await db.getUserByAffiliateCode(affiliateCode);
      if (existing && existing.id !== targetUserId) {
        return res.status(400).json({ error: 'Affiliate code is already taken' });
      }

      const updatedUser = await db.updateUser(targetUserId, {
        isAffiliate: 1,
        affiliateCode
      });
      res.json({ success: true, user: updatedUser });
    } else {
      const updatedUser = await db.updateUser(targetUserId, {
        isAffiliate: 0
      });
      res.json({ success: true, user: updatedUser });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/commissions
app.get('/api/admin/commissions', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const commissions = await db.getCommissions();
    const users = await db.getUsers();
    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set(u.id, u);
    }

    const result = [];
    for (const c of commissions) {
      const affiliate = userMap.get(c.affiliateId);
      const referred = userMap.get(c.referredUserId);
      result.push({
        id: c.id,
        affiliateId: c.affiliateId,
        affiliateName: affiliate ? affiliate.fullName : 'Unknown',
        affiliateUsername: affiliate ? affiliate.username : 'Unknown',
        referredUserId: c.referredUserId,
        referredName: referred ? referred.fullName : 'Unknown',
        referredUsername: referred ? referred.username : 'Unknown',
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/commissions/:id/status
app.post('/api/admin/commissions/:id/status', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const commissionId = req.params.id;
  const { status } = req.body;
  if (status !== 'Pending' && status !== 'Approved' && status !== 'Paid') {
    return res.status(400).json({ error: 'Invalid commission status' });
  }

  try {
    await db.updateCommissionStatus(commissionId, status);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/affiliates
app.get('/api/admin/affiliates', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const allUsers = await db.getUsers();
    const affiliates = allUsers.filter(u => u.isAffiliate === 1);
    const result = [];

    for (const affiliate of affiliates) {
      const commissions = await db.getCommissionsByAffiliate(affiliate.id);
      const referredUsers = [];
      let registeredCount = 0;
      let paidCount = 0;

      for (const u of allUsers) {
        if (u.referredBy && u.referredBy.toUpperCase() === (affiliate.affiliateCode || '').toUpperCase()) {
          registeredCount++;
          const isPaid = u.paymentStatus === 'Paid' || u.subscriptionStatus === 'Active';
          if (isPaid) {
            paidCount++;
          }
          referredUsers.push({
            id: u.id,
            fullName: u.fullName,
            username: u.username,
            email: u.email,
            registrationDate: u.registrationDate,
            paymentStatus: u.paymentStatus,
            subscriptionStatus: u.subscriptionStatus
          });
        }
      }

      let pendingCommission = 0.0;
      let approvedCommission = 0.0;
      let paidCommission = 0.0;
      let totalCommission = 0.0;

      for (const c of commissions) {
        const amt = Number(c.amount);
        totalCommission += amt;
        if (c.status === 'Pending') {
          pendingCommission += amt;
        } else if (c.status === 'Approved') {
          approvedCommission += amt;
        } else if (c.status === 'Paid') {
          paidCommission += amt;
        }
      }

      result.push({
        id: affiliate.id,
        fullName: affiliate.fullName,
        username: affiliate.username,
        email: affiliate.email,
        affiliateCode: affiliate.affiliateCode,
        registrationDate: affiliate.registrationDate,
        registeredCount,
        paidCount,
        pendingCommission,
        approvedCommission,
        paidCommission,
        totalCommission,
        referredUsers,
        commissions
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/requests
app.post('/api/media/requests', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, title, releaseYear, season, episode } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: 'Type and Title are required' });
  }

  try {
    const record = await db.createMediaRequest({
      userId: req.user.id,
      username: req.user.username,
      type,
      title,
      releaseYear: releaseYear || null,
      season: season || null,
      episode: episode || null
    });
    res.json({ success: true, request: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/requests
app.get('/api/media/requests', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.user.role === 'admin') {
      const requests = await db.getMediaRequests();
      res.json(requests);
    } else {
      const requests = await db.getMediaRequests();
      const filtered = requests.filter(r => r.userId === req.user.id);
      res.json(filtered);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/media/requests/:id
app.put('/api/admin/media/requests/:id', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { status } = req.body;
  if (status !== 'Pending' && status !== 'Approved' && status !== 'Declined') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await db.updateMediaRequestStatus(req.params.id, status);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/notifications/broadcast
app.post('/api/admin/notifications/broadcast', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { title, message, imageUrl, targetType, targetUserId } = req.body;
  if (!title || !message || !targetType) {
    return res.status(400).json({ error: 'Title, message, and targetType are required' });
  }

  try {
    const record = await db.createBroadcastNotification({
      title,
      message,
      imageUrl: imageUrl || null,
      targetType,
      targetUserId: targetType === 'user' ? (targetUserId || null) : null
    });
    res.json({ success: true, notification: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/notifications/all
app.get('/api/admin/notifications/all', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const allNotifs = await db.getBroadcastNotifications();
    res.json(allNotifs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/notifications/upload
app.post('/api/admin/notifications/upload', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { base64Data, fileName } = req.body;
    if (!base64Data || !fileName) {
      return res.status(400).json({ error: 'Missing base64Data or fileName' });
    }

    const uploadDir = path.join('uploads', 'notifications');
    const distDirPath = path.join(process.cwd(), 'dist', uploadDir);
    const publicDirPath = path.join(process.cwd(), 'public', uploadDir);

    if (!fs.existsSync(distDirPath)) {
      fs.mkdirSync(distDirPath, { recursive: true });
    }
    try {
      if (!fs.existsSync(publicDirPath)) {
        fs.mkdirSync(publicDirPath, { recursive: true });
      }
    } catch (e) {}

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    const fileExt = path.extname(fileName) || '.png';
    const cleanFileName = `notif_${Date.now()}${fileExt}`;

    const distFilePath = path.join(distDirPath, cleanFileName);
    fs.writeFileSync(distFilePath, buffer);

    try {
      const publicFilePath = path.join(publicDirPath, cleanFileName);
      fs.writeFileSync(publicFilePath, buffer);
    } catch (e) {}

    // Expose correct URL path
    const relativeUrl = `/uploads/notifications/${cleanFileName}`;
    res.json({ success: true, url: relativeUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/broadcast
app.get('/api/notifications/broadcast', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const allNotifs = await db.getBroadcastNotifications();
    const user = req.user;
    const filtered = allNotifs.filter(n => {
      if (n.targetType === 'all') return true;
      if (n.targetType === 'affiliate' && user.isAffiliate) return true;
      if (n.targetType === 'paid' && user.subscriptionStatus === 'Active') return true;
      if (n.targetType === 'free' && user.subscriptionStatus !== 'Active') return true;
      if (n.targetType === 'user' && n.targetUserId === user.id) return true;
      return false;
    });
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- BACKGROUND EXPIRY JOB ---

async function checkSubscriptionExpiries(): Promise<number> {
  console.log('[Expiry Job] Running subscription expiration audit...');
  try {
    const config = await db.getConfig();
    if (!config) {
      console.log('[Expiry Job] Skipping audit: Jellyfin is not configured yet.');
      return 0;
    }

    const jellyfin = new JellyfinService(config);
    const users = await db.getUsers();
    let expiredCount = 0;

    for (const user of users) {
      if (user.role === 'admin') continue; // Skip administrators

      // Only inspect active subscriptions
      if (user.subscriptionStatus === 'Active' && user.subscriptionExpiryDate) {
        const expiry = new Date(user.subscriptionExpiryDate);
        if (expiry.getTime() < Date.now()) {
          console.log(`[Expiry Job] User "${user.username}" subscription expired. Disabling access...`);
          
          await db.updateUser(user.id, {
            subscriptionStatus: 'Expired',
            accountStatus: 'Expired'
          });

          // Automatically disable account on Jellyfin server!
          if (user.jellyfinUserId) {
            try {
              await jellyfin.setUserDisabledStatus(user.jellyfinUserId, true);
              console.log(`[Expiry Job] Successfully disabled Jellyfin account for "${user.username}".`);
            } catch (err: any) {
              console.error(`[Expiry Job] Failed to disable Jellyfin account for user "${user.username}":`, err.message);
            }
          }
          expiredCount++;
        }
      }
    }

    console.log(`[Expiry Job] Audit complete. Expired and disabled ${expiredCount} users.`);
    return expiredCount;
  } catch (err: any) {
    console.error('[Expiry Job] Error checking subscription expiries:', err.message);
    return 0;
  }
}

// Boot checking + Daily Background Job interval (every 12 hours)
setTimeout(() => {
  checkSubscriptionExpiries().catch(err => console.error('Error running boot subscription audit:', err));
}, 5000);

setInterval(() => {
  checkSubscriptionExpiries().catch(err => console.error('Error running periodic subscription audit:', err));
}, 12 * 60 * 60 * 1000); // 12 hours


// --- GLOBAL ERROR HANDLING MIDDLEWARE ---
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Global Error Handler] Caught exception:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error. Please verify database connection.' 
  });
});

// --- VITE MIDDLEWARE AND PRODUCTION STATIC ROUTING ---

const startServer = async () => {
  // Initialize MySQL tables
  await initDb();

  // Expose uploads directory statically so receipts can be served directly
  app.use('/uploads', express.static(path.join(process.cwd(), 'dist', 'uploads')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start full-stack server:', err);
  });
}

export default app;
