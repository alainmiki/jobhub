import { beforeAll, afterAll, vi } from 'vitest';

global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.vi = vi;

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/jobhub-test';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-min-32-chars!!!';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'testpass';
process.env.SMTP_FROM = 'test@test.com';

beforeAll(async () => {
  // Mock database connection
});

afterAll(async () => {
  // Clean up
});

export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'candidate',
  image: null,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockSession = {
  sessionId: 'test-session-id',
  userId: 'test-user-id-123',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date()
};

export const mockEmployer = {
  ...mockUser,
  id: 'test-employer-id-456',
  email: 'employer@example.com',
  role: 'employer'
};

export const mockAdmin = {
  ...mockUser,
  id: 'test-admin-id-789',
  email: 'admin@example.com',
  role: 'admin'
};

export const createMockRequest = (overrides = {}) => ({
  headers: {
    'content-type': 'application/json',
    cookie: 'better-auth.session_token=test-session',
    ...overrides.headers
  },
  body: {},
  query: {},
  params: {},
  user: null,
  userId: null,
  userProfile: null,
  session: null,
  path: '/api/auth/sign-in',
  method: 'POST',
  originalUrl: '/api/auth/sign-in',
  ...overrides
});

export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    redirects: [],
    cookies: [],
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    },
    send: function(data) {
      this.body = data;
      return this;
    },
    redirect: function(url) {
      this.redirects.push(url);
      return this;
    },
    set: function(key, value) {
      this.headers[key] = value;
      return this;
    },
    cookie: function(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
  render: vi.fn(),
  locals: {}
};
  return res;
};