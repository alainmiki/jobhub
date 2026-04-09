import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

export const sanitizeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[$^|(){}*+\\]/g, '\\$&');
};

export const logAuditAction = async (req, action, targetType, targetId, details = {}, priority = null) => {
  try {
    await AuditLog.create({
      adminUserId: req.userId,
      action,
      targetType,
      targetId,
      priority,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Emits a real-time notification to a specific user
 */
export const emitNotification = (req, recipientId, notification) => {
  if (req.io) {
    const notificationData = notification.toObject();
    req.io.to(recipientId.toString()).emit('notification', notificationData);
  }
};