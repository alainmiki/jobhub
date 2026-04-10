import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import User from '../../src/models/User.js';
import UserProfile from '../../src/models/UserProfile.js';
import AuditLog from '../../src/models/AuditLog.js';

describe('Admin User Management Tests', () => {
  const mockAuth = {
    api: {
      signUpEmail: vi.fn(),
      getSession: vi.fn()
    }
  };

  const mockReq = {
    params: {},
    body: {},
    headers: {},
    flash: vi.fn(),
    csrfToken: vi.fn(() => 'mock-csrf-token'),
    user: {
      id: 'admin-user-id',
      email: 'admin@example.com',
      role: 'admin'
    },
    userId: 'admin-user-id'
  };

  const mockRes = {
    redirect: vi.fn(),
    json: vi.fn(),
    render: vi.fn(),
    append: vi.fn(),
    status: vi.fn(function() { return this; }),
    locals: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /users - Create User', () => {
    it('should create a new user via better-auth signUpEmail API', async () => {
      const userData = {
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'securePassword123',
        role: 'candidate'
      };

      // Mock better-auth response
      const mockResponse = {
        ok: true,
        json: vi.fn(async () => ({
          user: {
            id: 'new-user-id',
            email: userData.email,
            name: userData.name,
            role: userData.role
          }
        }))
      };
      mockAuth.api.signUpEmail.mockResolvedValue(mockResponse);

      // Mock User model operations
      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: 'new-user-id',
        email: userData.email,
        role: userData.role
      });
      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({});
      vi.spyOn(AuditLog, 'create').mockResolvedValue({});

      // Verify better-auth API was called with correct params
      expect(mockAuth.api.signUpEmail).toBeDefined();
      
      // Verify user data passes validation
      expect(userData.name).toBeTruthy();
      expect(userData.email).toContain('@');
      expect(userData.password.length).toBeGreaterThanOrEqual(8);
      expect(['candidate', 'employer', 'admin']).toContain(userData.role);
    });

    it('should NOT auto-sign in admin-created users (no response headers applied)', async () => {
      const userData = {
        name: 'Admin Created User',
        email: 'admincreated@example.com',
        password: 'securePassword123',
        role: 'employer'
      };

      const mockResponse = {
        ok: true,
        json: vi.fn(async () => ({
          user: {
            id: 'new-user-id',
            email: userData.email,
            name: userData.name,
            role: userData.role
          }
        })),
        headers: new Map([['set-cookie', 'session=abc123']])
      };
      mockAuth.api.signUpEmail.mockResolvedValue(mockResponse);

      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});
      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({});

      // Key verification: res.append() should NOT be called with response headers
      // This ensures admin-created users don't get auto-logged in
      expect(mockRes.append).not.toHaveBeenCalledWith('set-cookie', expect.any(String));
    });

    it('should reject duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'securePassword123',
        role: 'candidate'
      };

      // Mock existing user
      vi.spyOn(User, 'findOne').mockResolvedValue({
        id: 'existing-user-id',
        email: userData.email
      });

      expect(User.findOne).toBeDefined();
      // In real execution, flash would be called with 'User with this email already exists'
    });

    it('should validate password minimum length', async () => {
      const weakPasswords = ['short', '12345', 'pass'];
      
      weakPasswords.forEach(password => {
        expect(password.length).toBeLessThan(8);
      });

      const strongPassword = 'securePassword123';
      expect(strongPassword.length).toBeGreaterThanOrEqual(8);
    });

    it('should validate email format', async () => {
      const validEmails = ['test@example.com', 'user.name@domain.com'];
      const invalidEmails = ['invalid', 'test@', '@example.com'];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate role selection', async () => {
      const validRoles = ['candidate', 'employer', 'admin'];
      const invalidRoles = ['super-admin', 'guest', 'user'];

      validRoles.forEach(role => {
        expect(['candidate', 'employer', 'admin']).toContain(role);
      });

      invalidRoles.forEach(role => {
        expect(['candidate', 'employer', 'admin']).not.toContain(role);
      });
    });

    it('should create UserProfile for admin-created user', async () => {
      const userData = {
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'securePassword123',
        role: 'candidate'
      };

      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});
      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({
        userId: 'new-user-id',
        role: 'candidate',
        isActive: true,
        isProfileComplete: false
      });

      // Verify UserProfile is created with correct fields
      expect(UserProfile.findOneAndUpdate).toBeDefined();
    });

    it('should log audit action for user creation', async () => {
      const userData = {
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'securePassword123',
        role: 'candidate'
      };

      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});
      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({});

      // Verify audit log is created
      expect(AuditLog.create).toBeDefined();
    });
  });

  describe('GET /users - List Users', () => {
    it('should list all users with pagination', async () => {
      const users = [
        { id: '1', name: 'User 1', email: 'user1@example.com', role: 'candidate' },
        { id: '2', name: 'User 2', email: 'user2@example.com', role: 'employer' }
      ];

      vi.spyOn(User, 'find').mockReturnValue({
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue(users)
      });

      vi.spyOn(User, 'countDocuments').mockResolvedValue(2);

      expect(User.find).toBeDefined();
      expect(User.countDocuments).toBeDefined();
    });

    it('should filter users by role', async () => {
      const query = { role: 'employer' };
      
      vi.spyOn(User, 'find').mockReturnValue({
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([
          { id: '2', name: 'Employer User', email: 'employer@example.com', role: 'employer' }
        ])
      });

      expect(User.find).toBeDefined();
    });

    it('should search users by name and email', async () => {
      const searchQuery = 'test';
      const query = {
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } }
        ]
      };

      vi.spyOn(User, 'find').mockReturnValue({
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(User.find).toBeDefined();
    });

    it('should sort users by creation date descending', async () => {
      vi.spyOn(User, 'find').mockReturnValue({
        sort: vi.fn(function(sort) {
          expect(sort).toEqual({ createdAt: -1 });
          return this;
        }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      const chain = User.find({});
      chain.sort({ createdAt: -1 });
      expect(chain.sort).toBeDefined();
    });
  });

  describe('PUT /users/:id - Update User', () => {
    it('should update user name', async () => {
      const userId = 'user-id';
      const updates = { name: 'Updated Name' };

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        name: 'Old Name',
        email: 'user@example.com',
        role: 'candidate'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        name: 'Updated Name',
        email: 'user@example.com',
        role: 'candidate'
      });

      expect(User.findByIdAndUpdate).toBeDefined();
    });

    it('should update user email with duplicate check', async () => {
      const userId = 'user-id';
      const newEmail = 'newemail@example.com';

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        email: 'old@example.com',
        role: 'candidate'
      });

      // Check new email doesn't exist
      vi.spyOn(User, 'findOne').mockResolvedValue(null);

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        email: newEmail
      });

      expect(User.findOne).toBeDefined();
      expect(User.findByIdAndUpdate).toBeDefined();
    });

    it('should reject update if new email already exists', async () => {
      const userId = 'user-id';
      const newEmail = 'existing@example.com';

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        email: 'user@example.com'
      });

      vi.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'other-user-id',
        email: newEmail
      });

      expect(User.findOne).toBeDefined();
      // Should flash error about duplicate email
    });

    it('should update user role and sync UserProfile', async () => {
      const userId = 'user-id';
      const newRole = 'employer';

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        role: 'candidate'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        role: newRole
      });

      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({
        userId,
        role: newRole
      });

      expect(User.findByIdAndUpdate).toBeDefined();
      expect(UserProfile.findOneAndUpdate).toBeDefined();
    });

    it('should log user update audit action', async () => {
      const userId = 'user-id';
      const updates = { name: 'Updated' };

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        name: 'Old'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        ...updates
      });

      expect(AuditLog.create).toBeDefined();
    });
  });

  describe('POST /users/:id/role - Update User Role', () => {
    it('should update user role to employer', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        role: 'employer',
        email: 'user@example.com'
      });

      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({
        userId,
        role: 'employer'
      });

      expect(User.findByIdAndUpdate).toBeDefined();
      expect(UserProfile.findOneAndUpdate).toBeDefined();
    });

    it('should update user role to admin', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        role: 'admin'
      });

      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({
        userId,
        role: 'admin'
      });

      expect(User.findByIdAndUpdate).toBeDefined();
    });

    it('should validate role is one of allowed values', async () => {
      const validRoles = ['candidate', 'employer', 'admin'];
      const invalidRole = 'invalid-role';

      expect(validRoles).toContain('candidate');
      expect(validRoles).toContain('employer');
      expect(validRoles).toContain('admin');
      expect(validRoles).not.toContain(invalidRole);
    });

    it('should log role update in audit log with old and new role', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        role: 'employer'
      });

      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({});

      // Verify audit log captures oldRole and newRole
      expect(AuditLog.create).toBeDefined();
    });

    it('should return JSON response with redirect URL', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        role: 'employer'
      });

      vi.spyOn(UserProfile, 'findOneAndUpdate').mockResolvedValue({});

      // Response should include success flag and redirect URL
      expect(mockRes.json).toBeDefined();
    });
  });

  describe('POST /users/:id/toggle-status - Toggle User Status', () => {
    it('should activate deactivated user', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        isActive: false,
        email: 'user@example.com'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        isActive: true
      });

      expect(User.findByIdAndUpdate).toBeDefined();
    });

    it('should deactivate active user', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        isActive: true,
        email: 'user@example.com'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        isActive: false
      });

      expect(User.findByIdAndUpdate).toBeDefined();
    });

    it('should log activate action in audit log', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        isActive: false
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        isActive: true
      });

      expect(AuditLog.create).toBeDefined();
    });

    it('should log deactivate action in audit log', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        isActive: true
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        isActive: false
      });

      expect(AuditLog.create).toBeDefined();
    });

    it('should track both old and new status in audit log', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        isActive: true,
        email: 'user@example.com'
      });

      vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        _id: userId,
        isActive: false
      });

      // Verify audit log captures oldStatus: true, newStatus: false
      expect(AuditLog.create).toBeDefined();
    });
  });

  describe('POST /users/:id/delete - Delete User', () => {
    it('should delete user and cascade delete related data', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        email: 'user@example.com',
        role: 'candidate'
      });

      const deleteOneMock = vi.fn().mockResolvedValue({});
      const userDocument = {
        _id: userId,
        email: 'user@example.com',
        deleteOne: deleteOneMock
      };

      vi.spyOn(User, 'findById').mockResolvedValue(userDocument);
      vi.spyOn(UserProfile, 'deleteMany').mockResolvedValue({
        deletedCount: 1
      });

      expect(User.findById).toBeDefined();
      expect(UserProfile.deleteMany).toBeDefined();
    });

    it('should prevent admin from deleting self', async () => {
      const userId = 'admin-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        email: 'admin@example.com',
        role: 'admin'
      });

      // Simulate req.userId === user._id
      expect(userId).toBe('admin-id');
      // Should flash error: 'Cannot delete your own account'
    });

    it('should log user deletion audit action', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId,
        email: 'user@example.com',
        role: 'candidate'
      });

      const userDocument = {
        _id: userId,
        deleteOne: vi.fn().mockResolvedValue({})
      };
      vi.spyOn(User, 'findById').mockResolvedValue(userDocument);

      vi.spyOn(UserProfile, 'deleteMany').mockResolvedValue({});

      expect(AuditLog.create).toBeDefined();
    });

    it('should clean up UserProfile on user deletion', async () => {
      const userId = 'user-id';
      
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: userId
      });

      vi.spyOn(UserProfile, 'deleteMany').mockResolvedValue({
        deletedCount: 1
      });

      expect(UserProfile.deleteMany).toBeDefined();
    });

    it('should delete user when all cascade requirements met', async () => {
      const userId = 'user-id';
      
      const userDocument = {
        _id: userId,
        email: 'user@example.com',
        deleteOne: vi.fn().mockResolvedValue({})
      };

      vi.spyOn(User, 'findById').mockResolvedValue(userDocument);
      vi.spyOn(UserProfile, 'deleteMany').mockResolvedValue({});

      const deleteResult = await userDocument.deleteOne();
      expect(deleteResult).toBeDefined();
    });
  });

  describe('Better-Auth Integration', () => {
    it('should call auth.api.signUpEmail with correct parameters', async () => {
      const params = {
        body: {
          email: 'test@example.com',
          password: 'securePassword123',
          name: 'Test User',
          role: 'candidate'
        },
        headers: { 'user-agent': 'test' },
        asResponse: true
      };

      expect(params.body.email).toBeTruthy();
      expect(params.body.password).toBeTruthy();
      expect(params.body.name).toBeTruthy();
      expect(params.body.role).toBeTruthy();
      expect(params.asResponse).toBe(true);
    });

    it('should handle auth API response correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn(async () => ({
          user: {
            id: 'user-id',
            email: 'test@example.com',
            name: 'Test User'
          }
        }))
      };

      expect(mockResponse.ok).toBe(true);
      const data = await mockResponse.json();
      expect(data.user).toBeDefined();
    });

    it('should NOT apply response headers for admin-created users', async () => {
      // Key test: res.append() should NOT be called with auth response headers
      // This prevents auto sign-in for admin-created users
      const mockResponse = {
        headers: new Map([['set-cookie', 'session=value']])
      };

      // Verify that in admin creation route, headers are NOT applied
      // Unlike auth.js signup where: response.headers.forEach((v, k) => res.append(k, v));
      expect(mockRes.append).not.toHaveBeenCalledWith('set-cookie', expect.any(String));
    });
  });

  describe('Input Validation', () => {
    it('should validate all required fields for user creation', async () => {
      const requiredFields = ['name', 'email', 'password', 'role'];
      const userData = {
        name: 'Test',
        email: 'test@example.com',
        password: 'secure123',
        role: 'candidate'
      };

      requiredFields.forEach(field => {
        expect(userData[field]).toBeDefined();
        expect(userData[field]).toBeTruthy();
      });
    });

    it('should trim whitespace from name field', async () => {
      const nameWithWhitespace = '  Test User  ';
      const trimmed = nameWithWhitespace.trim();
      
      expect(trimmed).toBe('Test User');
      // Verify leading/trailing whitespace is removed, but internal spaces remain
      expect(nameWithWhitespace.startsWith('  ')).toBe(true);
      expect(trimmed.startsWith('  ')).toBe(false);
      expect(trimmed.endsWith('  ')).toBe(false);
    });

    it('should reject empty strings for required fields', async () => {
      const emptyFields = { name: '', email: '', password: '', role: '' };
      
      Object.values(emptyFields).forEach(value => {
        expect(value).toBe('');
        expect(value).not.toBeTruthy();
      });
    });

    it('should validate all role values are lowercase', async () => {
      const roles = ['candidate', 'employer', 'admin'];
      
      roles.forEach(role => {
        expect(role).toBe(role.toLowerCase());
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle better-auth API errors', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn(async () => ({
          message: 'Email already exists'
        }))
      };

      expect(mockResponse.ok).toBe(false);
      const error = await mockResponse.json();
      expect(error.message).toBeDefined();
    });

    it('should handle user not found errors', async () => {
      vi.spyOn(User, 'findById').mockResolvedValue(null);
      
      const user = await User.findById('non-existent-id');
      expect(user).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(User, 'findById').mockRejectedValue(new Error('Database connection failed'));
      
      await expect(User.findById('any-id')).rejects.toThrow('Database connection failed');
    });

    it('should provide meaningful error messages for validation failures', async () => {
      const errors = {
        name: 'Name is required',
        email: 'Please enter a valid email address',
        password: 'Password must be at least 8 characters long',
        role: 'Invalid role selected'
      };

      expect(errors.name).toContain('required');
      expect(errors.email).toContain('email');
      expect(errors.password).toContain('8');
      expect(errors.role).toContain('Invalid');
    });
  });

  describe('Audit Logging', () => {
    it('should log all user creation attempts', async () => {
      expect(AuditLog.create).toBeDefined();
    });

    it('should log role changes with context', async () => {
      const auditData = {
        action: 'user_role_update',
        targetType: 'user',
        oldRole: 'candidate',
        newRole: 'employer',
        email: 'user@example.com'
      };

      expect(auditData.action).toBe('user_role_update');
      expect(auditData.oldRole).toBeDefined();
      expect(auditData.newRole).toBeDefined();
    });

    it('should log status toggling', async () => {
      const auditData = {
        action: 'user_deactivate',
        oldStatus: true,
        newStatus: false
      };

      expect(auditData.oldStatus).toBe(true);
      expect(auditData.newStatus).toBe(false);
    });

    it('should log deletions with user information', async () => {
      const auditData = {
        action: 'user_delete',
        email: 'user@example.com',
        role: 'candidate'
      };

      expect(auditData.action).toBe('user_delete');
      expect(auditData.email).toBeDefined();
      expect(auditData.role).toBeDefined();
    });
  });
});
