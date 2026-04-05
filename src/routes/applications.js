import express from 'express';
import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import Application from '../models/Application.js';
import ApplicationFeedback from '../models/ApplicationFeedback.js';
import Job from '../models/Job.js';
import UserProfile from '../models/UserProfile.js';
import Notification from '../models/Notification.js';
import Company from '../models/Company.js';
import Interview from '../models/Interview.js';
import { createAuthMiddleware, isAuthenticated, isRole, isEmployer } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { APPLICATION_STATUS } from '../config/constants.js';

const router = express.Router();

export const initApplicationsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.post('/',
    isAuthenticated(auth),
    async (req, res) => {
      try {
        const jobId = req.body.jobId;
        
        if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
          req.flash('error', 'Invalid job ID');
          return res.redirect('/jobs');
        }
        
        const job = await Job.findById(jobId);
        if (!job || job.status !== 'approved') {
          req.flash('error', 'Job not available for application');
          return res.redirect(`/jobs/${jobId}`);
        }
        
        const existingApplication = await Application.findOne({
          job: jobId,
          applicantUserId: req.userId
        });

        if (existingApplication) {
          req.flash('error', 'You have already applied to this job');
          return res.redirect(`/jobs/${jobId}`);
        }

        const userProfile = await UserProfile.findOne({ userId: req.userId });
        
        if (!userProfile) {
          req.flash('error', 'Please complete your profile first');
          return res.redirect('/profile/edit');
        }
        
        if (!userProfile.resume || !userProfile.resume.url) {
          req.flash('error', 'Please upload a resume before applying');
          return res.redirect('/profile/edit');
        }
        
        const application = new Application({
          job: jobId,
          candidate: userProfile._id,
          applicantUserId: req.userId,
          coverLetter: req.body.coverLetter,
          resume: userProfile.resume
        });
        
        await application.save();
        
        await Job.findByIdAndUpdate(jobId, {
          $inc: { applicationsCount: 1 }
        });
        
        const notification = new Notification({
          recipient: job.postedBy,
          type: 'application_received',
          title: 'New Application',
          message: `You received a new application for ${job.title}`,
          link: `/applications/${application._id}`
        });
        await notification.save();
        
        logger.info(`Application submitted: ${application._id} for job: ${job._id}`);
        req.flash('success', 'Application submitted successfully!');
        return res.redirect(`/jobs/${jobId}?applied=true`);
      } catch (error) {
        console.error('[ERROR] Application submission:', error);
        req.flash('error', 'Failed to submit application. Please try again.');
        return res.redirect(`/jobs/${req.body.jobId}`);
      }
    }
  );

  router.get('/my-applications', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const { status, sort } = req.query;

    const query = { applicantUserId: req.userId, isArchived: { $ne: true } };
    if (status && status !== 'all') {
      query.status = status;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'status') sortOption = { status: 1 };

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('job', 'title location type company salary status')
        .populate({
          path: 'job',
          populate: { path: 'company', select: 'name logo' }
        })
        .sort(sortOption)
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query)
    ]);

    const stats = {
      total: await Application.countDocuments({ applicantUserId: req.userId, isArchived: { $ne: true } }),
      pending: await Application.countDocuments({ applicantUserId: req.userId, status: 'pending' }),
      shortlisted: await Application.countDocuments({ applicantUserId: req.userId, status: 'shortlisted' }),
      rejected: await Application.countDocuments({ applicantUserId: req.userId, status: 'rejected' }),
      accepted: await Application.countDocuments({ applicantUserId: req.userId, status: 'accepted' }),
      interviewScheduled: await Application.countDocuments({ applicantUserId: req.userId, status: { $in: ['interview_scheduled', 'interview_completed'] } })
    };

    res.render('applications/index', { 
      applications,
      stats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { status, sort }
    });
  }));

  router.get('/employer', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({ userId: req.userId });
    
    if (!company) {
      req.flash('error', 'You need to create a company profile first');
      return res.redirect('/company/create');
    }

    const { job: jobFilter, status: statusFilter, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find({ company: company._id }).select('_id title');
    const jobIds = jobs.map(j => j._id);
    
    const query = { job: { $in: jobIds } };
    if (jobFilter) query.job = jobFilter;
    if (statusFilter && statusFilter !== 'all') query.status = statusFilter;

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate({
          path: 'job',
          populate: { path: 'company', select: 'name logo' }
        })
        .populate({
          path: 'candidate',
          populate: { path: 'userId', select: 'name email image' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query)
    ]);

    const stats = {
      total: await Application.countDocuments({ job: { $in: jobIds } }),
      pending: await Application.countDocuments({ job: { $in: jobIds }, status: 'pending' }),
      shortlisted: await Application.countDocuments({ job: { $in: jobIds }, status: 'shortlisted' }),
      interview: await Application.countDocuments({ job: { $in: jobIds }, status: 'interview_scheduled' }),
      accepted: await Application.countDocuments({ job: { $in: jobIds }, status: 'accepted' }),
      rejected: await Application.countDocuments({ job: { $in: jobIds }, status: 'rejected' })
    };

    res.render('applications/employer', { 
      applications,
      company,
      jobs,
      stats,
      filters: { job: jobFilter, status: statusFilter },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  }));

  router.get('/:id', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const application = await Application.findById(req.params.id)
      .populate({
        path: 'job',
        populate: { path: 'company', select: 'name logo description location website' }
      })
      .populate('candidate')
      .populate('applicantUserId', 'name email image');
    
    if (!application) {
      return res.status(404).render('error', { message: 'Application not found' });
    }
    
    const isOwner = application.applicantUserId._id.toString() === req.userId ||
      application.job.postedBy.toString() === req.userId;
    const isAdmin = req.user?.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).render('error', { message: 'Access denied' });
    }

    const isEmployer = application.job.postedBy.toString() === req.userId;
    let interviews = [];
    let feedback = null;
    
    if (isOwner || isAdmin) {
      interviews = await Interview.find({ application: application._id })
        .populate('interviewer', 'name image')
        .sort({ scheduledAt: -1 });
      
      feedback = await ApplicationFeedback.find({ application: application._id })
        .populate('fromUser', 'name image')
        .sort({ createdAt: -1 });
    }

    res.render('applications/show', { 
      application, 
      isEmployer, 
      isAdmin,
      interviews,
      feedback
    });
  }));

  router.put('/:id/status',
    isAuthenticated(auth),
    [
      param('id').isMongoId().withMessage('Invalid application ID'),
      body('status').isIn(APPLICATION_STATUS).withMessage('Invalid status'),
      body('notes').optional().isLength({ max: 2000 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { status, notes, priority } = req.body;
      const application = await Application.findById(req.params.id)
        .populate('job');
      
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      
      if (application.job.postedBy.toString() !== req.userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const previousStatus = application.status;
      application.status = status;
      if (notes) application.employerNotes = notes;
      if (priority) application.priority = priority;
      await application.save();
      
      const notificationTypes = {
        viewed: 'application_viewed',
        shortlisted: 'application_shortlisted',
        rejected: 'application_rejected',
        accepted: 'application_accepted',
        interview_scheduled: 'interview_scheduled'
      };
      
      if (notificationTypes[status]) {
        const notification = new Notification({
          recipient: application.applicantUserId,
          type: notificationTypes[status],
          title: `Application ${status === 'viewed' ? 'Viewed' : status === 'interview_scheduled' ? 'Interview Scheduled' : status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your application for ${application.job.title} has been ${status === 'viewed' ? 'viewed' : status === 'interview_scheduled' ? 'scheduled for an interview' : status}`,
          link: `/applications/${application._id}`
        });
        await notification.save();
      }
      
      logger.info(`Application status updated: ${application._id} from ${previousStatus} to ${status}`);
      res.json({ success: true, status: application.status });
    })
  );

  router.post('/:id/withdraw', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const application = await Application.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.applicantUserId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (application.status === 'accepted') {
      return res.status(400).json({ error: 'Cannot withdraw an accepted application' });
    }
    
    application.status = 'withdrawn';
    application.isArchived = true;
    application.archivedAt = new Date();
    await application.save();
    
    logger.info(`Application withdrawn: ${application._id}`);
    req.flash('success', 'Application withdrawn successfully');
    res.redirect('/applications/my-applications');
  }));

  router.post('/:id/schedule-interview',
    isAuthenticated(auth),
    [
      param('id').isMongoId().withMessage('Invalid application ID'),
      body('scheduledAt').isISO8601().withMessage('Invalid date'),
      body('type').isIn(['phone', 'video', 'onsite', 'technical', 'behavioral', 'panel']),
      body('duration').optional().isInt({ min: 15, max: 480 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { scheduledAt, type, duration, location, meetingLink, notes } = req.body;
      
      const application = await Application.findById(req.params.id)
        .populate('job');
      
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      
      if (application.job.postedBy.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const profile = await UserProfile.findById(application.candidate);
      
      const interview = new Interview({
        application: application._id,
        candidate: application.candidate,
        interviewer: req.userId,
        scheduledBy: req.userId,
        type: type || 'video',
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        location,
        meetingLink,
        notes
      });
      
      await interview.save();
      
      application.status = 'interview_scheduled';
      application.interview = interview._id;
      await application.save();
      
      const notification = new Notification({
        recipient: application.applicantUserId,
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `Your interview for ${application.job.title} has been scheduled`,
        link: `/applications/${application._id}`
      });
      await notification.save();
      
      logger.info(`Interview scheduled: ${interview._id} for application: ${application._id}`);
      res.json({ success: true, interview });
    })
  );

  router.get('/:id/feedback', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const application = await Application.findById(req.params.id)
      .populate('job');
    
    if (!application) {
      return res.status(404).render('error', { message: 'Application not found' });
    }
    
    if (application.applicantUserId.toString() !== req.userId && 
        application.job.postedBy.toString() !== req.userId &&
        req.user?.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied' });
    }

    const feedback = await ApplicationFeedback.find({ application: application._id })
      .populate('fromUser', 'name image')
      .sort({ createdAt: -1 });

    res.render('applications/feedback', { application, feedback });
  }));

  router.post('/:id/feedback',
    isAuthenticated(auth),
    [
      body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
      body('overallFeedback').optional().isLength({ max: 2000 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { rating, strengths, areasForImprovement, overallFeedback, isAnonymous } = req.body;
      
      const application = await Application.findById(req.params.id)
        .populate('job');
    
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const toUserId = application.applicantUserId.toString() === req.userId 
        ? application.job.postedBy 
        : application.applicantUserId;

      const feedback = new ApplicationFeedback({
        application: application._id,
        fromUser: req.userId,
        toUser: toUserId,
        type: application.applicantUserId.toString() === req.userId 
          ? 'candidate_feedback' 
          : 'employer_feedback',
        rating,
        strengths: Array.isArray(strengths) ? strengths : [strengths],
        areasForImprovement: Array.isArray(areasForImprovement) ? areasForImprovement : [areasForImprovement],
        overallFeedback,
        isAnonymous: isAnonymous === 'true'
      });

      await feedback.save();

      logger.info(`Feedback submitted for application: ${application._id}`);
      req.flash('success', 'Feedback submitted successfully!');
      res.redirect(`/applications/${application._id}/feedback`);
    }));
  

  router.post('/:id/notes', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const { notes } = req.body;
    
    const application = await Application.findById(req.params.id)
      .populate('job');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.applicantUserId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    application.notes = notes;
    await application.save();
    
    logger.info(`Application notes updated: ${application._id}`);
    res.json({ success: true });
  }));

  return router;
};

export default initApplicationsRouter;
