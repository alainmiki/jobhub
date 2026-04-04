import express from 'express';
import helmet from 'helmet';
import nunjucks from 'nunjucks';
import cors from 'cors';
import session from 'express-session';
import csrf from 'csurf';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { toNodeHandler } from 'better-auth/node';

import { connectDB } from './config/db.js';
import { initAuth } from './config/auth.js';
import { validateEnv } from './config/validateEnv.js';
import logger from './config/logger.js';
import { createAuthMiddleware, validateInput } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import { initJobsRouter } from './routes/jobs.js';
import { initApplicationsRouter } from './routes/applications.js';
import { initCompanyRouter } from './routes/company.js';
import { initProfileRouter } from './routes/profile.js';
import { initDashboardRouter } from './routes/dashboard.js';
import { initNotificationsRouter } from './routes/notifications.js';
import { initMatchesRouter } from './routes/matches.js';
import { initAdminRouter } from './routes/admin.js';

import Job from './models/Job.js';

dotenv.config();
validateEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("the dir:",path.join(__dirname, 'public'));

const app = express();

// Initialize database and auth FIRST
await connectDB();
logger.info('Connected to database');
const mongoDb = mongoose.connection.db;

const auth = await initAuth(mongoDb);

// CORS - MUST be before Better-Auth handler
app.use(cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'",  "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Cache control middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) {
    res.set('Cache-Control', 'public, max-age=31536000');
    return next();
  }
  
  // Only set strict no-cache for non-static routes
  if (!req.path.endsWith('.css') && !req.path.endsWith('.js') && !req.path.endsWith('.png') && !req.path.endsWith('.jpg')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Mount Better-Auth handler BEFORE express.json() - critical!
// This handles all /api/auth/* routes
app.all("/api/auth/*splat", toNodeHandler(auth));

// NOW add express.json() AFTER Better-Auth handler
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Nunjucks view configuration
nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  watch: process.env.NODE_ENV === 'development',
  noCache: process.env.NODE_ENV === 'development'
});
app.set('view engine', 'html');

// Session configuration (for app-specific sessions, not Better-Auth)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// CSRF protection for custom forms
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

// Auth middleware - validates session from Better-Auth
app.use(createAuthMiddleware(auth));

// Rate limiting
// app.use('/api', apiLimiter);
// app.use('/jobs/search', searchLimiter);

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.session = req.session || null;
  res.locals.userId = req.userId || null;
  next();
});

// Input validation
app.use(validateInput);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// 2FA Routes
app.post('/api/auth/two-factor/verify-totp', async (req, res) => {
  try {
    const { code, trustDevice, challenge } = req.body;
    const result = await auth.api.verifyTOTP({
      body: { code, trustDevice: trustDevice === 'on' },
      headers: { cookie: req.headers.cookie }
    });
    
    if (result.response?.twoFactorRedirect) {
      return res.json({ error: '2FA verification failed' });
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/2fa?error=Invalid+code');
  }
});

app.post('/api/auth/two-factor/send-otp', async (req, res) => {
  try {
    await auth.api.sendTwoFactorOTP({
      body: { trustDevice: false },
      headers: { cookie: req.headers.cookie }
    });
    res.redirect('/2fa?method=otp');
  } catch (error) {
    res.redirect('/2fa?error=Failed+to+send+code');
  }
});

app.post('/api/auth/two-factor/verify-otp', async (req, res) => {
  try {
    const { code, trustDevice, challenge } = req.body;
    const result = await auth.api.verifyTwoFactorOTP({
      body: { code, trustDevice: trustDevice === 'on' },
      headers: { cookie: req.headers.cookie }
    });
    
    if (result.response?.twoFactorRedirect) {
      return res.json({ error: '2FA verification failed' });
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/2fa?error=Invalid+code');
  }
});

app.post('/api/auth/two-factor/verify-backup-code', async (req, res) => {
  try {
    const { code, challenge } = req.body;
    const result = await auth.api.verifyBackupCode({
      body: { code, disableSession: false, trustDevice: false },
      headers: { cookie: req.headers.cookie }
    });
    
    if (result.response?.twoFactorRedirect) {
      return res.json({ error: 'Invalid backup code' });
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/2fa?method=backup&error=Invalid+backup+code');
  }
});

app.post('/enable-2fa', 
  (req, res, next) => express.json()(req, res, next),
  async (req, res) => {
    try {
      const { step, password, code, totpUri } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.redirect('/sign-in');
      }
      
      if (step === 'verify') {
        const result = await auth.api.signInEmail({
          body: { email: req.user.email, password },
          headers: { cookie: req.headers.cookie }
        });
        
        if (result.response?.twoFactorRedirect !== true) {
          const totpResult = await auth.api.enableTwoFactor({
            body: { password, issuer: 'JobHub' },
            headers: { cookie: req.headers.cookie }
          });
          
          res.render('enable-2fa', { 
            step: 'setup', 
            user: req.user,
            secret: totpResult.response?.secret,
            totpUri: totpResult.response?.totpURI
          });
          return;
        }
      }
      
      if (step === 'verify-code') {
        const verifyResult = await auth.api.verifyTOTP({
          body: { code },
          headers: { cookie: req.headers.cookie }
        });
        
        if (!verifyResult.response?.twoFactorRedirect) {
          const backupResult = await auth.api.generateBackupCodes({
            body: { password },
            headers: { cookie: req.headers.cookie }
          });
          
          res.render('enable-2fa', { 
            step: 'backup-codes', 
            user: req.user,
            backupCodes: backupResult.response?.backupCodes
          });
          return;
        }
      }
      
      res.redirect('/enable-2fa?error=Verification+failed');
    } catch (error) {
      logger.error('Enable 2FA error:', error);
      res.redirect('/enable-2fa?error=' + encodeURIComponent(error.message));
    }
  }
);

const PORT = process.env.PORT || 3000;

app.use('/jobs', initJobsRouter(auth));
app.use('/applications', initApplicationsRouter(auth));
app.use('/company', initCompanyRouter(auth));
app.use('/profile', initProfileRouter(auth));
app.use('/dashboard', initDashboardRouter(auth));
app.use('/notifications', initNotificationsRouter(auth));
app.use('/matches', initMatchesRouter(auth));
app.use('/admin', initAdminRouter(auth));

app.get('/', async (req, res) => {
  const featuredJobs = await Job.find({ status: 'approved', isActive: true })
    .populate('company', 'name logo')
    .sort({ createdAt: -1 })
    .limit(6);
  
  res.render('index', { featuredJobs });
});

app.get('/sign-in', (req, res) => {
  const redirect = req.query.redirect || '/';
  res.render('sign-in', { redirect, redirectQuery: `redirect=${encodeURIComponent(redirect)}` });
});

app.get('/sign-up', (req, res) => {
  const redirect = req.query.redirect || '/';
  res.render('sign-up', { redirect, redirectQuery: `redirect=${encodeURIComponent(redirect)}` });
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

app.get('/reset-password', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.redirect('/forgot-password');
  }
  res.render('reset-password', { token });
});

app.get('/verify-email', (req, res) => {
  const { success } = req.query;
  res.render('verify-email', { success: success === 'true' });
});

app.get('/2fa', (req, res) => {
  if (!req.user) {
    return res.redirect('/sign-in');
  }
  res.render('2fa', { user: req.user });
});

app.get('/enable-2fa', (req, res) => {
  if (!req.user) {
    return res.redirect('/sign-in');
  }
  res.render('enable-2fa', { user: req.user });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', { message: 'Form tampered with (Invalid CSRF Token)' });
  }
  logger.error(err.stack);
  res.status(500).render('error', { message: 'Something broke!' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Better Auth API: http://localhost:${PORT}/api/auth`);
});