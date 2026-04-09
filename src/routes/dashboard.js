import express from 'express';
import { param, body } from 'express-validator';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Interview from '../models/Interview.js';
import AuditLog from '../models/AuditLog.js';
import { createAuthMiddleware, isAuthenticated, isRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate } from '../middleware/pagination.js';
import { validate, idParamValidator } from '../middleware/validation.js';
import { sanitizeRegex, logAuditAction, emitNotification } from '../utils/helpers.js';
import logger from '../config/logger.js';
import { JOB_TYPE, JOB_LOCATION, JOB_CATEGORY, EXPERIENCE_LEVEL } from '../config/constants.js';

const router = express.Router();

export const initDashboardRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  // Security: Prevent disabled accounts from accessing any dashboard routes
  router.use((req, res, next) => {
    if (req.user && req.user.isActive === false) {
      return res.status(403).render('error', { message: 'Your account has been disabled. Please contact support.', title: 'Account Disabled' });
    }
    next();
  });

  // POST /notifications/read-all - Mark all notifications as read
  router.post('/notifications/read-all',
    isAuthenticated(auth),
    asyncHandler(async (req, res) => {
      await Notification.updateMany(
        { recipient: req.userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
      req.flash('success', 'All notifications marked as read.');
      res.redirect(req.get('Referrer') || '/dashboard/candidate');
    })
  );

  router.get('/',
    isAuthenticated(auth),
    asyncHandler(async (req, res) => {
      const role = req.user?.role || 'candidate';
      res.redirect(`/dashboard/${role}`);
    })
  );

  router.get('/candidate',
    isAuthenticated(auth),
    asyncHandler(async (req, res) => {
      const { notifCategory } = req.query;

      // Get applications with populated job data
      const appliedJobs = await Application.find({
        applicantUserId: req.userId
      })
        .populate('job')
        .sort({ createdAt: -1 });

      // Use aggregation to get stats efficiently
      const statsResult = await Application.aggregate([
        { $match: { applicantUserId: req.userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        total: 0,
        pending: 0,
        viewed: 0,
        shortlisted: 0,
        accepted: 0,
        rejected: 0,
        interviewScheduled: 0
      };

      statsResult.forEach(stat => {
        stats[stat._id] = stat.count;
        stats.total += stat.count;
      });

      const recentApplications = appliedJobs.slice(0, 5);

      const upcomingInterviews = await Interview.find({
        candidate: req.userProfile._id,
        status: { $in: ['scheduled', 'confirmed'] },
        scheduledAt: { $gte: new Date() }
      })
        .populate({
          path: 'application',
          populate: { path: 'job', populate: { path: 'company', select: 'name' } }
        })
        .sort({ scheduledAt: 1 })
        .limit(3);

      stats.interviewScheduled = upcomingInterviews.length;

      const recommendedJobs = await Job.find({
        status: 'approved',
        isActive: true
      })
        .populate('company', 'name logo')
        .sort({ createdAt: -1 })
        .limit(5);

      const notifQuery = { recipient: req.userId, isRead: false };
      if (notifCategory && notifCategory !== 'All') {
        notifQuery.category = notifCategory;
      }

      const recentNotifications = await Notification.find(notifQuery).sort({ createdAt: -1 }).limit(5);

      logger.info(`Candidate dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/candidate', { csrfToken: req.csrfToken ? req.csrfToken() : '', stats, recommendedJobs, recentNotifications, recentApplications, upcomingInterviews, profile: req.userProfile, activeNotifCategory: notifCategory || 'All' });
    })
  );

  router.get('/employer',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      let stats = {
        totalJobs: 0,
        totalViews: 0,
        totalApplications: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        closed: 0
      };

      let recentApplications = [];
      let needsCompanySetup = !company;
      let jobs = [];

      if (company) {
        jobs = await Job.find({ company: company._id })
          .sort({ createdAt: -1 })
          .lean();

        stats.totalJobs = jobs.length;
        stats.totalViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
        stats.totalApplications = jobs.reduce((sum, job) => sum + (job.applicationsCount || 0), 0);
        stats.pending = jobs.filter(j => j.status === 'pending').length;
        stats.approved = jobs.filter(j => j.status === 'approved').length;
        stats.rejected = jobs.filter(j => j.status === 'rejected').length;
        stats.closed = jobs.filter(j => j.status === 'closed').length;

        recentApplications = await Application.find({
          job: { $in: jobs.map(j => j._id) }
        })
        .populate({
          path: 'job',
          populate: { path: 'company', select: 'name' }
        })
        .populate('applicantUserId', 'name image')
        .sort({ createdAt: -1 })
        .limit(10);
      }

      logger.info(`Employer dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/employer', { csrfToken: req.csrfToken ? req.csrfToken() : '', stats, company, recentApplications, needsCompanySetup, profile: req.userProfile });
    })
  );

  // GET /dashboard/admin - Enhanced Admin dashboard
  router.get('/admin',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
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

        res.render('dashboard/admin', {
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
        res.render('dashboard/admin', {
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
    })
  );

  router.use('/admin', isAuthenticated(auth), isRole(auth, 'admin'));

  // Admin User Management Routes
  // GET /dashboard/admin/users/create - Create user form
  router.get('/admin/users/create', asyncHandler(async (req, res) => {
    res.render('admin/user-create', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }));

  // POST /dashboard/admin/users - Create new user
  router.post('/admin/users',
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
        return res.redirect('/dashboard/admin/users/create');
      }

      // Use better-auth signUp to create the user
      const signUpResult = await auth.api.signUp({
        email,
        password,
        name
      });

      if (signUpResult.error) {
        req.flash('error', signUpResult.error.message || 'Failed to create user');
        return res.redirect('/dashboard/admin/users/create');
      }

      const createdUser = signUpResult.data?.user;
      if (!createdUser) {
        req.flash('error', 'Failed to create user');
        return res.redirect('/dashboard/admin/users/create');
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
      res.redirect('/dashboard/admin/users');
    })
  );

  // POST /dashboard/admin/users/:id/delete - Delete user
  router.post('/admin/users/:id/delete', idParamValidator, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/dashboard/admin/users');
    }

    // Prevent deleting self
    if (user._id.toString() === req.userId) {
      req.flash('error', 'Cannot delete your own account');
      return res.redirect('/dashboard/admin/users');
    }

    await UserProfile.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(req.params.id);

    await logAuditAction(req, 'user_delete', 'user', user._id, {
      email: user.email,
      role: user.role
    });

    logger.info(`Admin ${req.userId} deleted user ${user.email}`);
    req.flash('success', 'User deleted successfully');
    res.redirect('/dashboard/admin/users');
  }));

  // GET /dashboard/admin/users - User management list
  router.get('/admin/users',
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

  // GET /dashboard/admin/users/:id - User detail view
  router.get('/admin/users/:id', asyncHandler(async (req, res) => {
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

  // GET /dashboard/admin/users/:id/edit - Edit user form
  router.get('/admin/users/:id/edit', asyncHandler(async (req, res) => {
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

  // PUT /dashboard/admin/users/:id - Update user
  router.put('/admin/users/:id',
    [
      param('id').isMongoId().withMessage('Invalid user ID'),
      body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
      body('email').optional().isEmail().withMessage('Please enter a valid email address'),
      body('role').optional().isIn(['candidate', 'employer', 'admin']).withMessage('Invalid role')
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
        return res.redirect('/dashboard/admin/users');
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
      res.redirect(`/dashboard/admin/users/${req.params.id}`);
    })
  );

  // POST /dashboard/admin/users/:id/role - Update user role
  router.post('/admin/users/:id/role',
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

      // Sync the UserProfile role
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
      res.json({ success: true, redirect: `/dashboard/admin/users/${req.params.id}` });
    })
  );

  // POST /dashboard/admin/users/:id/disable - Toggle user status
  router.post('/admin/users/:id/disable', idParamValidator, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/dashboard/admin/users');
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
    res.redirect(`/dashboard/admin/users/${req.params.id}`);
  }));

  // Admin Job Management Routes
  // GET /dashboard/admin/jobs - List all jobs
  router.get('/admin/jobs',
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

  // GET /dashboard/admin/jobs/create - Create job form
  router.get('/admin/jobs/create', asyncHandler(async (req, res) => {
    const companies = await Company.find({ verified: true }).select('name _id');
    res.render('admin/job-create', { csrfToken: req.csrfToken ? req.csrfToken() : '', companies });
  }));

  // POST /dashboard/admin/jobs - Create new job
  router.post('/admin/jobs',
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
        return res.redirect('/dashboard/admin/jobs/create');
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
      res.redirect('/dashboard/admin/jobs');
    })
  );

  // GET /dashboard/admin/jobs/:id/edit - Edit job form
  router.get('/admin/jobs/:id/edit', asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('company', 'name');
    if (!job) {
      return res.status(404).render('error', { message: 'Job not found' });
    }

    const companies = await Company.find({ verified: true }).select('name _id');
    res.render('admin/job-edit', { csrfToken: req.csrfToken ? req.csrfToken() : '', job, companies });
  }));

  // PUT /dashboard/admin/jobs/:id - Update job
  router.put('/admin/jobs/:id',
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
        return res.redirect('/dashboard/admin/jobs');
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
      res.redirect(`/dashboard/admin/jobs/${req.params.id}`);
    })
  );

  // DELETE /dashboard/admin/jobs/:id - Delete job
  router.delete('/admin/jobs/:id', asyncHandler(async (req, res) => {
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
    res.json({ success: true, redirect: '/dashboard/admin/jobs' });
  }));

  // GET /dashboard/admin/jobs/:id - Job detail view
  router.get('/admin/jobs/:id', asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('company', 'name logo');
    if (!job) {
      return res.status(404).render('error', { message: 'Job not found' });
    }

    res.render('admin/job-detail', { csrfToken: req.csrfToken ? req.csrfToken() : '', job });
  }));

  // Admin Company Management Routes
  // GET /dashboard/admin/companies - List all companies
  router.get('/admin/companies',
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

  // GET /dashboard/admin/companies/create - Create company form
  router.get('/admin/companies/create', asyncHandler(async (req, res) => {
    res.render('admin/company-create', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }));

  // POST /dashboard/admin/companies - Create new company
  router.post('/admin/companies',
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

      // Create a temporary user for the company
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
      res.redirect('/dashboard/admin/companies');
    })
  );

  // Admin Notification Management Routes
  // GET /dashboard/admin/notifications - List notifications
  router.get('/admin/notifications',
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

  // GET /dashboard/admin/notifications/send - Send notification form
  router.get('/admin/notifications/send', asyncHandler(async (req, res) => {
    res.render('admin/notification-send', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }));

  // POST /dashboard/admin/notifications/send - Send system notification
  router.post('/admin/notifications/send', asyncHandler(async (req, res) => {
    const { title, message, recipientType, recipientIds, link, priority } = req.body;

    if (!title || !message) {
      req.flash('error', 'Title and message are required');
      return res.redirect('/dashboard/admin/notifications/send');
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

    // Emit real-time updates
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
    res.redirect('/dashboard/admin/notifications/send');
  }));

  // POST /dashboard/admin/notifications/:id/delete - Delete notification
  router.post('/admin/notifications/:id/delete', asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      req.flash('error', 'Notification not found');
      return res.redirect('/dashboard/admin/notifications');
    }

    await Notification.findByIdAndDelete(req.params.id);

    await logAuditAction(req, 'notification_delete', 'notification', notification._id, {
      title: notification.title
    });

    logger.info(`Admin ${req.userId} deleted notification: ${req.params.id}`);
    req.flash('success', 'Notification deleted successfully');
    res.redirect('/dashboard/admin/notifications');
  }));

  // Admin Audit Logs
  // GET /dashboard/admin/audit-logs - View audit logs
  router.get('/admin/audit-logs',
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

  router.post('/jobs/:id/approve',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    [param('id').isMongoId().withMessage('Invalid job ID')],
    validate,
    asyncHandler(async (req, res) => {
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
        return res.status(404).json({ error: 'Job not found' });
      }

      await logAuditAction(req, 'job_approve', 'job', job._id, {
        title: job.title,
        company: job.company,
        oldStatus: 'pending'
      });

      logger.info(`Job approved: ${req.params.id} by admin: ${req.userId}`);
      res.redirect(`/dashboard/admin`);
    })
  );

  router.post('/jobs/:id/reject',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    [param('id').isMongoId().withMessage('Invalid job ID')],
    validate,
    asyncHandler(async (req, res) => {
      const job = await Job.findByIdAndUpdate(
        req.params.id,
        { status: 'rejected' },
        { new: true }
      );

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await logAuditAction(req, 'job_reject', 'job', job._id, {
        title: job.title,
        company: job.company,
        oldStatus: 'pending'
      });

      logger.info(`Job rejected: ${req.params.id} by admin: ${req.userId}`);
      res.redirect(`/dashboard/admin`);
    })
  );

  router.post('/companies/:id/verify',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    [param('id').isMongoId().withMessage('Invalid company ID')],
    validate,
    asyncHandler(async (req, res) => {
      const company = await Company.findByIdAndUpdate(
        req.params.id,
        { verified: true, verifiedAt: new Date() },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      await logAuditAction(req, 'company_verify', 'company', company._id, {
        name: company.name,
        oldVerified: false
      });

      logger.info(`Company verified: ${req.params.id} by admin: ${req.userId}`);
      res.redirect(`/dashboard/admin`);
    })
  );

  // GET /dashboard/employer/applications - Manage applications to company's jobs
  router.get('/employer/applications',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    paginate(20),
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        req.flash('error', 'You need to create a company profile first');
        return res.redirect('/company/create');
      }

      const { status, search, job, sort } = req.query;
      const { skip, limit, page } = req.pagination;

      // Find all jobs posted by this company
      const companyJobs = await Job.find({ company: company._id }).select('_id title');
      const jobIds = companyJobs.map(j => j._id);

      const query = {
        job: { $in: jobIds }
      };

      if (status && status !== 'all') {
        query.status = status;
      }

      if (job && job !== 'all') {
        query.job = job;
      }

      if (search) {
        const safeSearch = sanitizeRegex(search);
        // Search in candidate profile and user name/email
        query.$or = [
          { 'candidate.headline': { $regex: safeSearch, $options: 'i' } },
          { 'candidate.bio': { $regex: safeSearch, $options: 'i' } },
          { 'candidate.skills': { $regex: safeSearch, $options: 'i' } },
          { 'applicantUserId.name': { $regex: safeSearch, $options: 'i' } },
          { 'applicantUserId.email': { $regex: safeSearch, $options: 'i' } }
        ];
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'status') sortOption = { status: 1, createdAt: -1 };
      if (sort === 'job') sortOption = { 'job.title': 1 };

      const applications = await Application.find(query)
        .populate('job', 'title')
        .populate('candidate', 'headline location skills yearsOfExperience')
        .populate('applicantUserId', 'name email')
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

      const total = await Application.countDocuments(query);

      res.render('dashboard/employer/applications', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        applications,
        companyJobs,
        filters: { status, search, job, sort },
        pagination: {
          page,
          totalPages: Math.ceil(total / limit),
          total
        }
      });
    })
  );

  // GET /dashboard/employer/applications/:id - View specific application
  router.get('/employer/applications/:id',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        req.flash('error', 'You need to create a company profile first');
        return res.redirect('/company/create');
      }

      const application = await Application.findById(req.params.id)
        .populate('job', 'title description requirements salary location')
        .populate('candidate')
        .populate('applicantUserId', 'name email image')
        .populate({
          path: 'interview',
          populate: {
            path: 'interviewer',
            select: 'name email'
          }
        });

      if (!application) {
        req.flash('error', 'Application not found');
        return res.redirect('/dashboard/employer/applications');
      }

      // Check if the application is for one of company's jobs
      const job = await Job.findById(application.job);
      if (!job || job.company.toString() !== company._id.toString()) {
        req.flash('error', 'Access denied');
        return res.redirect('/dashboard/employer/applications');
      }

      res.render('dashboard/employer/application-detail', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        application,
        job
      });
    })
  );

  // POST /dashboard/employer/applications/:id/status - Update application status
  router.post('/employer/applications/:id/status',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const { status, notes } = req.body;
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        return res.status(403).json({ error: 'Company not found' });
      }

      const application = await Application.findById(req.params.id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check if the application is for one of company's jobs
      const job = await Job.findById(application.job);
      if (!job || job.company.toString() !== company._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      application.status = status;
      if (notes) application.employerNotes = notes;
      await application.save();

      // Log the status change
      await logAuditAction(req, 'application_status_update', 'application', application._id, {
        oldStatus: application.status,
        newStatus: status,
        jobTitle: job.title
      });

      // Send notification to candidate
      const notification = new Notification({
        recipient: application.applicantUserId,
        type: 'application_status_update',
        title: 'Application Status Updated',
        message: `Your application for ${job.title} has been ${status}`,
        link: `/profile/applications`
      });
      await notification.save();
      emitNotification(req, application.applicantUserId, notification);

      res.json({ success: true, status });
    })
  );

  // POST /dashboard/employer/applications/:id/message - Send message to candidate
  router.post('/employer/applications/:id/message',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const { message } = req.body;
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        return res.status(403).json({ error: 'Company not found' });
      }

      const application = await Application.findById(req.params.id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check if the application is for one of company's jobs
      const job = await Job.findById(application.job);
      if (!job || job.company.toString() !== company._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Store message in application messages
      application.messages.push({
        fromEmployer: true,
        message: message
      });
      await application.save();

      // Send notification to candidate
      const notification = new Notification({
        recipient: application.applicantUserId,
        type: 'message_from_employer',
        title: 'New message from employer',
        message: `You have a new message regarding your application for ${job.title}`,
        link: `/profile/messages`
      });
      await notification.save();
      emitNotification(req, application.applicantUserId, notification);

      res.json({ success: true, message: 'Message sent successfully' });
    })
  );

  // POST /dashboard/employer/applications/:id/interview - Schedule interview
  router.post('/employer/applications/:id/interview',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const { scheduledAt, type, duration, timezone, location, notes } = req.body;
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        return res.status(403).json({ error: 'Company not found' });
      }

      const application = await Application.findById(req.params.id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check if the application is for one of company's jobs
      const job = await Job.findById(application.job);
      if (!job || job.company.toString() !== company._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if interview already exists
      const existingInterview = await Interview.findOne({ application: application._id });
      if (existingInterview) {
        return res.status(400).json({ error: 'Interview already scheduled for this application' });
      }

      const interview = new Interview({
        application: application._id,
        candidate: application.candidate,
        interviewer: req.userId,
        scheduledBy: req.userId,
        type: type || 'video',
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        timezone: timezone || 'UTC',
        location,
        notes
      });

      // Calculate end time
      interview.endTime = new Date(interview.scheduledAt.getTime() + (interview.duration * 60000));

      await interview.save();

      // Update application status to shortlisted if not already
      if (application.status === 'pending' || application.status === 'viewed') {
        application.status = 'shortlisted';
        await application.save();
      }

      // Send notification to candidate
      const notification = new Notification({
        recipient: application.applicantUserId,
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `You have an interview scheduled for ${job.title} on ${interview.scheduledAt.toLocaleDateString()}`,
        link: `/profile/applications`
      });
      await notification.save();
      emitNotification(req, application.applicantUserId, notification);

      // Log the interview scheduling
      await logAuditAction(req, 'interview_scheduled', 'interview', interview._id, {
        applicationId: application._id,
        jobTitle: job.title,
        scheduledAt: interview.scheduledAt
      });

      res.json({ success: true, interview: interview._id });
    })
  );

  // GET /dashboard/employer/candidates - Search candidates (for employers)
  router.get('/employer/candidates',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    paginate(20), // Apply pagination middleware
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        req.flash('error', 'You need to create a company profile first');
        return res.redirect('/company/create');
      }
      const { search, skills, location, experience, sort } = req.query;
      const { skip, limit, page } = req.pagination;

      const query = {
        role: 'candidate',
        isActive: true,
        isProfileComplete: true
      };

      if (search) {
        const safeSearch = sanitizeRegex(search);
        query.$or = [
          { headline: { $regex: safeSearch, $options: 'i' } },
          { bio: { $regex: safeSearch, $options: 'i' } },
          { skills: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      if (skills) {
        const skillArray = skills.split(',').map(s => s.trim()).filter(s => s);
        if (skillArray.length > 0) {
          query.skills = { $in: skillArray };
        }
      }

      if (location) {
        const safeLocation = sanitizeRegex(location);
        query.$or = query.$or || [];
        query.$or.push(
          { location: { $regex: safeLocation, $options: 'i' } },
          { country: { $regex: safeLocation, $options: 'i' } }
        );
      }

      if (experience) {
        const expNum = parseInt(experience);
        if (!isNaN(expNum)) {
          if (experience === '0-2') query.yearsOfExperience = { $lte: 2 };
          else if (experience === '3-5') query.yearsOfExperience = { $gte: 3, $lte: 5 };
          else if (experience === '6-10') query.yearsOfExperience = { $gte: 6, $lte: 10 };
          else if (experience === '10+') query.yearsOfExperience = { $gte: 10 };
        }
      }

      let sortOption = { profileCompletionScore: -1, updatedAt: -1 }; // Default sort
      if (sort === 'experience_desc') {
        sortOption = { 'yearsOfExperience': -1, ...sortOption };
      } else if (sort === 'experience_asc') {
        sortOption = { 'yearsOfExperience': 1, ...sortOption };
      }

      const [candidates, total] = await Promise.all([
        UserProfile.find(query)
          .populate('userId', 'name email image createdAt')
          .sort(sortOption)
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        UserProfile.countDocuments(query)
      ]);

      res.render('dashboard/candidates', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        candidates,
        company,
        filters: { search, skills, location, experience, sort },
        pagination: {
          page: req.pagination.page,
          limit: req.pagination.limit,
          total,
          pages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  return router;
};

export default initDashboardRouter;