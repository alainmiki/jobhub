import express from 'express';
import Notification from '../models/Notification.js';
import { createAuthMiddleware, isAuthenticated } from '../middleware/auth.js';
import {asyncHandler} from '../middleware/errorHandler.js';
const router = express.Router();

export const initNotificationsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/', isAuthenticated(auth), asyncHandler(async (req, res) => {
    try {
      const notifications = await Notification.find({ recipient: req.userId })
        .sort({ createdAt: -1 })
        .limit(50);
      
      const unreadCount = await Notification.countDocuments({
        recipient: req.userId,
        isRead: false
      });
      
      res.render('notifications/index', { csrfToken: req.csrfToken ? req.csrfToken() : '', notifications, unreadCount });
    } catch (error) {
      logger.error(`Error fetching notifications: ${error.message}`);
      req.flash('error', 'Failed to load notifications');
      res.status(500).render('error', { message: 'Failed to load notifications' });
    }
  }));

  router.get('/unread', isAuthenticated(auth), asyncHandler(async (req, res) => {
    try {
      const notifications = await Notification.find({
        recipient: req.userId,
        isRead: false
      }).sort({ createdAt: -1 });

      const unreadCount = notifications.length;

      res.render('notifications/index', {
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        notifications,
        unreadCount,
        filter: 'unread'
      });
    } catch (error) {
      logger.error(`Error fetching unread notifications: ${error.message}`);
      req.flash('error', 'Failed to load notifications');
      res.redirect('/notifications');
    }
  }));

  router.post('/read/:id', isAuthenticated(auth), asyncHandler(async (req, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.userId },
        { isRead: true, readAt: new Date() },
        { returnDocument: 'after' }
      );

      // Check if this is an AJAX request (for toast notifications)
      const isAjax = req.headers['content-type']?.includes('application/json') ||
                     req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                     req.xhr;

      if (isAjax) {
        // Return JSON for AJAX requests (toast notifications)
        if (notification) {
          res.json({ success: true, notification });
        } else {
          res.status(404).json({ error: 'Notification not found' });
        }
      } else {
        // Use flash messages and redirect for form submissions
        if (notification) {
          req.flash('success', 'Notification marked as read');
        } else {
          req.flash('error', 'Notification not found');
        }

        // Redirect back to notifications page or referrer
        const redirectTo = req.get('Referrer') || '/notifications';
        res.redirect(redirectTo);
      }
    } catch (error) {
      logger.error(`Error marking notification as read: ${error.message}`);

      const isAjax = req.headers['content-type'] === 'application/json' ||
                     req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                     req.xhr;

      if (isAjax) {
        res.status(500).json({ error: 'Failed to update notification' });
      } else {
        req.flash('error', 'Failed to update notification');
        res.redirect('/notifications');
      }
    }
  }));

  router.post('/read-all', isAuthenticated(auth), asyncHandler(async (req, res) => {
    try {
      const result = await Notification.updateMany(
        { recipient: req.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      if (result.modifiedCount > 0) {
        req.flash('success', `Marked ${result.modifiedCount} notification${result.modifiedCount !== 1 ? 's' : ''} as read`);
      } else {
        req.flash('info', 'No unread notifications to mark');
      }

      res.redirect('/notifications');
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error.message}`);
      req.flash('error', 'Failed to update notifications');
      res.redirect('/notifications');
    }
  }));

  // GET /notifications/check-updates - Check for new notifications since timestamp
  router.get('/check-updates', isAuthenticated(auth), asyncHandler(async (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const newNotifications = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false,
      createdAt: { $gt: new Date(since) }
    });

    res.json({ newNotifications });
  }));

  return router;
};

export default initNotificationsRouter;