import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

export const sanitizeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[$^|(){}*+\\]/g, '\\$&');
};

export const logAuditAction = async (req, action, targetType, targetId, details = {}) => {
  try {
    await AuditLog.create({
      adminUserId: req.userId,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};