import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import Interview from '../models/Interview.js';
import Notification from '../models/Notification.js';
import logger from '../config/logger.js';

export const initCandidateRouter = (auth) => {
  const router = express.Router();

  router.use(isAuthenticated(auth));

  // Security: Prevent disabled accounts from accessing candidate routes
  router.use((req, res, next) => {
    if (req.user && req.user.isActive === false) {
      return res.status(403).render('error', { message: 'Your account has been disabled. Please contact support.', title: 'Account Disabled' });
    }
    next();
  });

  // GET / - Candidate dashboard
  router.get('/',
    asyncHandler(async (req, res) => {
      const { notifCategory } = req.query;

      // Get applications with populated job data
      const appliedJobs = await Application.find({
        applicantUserId: req.userId
      })
        .populate('job')
        .sort({ createdAt: -1 });

      // Use aggregation to get stats efficiently
      const statsResult = await Application.aggregate([
        { $match: { applicantUserId: req.userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        total: 0,
        pending: 0,
        viewed: 0,
        shortlisted: 0,
        accepted: 0,
        rejected: 0,
        interviewScheduled: 0
      };

      statsResult.forEach(stat => {
        stats[stat._id] = stat.count;
        stats.total += stat.count;
      });

      const recentApplications = appliedJobs.slice(0, 5);

      const upcomingInterviews = await Interview.find({
        candidate: req.userProfile._id,
        status: { $in: ['scheduled', 'confirmed'] },
        scheduledAt: { $gte: new Date() }
      })
        .populate({
          path: 'application',
          populate: { path: 'job', populate: { path: 'company', select: 'name' } }
        })
        .sort({ scheduledAt: 1 })
        .limit(3);

      stats.interviewScheduled = upcomingInterviews.length;

      const recommendedJobs = await Job.find({
        status: 'approved',
        isActive: true
      })
        .populate('company', 'name logo')
        .sort({ createdAt: -1 })
        .limit(5);

      const notifQuery = { recipient: req.userId, isRead: false };
      if (notifCategory && notifCategory !== 'All') {
        notifQuery.category = notifCategory;
      }

      const recentNotifications = await Notification.find(notifQuery).sort({ createdAt: -1 }).limit(5);

      logger.info(`Candidate dashboard loaded for user: ${req.userId}`);
      res.render('dashboard/candidate', { csrfToken: req.csrfToken ? req.csrfToken() : '', stats, recommendedJobs, recentNotifications, recentApplications, upcomingInterviews, profile: req.userProfile, activeNotifCategory: notifCategory || 'All' });
    })
  );

  // POST /notifications/read-all - Mark all notifications as read
  router.post('/notifications/read-all',
    asyncHandler(async (req, res) => {
      await Notification.updateMany(
        { recipient: req.userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
      req.flash('success', 'All notifications marked as read.');
      res.redirect(req.get('Referrer') || '/candidate');
    })
  );

  return router;
};

export default initCandidateRouter;
