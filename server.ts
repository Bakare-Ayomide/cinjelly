import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword, UserRecord, initDb, mysqlAvailable, mysqlErrorMsg } from './server/db.js';
import { JellyfinService } from './server/jellyfin.js';
import { 
  sendEmail, 
  testSmtpConnection, 
  replaceTemplateVars, 
  DEFAULT_VERIFICATION_TEMPLATE, 
  DEFAULT_WELCOME_TEMPLATE, 
  DEFAULT_NOTIFICATION_TEMPLATE 
} from './server/email.js';

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
      return res.status(503).json({ error: 'Media server not configured yet.' });
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
              res.status(502).send('Error connecting to media server. Please verify server URL is reachable.');
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
      androidDownloadUrl: config?.androidDownloadUrl || '',
      emailVerificationEnabled: !!(config?.emailVerificationEnabled && config?.smtpEnabled),
      smtpEnabled: !!(config?.smtpEnabled && config?.smtpHost)
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
        error: 'Media Server is not configured. Please set the server URL, admin username, password, and API Key variables first.' 
      });
    }

    // Try connecting to Media Server using the environment configuration to make sure it's valid
    const jellyfin = new JellyfinService(config);
    const connectionOk = await jellyfin.verifyConnection();

    if (!connectionOk) {
      return res.status(400).json({ 
        error: 'Could not connect to Media Server using the backend credentials. Please check your system variables.' 
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
    androidDownloadUrl,
    // SMTP fields
    smtpEnabled,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFromName,
    smtpFromEmail,
    // Email Templates
    emailVerificationEnabled,
    emailVerificationSubject,
    emailVerificationTemplate,
    welcomeEmailSubject,
    welcomeEmailTemplate,
    notificationEmailSubject,
    notificationEmailTemplate,
    // Monnify fields
    monnifyEnabled,
    monnifyApiKey,
    monnifyContractCode,
    monnifySecretKey,
    monnifyMode,
    subscriptionAmount
  } = req.body;
  if (!serverUrl || !adminUsername || !apiKey) {
    return res.status(400).json({ error: 'Server URL, Admin Username, and API Key are required.' });
  }
  
  const newConfig = {
    ...existingConfig,
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
    androidDownloadUrl: androidDownloadUrl || '',
    smtpEnabled: smtpEnabled ? 1 : 0,
    smtpHost: smtpHost || '',
    smtpPort: smtpPort ? Number(smtpPort) : 587,
    smtpSecure: smtpSecure ? 1 : 0,
    smtpUser: smtpUser || '',
    smtpPass: smtpPass || '',
    smtpFromName: smtpFromName || 'CINJELLY Stream',
    smtpFromEmail: smtpFromEmail || '',
    emailVerificationEnabled: emailVerificationEnabled ? 1 : 0,
    emailVerificationSubject: emailVerificationSubject || 'Verify Your Email Address - CINJELLY',
    emailVerificationTemplate: emailVerificationTemplate || DEFAULT_VERIFICATION_TEMPLATE,
    welcomeEmailSubject: welcomeEmailSubject || 'Welcome to CINJELLY Stream!',
    welcomeEmailTemplate: welcomeEmailTemplate || DEFAULT_WELCOME_TEMPLATE,
    notificationEmailSubject: notificationEmailSubject || 'Important Update - CINJELLY Stream',
    notificationEmailTemplate: notificationEmailTemplate || DEFAULT_NOTIFICATION_TEMPLATE,
    monnifyEnabled: monnifyEnabled ? 1 : 0,
    monnifyApiKey: monnifyApiKey || '',
    monnifyContractCode: monnifyContractCode || '',
    monnifySecretKey: monnifySecretKey || '',
    monnifyMode: monnifyMode || 'live',
    subscriptionAmount: subscriptionAmount !== undefined ? Number(subscriptionAmount) : 600.00
  };
  
  await db.saveConfig(newConfig);

  let warning = '';
  if (serverUrl && apiKey) {
    try {
      const jellyfin = new JellyfinService(newConfig);
      const connectionOk = await jellyfin.verifyConnection();
      if (!connectionOk) {
        warning = ' Warning: Could not connect to Media Server with these credentials. Please check Media Server URL and API Key.';
      }
    } catch (e: any) {
      warning = ' Warning: Media Server verification check failed.';
    }
  }

  res.json({ success: true, message: `System settings, SMTP, and Email templates saved successfully!${warning}` });
});

// Admin test SMTP Connection
app.post('/api/admin/smtp-test', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }

  const { testEmail, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromName, smtpFromEmail, customSubject, customHtml } = req.body;

  if (!testEmail) {
    return res.status(400).json({ error: 'Recipient test email address is required' });
  }

  try {
    const customConfig = (smtpHost && smtpUser) ? {
      smtpEnabled: 1,
      smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : 587,
      smtpSecure: smtpSecure ? 1 : 0,
      smtpUser,
      smtpPass,
      smtpFromName: smtpFromName || 'CINJELLY Stream',
      smtpFromEmail: smtpFromEmail || smtpUser
    } : undefined;

    if (customHtml) {
      const dummyUser = { username: 'AdminTest', fullName: 'Admin Tester', email: testEmail };
      const configObj = customConfig || (await db.getConfig());
      const replacedSubj = replaceTemplateVars(customSubject || 'Test Email Preview', dummyUser, configObj);
      const replacedHtml = replaceTemplateVars(customHtml, dummyUser, configObj);
      const emailResult = await sendEmail(testEmail, replacedSubj, replacedHtml, configObj as any);
      if (emailResult.success) {
        return res.json({ success: true, message: `Test preview email delivered to ${testEmail}` });
      } else {
        return res.status(400).json({ error: emailResult.error || 'Failed to send test email.' });
      }
    }

    const result = await testSmtpConnection(testEmail, customConfig as any);
    if (result.success) {
      return res.json({ success: true, message: 'SMTP Test connection successful! Test email delivered.' });
    } else {
      return res.status(400).json({ error: result.error || 'SMTP Connection failed.' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'SMTP test failed' });
  }
});

// Admin Send Custom HTML Email to User(s)
app.post('/api/admin/send-email', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }

  const { targetUserId, targetType, subject, bodyHtml } = req.body;

  if (!subject || !bodyHtml) {
    return res.status(400).json({ error: 'Subject and Email HTML Body are required.' });
  }

  try {
    const config = await db.getConfig();
    if (!config || !config.smtpEnabled) {
      return res.status(400).json({ error: 'SMTP is not enabled. Please configure and enable SMTP settings in Admin Panel first.' });
    }

    let recipients: UserRecord[] = [];
    const allUsers = await db.getUsers();

    if (targetType === 'single' && targetUserId) {
      const u = allUsers.find(x => x.id === targetUserId);
      if (u) recipients.push(u);
    } else if (targetType === 'active') {
      recipients = allUsers.filter(u => u.subscriptionStatus === 'Active');
    } else if (targetType === 'unpaid') {
      recipients = allUsers.filter(u => u.paymentStatus === 'Unpaid');
    } else {
      recipients = allUsers; // All users
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found for the selected target.' });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const u of recipients) {
      const replacedSubject = replaceTemplateVars(subject, u, config);
      const replacedHtml = replaceTemplateVars(bodyHtml, u, config);

      const result = await sendEmail(u.email, replacedSubject, replacedHtml);
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Email notification process finished. Successfully delivered: ${sentCount}, Failed: ${failedCount}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send emails' });
  }
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
      console.error('Failed to register user on media server:', err.message);
      return res.status(400).json({ error: `Media server integration failed: ${err.message}` });
    }

    // Check if email verification is enabled by admin
    const emailVerifActive = !!(config.emailVerificationEnabled && config.smtpEnabled);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

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
      referredBy: referredBy ? referredBy.trim().toUpperCase() : undefined,
      emailVerified: emailVerifActive ? 0 : 1,
      verificationToken: emailVerifActive ? verificationToken : undefined,
      verificationTokenExpires: emailVerifActive ? tokenExpires : undefined
    });

    // Send Verification Email if enabled
    let emailSent = false;
    if (emailVerifActive) {
      const subject = config.emailVerificationSubject || 'Verify Your Email Address - CINJELLY Stream';
      const template = config.emailVerificationTemplate || DEFAULT_VERIFICATION_TEMPLATE;
      
      const hostUrl = req.protocol + '://' + req.get('host');
      const verificationLink = `${hostUrl}/api/auth/verify-email?token=${verificationToken}`;

      const customVars = {
        verification_code: verificationCode,
        verification_link: verificationLink
      };

      const replacedSubject = replaceTemplateVars(subject, newUser, config, customVars);
      const replacedHtml = replaceTemplateVars(template, newUser, config, customVars);

      const emailResult = await sendEmail(newUser.email, replacedSubject, replacedHtml);
      emailSent = emailResult.success;
    }

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
      emailVerificationRequired: emailVerifActive,
      emailSent,
      message: emailVerifActive 
        ? 'Account created! Please check your email to verify your account.' 
        : 'Account created successfully!',
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        subscriptionStatus: newUser.subscriptionStatus,
        paymentStatus: newUser.paymentStatus,
        role: newUser.role,
        emailVerified: newUser.emailVerified
      }
    });
  } catch (err: any) {
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Internal registration failure' });
  }
});

// Verify Email Endpoint (POST - for UI form submission with token or code)
app.post('/api/auth/verify-email', async (req: any, res) => {
  try {
    const { token, email, code } = req.body;

    let targetUser: UserRecord | undefined = undefined;

    if (token) {
      targetUser = await db.getUserByVerificationToken(token);
    } else if (email) {
      targetUser = await db.getUserByEmail(email);
    } else if (req.user) {
      targetUser = req.user;
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User account or verification token not found.' });
    }

    if (targetUser.emailVerified === 1) {
      return res.json({ success: true, message: 'Your email address is already verified!' });
    }

    // If a token was provided, ensure it matches
    if (token && targetUser.verificationToken && targetUser.verificationToken !== token) {
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    // Update user record to verified
    await db.updateUser(targetUser.id, {
      emailVerified: 1,
      verificationToken: undefined,
      verificationTokenExpires: undefined
    });

    res.json({ success: true, message: 'Email address verified successfully! You can now proceed to select a plan and enjoy streaming.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Email verification failed' });
  }
});

// Verify Email Endpoint (GET - for direct link clicks from email inbox)
app.get('/api/auth/verify-email', async (req: any, res) => {
  const token = (req.query.token || '').toString();
  if (!token) {
    return res.status(400).send('<h2>Verification Link Invalid</h2><p>Missing token in link.</p>');
  }

  try {
    const targetUser = await db.getUserByVerificationToken(token);
    if (!targetUser) {
      return res.status(404).send('<h2>Verification Link Invalid or Expired</h2><p>Could not find account for this verification link.</p>');
    }

    await db.updateUser(targetUser.id, {
      emailVerified: 1,
      verificationToken: undefined,
      verificationTokenExpires: undefined
    });

    // Return friendly HTML verification success page that redirects back to app
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified - CINJELLY Stream</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d0f17; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #161a29; border: 1px solid rgba(255,255,255,0.1); padding: 40px; border-radius: 16px; text-align: center; max-width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .icon { width: 64px; height: 64px; background: rgba(16,185,129,0.15); color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
          h1 { margin: 0 0 10px; font-size: 24px; font-weight: 700; }
          p { color: #9ca3af; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
          .btn { background: linear-gradient(135deg, #e11d48, #be123c); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; display: inline-block; transition: opacity 0.2s; }
          .btn:hover { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Email Verified Successfully!</h1>
          <p>Thank you for verifying your email address (${targetUser.email}). Your account is now fully active.</p>
          <a href="/" class="btn">Return to CINJELLY Stream</a>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`<h2>Verification Error</h2><p>${err.message}</p>`);
  }
});

// Resend Verification Email
app.post('/api/auth/resend-verification', async (req: any, res) => {
  try {
    let targetUser: UserRecord | undefined = undefined;
    const { email } = req.body;

    if (email) {
      targetUser = await db.getUserByEmail(email);
    } else if (req.user) {
      targetUser = req.user;
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (targetUser.emailVerified === 1) {
      return res.json({ success: true, message: 'Your email address is already verified!' });
    }

    const config = await db.getConfig();
    if (!config || !config.smtpEnabled) {
      return res.status(400).json({ error: 'SMTP email notifications are not enabled on this server.' });
    }

    const verificationToken = crypto.randomBytes(24).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.updateUser(targetUser.id, {
      verificationToken,
      verificationTokenExpires: tokenExpires
    });

    const subject = config.emailVerificationSubject || 'Verify Your Email Address - CINJELLY Stream';
    const template = config.emailVerificationTemplate || DEFAULT_VERIFICATION_TEMPLATE;

    const hostUrl = req.protocol + '://' + req.get('host');
    const verificationLink = `${hostUrl}/api/auth/verify-email?token=${verificationToken}`;

    const customVars = {
      verification_link: verificationLink
    };

    const replacedSubject = replaceTemplateVars(subject, targetUser, config, customVars);
    const replacedHtml = replaceTemplateVars(template, targetUser, config, customVars);

    const emailResult = await sendEmail(targetUser.email, replacedSubject, replacedHtml);

    if (emailResult.success) {
      res.json({ success: true, message: 'A new verification email has been sent to your inbox.' });
    } else {
      res.status(400).json({ error: `Failed to send email: ${emailResult.error || 'SMTP delivery failed'}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resend verification email' });
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
      if ((user.subscriptionStatus === 'Active' || user.role === 'admin') && user.jellyfinUserId) {
        try {
          await jellyfin.setUserDisabledStatus(user.jellyfinUserId, false);
          await jellyfin.updateUserPassword(user.jellyfinUserId, password);
          const authResult = await jellyfin.authenticateUser(username.trim(), password);
          jellyfinToken = authResult.accessToken;
        } catch (err: any) {
          console.warn('Notice: Could not pre-auth active user with Jellyfin:', err.message);
        }
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
    if (req.user.jellyfinUserId) {
      if (req.user.subscriptionStatus === 'Active' || req.user.role === 'admin') {
        await jellyfin.setUserDisabledStatus(req.user.jellyfinUserId, false);
        await jellyfin.updateUserPassword(req.user.jellyfinUserId, password);
      }
    }
    const authResult = await jellyfin.authenticateUser(req.user.username, password);
    
    // Save token in active session
    const token = req.cookies?.session;
    if (token) {
      await db.updateSessionJellyfinToken(token, authResult.accessToken);
    }

    res.json({ success: true, jellyfinToken: authResult.accessToken });
  } catch (err: any) {
    res.status(400).json({ error: `Media server sync failed: ${err.message}` });
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
      message: 'Subscription successfully activated for 30 days! Streaming access enabled.',
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
      contactOther: config.contactOther || '',
      monnifyEnabled: Boolean(config.monnifyEnabled),
      monnifyApiKey: config.monnifyApiKey || '',
      monnifyContractCode: config.monnifyContractCode || '',
      monnifyMode: config.monnifyMode || 'live',
      subscriptionAmount: config.subscriptionAmount ? Number(config.subscriptionAmount) : 600.00
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- MONNIFY SERVER-SIDE HELPER FUNCTIONS ---
function getMonnifyTestMode(apiKey: string, configuredMode: string = 'test'): boolean {
  const cleanKey = (apiKey || '').trim();
  if (cleanKey.startsWith('MK_TEST_')) {
    return true;
  }
  if (cleanKey.startsWith('MK_PROD_') || cleanKey.startsWith('MK_LIVE_')) {
    return false;
  }
  return (configuredMode || 'test').toLowerCase() === 'test';
}

async function getMonnifyAccessToken(apiKey: string, secretKey: string, isTestMode: boolean): Promise<string> {
  const cleanApiKey = (apiKey || '').trim();
  const cleanSecretKey = (secretKey || '').trim();
  if (!cleanApiKey || !cleanSecretKey) {
    throw new Error('Monnify API Key and Secret Key are required for server authentication.');
  }

  const baseUrl = isTestMode ? 'https://sandbox.monnify.com' : 'https://api.monnify.com';
  const authUrl = `${baseUrl}/api/v1/auth/login`;

  const authHeader = 'Basic ' + Buffer.from(`${cleanApiKey}:${cleanSecretKey}`).toString('base64');

  const res = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.requestSuccessful || !data.responseBody?.accessToken) {
    const msg = data.responseMessage || data.error || `Authentication failed with status code ${res.status}`;
    const envName = isTestMode ? 'Sandbox (sandbox.monnify.com)' : 'Live (api.monnify.com)';
    throw new Error(`Monnify Auth Error on ${envName}: ${msg}`);
  }

  return data.responseBody.accessToken;
}

async function verifyMonnifyTransaction(paymentReference: string, config: any): Promise<any> {
  if (!paymentReference) {
    throw new Error('Payment reference is missing for verification.');
  }

  const apiKey = (config?.monnifyApiKey || '').trim();
  const secretKey = (config?.monnifySecretKey || '').trim();
  const isTestMode = getMonnifyTestMode(apiKey, config?.monnifyMode || 'test');

  if (!apiKey) {
    throw new Error('Monnify API Key is not configured in settings.');
  }
  if (!secretKey) {
    throw new Error('Monnify Secret Key is missing in settings. Secret key is required for transaction verification.');
  }

  const accessToken = await getMonnifyAccessToken(apiKey, secretKey, isTestMode);
  const baseUrl = isTestMode ? 'https://sandbox.monnify.com' : 'https://api.monnify.com';

  const encodedRef = encodeURIComponent(paymentReference);
  const verifyUrl = `${baseUrl}/api/v2/transactions/searchByReference?paymentReference=${encodedRef}`;

  let res = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  let data: any = await res.json().catch(() => ({}));

  if (!res.ok || !data.requestSuccessful || !data.responseBody) {
    const verifyUrl2 = `${baseUrl}/api/v2/transactions/${encodedRef}`;
    const res2 = await fetch(verifyUrl2, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (res2.ok) {
      const data2: any = await res2.json().catch(() => ({}));
      if (data2.requestSuccessful && data2.responseBody) {
        data = data2;
      }
    }
  }

  if (!data.requestSuccessful || !data.responseBody) {
    const msg = data.responseMessage || 'Transaction reference not found on Monnify server.';
    throw new Error(`Monnify Verification Failed: ${msg}`);
  }

  const responseBody = data.responseBody;
  const paymentStatus = (responseBody.paymentStatus || responseBody.status || '').toUpperCase();

  if (paymentStatus !== 'PAID' && paymentStatus !== 'OVERPAID' && paymentStatus !== 'SUCCESSFUL') {
    throw new Error(`Transaction status on Monnify server is '${paymentStatus}'. Subscription requires confirmed payment.`);
  }

  return {
    success: true,
    paymentStatus,
    amountPaid: responseBody.amountPaid || responseBody.amount || 0,
    paymentReference: responseBody.paymentReference || paymentReference,
    transactionReference: responseBody.transactionReference || paymentReference,
    raw: responseBody
  };
}

// POST /api/payment/monnify-complete
app.post('/api/payment/monnify-complete', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { paymentReference, transactionReference } = req.body;
  const refToVerify = paymentReference || transactionReference;

  if (!refToVerify) {
    return res.status(400).json({ error: 'Missing transaction or payment reference' });
  }

  try {
    const bankInfo = await db.getConfig();

    // Security: Call Monnify REST API to verify transaction. DO NOT trust frontend status.
    await verifyMonnifyTransaction(refToVerify, bankInfo);

    const config = await db.getConfig();
    const daysToAdd = 30;
    let currentExpiry = Date.now();
    if (req.user.subscriptionExpiryDate) {
      const existingExpiry = new Date(req.user.subscriptionExpiryDate).getTime();
      if (existingExpiry > Date.now()) {
        currentExpiry = existingExpiry;
      }
    }
    const newExpiryDate = new Date(currentExpiry + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    const updatedUser = await db.updateUser(req.user.id, {
      subscriptionStatus: 'Active',
      accountStatus: 'Active',
      paymentStatus: 'Paid',
      subscriptionStartDate: req.user.subscriptionStartDate || new Date().toISOString(),
      subscriptionExpiryDate: newExpiryDate,
      transactionRef: refToVerify,
      lastPaymentTime: new Date().toISOString(),
      declineReason: undefined,
      systemNotification: 'accepted'
    });

    if (req.user.jellyfinUserId && config) {
      try {
        const jellyfin = new JellyfinService(config);
        await jellyfin.setUserDisabledStatus(req.user.jellyfinUserId, false);
      } catch (e) {}
    }

    if (req.user.referredBy) {
      const affiliateUser = await db.getUserByAffiliateCode(req.user.referredBy);
      if (affiliateUser) {
        const commissionAmount = (config && config.defaultCommission) ? Number(config.defaultCommission) : 100.00;
        await db.createCommission({
          affiliateId: affiliateUser.id,
          referredUserId: req.user.id,
          amount: commissionAmount,
          status: 'Approved'
        });
      }
    }

    res.json({ success: true, verified: true, user: updatedUser });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Payment verification failed' });
  }
});

// POST /api/payment/monnify-initiate
app.post('/api/payment/monnify-initiate', async (req: any, res) => {
  try {
    const { fullName, email, phone, amount } = req.body || {};
    const user = req.user;

    if (!user && (!fullName || !email)) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please log in first.' });
    }

    const bankInfo = await db.getConfig();

    if (!bankInfo || !bankInfo.monnifyEnabled) {
      return res.status(400).json({ success: false, error: 'Monnify payment gateway is currently disabled by Admin.' });
    }

    const apiKey = (bankInfo.monnifyApiKey || '').trim();
    const contractCode = (bankInfo.monnifyContractCode || '').trim();
    const secretKey = (bankInfo.monnifySecretKey || '').trim();
    const isTestMode = getMonnifyTestMode(apiKey, bankInfo.monnifyMode || 'test');

    if (!apiKey || !contractCode) {
      return res.status(400).json({ success: false, error: 'Monnify API Key or Contract Code is missing in Admin configuration.' });
    }

    // Validate merchant credentials if Secret Key is provided
    if (secretKey) {
      try {
        await getMonnifyAccessToken(apiKey, secretKey, isTestMode);
      } catch (authEx: any) {
        // Log warning; do not block checkout modal launch if secret key check fails
        console.warn(`[Monnify Secret Key Pre-Validation Warning] ${authEx.message || authEx}`);
      }
    }

    const subAmount = Number(amount) || Number(bankInfo.subscriptionAmount) || 600;
    const paymentRef = 'MON_' + Date.now() + '_' + Math.floor(Math.random() * 100000);

    const customerFullName = (fullName || user?.fullName || user?.username || 'Subscriber').trim();
    const customerEmail = (email || user?.email || `${user?.username || 'user'}@cinjelly.com`).trim();
    const customerPhone = (phone || user?.phone || '').trim();

    return res.json({
      success: true,
      paymentReference: paymentRef,
      reference: paymentRef,
      amount: subAmount,
      currency: 'NGN',
      customerFullName,
      customerName: customerFullName,
      customerEmail,
      customerPhoneNumber: customerPhone,
      phoneNumber: customerPhone,
      apiKey,
      contractCode,
      paymentDescription: 'CINJELLY Stream 30-Day Access Renewal',
      isTestMode,
      mode: isTestMode ? 'TEST' : 'LIVE'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to initialize Monnify payment.' });
  }
});

// POST /api/payment/monnify-webhook and /api/monnify/webhook
const handleMonnifyWebhook = async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const email = body.eventData?.customer?.email || body.customerEmail || body.eventData?.customerEmail;
    const paymentRef = body.eventData?.paymentReference || body.paymentReference || body.eventData?.transactionReference || body.transactionReference;
    const paymentStatus = (body.eventData?.paymentStatus || body.paymentStatus || '').toUpperCase();

    if (email && (paymentStatus === 'PAID' || paymentStatus === 'SUCCESSFUL' || paymentStatus === 'OVERPAID')) {
      const users = await db.getUsers();
      const targetUser = users.find((u: any) => u.email && u.email.toLowerCase() === email.toLowerCase());

      if (targetUser) {
        const config = await db.getConfig();
        const daysToAdd = 30;
        let currentExpiry = Date.now();
        if (targetUser.subscriptionExpiryDate) {
          const existingExpiry = new Date(targetUser.subscriptionExpiryDate).getTime();
          if (existingExpiry > Date.now()) {
            currentExpiry = existingExpiry;
          }
        }
        const newExpiryDate = new Date(currentExpiry + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        await db.updateUser(targetUser.id, {
          subscriptionStatus: 'Active',
          accountStatus: 'Active',
          paymentStatus: 'Paid',
          subscriptionStartDate: targetUser.subscriptionStartDate || new Date().toISOString(),
          subscriptionExpiryDate: newExpiryDate,
          transactionRef: paymentRef || ('WH_' + Date.now()),
          lastPaymentTime: new Date().toISOString(),
          declineReason: undefined,
          systemNotification: 'accepted'
        });

        if (targetUser.jellyfinUserId && config) {
          try {
            const jellyfin = new JellyfinService(config);
            await jellyfin.setUserDisabledStatus(targetUser.jellyfinUserId, false);
          } catch (e) {}
        }
      }
    }
    return res.status(200).json({ requestSuccessful: true, responseMessage: "Webhook processed", responseCode: "0" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

app.all('/api/payment/monnify-webhook', (req: any, res: any) => {
  if (req.method === 'GET') {
    return res.status(200).json({ status: "active", message: "Monnify payment webhook endpoint is live and listening for transaction events.", requestSuccessful: true, responseCode: "0" });
  }
  return handleMonnifyWebhook(req, res);
});

app.all('/api/monnify/webhook', (req: any, res: any) => {
  if (req.method === 'GET') {
    return res.status(200).json({ status: "active", message: "Monnify payment webhook endpoint is live and listening for transaction events.", requestSuccessful: true, responseCode: "0" });
  }
  return handleMonnifyWebhook(req, res);
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

      // Send welcome / payment confirmed notification email if SMTP is configured
      if (config && config.smtpEnabled) {
        try {
          const subject = config.welcomeEmailSubject || 'Welcome to CINJELLY Stream! Payment Confirmed';
          const template = config.welcomeEmailTemplate || DEFAULT_WELCOME_TEMPLATE;
          const replacedSubject = replaceTemplateVars(subject, updatedUser || userToVerify, config);
          const replacedHtml = replaceTemplateVars(template, updatedUser || userToVerify, config);
          await sendEmail(userToVerify.email, replacedSubject, replacedHtml);
        } catch (e: any) {
          console.error(`Failed to send payment approval email to ${userToVerify.email}:`, e.message);
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
