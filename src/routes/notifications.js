import express from 'express';
import Notification from '../models/Notification.js';
import { createAuthMiddleware, isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

export const initNotificationsRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/', isAuthenticated(auth), async (req, res) => {
    try {
      const notifications = await Notification.find({ recipient: req.userId })
        .sort({ createdAt: -1 })
        .limit(50);
      
      const unreadCount = await Notification.countDocuments({
        recipient: req.userId,
        isRead: false
      });
      
      res.render('notifications/index', { notifications, unreadCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).render('error', { message: 'Failed to load notifications' });
    }
  });

  router.get('/unread', isAuthenticated(auth), async (req, res) => {
    try {
      const notifications = await Notification.find({
        recipient: req.userId,
        isRead: false
      }).sort({ createdAt: -1 });
      
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to load notifications' });
    }
  });

  router.post('/read/:id', isAuthenticated(auth), async (req, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
      
      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to update notification' });
    }
  });

  router.post('/read-all', isAuthenticated(auth), async (req, res) => {
    try {
      await Notification.updateMany(
        { recipient: req.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to update notifications' });
    }
  });

  return router;
};

export default initNotificationsRouter;