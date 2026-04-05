import express from 'express';
import UserProfile from '../models/UserProfile.js';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

const router = express.Router();

export const initProfileRouter = (auth) => {
  router.use(isAuthenticated(auth));

  // GET /profile - View own profile
  router.get('/', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image'); // Populate user details from Better-Auth's user model

    if (!profile) {
      // If no profile exists, redirect to create/edit it
      return res.redirect('/profile/edit');
    }
    res.render('profile/view', { userProfile: profile });
  }));

  // GET /profile/edit - Edit own profile
  router.get('/edit', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image');

    if (!profile) {
      // If no profile exists, create a basic one for editing
      const newProfile = new UserProfile({ userId: req.userId, role: req.user.role });
      await newProfile.save();
      return res.render('profile/edit', { userProfile: newProfile });
    }
    res.render('profile/edit', { userProfile: profile });
  }));

  return router;
};