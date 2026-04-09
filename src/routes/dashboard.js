import express from 'express';
import { param, body } from 'express-validator';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import UserProfile from '../models/UserProfile.js';
import Notification from '../models/Notification.js';
import Interview from '../models/Interview.js';
import { createAuthMiddleware, isAuthenticated, isRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate } from '../middleware/pagination.js';
import { validate } from '../middleware/validation.js';
import { sanitizeRegex, logAuditAction } from '../utils/helpers.js';
import logger from '../config/logger.js';

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
      res.render('dashboard/candidate', { stats, recommendedJobs, recentNotifications, recentApplications, upcomingInterviews, profile: req.userProfile, activeNotifCategory: notifCategory || 'All' });
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
      res.render('dashboard/employer', { stats, company, recentApplications, needsCompanySetup, profile: req.userProfile });
    })
  );

  router.get('/admin',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const [totalJobs, pendingJobs, approvedJobs, rejectedJobs, totalApplications, totalCompanies, pendingCompanies] = await Promise.all([
        Job.countDocuments(),
        Job.countDocuments({ status: 'pending' }),
        Job.countDocuments({ status: 'approved' }),
        Job.countDocuments({ status: 'rejected' }),
        Application.countDocuments(),
        Company.countDocuments(),
        Company.countDocuments({ verified: false }) // Count pending companies
      ]);

      const [recentJobs, recentApplications] = await Promise.all([
        Job.find()
          .populate('company', 'name')
          .sort({ createdAt: -1 })
          .limit(10),
        Application.find()
          .populate('job', 'title')
          .sort({ createdAt: -1 })
          .limit(10)
      ]);

      logger.info(`Admin dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/admin', {
        stats: {
          totalJobs,
          pendingJobs,
          approvedJobs,
          rejectedJobs,
          totalApplications,
          totalCompanies,
          pendingCompanies // Pass pending companies count
        },
        recentJobs,
        recentApplications,
        profile: req.userProfile
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