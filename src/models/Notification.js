import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true 
  },
  type: {
    type: String,
    enum: ['application_received', 'application_shortlisted', 'application_rejected', 'application_accepted', 'job_match', 'job_approved', 'job_rejected', 'new_job_posted', 'profile_update', 'system'],
    required: true
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
notificationSchema.index({ link: 1 });

export default mongoose.model('Notification', notificationSchema);