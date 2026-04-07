import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['user_create', 'user_delete', 'user_role_update', 'user_disable', 'user_enable', 'job_approve', 'job_reject', 'company_verify', 'company_approve', 'company_reject']
  },
  targetType: {
    type: String,
    required: true,
    enum: ['user', 'job', 'company']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
});

auditLogSchema.set('timestamps', {
  createdAt: 'createdAt',
  updatedAt: false
});

auditLogSchema.index({ adminUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ targetId: 1, targetType: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;