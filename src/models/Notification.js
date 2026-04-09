import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true 
  },
  type: {
    type: String,
    enum: [
      'application_received', 'application_shortlisted', 'application_rejected', 'application_accepted', 'application_viewed',
      'job_match', 'job_approved', 'job_rejected', 'new_job_posted',
      'profile_update', 'system', 'company_verified', 'company_approve', 'company_rejected',
      'interview_scheduled', 'interview_confirmed', 'interview_cancelled', 'interview_rescheduled',
      'message', 'message_from_employer', 'message_from_candidate'
    ],
    required: true
  },
  category: {
    type: String,
    enum: ['Application', 'Job', 'Company', 'Profile', 'System', 'Interview'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ link: 1 }); // Keep existing index
notificationSchema.index({ category: 1, createdAt: -1 }); // New index for category filtering
notificationSchema.index({ priority: 1, createdAt: -1 }); // New index for priority filtering

export default mongoose.model('Notification', notificationSchema);