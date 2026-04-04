import express from 'express';
import { body, param } from 'express-validator';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import { createAuthMiddleware, isAuthenticated, isEmployer } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate } from '../middleware/pagination.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { PAGINATION, JOB_TYPE, JOB_LOCATION, JOB_CATEGORY, EXPERIENCE_LEVEL } from '../config/constants.js';

const sanitizeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[$^|(){}*+\\]/g, '\\$&');
};

const router = express.Router();

export const initJobsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/',
    paginate(PAGINATION.JOB_LIST_SIZE, PAGINATION.MAX_PAGE_SIZE),
    asyncHandler(async (req, res) => {
      const { q, type, location, category } = req.query;
      const filter = { status: 'approved', isActive: true };
      
      if (q) {
        const safeSearch = sanitizeRegex(q);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { skills: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      if (type) filter.type = type;
      if (location) filter.location = location;
      if (category) filter.category = category;
      
      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .populate('company', 'name logo industry')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Job.countDocuments(filter)
      ]);
      
      res.render('jobs/index', { 
        jobs, 
        filters: req.query,
        pagination: {
          page: req.pagination.page,
          limit: req.pagination.limit,
          total,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  router.get('/search', async (req, res) => {
    try {
      const { q, type, location, category, experienceLevel } = req.query;
      const filter = { status: 'approved', isActive: true };
      
      if (q) {
        const safeSearch = sanitizeRegex(q);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { skills: { $regex: safeSearch, $options: 'i' } }
        ];
      }
      if (type) filter.type = type;
      if (location) filter.location = location;
      if (category) filter.category = category;
      if (experienceLevel) filter.experienceLevel = experienceLevel;
      
      const jobs = await Job.find(filter)
        .populate('company', 'name logo industry size')
        .sort({ createdAt: -1 });
      
      res.render('jobs/search', { jobs, filters: req.query, searchQuery: q });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).render('error', { message: 'Search failed' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const job = await Job.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
      ).populate('company', 'name logo description industry size headquarters website');
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      let hasApplied = false;
      if (req.userId) {
        const application = await Application.findOne({
          job: job._id,
          applicantUserId: req.userId
        });
        hasApplied = !!application;
      }
      
      res.render('jobs/show', { job, hasApplied });
    } catch (error) {
      console.error('Error fetching job:', error);
      res.status(500).render('error', { message: 'Failed to load job' });
    }
  });

  router.post('/',
    isAuthenticated(auth),
    isEmployer(auth),
    [
      body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
      body('description').trim().isLength({ min: 50, max: 5000 }).withMessage('Description must be 50-5000 characters'),
      body('location').isIn(JOB_LOCATION).withMessage('Invalid location'),
      body('type').isIn(JOB_TYPE).withMessage('Invalid job type'),
      body('category').optional().isIn(JOB_CATEGORY),
      body('salary.min').optional().isInt({ min: 0 }),
      body('salary.max').optional().isInt({ min: 0 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({ userId: req.userId });
      
      if (!company) {
        return res.redirect('/company/create');
      }
      
      const jobData = {
        title: req.body.title,
        description: req.body.description,
        location: req.body.location,
        type: req.body.type,
        category: req.body.category || 'Other',
        experienceLevel: req.body.experienceLevel || 'Entry',
        skills: req.body.skills || [],
        requirements: req.body.requirements || [],
        salary: req.body.salary || {},
        city: req.body.city,
        country: req.body.country,
        applicationDeadline: req.body.applicationDeadline,
        isRemote: req.body.isRemote === 'true',
        postedBy: req.userId,
        company: company._id,
        status: company.verified ? 'approved' : 'pending'
      };
      
      const job = new Job(jobData);
      await job.save();
      logger.info(`Job created: ${job._id} by user: ${req.userId}`);
      
      res.redirect(`/jobs/${job._id}`);
    })
  );

  router.get('/:id/edit', isAuthenticated(auth), isEmployer(auth), async (req, res) => {
    try {
      const job = await Job.findOne({
        _id: req.params.id,
        postedBy: req.userId
      }).populate('company');
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      res.render('jobs/edit', { job });
    } catch (error) {
      console.error('Error fetching job:', error);
      res.status(500).render('error', { message: 'Failed to load job' });
    }
  });

  router.put('/:id',
    isAuthenticated(auth),
    isEmployer(auth),
    [
      param('id').isMongoId().withMessage('Invalid job ID'),
      body('title').optional().trim().isLength({ min: 3, max: 200 }),
      body('description').optional().trim().isLength({ min: 50, max: 5000 }),
      body('location').optional().isIn(JOB_LOCATION),
      body('type').optional().isIn(JOB_TYPE),
      body('category').optional().isIn(JOB_CATEGORY),
      body('experienceLevel').optional().isIn(EXPERIENCE_LEVEL),
      body('skills').optional().isArray({ max: 20 }),
      body('salary.min').optional().isInt({ min: 0 }),
      body('salary.max').optional().isInt({ min: 0 }),
      body('city').optional().trim().isLength({ max: 100 }),
      body('country').optional().trim().isLength({ max: 100 }),
      body('applicationDeadline').optional().isISO8601(),
      body('isRemote').optional().isBoolean()
    ],
    validate,
    asyncHandler(async (req, res) => {
      const job = await Job.findOne({
        _id: req.params.id,
        postedBy: req.userId
      });
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      const allowedUpdates = [
        'title', 'description', 'location', 'type', 'category',
        'experienceLevel', 'skills', 'requirements', 'salary',
        'city', 'country', 'applicationDeadline', 'isRemote'
      ];
      
      const updates = {};
      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }
      updates.updatedAt = new Date();
      
      Object.assign(job, updates);
      await job.save();
      
      logger.info(`Job updated: ${job._id} by user: ${req.userId}`);
      res.redirect(`/jobs/${job._id}`);
    })
  );

  router.delete('/:id',
    isAuthenticated(auth),
    isEmployer(auth),
    [param('id').isMongoId().withMessage('Invalid job ID')],
    validate,
    asyncHandler(async (req, res) => {
      const job = await Job.findOneAndDelete({
        _id: req.params.id,
        postedBy: req.userId
      });
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      logger.info(`Job deleted: ${req.params.id} by user: ${req.userId}`);
      res.redirect('/employer/jobs');
    })
  );

  return router;
};

export default initJobsRouter;