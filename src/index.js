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
import { createAuthMiddleware, isAuthenticated, validateInput } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import { initJobsRouter } from './routes/jobs.js';
import { initApplicationsRouter } from './routes/applications.js';
import { initCompanyRouter } from './routes/company.js';
import { initProfileRouter } from './routes/profile.js';
import { initAdminRouter } from './routes/admin.js';
import { initDashboardRouter } from './routes/dashboard.js';
import { initNotificationsRouter } from './routes/notifications.js';
import { initMatchesRouter } from './routes/matches.js';
import { initAuthRouter } from './routes/auth.js';

import Job from './models/Job.js';

dotenv.config();
validateEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
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

// Mount Better-Auth handler BEFORE body parsers and CSRF
// This handles all /api/auth/* internal requests and should not be CSRF-protected by csurf
app.all("/api/auth/*path", toNodeHandler(auth));

// NOW add express.json() AFTER Better-Auth handler
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Nunjucks view configuration
nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  watch: true, // Watch for template changes in development
  noCache: true // Always disable cache in development for immediate template updates
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

// Flash message middleware
app.use((req, res, next) => {
  // Set flash messages to locals for templates and then clear them from session
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;

  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };
  next();
});

// CSRF protection for custom forms
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

// Auth middleware - validates session from Better-Auth
app.use(createAuthMiddleware(auth));



// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.authSession = req.authSession || null;
  res.locals.userId = req.userId || null;
  next();
});

// Input validation
app.use(validateInput);

const PORT = process.env.PORT || 3000;

app.use('/', initAuthRouter(auth));
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