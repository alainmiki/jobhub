import express from 'express';
import helmet from 'helmet';
import nunjucks from 'nunjucks';
import cors from 'cors';
import session from 'express-session';
import methodOverride from 'method-override';
import csrf from 'csurf';
import flash from 'connect-flash';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { toNodeHandler } from 'better-auth/node';
import MongoStore from 'connect-mongo'; // Import MongoStore
import rateLimit from 'express-rate-limit';
import cookie from 'cookie';

import { connectDB } from './config/db.js';
import { initAuth } from './config/auth.js';
import { validateEnv } from './config/validateEnv.js';
import logger from './config/logger.js';
import { createAuthMiddleware, validateInput } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { RATE_LIMIT } from './config/constants.js';

import { initJobsRouter } from './routes/jobs.js';
import { initApplicationsRouter } from './routes/applications.js';
import { initCompanyRouter } from './routes/company.js';
import { initProfileRouter } from './routes/profile.js';
import { initDashboardRouter } from './routes/dashboard.js';
import { initNotificationsRouter } from './routes/notifications.js';
import { initMatchesRouter } from './routes/matches.js';
import { initAdminRouter } from './routes/admin.js';
import { initAuthRouter } from './routes/auth.js';

import Job from './models/Job.js';
import { log } from 'console';

dotenv.config();
validateEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("the dir:",path.join(__dirname, 'public'));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const searchLimiter = rateLimit({
  windowMs: RATE_LIMIT.SEARCH_WINDOW,
  max: RATE_LIMIT.SEARCH_MAX,
  message: 'Too many searches, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.API_WINDOW,
  max: RATE_LIMIT.API_MAX,
  message: 'Too many API requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

await connectDB();
logger.info('Connected to database');
const mongoDb = mongoose.connection.db;

const auth = await initAuth(mongoDb);

nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  watch: true,
  noCache: process.env.NODE_ENV === 'development'
}).addFilter('date', (date, formatStr) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    if (formatStr === 'MMM d' || formatStr === 'MMM d, YYYY' || formatStr === 'YYYY-MM-DD') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (formatStr === 'MMM d') {
        return `${months[d.getMonth()]} ${d.getDate()}`;
      } else if (formatStr === 'MMM d, YYYY') {
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      } else if (formatStr === 'YYYY-MM-DD') {
        return d.toISOString().split('T')[0];
      }
    }
    return d.toLocaleDateString();
  } catch (e) {
    return '';
  }
}).addFilter('number', (num) => {
  if (num === undefined || num === null) return '';
  try {
    return Number(num).toLocaleString();
  } catch (e) {
    return num;
  }
});
app.set('view engine', 'html');

app.use(cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));


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

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI, // Use your existing MongoDB connection string
    ttl: 7 * 24 * 60 * 60 // Session TTL in seconds (7 days)
  })
});

app.use(sessionMiddleware);

// Socket.io Authentication Middleware
io.use(async (socket, next) => {
  try {
    // Use Better-Auth API to get the session from handshake headers
    const session = await auth.api.getSession({
      headers: socket.handshake.headers
    });

    if (!session || !session.user) {
      return next(new Error('unauthorized'));
    }

    socket.userId = session.user.id;
    return next();
  } catch (err) {
    logger.error('Socket authentication error:', err);
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  if (socket.userId) socket.join(socket.userId.toString());
  logger.info(`User connected to socket: ${socket.userId}`);
});

app.use(csrf());
app.use(flash());

const safeFlash = (req, type, message) => {
  try {
    if (req.flash && typeof req.flash === 'function') {
      req.flash(type, message);
    }
  } catch (e) {
    console.warn('Flash error:', e.message);
  }
};

const flashWrapper = (req, res, next) => {
  if (!req.flash || typeof req.flash !== 'function') {
    req.flash = (type, message) => safeFlash(req, type, message);
  }
  if (!res.flash || typeof res.flash !== 'function') {
    res.flash = (type, message) => safeFlash(req, type, message);
  }
  next();
};

app.use(flashWrapper);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.successMessage = [];
  res.locals.errorMessage = [];
  
  try {
    res.locals.successMessage = req.flash ? req.flash('success') : [];
    res.locals.errorMessage = req.flash ? req.flash('error') : [];
  } catch (e) {
    console.warn('Flash error:', e.message);
  }
  
  res.locals.idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  next();
});

app.use(createAuthMiddleware(auth));

app.use('/api', apiLimiter);
app.use('/jobs/search', searchLimiter);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(validateInput);

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.session = req.session || null;
  next();
});

app.use('/jobs', initJobsRouter(auth));
app.use('/applications', initApplicationsRouter(auth));
app.use('/company', initCompanyRouter(auth));
app.use('/profile', initProfileRouter(auth));
app.use('/dashboard', initDashboardRouter(auth));
app.use('/notifications', initNotificationsRouter(auth));
app.use('/matches', initMatchesRouter(auth));
app.use('/admin', initAdminRouter(auth));

// Make io accessible to routers via req
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/', async (req, res) => {
  const featuredJobs = await Job.find({ status: 'approved', isActive: true })
    .populate('company', 'name logo')
    .sort({ createdAt: -1 })
    .limit(6);
  
  res.render('index', { featuredJobs });
});



app.use("/",initAuthRouter(auth));
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn(`CSRF error detected: ${err.message}, Path: ${req.path}, Method: ${req.method}`);
    
    if (req.xhr || req.headers['accept']?.includes('application/json')) {
      return res.status(403).json({ error: 'Your session has expired. Please refresh the page and try again.' });
    }
    
    try {
      if (req.flash && typeof req.flash === 'function') {
        req.flash('error', 'Your session has expired or the form was tampered with. Please try again.');
      }
    } catch (e) {
      console.warn('Flash error:', e.message);
    }
    return res.redirect(req.originalUrl || '/profile');
  }
  logger.error(err.stack);
  res.status(500).render('error', { message: 'Something broke!' });
});

app.use(errorHandler);

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Better Auth API: http://localhost:${PORT}/api/auth`);
});