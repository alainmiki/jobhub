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
import { createAuthMiddleware, isAuthenticated, isRole, isEmployer, requireProfileComplete } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { APPLICATION_STATUS } from '../config/constants.js';

const router = express.Router();

export const initApplicationsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.post('/',
    isAuthenticated(auth),
    requireProfileComplete(auth),
    asyncHandler(async (req, res) => {
      const { jobId, coverLetter, source, priority } = req.body;
      
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
        coverLetter,
        resume: userProfile.resume,
        source: source || 'direct',
        priority: priority || 'medium'
      });
      
      await application.save();
      
      await Job.findByIdAndUpdate(jobId, {
        $inc: { applicationsCount: 1 }
      });
      
      await logAuditAction(req, 'application_create', 'application', application._id, {
        jobTitle: job.title,
        source: application.source
      });

      const notification = new Notification({
        recipient: job.postedBy,
        type: 'application_received',
        category: 'Application',
        priority: 'high', // New applications are high priority for employers
        title: 'New Application',
        message: `You received a new application for ${job.title}`,
        link: `/applications/${application._id}`
      });
      await notification.save();
      
      emitNotification(req, job.postedBy, notification);
      
      logger.info(`Application submitted: ${application._id} for job: ${job._id}`);
      req.flash('success', 'Application submitted successfully!');
      res.redirect(`/jobs/${jobId}?applied=true`);
    })
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

    // Mask candidate emails for privacy - only show after connection is established
    applications.forEach(app => {
      if (app.candidate && app.candidate.userId && app.status !== 'accepted' && app.status !== 'offer_extended') {
        app.candidate.userId.email = app.candidate.userId.email.replace(/(.{2}).*(@.*)/, '$1***$2');
      }
    });

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
      
      await logAuditAction(req, 'application_status_update', 'application', application._id, { 
        oldStatus: previousStatus, 
        newStatus: status, 
        jobTitle: application.job.title 
      });

      const notificationTypes = {
        viewed: 'application_viewed',
        shortlisted: 'application_shortlisted',
        rejected: 'application_rejected',
        accepted: 'application_accepted',
        interview_scheduled: 'interview_scheduled'
      };
      
      const statusText = status === 'viewed' ? 'viewed' : status === 'interview_scheduled' ? 'scheduled for an interview' : status;

      if (notificationTypes[status]) {
        const notification = new Notification({
          recipient: application.applicantUserId,
          type: notificationTypes[status],
          category: notificationTypes[status].startsWith('interview') ? 'Interview' : 'Application',
          priority: status === 'interview_scheduled' ? 'high' : 'medium', // Interview scheduled is high priority
          title: `Application ${status === 'viewed' ? 'Viewed' : status === 'interview_scheduled' ? 'Interview Scheduled' : status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `${application.job.title}: ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}.` + 
                   (notes ? ` Note: ${notes}` : ''),
          link: `/applications/${application._id}`
        });
        await notification.save();
      }
      
      logger.info(`Application status updated: ${application._id} from ${previousStatus} to ${status}`);
      res.json({ success: true, status: application.status });
    })
  );

  // PATCH /applications/bulk-status - Bulk update application statuses
  router.patch('/bulk-status',
    isAuthenticated(auth),
    isEmployer(auth),
    [
      body('ids').isArray({ min: 1 }).withMessage('At least one application ID is required'),
      body('ids.*').isMongoId().withMessage('Invalid application ID format'),
      body('status').isIn(APPLICATION_STATUS).withMessage('Invalid status')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { ids, status, notes } = req.body;

      // Find jobs posted by this employer to authorize the update
      const employerJobs = await Job.find({ postedBy: req.userId }).select('_id');
      const jobIds = employerJobs.map(j => j._id.toString());

      // Find applications that belong to this employer's jobs
      const applications = await Application.find({
        _id: { $in: ids },
        job: { $in: jobIds }
      }).populate('job', 'title');

      if (applications.length === 0) {
        return res.status(404).json({ error: 'No authorized applications found to update' });
      }

      const notificationTypes = {
        viewed: 'application_viewed',
        shortlisted: 'application_shortlisted',
        rejected: 'application_rejected',
        accepted: 'application_accepted',
        interview_scheduled: 'interview_scheduled'
      };

      const statusText = status.replace('_', ' ');

      const results = {
        updated: 0,
        failed: ids.length - applications.length
      };

      // Iterate and update to trigger pre-save hooks (for timeline) and notifications
      const updatePromises = applications.map(async (app) => {
        const previousStatus = app.status;
        app.status = status;
        if (notes) app.employerNotes = notes;
        await app.save();

        await logAuditAction(req, 'application_status_update', 'application', app._id, {
          oldStatus: previousStatus,
          newStatus: status,
          jobTitle: app.job.title
        });
        results.updated++;

        // Send individual notifications
        if (notificationTypes[status]) {
          await Notification.create({
            recipient: app.applicantUserId,
            type: notificationTypes[status],
            title: `Application ${status.replace('_', ' ')}`,
            priority: status === 'interview_scheduled' ? 'high' : 'medium',
            category: notificationTypes[status].startsWith('interview') ? 'Interview' : 'Application',
            message: `${app.job.title}: ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}.` + 
                     (notes ? ` Note: ${notes}` : ''),
            link: `/applications/${app._id}`
          });
        }
      });

      await Promise.all(updatePromises);

      logger.info(`Bulk status update by ${req.userId}: ${results.updated} applications set to ${status}`);
      
      res.json({ 
        success: true, 
        message: `Successfully updated ${results.updated} applications.`,
        results 
      });
    })
  );

  router.post('/:id/withdraw', isAuthenticated(auth), asyncHandler(async (req, res) => {
    // CSRF check
    if (!req.body._csrf) {
      return res.status(403).json({ error: 'CSRF token missing' });
    }
    if (req.csrfToken && req.csrfToken() !== req.body._csrf) {
      return res.status(403).json({ error: 'CSRF token invalid' });
    }

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

      // Check for interview conflicts
      const interviewStart = new Date(scheduledAt);
      const interviewEnd = new Date(interviewStart.getTime() + (duration || 60) * 60000);

      const conflictingInterview = await Interview.findOne({
        candidate: application.candidate,
        status: { $in: ['scheduled', 'confirmed'] },
        $or: [
          {
            scheduledAt: { $lt: interviewEnd },
            $expr: {
              $gt: [
                { $add: ['$scheduledAt', { $multiply: ['$duration', 60000] }] },
                interviewStart
              ]
            }
          }
        ]
      });

      if (conflictingInterview) {
        return res.status(409).json({
          error: 'Interview conflict detected. The candidate has another interview scheduled at this time.'
        });
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
        category: 'Interview',
        priority: 'high',
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
      
      // Strict Ownership Check: Only the applicant or the job poster can leave feedback
      const isApplicant = application.applicantUserId.toString() === req.userId;
      const isJobPoster = application.job.postedBy.toString() === req.userId;
      
      if (!isApplicant && !isJobPoster) {
        return res.status(403).json({ error: 'You are not authorized to provide feedback for this application.' });
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
    
    // Strict Ownership Check: Only the candidate can manage private notes on their application
    if (application.applicantUserId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied. Only the applicant can modify private notes.' });
    }
    
    application.notes = notes;
    await application.save();
    
    logger.info(`Application notes updated: ${application._id}`);
    res.json({ success: true });
  }));

  return router;
};

export default initApplicationsRouter;
