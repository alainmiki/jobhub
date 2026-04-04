import express from 'express';
import { body, param } from 'express-validator';
import User from '../models/User.js';
import UserProfile from '../models/UserProfile.js';
import { createAuthMiddleware, isAuthenticated, isRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../config/logger.js';

const router = express.Router();

const validRoles = ['candidate', 'employer', 'admin'];

export const initAdminRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/users',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const { page = 1, limit = 20, role, search } = req.query;
      
      const filter = {};
      if (role && validRoles.includes(role)) {
        filter.role = role;
      }
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ];
      }
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-image -coverImage')
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 }),
        User.countDocuments(filter)
      ]);
      
      res.render('admin/users', {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        filters: { role, search }
      });
    })
  );

  router.post('/users/:id/role',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    [
      param('id').isMongoId().withMessage('Invalid user ID'),
      body('role').isIn(validRoles).withMessage('Invalid role')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { role } = req.body;
      const userId = req.params.id;
      
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (user.id === req.userId) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      
      user.role = role;
      await user.save();
      
      await UserProfile.findOneAndUpdate(
        { userId },
        { role },
        { upsert: true }
      );
      
      logger.warn(`SECURITY: Role changed for user ${userId} to ${role} by admin ${req.userId}`);
      
      res.json({ success: true, message: `Role updated to ${role}` });
    })
  );

  router.post('/users/:id/disable',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    [
      param('id').isMongoId().withMessage('Invalid user ID'),
      body('disabled').isBoolean().withMessage('Invalid value')
    ],
    validate,
    asyncHandler(async (req, res) => {
      const { disabled } = req.body;
      const userId = req.params.id;
      
      if (userId === req.userId) {
        return res.status(400).json({ error: 'Cannot disable your own account' });
      }
      
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          disabled,
          disabledAt: disabled ? new Date() : null
        },
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      logger.warn(`SECURITY: User ${userId} ${disabled ? 'disabled' : 'enabled'} by admin ${req.userId}`);
      
      res.json({ success: true, message: `User ${disabled ? 'disabled' : 'enabled'} successfully` });
    })
  );

  router.get('/users/:id',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const user = await User.findById(req.params.id)
        .select('-image -coverImage');
      
      if (!user) {
        return res.status(404).render('error', { message: 'User not found' });
      }
      
      const profile = await UserProfile.findOne({ userId: req.params.id });
      
      res.render('admin/user-detail', { user, profile });
    })
  );

  router.get('/jobs/pending',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const Job = (await import('../models/Job.js')).default;
      
      const jobs = await Job.find({ status: 'pending' })
        .populate('company', 'name logo')
        .populate('postedBy', 'name email')
        .sort({ createdAt: -1 });
      
      res.render('admin/pending-jobs', { jobs });
    })
  );

  router.get('/companies/pending',
    isAuthenticated(auth),
    isRole(auth, 'admin'),
    asyncHandler(async (req, res) => {
      const Company = (await import('../models/Company.js')).default;
      
      const companies = await Company.find({ status: 'pending' })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });
      
      res.render('admin/pending-companies', { companies });
    })
  );

  return router;
};

export default initAdminRouter;