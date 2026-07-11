import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import crypto from 'crypto';
import { db, hashPassword, verifyPassword, UserRecord, initDb, mysqlAvailable, mysqlErrorMsg } from './server/db';
import { JellyfinService } from './server/jellyfin';

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

    if (!mysqlAvailable) {
      return res.status(500).json({
        error: mysqlErrorMsg || 'MySQL database is currently offline or access is denied.'
      });
    }

    const config = await db.getConfig();
    const users = await db.getUsers();
    const hasAdmin = users.some(u => u.role === 'admin');

    res.json({
      configured: !!config,
      hasAdmin,
      serverUrl: config?.serverUrl || '',
      adminUsername: config?.adminUsername || '',
      mysqlAvailable: true,
      mysqlError: null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// Admin config update (Disabled and isolated from browser)
app.get('/api/admin/config', (req: any, res) => {
  return res.status(403).json({ error: 'Jellyfin configuration is locked to backend environment variables and cannot be accessed via the browser.' });
});

app.post('/api/admin/config', async (req: any, res) => {
  return res.status(403).json({ error: 'Jellyfin configuration is locked to backend environment variables and cannot be modified via the browser.' });
});

// Authentication
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

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
      role: 'user'
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
        role: req.user.role
      },
      jellyfinToken: jellyfinAuthToken
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ error: err.message || 'Internal session validation error' });
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
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + 30); // 30 days expiration

    await db.updateUser(req.user.id, {
      subscriptionStatus: 'Active',
      paymentStatus: 'Paid',
      accountStatus: 'Active',
      subscriptionStartDate: startDate.toISOString(),
      subscriptionExpiryDate: expiryDate.toISOString()
    });

    // Automatically re-enable Jellyfin account
    if (req.user.jellyfinUserId) {
      const jellyfin = new JellyfinService(config);
      await jellyfin.setUserDisabledStatus(req.user.jellyfinUserId, false);
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

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
