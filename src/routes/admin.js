import express from 'express';
import mongoose from 'mongoose';
import UserProfile from '../models/UserProfile.js';
import { isAuthenticated, isRole } from '../middleware/auth.js';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate } from '../middleware/pagination.js';
import logger from '../config/logger.js';

const router = express.Router();

export const initAdminRouter = (auth) => {
  router.use(isAuthenticated(auth));
  router.use(isRole(auth, 'admin'));

  // GET /admin/users - User management list with filters and pagination
  router.get('/users', 
    paginate(20), 
    asyncHandler(async (req, res) => {
      const { search, role } = req.query;
      const User = mongoose.model('user'); // Access Better-Auth user model
      
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      if (role) {
        query.role = role;
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        User.countDocuments(query)
      ]);

      res.render('admin/users', {
        users,
        filters: { search, role },
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/users/:id - User detail view
  router.get('/users/:id', asyncHandler(async (req, res) => {
    const User = mongoose.model('user');
    
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).render('error', {
        message: 'User not found',
        title: '404 - Not Found'
      });
    }

    const profile = await UserProfile.findOne({ userId: targetUser.id });

    res.render('admin/user-detail', {
      targetUser,
      profile
    });
  }));

  // POST /admin/users/:id/role - Update user role
  router.post('/users/:id/role', asyncHandler(async (req, res) => {
    const { role } = req.body;
    const User = mongoose.model('user');

    if (!['candidate', 'employer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Sync the UserProfile role
    await UserProfile.findOneAndUpdate({ userId: user.id }, { role });

    logger.info(`Admin ${req.userId} updated role for ${user.email} to ${role}`);
    res.json({ success: true });
  }));

  // GET /admin/jobs/pending - List pending jobs
  router.get('/jobs/pending',
    paginate(20),
    asyncHandler(async (req, res) => {
      const filter = { status: 'pending' };
      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .populate('company', 'name logo')
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Job.countDocuments(filter)
      ]);

      res.render('admin/pending-jobs', {
        jobs,
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  // GET /admin/companies/pending - List pending companies
  router.get('/companies/pending',
    paginate(20),
    asyncHandler(async (req, res) => {
      const filter = { verified: false };
      const [companies, total] = await Promise.all([
        Company.find(filter)
          .populate('userId', 'name email') // Populate owner info
          .sort({ createdAt: -1 })
          .skip(req.pagination.skip)
          .limit(req.pagination.limit),
        Company.countDocuments(filter)
      ]);

      res.render('admin/pending-companies', {
        companies,
        pagination: {
          page: req.pagination.page,
          totalPages: Math.ceil(total / req.pagination.limit)
        }
      });
    })
  );

  return router;
};