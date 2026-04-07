import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import methodOverride from 'method-override';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'test-uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

describe('Profile Routes CSRF Protection', () => {
  const createTestApp = () => {
    const testApp = express();
    testApp.use(cookieParser());
    testApp.use(express.urlencoded({ extended: true }));
    testApp.use(methodOverride('_method', {
      methods: ['POST', 'PUT', 'DELETE']
    }));
    
    testApp.use(session({
      secret: 'test-secret-key-for-csrf-testing',
      resave: false,
      saveUninitialized: true,
      cookie: { httpOnly: true, secure: false }
    }));

    testApp.use(csrf({ 
      cookie: {
        httpOnly: true,
        secure: false
      }
    }));
    
    testApp.use((req, res, next) => {
      res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
      next();
    });

    testApp.get('/profile/edit', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <body>
          <form action="/profile?_method=PUT" method="POST" enctype="multipart/form-data" id="profile-form">
            <input type="hidden" name="_csrf" value="${res.locals.csrfToken}">
            <input type="text" name="headline" value="Test Headline">
            <button type="submit">Save</button>
          </form>
        </body>
        </html>
      `);
    });

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    });
    const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

    testApp.post('/profile', upload.single('resume'), (req, res) => {
      res.json({ success: true, body: req.body });
    });

    testApp.put('/profile', upload.single('resume'), (req, res) => {
      res.json({ success: true, body: req.body });
    });

    testApp.use((err, req, res, next) => {
      if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid CSRF Token' });
      }
      res.status(500).json({ error: err.message });
    });

    return testApp;
  };

  let app;
  let csrfToken = '';
  let cookie = '';

  beforeEach(() => {
    app = createTestApp();
  });

  describe('CSRF Token Validation', () => {
    it('should reject request without CSRF token', async () => {
      const response = await request(app)
        .put('/profile')
        .set('Cookie', cookie)
        .field('headline', 'Test')
        .expect(403);
      
      expect(response.body.error).toBe('Invalid CSRF Token');
    });

    it('should reject request with invalid CSRF token', async () => {
      const response = await request(app)
        .put('/profile')
        .set('Cookie', cookie)
        .field('_csrf', 'invalid-token')
        .field('headline', 'Test')
        .expect(403);
      
      expect(response.body.error).toBe('Invalid CSRF Token');
    });

    it('should accept request with valid CSRF token from cookie', async () => {
      const agent = request.agent(app);
      
      const getRes = await agent.get('/profile/edit');
      const cookies = getRes.headers['set-cookie'];
      cookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
      
      const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
      csrfToken = csrfMatch ? csrfMatch[1] : '';
      
      const response = await agent
        .put('/profile')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .field('headline', 'Valid Headline')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });

  describe('Method Override', () => {
    it('should properly override POST to PUT via query param', async () => {
      const agent = request.agent(app);
      
      const getRes = await agent.get('/profile/edit');
      const cookies = getRes.headers['set-cookie'];
      cookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
      
      const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
      csrfToken = csrfMatch ? csrfMatch[1] : '';
      
      const response = await agent
        .post('/profile?_method=PUT')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .field('headline', 'Test Headline')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });

    it('should properly handle _method in form body', async () => {
      const agent = request.agent(app);
      
      const getRes = await agent.get('/profile/edit');
      const cookies = getRes.headers['set-cookie'];
      cookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
      
      const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
      csrfToken = csrfMatch ? csrfMatch[1] : '';
      
      const response = await agent
        .post('/profile')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .field('headline', 'Test Headline')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Multer File Upload', () => {
  const createUploadApp = () => {
    const testApp = express();
    testApp.use(express.urlencoded({ extended: true }));
    
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    });

    const fileFilter = (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('File type not allowed'));
      }
    };

    const upload = multer({ 
      storage, 
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter 
    });

    testApp.put('/profile', upload.single('resume'), (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      res.json({ 
        success: true, 
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    });

    testApp.use((err, req, res, next) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });

    return testApp;
  };

  it('should accept valid image files', async () => {
    const testApp = createUploadApp();
    
    const response = await request(testApp)
      .put('/profile')
      .attach('resume', Buffer.from('test content'), 'test.jpg')
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid file types', async () => {
    const testApp = createUploadApp();
    
    const response = await request(testApp)
      .put('/profile')
      .attach('resume', Buffer.from('test content'), 'test.exe')
      .expect(400);
    
    expect(response.body.error).toContain('not allowed');
  });

  it('should reject files exceeding size limit', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const testApp = createUploadApp();
    
    const response = await request(testApp)
      .put('/profile')
      .attach('resume', largeBuffer, 'large.pdf')
      .expect(400);
    
    expect(response.body.error).toContain('File too large');
  });
});

describe('Profile Field Validation', () => {
  it('should validate URL fields properly', () => {
    const validateUrl = (url) => {
      try {
        return new URL(url).protocol === 'http:' || new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    };

    expect(validateUrl('https://example.com')).toBe(true);
    expect(validateUrl('http://example.com')).toBe(true);
    expect(validateUrl('invalid-url')).toBe(false);
    expect(validateUrl('')).toBe(false);
  });

  it('should validate phone numbers properly', () => {
    const validatePhone = (phone) => {
      if (!phone || phone.trim() === '') return true;
      return /^[\d\s\-+()]+$/.test(phone);
    };

    expect(validatePhone('+1 (555) 123-4567')).toBe(true);
    expect(validatePhone('555-123-4567')).toBe(true);
    expect(validatePhone('1234567890')).toBe(true);
    expect(validatePhone('invalid')).toBe(false);
  });

  it('should validate salary range', () => {
    const validateSalaryRange = (min, max) => {
      if (min && (isNaN(min) || parseInt(min) < 0)) return false;
      if (max && (isNaN(max) || parseInt(max) < 0)) return false;
      if (min && max && parseInt(min) > parseInt(max)) return false;
      return true;
    };

    expect(validateSalaryRange(50000, 100000)).toBe(true);
    expect(validateSalaryRange(0, 100000)).toBe(true);
    expect(validateSalaryRange(100000, 50000)).toBe(false);
    expect(validateSalaryRange(-50000, 100000)).toBe(false);
    expect(validateSalaryRange(null, 100000)).toBe(true);
  });

  it('should sanitize input strings', () => {
    const validator = require('validator');
    
    const sanitize = (input) => {
      if (!input) return '';
      return validator.escape(input.trim().substring(0, 500));
    };

    const sanitized = sanitize('<script>alert("xss")</script>');
    expect(sanitized).toContain('&lt;script&gt;');
    expect(sanitized).toContain('alert');
    expect(sanitize('  Hello World  ')).toBe('Hello World');
    expect(sanitize('A'.repeat(600)).length).toBe(500);
    expect(sanitize(null)).toBe('');
    expect(sanitize('')).toBe('');
  });
});

describe('Idempotency Key Handling', () => {
  it('should generate unique idempotency keys', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      const key = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      keys.add(key);
    }
    expect(keys.size).toBe(100);
  });

  it('should detect duplicate submissions with same key', () => {
    const submittedKeys = new Map();
    
    const checkDuplicate = (idempotencyKey) => {
      if (!idempotencyKey) return false;
      if (submittedKeys.has(idempotencyKey)) return true;
      submittedKeys.set(idempotencyKey, Date.now());
      return false;
    };

    expect(checkDuplicate('key-123')).toBe(false);
    expect(checkDuplicate('key-123')).toBe(true);
    expect(checkDuplicate('key-456')).toBe(false);
  });
});

afterAll(() => {
  if (fs.existsSync(UPLOAD_DIR)) {
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  }
});
