import express from 'express';
import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { createAuthMiddleware, isAuthenticated, isEmployer, requireProfileComplete } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { upload } from '../config/multer.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { COMPANY_SIZE } from '../config/constants.js';

const router = express.Router();

export const initCompanyRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/create', 
    isAuthenticated(auth), 
    isEmployer(auth), 
    requireProfileComplete(auth),
    asyncHandler(async (req, res) => {
    const existing = await Company.findOne({ userId: req.userId });
    
    if (existing) {
      req.flash('info', 'You already have a company profile.');
      return res.redirect(`/company/${existing._id}/edit`);
    }
    
    res.render('company/create', { 
      company: {},
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }));

  router.post('/',
    isAuthenticated(auth),
    isEmployer(auth),
    requireProfileComplete(auth),
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 }
    ]),
    [
      body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
      body('description').trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
      body('industry').trim().isLength({ max: 100 }).withMessage('Industry must be under 100 characters'),
      body('size').isIn(COMPANY_SIZE).withMessage('Please select a valid company size'),
      body('website').optional({ checkFalsy: true }).trim().isURL({ 
        require_protocol: false, 
        require_tld: false, 
        allow_underscores: true 
      }).withMessage('Invalid website URL'),
      body('headquarters').optional().trim().isLength({ max: 100 }),
      body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() })
    ],
    validate,
    asyncHandler(async (req, res) => {
      // CSRF check for multipart forms
      if (!req.body._csrf) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }
      if (req.csrfToken && req.csrfToken() !== req.body._csrf) {
        return res.status(403).json({ error: 'CSRF token invalid' });
      }

      const existing = await Company.findOne({ userId: req.userId });
      
      if (existing) {
        req.flash('error', 'You already have a company profile. Please edit it instead.');
        return res.redirect(`/company/${existing._id}/edit`);
      }
      
      const logo = req.files?.['logo'] ? `/uploads/${req.files['logo'][0].filename}` : undefined;
      const coverImage = req.files?.['coverImage'] ? `/uploads/${req.files['coverImage'][0].filename}` : undefined;

      const companyData = {
        name: req.body.name.trim(),
        description: req.body.description.trim(),
        industry: req.body.industry?.trim(),
        size: req.body.size,
        website: req.body.website?.trim(),
        headquarters: req.body.headquarters?.trim(),
        foundedYear: req.body.foundedYear ? parseInt(req.body.foundedYear) : undefined,
        logo,
        coverImage,
        userId: req.userId,
        socialLinks: {
          linkedin: req.body.linkedin?.trim(),
          twitter: req.body.twitter?.trim(),
          facebook: req.body.facebook?.trim(),
          instagram: req.body.instagram?.trim()
        },
        specializations: req.body.specializations 
          ? (Array.isArray(req.body.specializations) ? req.body.specializations : req.body.specializations.split(',')).map(s => s.trim()).filter(s => s)
          : [],
        status: 'pending',
        analytics: { totalViews: 0, totalApplications: 0, profileViews: 0 }
      };
      
      const company = new Company(companyData);
      await company.save();
      
      logger.info(`Company created: ${company._id} by user: ${req.userId}`);
      
      req.flash('success', 'Company profile created successfully! Your profile is pending verification.');
      res.redirect(`/company/${company._id}/edit`);
    })
  );

  router.get('/', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({ userId: req.userId });
    
    if (!company) {
      return res.redirect('/company/create');
    }
    
    res.redirect(`/company/${company._id}`);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    try {
      const company = await Company.findByIdAndUpdate(
        req.params.id,
        { $inc: { 'analytics.profileViews': 1 } },
        { returnDocument: 'after' }
      );
      
      if (!company) {
        return res.status(404).render('error', { message: 'Company not found' });
      }

      const isOwner = req.userId && company.userId.toString() === req.userId;
      const isAdmin = req.user?.role === 'admin';
      const canView = isOwner || isAdmin || company.verified;

      if (!canView) {
        return res.status(403).render('error', { message: 'This company profile is not yet verified' });
      }

      const jobs = await Job.find({ 
        company: company._id,
        ...(isOwner ? {} : { status: 'approved', isActive: true })
      }).sort({ createdAt: -1 });

      const companyJobs = await Job.find({ company: company._id }).select('_id');
      const stats = await Application.aggregate([
        { $match: { job: { $in: companyJobs.map(j => j._id) } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ]);

      res.render('company/show', { 
        company, 
        jobs, 
        isOwner,
        stats: stats[0] || { total: 0, pending: 0, shortlisted: 0, accepted: 0, rejected: 0 }
      });
    } catch (error) {
      logger.error(`Error fetching company ${req.params.id}: ${error.message}`);
      res.status(500).render('error', { message: 'Failed to load company' });
    }
  }));

  router.get('/:id/edit', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!company) {
      req.flash('error', 'Company not found or you do not have permission.');
      return res.redirect('/dashboard/employer');
    }
    
    res.render('company/edit', { 
      company,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }));

  router.put('/:id',
    isAuthenticated(auth),
    isEmployer(auth),
    requireProfileComplete(auth),
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 }
    ]),
    [
      param('id').isMongoId().withMessage('Invalid company ID'),
      body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
      body('description').optional().trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20-5000 characters'),
      body('website').optional({ checkFalsy: true }).trim().isURL({ 
        require_protocol: false, 
        require_tld: false, 
        allow_underscores: true 
      }).withMessage('Invalid website URL')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const company = await Company.findOne({
        _id: req.params.id,
        userId: req.userId
      });
      
      if (!company) {
        req.flash('error', 'Company not found or you do not have permission.');
        return res.redirect('/dashboard/employer');
      }

      const updates = {
        name: req.body.name?.trim(),
        description: req.body.description?.trim(),
        industry: req.body.industry?.trim(),
        size: req.body.size,
        website: req.body.website?.trim(),
        headquarters: req.body.headquarters?.trim(),
        foundedYear: req.body.foundedYear ? parseInt(req.body.foundedYear) : undefined,
        specializations: req.body.specializations 
          ? (Array.isArray(req.body.specializations) ? req.body.specializations : req.body.specializations.split(',')).map(s => s.trim()).filter(s => s)
          : company.specializations
      };

      if (req.files?.['logo']) updates.logo = `/uploads/${req.files['logo'][0].filename}`;
      if (req.files?.['coverImage']) updates.coverImage = `/uploads/${req.files['coverImage'][0].filename}`;
      
      updates.socialLinks = {
        linkedin: req.body.linkedin?.trim(),
        twitter: req.body.twitter?.trim(),
        facebook: req.body.facebook?.trim(),
        instagram: req.body.instagram?.trim()
      };

      if (!company.verified) {
        updates.status = 'pending';
      }

      Object.assign(company, updates);
      await company.save();
      
      logger.info(`Company updated: ${company._id} by user: ${req.userId}`);
      req.flash('success', 'Company details updated successfully');
      res.redirect(`/company/${company._id}`);
    })
  );

  router.delete('/:id', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found or access denied' });
    }

    const activeJobs = await Job.countDocuments({ company: company._id, status: 'approved', isActive: true });
    if (activeJobs > 0) {
      return res.status(400).json({ error: 'Cannot delete company with active job postings. Please close or delete all jobs first.' });
    }

    await Job.deleteMany({ company: company._id });
    await company.deleteOne();
    
    logger.info(`Company deleted: ${req.params.id} by user: ${req.userId}`);
    req.flash('success', 'Company profile deleted successfully');
    res.json({ success: true, redirect: '/dashboard/employer' });
  }));

  router.post('/:id/verify', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    company.verified = true;
    company.verifiedAt = new Date();
    company.verifiedBy = req.userId;
    company.status = 'approved';
    await company.save();

    const notification = new Notification({
      recipient: company.userId,
      type: 'company_verified',
      priority: 'medium', // Default priority for company verification
      category: 'Company',
      title: 'Company Verified',
      message: `Your company "${company.name}" has been verified and is now visible to all users.`,
      link: `/company/${company._id}`
    });
    await notification.save();

    logger.info(`Company verified: ${company._id} by admin: ${req.userId}`);
    req.flash('success', 'Company verified successfully');
    res.redirect(`/admin/companies/${company._id}`);
  }));

  router.get('/:id/analytics', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!company) {
      return res.status(404).render('error', { message: 'Company not found' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const jobAnalytics = await Job.aggregate([
      { $match: { company: company._id } },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          totalViews: { $sum: '$views' },
          totalApplications: { $sum: '$applicationsCount' }
        }
      }
    ]);

    const applicationsOverTime = await Application.aggregate([
      { 
        $match: { 
          job: { $in: await Job.find({ company: company._id }).select('_id') },
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const statusBreakdown = await Application.aggregate([
      { 
        $match: { 
          job: { $in: await Job.find({ company: company._id }).select('_id') }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      company: {
        profileViews: company.analytics?.profileViews || 0,
        totalViews: company.analytics?.totalViews || 0,
        totalApplications: company.analytics?.totalApplications || 0
      },
      jobs: jobAnalytics[0] || { totalJobs: 0, activeJobs: 0, totalViews: 0, totalApplications: 0 },
      applicationsOverTime,
      statusBreakdown
    });
  }));

  router.get('/:id/jobs', isAuthenticated(auth), isEmployer(auth), asyncHandler(async (req, res) => {
    const company = await Company.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { status, sort } = req.query;
    const filter = { company: company._id };
    if (status && status !== 'all') filter.status = status;

    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'title') sortOption = { title: 1 };

    const jobs = await Job.find(filter)
      .populate('company', 'name logo')
      .sort(sortOption);

    const stats = {
      total: await Job.countDocuments({ company: company._id }),
      active: await Job.countDocuments({ company: company._id, status: 'approved', isActive: true }),
      pending: await Job.countDocuments({ company: company._id, status: 'pending' }),
      closed: await Job.countDocuments({ company: company._id, status: 'closed' })
    };

    res.json({ jobs, stats });
  }));

  return router;
};

export default initCompanyRouter;