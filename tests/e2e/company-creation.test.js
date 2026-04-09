import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import csrf from 'csurf';
import flash from 'connect-flash';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';

const mockSave = vi.fn().mockResolvedValue();
const mockFindOne = vi.fn();
const mockUserProfileFindOne = vi.fn();
const mockNotificationCount = vi.fn().mockResolvedValue(0);

vi.mock('../../src/models/Company.js', () => ({
  default: class MockCompany {
    constructor(data) {
      Object.assign(this, data);
      this._id = 'mock-company-id';
    }

    save() {
      return mockSave();
    }

    static findOne = mockFindOne;
  }
}));

vi.mock('../../src/models/UserProfile.js', () => ({
  default: { findOne: mockUserProfileFindOne }
}));

vi.mock('../../src/models/Notification.js', () => ({
  default: { countDocuments: mockNotificationCount }
}));

const createTestApp = async (auth) => {
  const { initCompanyRouter } = await import('../../src/routes/company.js');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = express();
  app.use(cookieParser());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false }
  }));
  app.use(flash());
  app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    next();
  });
  app.use((req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
      return next();
    }
    csrf({ cookie: { httpOnly: true, secure: false } })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  nunjucks.configure(path.join(__dirname, '../../src/views'), {
    autoescape: true,
    express: app,
    noCache: true
  });
  app.set('view engine', 'html');

  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    next();
  });

  app.use('/company', initCompanyRouter(auth));

  app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).send('Invalid CSRF Token');
    }
    next(err);
  });

  return app;
};

describe('Company Creation E2E', () => {
  let app;
  let auth;
  let agent;
  let Company;

  beforeEach(async () => {
    mockSave.mockClear();
    mockFindOne.mockClear();
    mockUserProfileFindOne.mockClear().mockResolvedValue(null);
    mockNotificationCount.mockClear();

    auth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          session: { expiresAt: new Date(Date.now() + 10000) },
          user: {
            id: '507f191e810c19729de860ea',
            email: 'employer@example.com',
            name: 'Employer Test',
            role: 'employer'
          }
        })
      }
    };

    Company = (await import('../../src/models/Company.js')).default;
    app = await createTestApp(auth);
    agent = request.agent(app);
  });

  it('should render the company creation form with CSRF token', async () => {
    const response = await agent.get('/company/create').expect(200);
    expect(response.text).toContain('name="_csrf"');
    expect(response.text).toContain('Create Company Profile');
  });

  it('should create a new company and redirect to the edit page', async () => {
    const getRes = await agent.get('/company/create').expect(200);
    const match = getRes.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : '';

    const response = await agent
      .post('/company')
      .field('_csrf', csrfToken)
      .field('name', 'Acme Corporation')
      .field('description', 'An innovative company building automated workflows.')
      .field('industry', 'Technology')
      .field('size', '11-50')
      .field('website', 'https://example.com')
      .field('headquarters', 'Anywhere')
      .field('foundedYear', '2020')
      .field('specializations', 'Automation,Recruiting')
      .attach('logo', Buffer.from('logo file content'), 'logo.png')
      .attach('coverImage', Buffer.from('cover file content'), 'cover.png')
      .expect(302);

    expect(response.headers.location).toBe('/company/mock-company-id/edit');
    expect(Company.findOne).toHaveBeenCalledWith({ userId: '507f191e810c19729de860ea' });
    expect(mockSave).toHaveBeenCalled();
  });
});