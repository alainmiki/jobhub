import express from 'express';
import { isAuthenticated, isRole, validateCsrfForApi } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate } from '../middleware/pagination.js';
import { sanitizeRegex, logAuditAction, emitNotification } from '../utils/helpers.js';
import logger from '../config/logger.js';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Interview from '../models/Interview.js';
import Notification from '../models/Notification.js';
import UserProfile from '../models/UserProfile.js';

export const initEmployerRouter = (auth) => {
  const router = express.Router();

  router.use(isAuthenticated(auth));
  router.use(isRole(auth, 'employer'));

  // Security: Prevent disabled accounts from accessing employer routes
  router.use((req, res, next) => {
    if (req.user && req.user.isActive === false) {
      return res.status(403).render('error', { message: 'Your account has been disabled. Please contact support.', title: 'Account Disabled' });
    }
    next();
  });

  // GET / - Employer dashboard
  router.get('/',
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

  // GET /jobs - List employer's company jobs
  router.get('/jobs',
    paginate(20),
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        req.flash('info', 'You need to create a company profile first');
        return res.redirect('/employer');
      }

      const { search, status, sort } = req.query;
      const filter = { company: company._id };

      if (search) {
        const safeSearch = sanitizeRegex(search);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      if (status && status !== 'all') {
        filter.status = status;
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'views') sortOption = { views: -1 };
      if (sort === 'applications') sortOption = { applicationsCount: -1 };

      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .sort(sortOption)
          .skip(req.pagination.skip)
          .limit(req.pagination.limit)
          .lean(),
        Job.countDocuments(filter)
      ]);

      res.render('dashboard/employer/jobs', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        jobs,
        company,
        filters: { search, status, sort },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit),
          total
        }
      });
    })
  );

  // GET /applications - Manage applications to company's jobs
  router.get('/applications',
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

  // GET /applications/:id - View specific application
  router.get('/applications/:id',
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
        return res.redirect('/employer/applications');
      }

      // Check if the application is for one of company's jobs
      const job = await Job.findById(application.job);
      if (!job || job.company.toString() !== company._id.toString()) {
        req.flash('error', 'Access denied');
        return res.redirect('/employer/applications');
      }

      res.render('dashboard/employer/application-detail', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        application,
        job
      });
    })
  );

  // POST /applications/:id/status - Update application status
  router.post('/applications/:id/status',
    isAuthenticated(auth),
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
        category: 'Application',
        priority: 'high',
        title: 'Application Status Updated',
        message: `Your application for ${job.title} has been ${status}`,
        link: `/profile/applications`
      });
      await notification.save();
      emitNotification(req, application.applicantUserId, notification);

      res.json({ success: true, status });
    })
  );

  // POST /applications/:id/message - Send message to candidate
  router.post('/applications/:id/message',
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
        category: 'Application',
        priority: 'medium',
        title: 'New message from employer',
        message: `You have a new message regarding your application for ${job.title}`,
        link: `/profile/messages`
      });
      await notification.save();
      emitNotification(req, application.applicantUserId, notification);

      res.json({ success: true, message: 'Message sent successfully' });
    })
  );

  // POST /applications/:id/interview - Schedule interview
  router.post('/applications/:id/interview',
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
        category: 'Interview',
        priority: 'high',
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

  // GET /candidates - Search candidates (for employers)
  router.get('/candidates',
    paginate(20),
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
          totalPages: Math.ceil(total / req.pagination.limit),
          total
        }
      });
    })
  );
  // POST /applications/interviews/:id/feedback - Submit interview feedback
  router.post('/applications/interviews/:id/feedback',
    asyncHandler(async (req, res) => {
      const { rating, strengths, improvements, recommendation } = req.body;

      const interview = await Interview.findById(req.params.id);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      // Only interviewer can submit feedback
      if (interview.interviewer.toString() !== req.userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only the interviewer can submit feedback' });
      }

      interview.feedback = {
        rating: parseInt(rating),
        strengths,
        improvements,
        recommendation,
        submittedAt: new Date()
      };
      
      await interview.save();

      // Send notification to candidate about feedback
      const application = await Application.findById(interview.application)
        .populate('job', 'title');
      
      if (application) {
        const notification = new Notification({
          recipient: application.applicantUserId,
          type: 'interview_feedback_received',
          category: 'Interview',
          priority: 'medium',
          title: 'Interview Feedback Received',
          message: `You have received feedback for your interview for ${application.job.title}`,
          link: `/applications/${application._id}`
        });
        await notification.save();
        emitNotification(req, application.applicantUserId, notification);
      }

      logger.info(`Interview feedback submitted: ${interview._id}`);
      res.json({ success: true, feedback: interview.feedback });
    })
  );

  return router;
};

export default initEmployerRouter;
