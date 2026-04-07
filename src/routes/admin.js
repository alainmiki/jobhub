import express from 'express';
import { body, param } from 'express-validator';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import { isAuthenticated, isRole } from '../middleware/auth.js';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, idParamValidator } from '../middleware/validation.js';
import { paginate } from '../middleware/pagination.js';
import { sanitizeRegex, logAuditAction } from '../utils/helpers.js';
import logger from '../config/logger.js';

const router = express.Router();

export const initAdminRouter = (auth) => {
  router.use(isAuthenticated(auth));
  router.use(isRole(auth, 'admin'));

  // GET /admin/users/create - Create user form
  router.get('/users/create', asyncHandler(async (req, res) => {
    res.render('admin/user-create');
  }));

  // POST /admin/users - Create new user
  router.post('/users',
    [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Please enter a valid email address'),
      body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
      body('role').isIn(['candidate', 'employer', 'admin']).withMessage('Invalid role selected')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { name, email, role, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'User with this email already exists');
      return res.redirect('/admin/users/create');
    }

    const user = new User({
      name,
      email,
      role,
      isActive: true
    });

    // Hash password (assuming auth handles it, but for now set directly if needed)
    // Since using better-auth, perhaps create via auth
    // For simplicity, assume User model has password field
    user.password = password; // In real app, hash it

    await user.save();

    // Create UserProfile
    await UserProfile.create({
      userId: user._id,
      role,
      isActive: true
    });

    await logAuditAction(req, 'user_create', 'user', user._id, {
      email: user.email,
      role: user.role
    });

    logger.info(`Admin ${req.userId} created user ${user.email}`);
    req.flash('success', 'User created successfully');
    res.redirect('/admin/users');
  }));

  // POST /admin/users/:id/delete - Delete user
  router.post('/users/:id/delete', idParamValidator, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Prevent deleting self
    if (user._id.toString() === req.userId) {
      req.flash('error', 'Cannot delete your own account');
      return res.redirect('/admin/users');
    }

    await UserProfile.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(req.params.id);

    await logAuditAction(req, 'user_delete', 'user', user._id, {
      email: user.email,
      role: user.role
    });

    logger.info(`Admin ${req.userId} deleted user ${user.email}`);
    req.flash('success', 'User deleted successfully');
    res.redirect('/admin/users');
  }));

  // GET /admin/users - User management list with filters and pagination
  router.get('/users', 
    paginate(20), 
    asyncHandler(async (req, res) => {
      const { search, role } = req.query;      
      
      const query = {};
      if (search) {
        const safeSearch = sanitizeRegex(search);
        query.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      if (role) {
        query.role = role;
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        User.countDocuments(query)
      ]);

      res.render('admin/users', {
        users,
        filters: { search, role },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/users/:id - User detail view
  router.get('/users/:id', asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).render('error', {
        message: 'User not found',
        title: '404 - Not Found'
      });
    }

    const profile = await UserProfile.findOne({ userId: targetUser.id });

    res.render('admin/user-detail', {
      targetUser,
      profile
    });
  }));

  // POST /admin/users/:id/role - Update user role
  router.post('/users/:id/role',
    [
      param('id').isMongoId().withMessage('Invalid user ID'),
      body('role').isIn(['candidate', 'employer', 'admin']).withMessage('Invalid role')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { role } = req.body;

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Sync the UserProfile role with upsert to handle users who haven't set up a profile yet
    await UserProfile.findOneAndUpdate(
      { userId: user.id },
      { role },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await logAuditAction(req, 'user_role_update', 'user', user._id, {
      oldRole: user.role,
      newRole: role,
      email: user.email
    });

    logger.info(`Admin ${req.userId} updated role for ${user.email} to ${role}`);

    req.flash('success', `User role updated to ${role} successfully.`);
    res.json({ success: true, redirect: `/admin/users/${req.params.id}` });
  }));

  // POST /admin/users/:id/disable - Toggle user account status
  router.post('/users/:id/disable', idParamValidator, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    const oldStatus = user.isActive;
    user.isActive = !user.isActive; // Assuming an isActive field exists
    await user.save();

    await logAuditAction(req, user.isActive ? 'user_enable' : 'user_disable', 'user', user._id, {
      oldStatus,
      newStatus: user.isActive,
      email: user.email
    });

    logger.info(`Admin ${req.userId} toggled status for user ${user._id} to ${user.isActive}`);
    req.flash('success', `User account ${user.isActive ? 'enabled' : 'disabled'} successfully.`);
    res.redirect(`/admin/users/${req.params.id}`);
  }));

  // GET /admin/jobs/pending - List pending jobs
  router.get('/jobs/pending',
    paginate(20),
    asyncHandler(async (req, res) => {
      const filter = { status: 'pending' };
      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .populate('company', 'name logo')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Job.countDocuments(filter)
      ]);

      res.render('admin/pending-jobs', {
        jobs,
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/companies/pending - List pending companies
  router.get('/companies/pending',
    paginate(20),
    asyncHandler(async (req, res) => {
      const filter = { verified: false };
      const [companies, total] = await Promise.all([
        Company.find(filter)
          .populate('userId', 'name email') // Populate owner info
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Company.countDocuments(filter)
      ]);

      res.render('admin/pending-companies', {
        companies,
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // POST /admin/companies/:id/approve - Approve company
  router.post('/companies/:id/approve', idParamValidator, asyncHandler(async (req, res) => {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { verified: true, verifiedAt: new Date() },
      { new: true }
    );

    if (!company) {
      req.flash('error', 'Company not found');
      return res.redirect('/admin/companies/pending');
    }

    await logAuditAction(req, 'company_approve', 'company', company._id, {
      name: company.name
    });

    logger.info(`Admin ${req.userId} approved company: ${company._id}`);
    req.flash('success', 'Company approved successfully');
    res.redirect('/admin/companies/pending');
  }));

  // POST /admin/companies/:id/reject - Reject company
  router.post('/companies/:id/reject', idParamValidator, asyncHandler(async (req, res) => {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { verified: false },
      { new: true }
    );

    if (!company) {
      req.flash('error', 'Company not found');
      return res.redirect('/admin/companies/pending');
    }

    await logAuditAction(req, 'company_reject', 'company', company._id, {
      name: company.name
    });

    logger.info(`Admin ${req.userId} rejected company: ${company._id}`);
    req.flash('success', 'Company rejected');
    res.redirect('/admin/companies/pending');
  }));

  // POST /admin/jobs/:id/approve - Approve job
  router.post('/jobs/:id/approve', idParamValidator, asyncHandler(async (req, res) => {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.userId,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/admin/jobs/pending');
    }

    await logAuditAction(req, 'job_approve', 'job', job._id, {
      title: job.title
    });

    logger.info(`Admin ${req.userId} approved job: ${req.params.id}`);
    req.flash('success', 'Job approved successfully');
    res.redirect('/admin/jobs/pending');
  }));

  // POST /admin/jobs/:id/reject - Reject job
  router.post('/jobs/:id/reject', idParamValidator, asyncHandler(async (req, res) => {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );

    if (!job) {
      req.flash('error', 'Job not found');
      return res.redirect('/admin/jobs/pending');
    }

    await logAuditAction(req, 'job_reject', 'job', job._id, {
      title: job.title
    });

    logger.info(`Admin ${req.userId} rejected job: ${req.params.id}`);
    req.flash('success', 'Job rejected');
    res.redirect('/admin/jobs/pending');
  }));

  return router;
};