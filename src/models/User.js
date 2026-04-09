import mongoose from 'mongoose';

// This schema allows Mongoose to "populate" user data from the collection managed by Better-Auth
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  image: { type: String },
  coverImage: { type: String },
  role: { 
    type: String, 
    enum: ['candidate', 'employer', 'admin'], 
    default: 'candidate' 
  },
  isActive: { type: Boolean, default: true },
}, { 
  collection: 'user',
  strict: false,
  timestamps: true
});

// Performance indexes for admin filtering and sorting
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Cascade delete middleware
userSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const userId = this._id;

    // Import models here to avoid circular dependencies
    const UserProfile = (await import('./UserProfile.js')).default;
    const Application = (await import('./Application.js')).default;
    const Notification = (await import('./Notification.js')).default;
    const Interview = (await import('./Interview.js')).default;
    const AuditLog = (await import('./AuditLog.js')).default;
    const Company = (await import('./Company.js')).default;
    const Job = (await import('./Job.js')).default;
    const ApplicationFeedback = (await import('./ApplicationFeedback.js')).default;

    // Delete user profile
    await UserProfile.deleteMany({ userId });

    // Delete applications where user is applicant
    await Application.deleteMany({ applicantUserId: userId });

    // Delete applications where user posted the job
    const userJobs = await Job.find({ postedBy: userId });
    const jobIds = userJobs.map(job => job._id);
    await Application.deleteMany({ job: { $in: jobIds } });

    // Delete notifications
    await Notification.deleteMany({ recipient: userId });

    // Delete interviews where user is candidate
    const userProfile = await UserProfile.findOne({ userId });
    if (userProfile) {
      await Interview.deleteMany({ candidate: userProfile._id });
    }

    // Delete interviews for jobs posted by user
    await Interview.deleteMany({ application: { $in: await Application.find({ job: { $in: jobIds } }).distinct('_id') } });

    // Delete audit logs
    await AuditLog.deleteMany({ userId });

    // Delete company and related jobs if user is employer
    const company = await Company.findOne({ userId });
    if (company) {
      await Job.deleteMany({ company: company._id });
      await Company.deleteOne({ userId });
    }

    // Delete feedback
    await ApplicationFeedback.deleteMany({ fromUser: userId });
    await ApplicationFeedback.deleteMany({ toUser: userId });

    next();
  } catch (error) {
    console.error('Error in user cascade delete:', error);
    next(error);
  }
});

const User = mongoose.models.user || mongoose.model('user', userSchema);
export default User;
