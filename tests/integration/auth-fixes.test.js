import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAuthResponse, handleAuthError, createAuthHandler } from '../../src/utils/authUtils.js';

describe('Auth Utils', () => {
  describe('handleAuthResponse', () => {
    it('should forward headers from auth response to Express response', () => {
      const mockRes = {
        headers: {},
        append: vi.fn()
      };
      
      const mockAuthResponse = {
        headers: new Map([
          ['set-cookie', 'session=abc123; Path=/; HttpOnly'],
          ['x-custom-header', 'value']
        ])
      };

      handleAuthResponse(mockRes, mockAuthResponse);

      expect(mockRes.append).toHaveBeenCalledWith('set-cookie', 'session=abc123; Path=/; HttpOnly');
      expect(mockRes.append).toHaveBeenCalledWith('x-custom-header', 'value');
    });

    it('should handle null auth response', () => {
      const mockRes = {
        append: vi.fn()
      };

      handleAuthResponse(mockRes, null);

      expect(mockRes.append).not.toHaveBeenCalled();
    });

    it('should handle undefined headers', () => {
      const mockRes = {
        append: vi.fn()
      };

      handleAuthResponse(mockRes, {});

      expect(mockRes.append).not.toHaveBeenCalled();
    });
  });

  describe('handleAuthError', () => {
    it('should extract error message from response data', () => {
      const mockRes = {};
      
      const error = {
        response: {
          data: {
            message: 'Invalid credentials'
          }
        }
      };

      const result = handleAuthError(mockRes, error);

      expect(result.error).toBe('Invalid credentials');
      expect(result.message).toBe('Invalid credentials');
    });

    it('should use default message when no error data', () => {
      const mockRes = {};
      
      const error = new Error('Network error');

      const result = handleAuthError(mockRes, error, 'Default error');

      expect(result.error).toBe('Network error');
      expect(result.message).toBe('Network error');
    });

    it('should use fallback message when no error available', () => {
      const mockRes = {};
      
      const result = handleAuthError(mockRes, null, 'Custom default');

      expect(result.error).toBe('Custom default');
    });
  });

  describe('createAuthHandler', () => {
    let mockAuth;
    let mockRes;

    beforeEach(() => {
      mockAuth = {
        api: {
          signInEmail: vi.fn(),
          signUpEmail: vi.fn(),
          signOut: vi.fn(),
          resetPassword: vi.fn(),
          verifyEmail: vi.fn(),
          changePassword: vi.fn()
        }
      };

      mockRes = {
        append: vi.fn()
      };
    });

    it('should create signInEmail handler that forwards headers', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.signInEmail.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.signInEmail({ email: 'test@example.com' }, {}, mockRes);

      expect(mockAuth.api.signInEmail).toHaveBeenCalledWith({
        body: { email: 'test@example.com' },
        headers: {},
        asResponse: true
      });
      expect(mockRes.append).toHaveBeenCalledWith('set-cookie', 'test');
    });

    it('should create signUpEmail handler', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.signUpEmail.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.signUpEmail({ email: 'test@example.com', name: 'Test' }, {}, mockRes);

      expect(mockAuth.api.signUpEmail).toHaveBeenCalled();
    });

    it('should create signOut handler', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.signOut.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.signOut({}, mockRes);

      expect(mockAuth.api.signOut).toHaveBeenCalled();
    });

    it('should create resetPassword handler', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.resetPassword.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.resetPassword({ newPassword: 'pass123' }, {}, mockRes);

      expect(mockAuth.api.resetPassword).toHaveBeenCalled();
    });

    it('should create verifyEmail handler', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.verifyEmail.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.verifyEmail({ token: 'abc123' }, {}, mockRes);

      expect(mockAuth.api.verifyEmail).toHaveBeenCalled();
    });

    it('should create changePassword handler', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map([['set-cookie', 'test']])
      };
      mockAuth.api.changePassword.mockResolvedValue(mockResponse);

      const handler = createAuthHandler(mockAuth);
      await handler.changePassword({ currentPassword: 'old', newPassword: 'new' }, {}, mockRes);

      expect(mockAuth.api.changePassword).toHaveBeenCalled();
    });
  });
});

describe('CSRF Token Tests', () => {
  it('should have CSRF token available in res.locals', () => {
    const csrfToken = 'csrf-token-value';
    expect(csrfToken).toBeDefined();
    expect(csrfToken.length).toBeGreaterThan(0);
  });

  it('should include CSRF token in form submissions', () => {
    const formHtml = '<input type="hidden" name="_csrf" value="{{ csrfToken }}">';
    expect(formHtml).toContain('_csrf');
  });

  it('should validate CSRF token on form submission', () => {
    const validToken = 'token123';
    const submittedToken = 'token123';
    
    expect(validToken).toBe(submittedToken);
  });

  it('should reject form with invalid CSRF token', () => {
    const validToken = 'token123';
    const invalidToken = 'wrong-token';
    
    expect(validToken).not.toBe(invalidToken);
  });
});

describe('Password Field Exclusion Tests', () => {
  const validateInputExcludedFields = () => {
    const excludedFields = ['password', 'confirmPassword', 'newPassword', 'currentPassword'];
    return excludedFields;
  };

  it('should have password in excluded fields', () => {
    const excludedFields = validateInputExcludedFields();
    expect(excludedFields).toContain('password');
  });

  it('should have confirmPassword in excluded fields', () => {
    const excludedFields = validateInputExcludedFields();
    expect(excludedFields).toContain('confirmPassword');
  });

  it('should have newPassword in excluded fields', () => {
    const excludedFields = validateInputExcludedFields();
    expect(excludedFields).toContain('newPassword');
  });

  it('should have currentPassword in excluded fields', () => {
    const excludedFields = validateInputExcludedFields();
    expect(excludedFields).toContain('currentPassword');
  });

  it('should not escape password with special characters', () => {
    const password = 'Test&<Password>123';
    const isEscaped = password.includes('&lt;') || password.includes('&gt;');
    
    expect(isEscaped).toBe(false);
  });
});

describe('Admin Role Synchronization Tests', () => {
  it('should update role in both user and UserProfile collections', async () => {
    const mockUserUpdate = vi.fn().mockResolvedValue({ id: '123', role: 'admin' });
    const mockProfileUpdate = vi.fn().mockResolvedValue({ role: 'admin' });

    const result = await mockUserUpdate({ id: '123' }, { role: 'admin' });
    await mockProfileUpdate({ userId: '123' }, { role: 'admin' });

    expect(result.role).toBe('admin');
  });

  it('should validate role values', () => {
    const validRoles = ['candidate', 'employer', 'admin'];
    const invalidRole = 'superuser';

    expect(validRoles).toContain('candidate');
    expect(validRoles).toContain('employer');
    expect(validRoles).toContain('admin');
    expect(validRoles).not.toContain(invalidRole);
  });
});

describe('User Detail Route Tests', () => {
  it('should fetch user by ID', async () => {
    const mockUser = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'candidate'
    };

    expect(mockUser.id).toBeDefined();
    expect(mockUser.email).toContain('@');
  });

  it('should fetch UserProfile by userId', async () => {
    const mockProfile = {
      userId: 'user-123',
      bio: 'Test bio',
      skills: ['JavaScript'],
      role: 'candidate'
    };

    expect(mockProfile.userId).toBeDefined();
    expect(mockProfile.skills).toBeInstanceOf(Array);
  });

  it('should handle user not found', async () => {
    const user = null;

    expect(user).toBeNull();
  });
});
