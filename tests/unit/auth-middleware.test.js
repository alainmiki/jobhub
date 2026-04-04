import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthMiddleware, isAuthenticated, isRole, validateInput } from '../../src/middleware/auth.js';

describe('Auth Middleware', () => {
  let mockAuth;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockAuth = {
      api: {
        getSession: vi.fn()
      }
    };

    mockReq = {
      headers: { cookie: 'better-auth.session_token=test' },
      session: null,
      user: null,
      userId: null,
      userProfile: null
    };

    mockRes = {
      locals: {}
    };

    mockNext = vi.fn();
  });

  describe('createAuthMiddleware', () => {
    it('should set user data when session exists', async () => {
      const mockSession = {
        session: { expiresAt: new Date(Date.now() + 86400000) },
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'candidate'
        }
      };

      mockAuth.api.getSession.mockResolvedValue(mockSession);

      const middleware = createAuthMiddleware(mockAuth);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockSession.user);
      expect(mockReq.userId).toBe('test-user-123');
      expect(mockReq.session).toEqual(mockSession.session);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing session gracefully', async () => {
      mockAuth.api.getSession.mockResolvedValue(null);

      const middleware = createAuthMiddleware(mockAuth);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockReq.userId).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle auth errors without breaking', async () => {
      mockAuth.api.getSession.mockRejectedValue(new Error('Auth error'));

      const middleware = createAuthMiddleware(mockAuth);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve user role from session', async () => {
      const mockSession = {
        session: { expiresAt: new Date(Date.now() + 86400000) },
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'employer'
        }
      };

      mockAuth.api.getSession.mockResolvedValue(mockSession);

      const middleware = createAuthMiddleware(mockAuth);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user.role).toBe('employer');
    });
  });

  describe('isAuthenticated', () => {
    it('should redirect to sign-in when user is not authenticated', () => {
      const middleware = isAuthenticated(mockAuth);
      
      mockReq.user = null;
      mockReq.originalUrl = '/dashboard';
      
      const mockRes = {
        redirect: vi.fn()
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('/sign-in?redirect=%2Fdashboard');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user is authenticated', () => {
      const middleware = isAuthenticated(mockAuth);
      
      mockReq.user = { id: 'test-user', role: 'candidate' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve query parameters in redirect', () => {
      const middleware = isAuthenticated(mockAuth);
      
      mockReq.user = null;
      mockReq.originalUrl = '/jobs?id=123';
      
      const mockRes = {
        redirect: vi.fn()
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('/sign-in?redirect=%2Fjobs%3Fid%3D123');
    });
  });

  describe('isRole', () => {
    it('should redirect to sign-in when user is not authenticated', () => {
      const middleware = isRole(mockAuth, 'admin');
      mockReq.user = null;
      
      const mockRes = {
        redirect: vi.fn()
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      const middleware = isRole(mockAuth, 'admin');
      mockReq.user = { id: 'test-user', role: 'candidate' };
      
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn()
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('error', expect.objectContaining({
        message: expect.stringContaining('admin')
      }));
    });

    it('should call next when user has required role', () => {
      const middleware = isRole(mockAuth, 'admin');
      mockReq.user = { id: 'test-user', role: 'admin' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      const middleware = isRole(mockAuth, 'admin', 'employer');
      mockReq.user = { id: 'test-user', role: 'employer' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should default to candidate role when user role is undefined', () => {
      const middleware = isRole(mockAuth, 'candidate');
      mockReq.user = { id: 'test-user', role: undefined };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateInput', () => {
    it('should sanitize string values in request body', () => {
      mockReq.body = {
        name: '  <script>alert("xss")</script>Test User  ',
        email: 'test@example.com'
      };

      validateInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.name).not.toContain('<script>');
      expect(mockReq.body.name).toContain('Test User');
    });

    it('should sanitize string values in query params', () => {
      mockReq.query = {
        search: '  $gt:{}  ',
        page: '1'
      };

      validateInput(mockReq, mockRes, mockNext);

      expect(mockReq.query.search).not.toContain('$gt');
    });

    it('should handle non-string values gracefully', () => {
      mockReq.body = {
        count: 123,
        items: ['item1', 'item2'],
        nested: { value: 'test' }
      };

      validateInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.count).toBe(123);
      expect(mockReq.body.items).toEqual(['item1', 'item2']);
    });

    it('should handle empty body and query', () => {
      mockReq.body = null;
      mockReq.query = null;

      validateInput(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace from string values', () => {
      mockReq.body = {
        name: '  Test User  '
      };

      validateInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.name).toBe('Test User');
    });
  });
});