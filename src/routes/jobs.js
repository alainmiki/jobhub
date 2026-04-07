import express from 'express';
import { body, param } from 'express-validator';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import { createAuthMiddleware, isAuthenticated, isEmployer, requireProfileComplete } from '../middleware/auth.js';
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
    async (req, res) => {
      try {
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
        
        const page = req.pagination?.page || 1;
        const limit = req.pagination?.limit || 20;
        const skip = (page - 1) * limit;
        
        const jobs = await Job.find(filter)
          .populate('company', 'name logo industry')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        
        const total = await Job.countDocuments(filter);
        
        return res.render('jobs/index', { 
          jobs: jobs || [], 
          filters: req.query,
          pagination: {
            page,
            limit,
            total: total || 0,
            totalPages: Math.ceil((total || 0) / limit)
          }
        });
      } catch (error) {
        logger.error('Error fetching jobs:', error);
        return res.status(500).render('error', { message: 'Failed to load jobs' });
      }
    }
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
        .sort({ createdAt: -1 })
        .lean();

      return res.render('jobs/search', { jobs: jobs || [], filters: req.query, searchQuery: q || '' });
    } catch (error) {
      logger.error('Search error:', error);
      return res.status(500).render('error', { message: 'Search failed' });
    }
  });

  router.get('/create',
    isAuthenticated(auth),
    isEmployer(auth),
    requireProfileComplete(auth),
    async (req, res) => {
      try {
        const company = await Company.findOne({ userId: req.userId });

        if (!company) {
          req.flash('info', 'You need to create a company profile before posting jobs.');
          return res.redirect('/company/create');
        }

        res.render('jobs/create', { company });
      } catch (error) {
        logger.error('Error loading job creation form:', error);
        res.status(500).render('error', { message: 'Failed to load job creation form' });
      }
    }
  );

  router.get('/:id', async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).send('Invalid job ID format');
      }
      
      const job = await Job.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { returnDocument: 'after' }
      ).populate('company', 'name logo description industry size headquarters website').lean();
      
      if (!job) {
        return res.status(404).send('Job not found');
      }
      
      let hasApplied = false;
      if (req.userId) {
        const application = await Application.findOne({
          job: job._id,
          applicantUserId: req.userId
        });
        hasApplied = !!application;
      }
      
      console.log('[DEBUG] req.user:', req.user);
      console.log('[DEBUG] req.userId:', req.userId);
      console.log('[DEBUG] hasApplied:', hasApplied);
      
      return res.render('jobs/show', { 
        job, 
        hasApplied, 
        userProfile: req.userProfile || null,
        user: req.user || null
      });
    } catch (error) {
      console.error('[ERROR] Fetching job:', error.message);
      return res.status(500).send('Error: ' + error.message);
    }
  });

  router.post('/',
    isAuthenticated(auth),
    isEmployer(auth),
    requireProfileComplete(auth),
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
    async (req, res) => {
      try {
        const company = await Company.findOne({ userId: req.userId });
        
        if (!company) {
          return res.redirect('/company/create');
        }
        
        const skills = typeof req.body.skills === 'string' 
          ? req.body.skills.split(',').map(s => s.trim()).filter(s => s) 
          : req.body.skills;
        const requirements = typeof req.body.requirements === 'string'
          ? req.body.requirements.split('\n').map(r => r.trim()).filter(r => r)
          : req.body.requirements;

        const jobData = {
          title: req.body.title,
          description: req.body.description,
          location: req.body.location,
          type: req.body.type,
          category: req.body.category || 'Other',
          experienceLevel: req.body.experienceLevel || 'Entry',
          skills: skills || [],
          requirements: requirements || [],
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
        req.flash('success', 'Job posted successfully! It is now under review.');
        
        return res.redirect(`/jobs/${job._id}`);
      } catch (error) {
        logger.error('Error creating job:', error);
        return res.status(500).render('error', { message: 'Failed to create job' });
      }
    }
  );

  router.get('/:id/edit', isAuthenticated(auth), isEmployer(auth), async (req, res) => {
    try {
      const job = await Job.findOne({
        _id: req.params.id,
        postedBy: req.userId
      }).populate('company').lean();
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      return res.render('jobs/edit', { job });
    } catch (error) {
      logger.error('Error fetching job:', error);
      return res.status(500).render('error', { message: 'Failed to load job' });
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
    async (req, res) => {
      try {
        const job = await Job.findOne({
          _id: req.params.id,
          postedBy: req.userId
        });
        
        if (!job) {
          return res.status(404).render('error', { message: 'Job not found' });
        }
        
        let skills, requirements;
        if (typeof req.body.skills === 'string') {
          skills = req.body.skills.split(',').map(s => s.trim()).filter(s => s);
        }
        if (typeof req.body.requirements === 'string') {
          requirements = req.body.requirements.split('\n').map(r => r.trim()).filter(r => r);
        }
        
        const allowedUpdates = [
          'title', 'description', 'location', 'type', 'category',
          'experienceLevel', 'city', 'country', 'applicationDeadline', 'isRemote'
        ];
        
        const updates = {};
        for (const key of allowedUpdates) {
          if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
          }
        }
        
        if (req.body.salary) {
          updates.salary = {
            min: req.body.salary.min ? parseInt(req.body.salary.min) : undefined,
            max: req.body.salary.max ? parseInt(req.body.salary.max) : undefined,
            currency: 'USD'
          };
        }
        if (skills) updates.skills = skills;
        if (requirements) updates.requirements = requirements;
        updates.updatedAt = new Date();
        
        Object.assign(job, updates);
        await job.save();
        
        logger.info(`Job updated: ${job._id} by user: ${req.userId}`);
        req.flash('success', 'Job listing updated.');
        return res.redirect(`/jobs/${job._id}`);
      } catch (error) {
        logger.error('Error updating job:', error);
        return res.status(500).render('error', { message: 'Failed to update job' });
      }
    }
  );

  router.delete('/:id',
    isAuthenticated(auth),
    isEmployer(auth),
    [param('id').isMongoId().withMessage('Invalid job ID')],
    validate,
    async (req, res) => {
      try {
        const job = await Job.findOneAndDelete({
          _id: req.params.id,
          postedBy: req.userId
        });
        
        if (!job) {
          return res.status(404).render('error', { message: 'Job not found' });
        }
        
        logger.info(`Job deleted: ${req.params.id} by user: ${req.userId}`);
        req.flash('success', 'Job deleted successfully.');
        return res.redirect('/dashboard/employer');
      } catch (error) {
        logger.error('Error deleting job:', error);
        return res.status(500).render('error', { message: 'Failed to delete job' });
      }
    }
  );

  return router;
};

export default initJobsRouter;