import express from 'express';
import { body, param } from 'express-validator';
import mongoose from 'mongoose';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import UserProfile from '../models/UserProfile.js';
import Notification from '../models/Notification.js';
import Company from '../models/Company.js';
import { createAuthMiddleware, isAuthenticated, isRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { APPLICATION_STATUS } from '../config/constants.js';

const router = express.Router();

export const initApplicationsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.post('/',
    isAuthenticated(auth),
    [
      body('jobId').isMongoId().withMessage('Invalid job ID'),
      body('coverLetter').optional().isLength({ max: 5000 }).withMessage('Cover letter too long')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const job = await Job.findById(req.body.jobId).session(session);
        
        if (!job || job.status !== 'approved') {
          await session.abortTransaction();
          return res.status(400).json({ error: 'Job not available for application' });
        }
        
        const existingApplication = await Application.findOne({
          job: req.body.jobId,
          applicantUserId: req.userId
        }).session(session);

        if (existingApplication) {
          await session.abortTransaction();
          return res.status(400).json({ error: 'You have already applied to this job' });
        }

        const userProfile = await UserProfile.findOne({ userId: req.userId }).session(session);
        
        if (!userProfile) {
          await session.abortTransaction();
          return res.status(400).json({ error: 'Please complete your profile first' });
        }
        
        const application = new Application({
          job: req.body.jobId,
          candidate: userProfile._id,
          applicantUserId: req.userId,
          coverLetter: req.body.coverLetter,
          resume: userProfile.resume
        });
        
        await application.save({ session });
        
        await Job.findByIdAndUpdate(req.body.jobId, {
          $inc: { applicationsCount: 1 }
        }, { session });
        
        await session.commitTransaction();
        
        const notification = new Notification({
          recipient: job.postedBy,
          type: 'application_received',
          title: 'New Application',
          message: `You received a new application for ${job.title}`,
          link: `/applications/${application._id}`
        });
        await notification.save();
        
        logger.info(`Application submitted: ${application._id} for job: ${job._id}`);
        res.redirect(`/jobs/${req.body.jobId}?applied=true`);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    })
  );

  router.get('/my-applications', isAuthenticated(auth), async (req, res) => {
    try {
      const applications = await Application.find({
        applicantUserId: req.userId
      })
      .populate('job', 'title location type company salary')
      .sort({ createdAt: -1 });
      
      res.render('applications/index', { applications });
    } catch (error) {
      console.error('Error fetching applications:', error);
      res.status(500).render('error', { message: 'Failed to load applications' });
    }
  });

  router.get('/employer', isAuthenticated(auth), async (req, res) => {
    try {
      const company = await Company.findOne({ userId: req.userId });
      
      if (!company) {
        return res.redirect('/company/create');
      }
      
      const jobs = await Job.find({ company: company._id }).select('_id title');
      
      const applications = await Application.find({
        job: { $in: jobs.map(j => j._id) }
      })
      .populate('job', 'title company')
      .populate('candidate', 'userId')
      .sort({ createdAt: -1 });
      
      res.render('applications/employer', { applications });
    } catch (error) {
      console.error('Error fetching applications:', error);
      res.status(500).render('error', { message: 'Failed to load applications' });
    }
  });

  router.get('/:id', isAuthenticated(auth), async (req, res) => {
    try {
      const application = await Application.findById(req.params.id)
        .populate('job')
        .populate('candidate');
      
      if (!application) {
        return res.status(404).render('error', { message: 'Application not found' });
      }
      
      const isOwner = application.applicantUserId.toString() === req.userId ||
        application.job.postedBy.toString() === req.userId;
      const isAdmin = req.user?.role === 'admin';
      
      if (!isOwner && !isAdmin) {
        return res.status(403).render('error', { message: 'Access denied' });
      }

      const isEmployer = application.job.postedBy.toString() === req.userId;
      res.render('applications/show', { application, isEmployer, isAdmin });
    } catch (error) {
      console.error('Error fetching application:', error);
      res.status(500).render('error', { message: 'Failed to load application' });
    }
  });

  router.put('/:id/status',
    isAuthenticated(auth),
    [
      param('id').isMongoId().withMessage('Invalid application ID'),
      body('status').isIn(APPLICATION_STATUS).withMessage('Invalid status'),
      body('notes').optional().isLength({ max: 2000 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { status, notes } = req.body;
      const application = await Application.findById(req.params.id)
        .populate('job');
      
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      
      if (application.job.postedBy.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      application.status = status;
      if (notes) application.employerNotes = notes;
      await application.save();
      
      const notificationTypes = {
        shortlisted: 'application_shortlisted',
        rejected: 'application_rejected',
        accepted: 'application_accepted'
      };
      
      if (notificationTypes[status]) {
        const notification = new Notification({
          recipient: application.applicantUserId,
          type: notificationTypes[status],
          title: `Application ${status}`,
          message: `Your application for ${application.job.title} has been ${status}`,
          link: `/applications/my-applications`
        });
        await notification.save();
      }
      
      logger.info(`Application status updated: ${application._id} to ${status}`);
      res.json({ success: true });
    })
  );

  return router;
};

export default initApplicationsRouter;