import express from 'express';
import { body, param } from 'express-validator';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import { isAuthenticated, isRole } from '../middleware/auth.js';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, idParamValidator } from '../middleware/validation.js';
import { paginate } from '../middleware/pagination.js';
import { sanitizeRegex, logAuditAction, emitNotification } from '../utils/helpers.js';
import logger from '../config/logger.js';
import { JOB_TYPE, JOB_LOCATION, JOB_CATEGORY, EXPERIENCE_LEVEL } from '../config/constants.js';

const router = express.Router();

export const initAdminRouter = (auth) => {
  const authInstance = auth;
  router.use(isAuthenticated(auth));
  router.use(isRole(auth, 'admin'));

  // GET /admin - Admin dashboard
  router.get('/', asyncHandler(async (req, res) => {
    try {
      const [
        totalUsers,
        totalEmployers,
        totalCandidates,
        totalCompanies,
        totalJobs,
        pendingJobs,
        pendingCompanies,
        totalApplications,
        recentAuditLogs
      ] = await Promise.all([
        User.countDocuments().catch(err => { logger.error('Error counting users:', err); return 0; }),
        User.countDocuments({ role: 'employer' }).catch(err => { logger.error('Error counting employers:', err); return 0; }),
        User.countDocuments({ role: 'candidate' }).catch(err => { logger.error('Error counting candidates:', err); return 0; }),
        Company.countDocuments().catch(err => { logger.error('Error counting companies:', err); return 0; }),
        Job.countDocuments().catch(err => { logger.error('Error counting jobs:', err); return 0; }),
        Job.countDocuments({ status: 'pending' }).catch(err => { logger.error('Error counting pending jobs:', err); return 0; }),
        Company.countDocuments({ verified: false }).catch(err => { logger.error('Error counting pending companies:', err); return 0; }),
        Application.countDocuments().catch(err => { logger.error('Error counting applications:', err); return 0; }),
        AuditLog.find()
          .populate('adminUserId', 'name email')
          .sort({ createdAt: -1 })
          .limit(10)
          .catch(err => { logger.error('Error fetching audit logs:', err); return []; })
      ]);

      logger.info(`Admin dashboard stats: users=${totalUsers}, employers=${totalEmployers}, candidates=${totalCandidates}, companies=${totalCompanies}, jobs=${totalJobs}, pendingJobs=${pendingJobs}, pendingCompanies=${pendingCompanies}, applications=${totalApplications}`);

      res.render('admin/dashboard', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        stats: {
          totalUsers: totalUsers || 0,
          totalEmployers: totalEmployers || 0,
          totalCandidates: totalCandidates || 0,
          totalCompanies: totalCompanies || 0,
          totalJobs: totalJobs || 0,
          pendingJobs: pendingJobs || 0,
          pendingCompanies: pendingCompanies || 0,
          totalApplications: totalApplications || 0
        },
        recentAuditLogs: recentAuditLogs || []
      });
    } catch (error) {
      logger.error('Error loading admin dashboard:', error);
      res.render('admin/dashboard', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        stats: {
          totalUsers: 0,
          totalEmployers: 0,
          totalCandidates: 0,
          totalCompanies: 0,
          totalJobs: 0,
          pendingJobs: 0,
          pendingCompanies: 0,
          totalApplications: 0
        },
        recentAuditLogs: [],
        error: 'Failed to load dashboard statistics'
      });
    }
  }));

  // GET /admin/users/create - Create user form
  router.get('/users/create', asyncHandler(async (req, res) => {
    res.render('admin/user-create', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
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

      // Use better-auth signUp to create the user
      const signUpResult = await authInstance.api.signUp({
        email,
        password,
        name
      });

      if (signUpResult.error) {
        req.flash('error', signUpResult.error.message || 'Failed to create user');
        return res.redirect('/admin/users/create');
      }

      const createdUser = signUpResult.data?.user;
      if (!createdUser) {
        req.flash('error', 'Failed to create user');
        return res.redirect('/admin/users/create');
      }

      // Update the User model with role
      await User.findByIdAndUpdate(createdUser.id, { role, isActive: true }, { upsert: true });

      // Create UserProfile
      await UserProfile.create({
        userId: createdUser.id,
        role,
        isActive: true
      });

      await logAuditAction(req, 'user_create', 'user', createdUser.id, {
        email: createdUser.email,
        role
      });

      logger.info(`Admin ${req.userId} created user ${createdUser.email}`);
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
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        users,
        filters: { search, role },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/users/:id/edit - Edit user form
  router.get('/users/:id/edit', asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).render('error', {
        message: 'User not found',
        title: '404 - Not Found'
      });
    }

    const profile = await UserProfile.findOne({ userId: targetUser.id });

    res.render('admin/user-edit', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      targetUser,
      profile
    });
  }));

  // PUT /admin/users/:id - Update user
  router.put('/users/:id',
    [
      param('id').isMongoId().withMessage('Invalid user ID'),
      body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
      body('email').optional().isEmail().withMessage('Please enter a valid email address'),
      body('role').optional().isIn(['candidate', 'employer', 'admin']).withMessage('Invalid role selected')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { name, email, role } = req.body;
      const updates = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;

      const user = await User.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' });
      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users');
      }

      if (role) {
        await UserProfile.findOneAndUpdate(
          { userId: user.id },
          { role },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }

      await logAuditAction(req, 'user_update', 'user', user._id, {
        updates,
        email: user.email
      });

      logger.info(`Admin ${req.userId} updated user ${user.email}`);
      req.flash('success', 'User updated successfully');
      res.redirect(`/admin/users/${req.params.id}`);
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
      csrfToken: req.csrfToken ? req.csrfToken() : '',
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

  // POST /admin/users/:id/toggle-status - Toggle user account status
  router.post('/users/:id/toggle-status', idParamValidator, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    const oldStatus = user.isActive;
    user.isActive = !user.isActive;
    await user.save();

    await logAuditAction(req, user.isActive ? 'user_activate' : 'user_deactivate', 'user', user._id, {
      oldStatus,
      newStatus: user.isActive,
      email: user.email
    });

    logger.info(`Admin ${req.userId} toggled status for user ${user._id} to ${user.isActive}`);
    req.flash('success', `User account ${user.isActive ? 'activated' : 'deactivated'} successfully.`);
    res.redirect(`/admin/users/${req.params.id}`);
  }));

  // GET /admin/jobs - List all jobs
  router.get('/jobs',
    paginate(20),
    asyncHandler(async (req, res) => {
      const { status, search, company } = req.query;

      const filter = {};
      if (status && status !== 'all') filter.status = status;
      if (company) filter['company.name'] = { $regex: sanitizeRegex(company), $options: 'i' };
      if (search) {
        const safeSearch = sanitizeRegex(search);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .populate('company', 'name logo')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Job.countDocuments(filter)
      ]);

      res.render('admin/jobs', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        jobs,
        filters: { status, search, company },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/companies - List all companies
  router.get('/companies',
    paginate(20),
    asyncHandler(async (req, res) => {
      const { status, search } = req.query;

      const filter = {};
      if (status === 'verified') filter.verified = true;
      else if (status === 'pending') filter.verified = false;
      if (search) {
        const safeSearch = sanitizeRegex(search);
        filter.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { industry: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      const [companies, total] = await Promise.all([
        Company.find(filter)
          .populate('userId', 'name email')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Company.countDocuments(filter)
      ]);

      res.render('admin/companies', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        companies,
        filters: { status, search },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/companies/create - Create company form
  router.get('/companies/create', asyncHandler(async (req, res) => {
    res.render('admin/company-create', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }));

  // POST /admin/companies - Create new company
  router.post('/companies',
    [
      body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
      body('description').trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
      body('industry').trim().isLength({ max: 100 }).withMessage('Industry must be under 100 characters'),
      body('size').isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).withMessage('Please select a valid company size'),
      body('website').optional({ checkFalsy: true }).trim().isURL({ protocols: ['http', 'https'], require_protocol: false }).withMessage('Invalid website URL'),
      body('headquarters').optional().trim().isLength({ max: 100 }),
      body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { name, description, industry, size, website, headquarters, foundedYear } = req.body;

      // Create a temporary user for the company (admin-created companies)
      const tempUser = new User({
        name: `${name} Admin`,
        email: `admin@${name.toLowerCase().replace(/\s+/g, '')}.com`,
        role: 'employer',
        isActive: true
      });
      await tempUser.save();

      const companyData = {
        name,
        description,
        industry,
        size,
        website,
        headquarters,
        foundedYear: foundedYear ? parseInt(foundedYear) : undefined,
        userId: tempUser._id,
        verified: true, // Admin-created companies are auto-verified
        socialLinks: {},
        specializations: [],
        status: 'approved'
      };

      const company = new Company(companyData);
      await company.save();

      await logAuditAction(req, 'company_create', 'company', company._id, {
        name: company.name
      });

      logger.info(`Admin ${req.userId} created company: ${company._id}`);
      req.flash('success', 'Company created successfully');
      res.redirect('/admin/companies');
    })
  );

  // GET /admin/jobs/create - Create job form
  router.get('/jobs/create', asyncHandler(async (req, res) => {
    const companies = await Company.find({ verified: true }).select('name _id');
    res.render('admin/job-create', { csrfToken: req.csrfToken ? req.csrfToken() : '', companies });
  }));

  // POST /admin/jobs - Create new job
  router.post('/jobs',
    [
      body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
      body('description').trim().isLength({ min: 50, max: 5000 }).withMessage('Description must be 50-5000 characters'),
      body('company').isMongoId().withMessage('Invalid company ID'),
      body('location').isIn(JOB_LOCATION).withMessage('Invalid location'),
      body('type').isIn(JOB_TYPE).withMessage('Invalid job type'),
      body('category').optional().isIn(JOB_CATEGORY),
      body('experienceLevel').optional().isIn(EXPERIENCE_LEVEL),
      body('salary.min').optional().isInt({ min: 0 }),
      body('salary.max').optional().isInt({ min: 0 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const company = await Company.findById(req.body.company);
      if (!company) {
        req.flash('error', 'Company not found');
        return res.redirect('/admin/jobs/create');
      }

      const skills = req.body.skills ? (Array.isArray(req.body.skills) ? req.body.skills : req.body.skills.split(',')).map(s => s.trim()).filter(s => s) : [];
      const requirements = req.body.requirements ? (Array.isArray(req.body.requirements) ? req.body.requirements : req.body.requirements.split('\n')).map(r => r.trim()).filter(r => r) : [];

      const jobData = {
        title: req.body.title,
        description: req.body.description,
        company: company._id,
        location: req.body.location,
        type: req.body.type,
        category: req.body.category || 'Other',
        experienceLevel: req.body.experienceLevel || 'Entry',
        skills,
        requirements,
        salary: req.body.salary || {},
        status: 'approved', // Admin created jobs are auto-approved
        postedBy: req.userId,
        isActive: true
      };

      const job = new Job(jobData);
      await job.save();

      await logAuditAction(req, 'job_create', 'job', job._id, {
        title: job.title,
        company: company.name
      });

      logger.info(`Admin ${req.userId} created job: ${job._id}`);
      req.flash('success', 'Job created successfully');
      res.redirect('/admin/jobs');
    })
  );

  // GET /admin/jobs/:id/edit - Edit job form
  router.get('/jobs/:id/edit', asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('company', 'name');
    if (!job) {
      return res.status(404).render('error', { message: 'Job not found' });
    }

    const companies = await Company.find({ verified: true }).select('name _id');
    res.render('admin/job-edit', { csrfToken: req.csrfToken ? req.csrfToken() : '', job, companies });
  }));

  // PUT /admin/jobs/:id - Update job
  router.put('/jobs/:id',
    [
      param('id').isMongoId().withMessage('Invalid job ID'),
      body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
      body('description').optional().trim().isLength({ min: 50, max: 5000 }).withMessage('Description must be 50-5000 characters'),
      body('company').optional().isMongoId().withMessage('Invalid company ID'),
      body('location').optional().isIn(JOB_LOCATION).withMessage('Invalid location'),
      body('type').optional().isIn(JOB_TYPE).withMessage('Invalid job type'),
      body('category').optional().isIn(JOB_CATEGORY),
      body('experienceLevel').optional().isIn(EXPERIENCE_LEVEL),
      body('salary.min').optional().isInt({ min: 0 }),
      body('salary.max').optional().isInt({ min: 0 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const job = await Job.findById(req.params.id);
      if (!job) {
        req.flash('error', 'Job not found');
        return res.redirect('/admin/jobs');
      }

      const updates = {};
      if (req.body.title) updates.title = req.body.title;
      if (req.body.description) updates.description = req.body.description;
      if (req.body.company) updates.company = req.body.company;
      if (req.body.location) updates.location = req.body.location;
      if (req.body.type) updates.type = req.body.type;
      if (req.body.category) updates.category = req.body.category;
      if (req.body.experienceLevel) updates.experienceLevel = req.body.experienceLevel;
      if (req.body.skills) updates.skills = Array.isArray(req.body.skills) ? req.body.skills : req.body.skills.split(',').map(s => s.trim()).filter(s => s);
      if (req.body.requirements) updates.requirements = Array.isArray(req.body.requirements) ? req.body.requirements : req.body.requirements.split('\n').map(r => r.trim()).filter(r => r);
      if (req.body.salary) updates.salary = req.body.salary;
      updates.updatedAt = new Date();

      Object.assign(job, updates);
      await job.save();

      await logAuditAction(req, 'job_update', 'job', job._id, {
        title: job.title,
        updates: Object.keys(updates)
      });

      logger.info(`Admin ${req.userId} updated job: ${job._id}`);
      req.flash('success', 'Job updated successfully');
      res.redirect(`/admin/jobs/${req.params.id}`);
    })
  );

  // DELETE /admin/jobs/:id - Delete job
  router.delete('/jobs/:id', asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await Job.findByIdAndDelete(req.params.id);

    await logAuditAction(req, 'job_delete', 'job', job._id, {
      title: job.title
    });

    logger.info(`Admin ${req.userId} deleted job: ${req.params.id}`);
    req.flash('success', 'Job deleted successfully');
    res.json({ success: true, redirect: '/admin/jobs' });
  }));

  // GET /admin/jobs/:id - Job detail view
  router.get('/jobs/:id', asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('company', 'name logo');
    if (!job) {
      return res.status(404).render('error', { message: 'Job not found' });
    }

    res.render('admin/job-detail', { csrfToken: req.csrfToken ? req.csrfToken() : '', job });
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
        csrfToken: req.csrfToken ? req.csrfToken() : '',
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
        csrfToken: req.csrfToken ? req.csrfToken() : '',
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

  // GET /admin/audit-logs - View audit logs with filters
  router.get('/audit-logs',
    paginate(50),
    asyncHandler(async (req, res) => {
      const { action, adminUser, targetType, dateFrom, dateTo, priority } = req.query;

      const query = {};
      if (action) query.action = action;
      if (adminUser) query.adminUserId = adminUser;
      if (targetType) query.targetType = targetType;
      if (priority) query.priority = priority;
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const [auditLogs, total] = await Promise.all([
        AuditLog.find(query)
          .populate('adminUserId', 'name email')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        AuditLog.countDocuments(query)
      ]);

      res.render('admin/audit-logs', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        auditLogs,
        filters: { action, adminUser, targetType, dateFrom, dateTo, priority },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/notifications - List notifications
  router.get('/notifications',
    paginate(20),
    asyncHandler(async (req, res) => {
      const { type, recipient, isRead } = req.query;

      const filter = {};
      if (type) filter.type = type;
      if (recipient) filter.recipient = recipient;
      if (isRead !== undefined) filter.isRead = isRead === 'true';

      const [notifications, total] = await Promise.all([
        Notification.find(filter)
          .populate('recipient', 'name email')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Notification.countDocuments(filter)
      ]);

      res.render('admin/notifications', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        notifications,
        filters: { type, recipient, isRead },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/notifications/send - Send notification form
  router.get('/notifications/send', asyncHandler(async (req, res) => {
    res.render('admin/notification-send', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }));

  // POST /admin/notifications/send - Send system notification
  router.post('/notifications/send', asyncHandler(async (req, res) => {
    const { title, message, recipientType, recipientIds, link, priority } = req.body;

    if (!title || !message) {
      req.flash('error', 'Title and message are required');
      return res.redirect('/admin/notifications/send');
    }

    let recipients = [];
    if (recipientType === 'all') {
      recipients = await User.find({ isActive: true }).select('_id');
    } else if (recipientType === 'role' && req.body.role) {
      recipients = await User.find({ role: req.body.role, isActive: true }).select('_id');
    } else if (recipientType === 'specific' && recipientIds) {
      recipients = recipientIds.split(',').map(id => id.trim());
    }

    const notifications = recipients.map(user => ({
      recipient: user._id,
      type: 'system_notification',
      title,
      priority: priority || 'medium',
      message,
      link: link || null,
      isRead: false
    }));
    const insertedNotifications = await Notification.insertMany(notifications);

    // Emit real-time updates for all recipients
    insertedNotifications.forEach(notification => {
      emitNotification(req, notification.recipient, notification);
    });

    await logAuditAction(req, 'notification_send', 'system', null, {
      category: 'System',
      title,
      recipientCount: recipients.length,
      recipientType
    }, priority || 'medium');

    logger.info(`Admin ${req.userId} sent system notification to ${recipients.length} users`);
    req.flash('success', `Notification sent to ${recipients.length} users`);
    res.redirect('/admin/notifications/send');
  }));

  // POST /admin/notifications/:id/delete - Delete notification
  router.post('/notifications/:id/delete', asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      req.flash('error', 'Notification not found');
      return res.redirect('/admin/notifications');
    }

    await Notification.findByIdAndDelete(req.params.id);

    await logAuditAction(req, 'notification_delete', 'notification', notification._id, {
      title: notification.title
    });

    logger.info(`Admin ${req.userId} deleted notification: ${req.params.id}`);
    req.flash('success', 'Notification deleted successfully');
    res.redirect('/admin/notifications');
  }));

  return router;
};