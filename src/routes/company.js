import express from 'express';
import { body, param } from 'express-validator';
import Company from '../models/Company.js';
import { createAuthMiddleware, isAuthenticated, isEmployer } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';
import { COMPANY_SIZE } from '../config/constants.js';

const router = express.Router();

export const initCompanyRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/create', isAuthenticated(auth), isEmployer(auth), async (req, res) => {
    try {
      const existing = await Company.findOne({ userId: req.userId });
      
      if (existing) {
        return res.redirect(`/company/${existing._id}/edit`);
      }
      
      res.render('company/create', { company: {} });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).render('error', { message: 'Failed to load page' });
    }
  });

  router.post('/',
    isAuthenticated(auth),
    isEmployer(auth),
    [
      body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
      body('description').optional().isLength({ max: 5000 }),
      body('industry').optional().trim().isLength({ max: 100 }),
      body('size').optional().isIn(COMPANY_SIZE),
      body('website').optional().trim().isURL().withMessage('Invalid website URL'),
      body('headquarters').optional().trim().isLength({ max: 100 })
    ],
    validate,
    asyncHandler(async (req, res) => {
      const existing = await Company.findOne({ userId: req.userId });
      
      if (existing) {
        return res.redirect(`/company/${existing._id}/edit`);
      }
      
      const companyData = {
        name: req.body.name,
        description: req.body.description,
        industry: req.body.industry,
        size: req.body.size,
        website: req.body.website,
        headquarters: req.body.headquarters,
        userId: req.userId,
        status: 'pending'
      };
      
      const company = new Company(companyData);
      await company.save();
      logger.info(`Company created: ${company._id} by user: ${req.userId}`);
      
      res.redirect(`/company/${company._id}`);
    })
  );

  router.get('/:id', async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);
      
      if (!company) {
        return res.status(404).render('error', { message: 'Company not found' });
      }
      
      res.render('company/show', { company });
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).render('error', { message: 'Failed to load company' });
    }
  });

  router.get('/:id/edit', isAuthenticated(auth), isEmployer(auth), async (req, res) => {
    try {
      const company = await Company.findOne({
        _id: req.params.id,
        userId: req.userId
      });
      
      if (!company) {
        return res.status(404).render('error', { message: 'Company not found' });
      }
      
      res.render('company/edit', { company });
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).render('error', { message: 'Failed to load company' });
    }
  });

  router.put('/:id',
    isAuthenticated(auth),
    isEmployer(auth),
    [
      param('id').isMongoId().withMessage('Invalid company ID'),
      body('name').optional().trim().isLength({ min: 2, max: 200 }),
      body('description').optional().isLength({ max: 5000 }),
      body('website').optional().trim().isURL().withMessage('Invalid website URL')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const company = await Company.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { ...req.body, updatedAt: new Date() },
        { new: true }
      );
      
      if (!company) {
        return res.status(404).render('error', { message: 'Company not found' });
      }
      
      logger.info(`Company updated: ${company._id} by user: ${req.userId}`);
      res.redirect(`/company/${company._id}`);
    })
  );

  return router;
};

export default initCompanyRouter;