import express from 'express';
import { param, body } from 'express-validator';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import UserProfile from '../models/UserProfile.js';
import { createAuthMiddleware, isAuthenticated, isRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';

const router = express.Router();

export const initDashboardRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

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
      const appliedJobs = await Application.find({
        applicantUserId: req.userId
      }).populate('job');

      const stats = {
        applied: appliedJobs.length,
        pending: appliedJobs.filter(a => a.status === 'pending').length,
        shortlisted: appliedJobs.filter(a => a.status === 'shortlisted').length,
        rejected: appliedJobs.filter(a => a.status === 'rejected').length,
        accepted: appliedJobs.filter(a => a.status === 'accepted').length
      };

      const recommendedJobs = await Job.find({
        status: 'approved',
        isActive: true
      })
        .populate('company', 'name logo')
        .sort({ createdAt: -1 })
        .limit(5);

      logger.info(`Candidate dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/candidate', { stats, recommendedJobs });
    })
  );

  router.get('/employer',
    isAuthenticated(auth),
    isRole(auth, 'employer'),
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        return res.redirect('/company/create');
      }

      const jobs = await Job.find({ company: company._id });

      const totalViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
      const totalApplications = jobs.reduce((sum, job) => sum + (job.applicationsCount || 0), 0);

      const stats = {
        totalJobs: jobs.length,
        totalViews,
        totalApplications,
        pending: jobs.filter(j => j.status === 'pending').length,
        approved: jobs.filter(j => j.status === 'approved').length,
        rejected: jobs.filter(j => j.status === 'rejected').length,
        closed: jobs.filter(j => j.status === 'closed').length
      };

      const recentApplications = await Application.find({
        job: { $in: jobs.map(j => j._id) }
      })
        .populate('job', 'title')
        .sort({ createdAt: -1 })
        .limit(10);

      logger.info(`Employer dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/employer', { stats, company, recentApplications });
    })
  );

  router.get('/admin',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const [totalJobs, pendingJobs, approvedJobs, rejectedJobs, totalApplications, totalCompanies] = await Promise.all([
        Job.countDocuments(),
        Job.countDocuments({ status: 'pending' }),
        Job.countDocuments({ status: 'approved' }),
        Job.countDocuments({ status: 'rejected' }),
        Application.countDocuments(),
        Company.countDocuments()
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
          totalCompanies
        },
        recentJobs,
        recentApplications
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

      logger.info(`Company verified: ${req.params.id} by admin: ${req.userId}`);
      res.redirect(`/dashboard/admin`);
    })
  );

  return router;
};

export default initDashboardRouter;