import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true,
    unique: true 
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  industry: {
    type: String,
    enum: ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Media', 'Consulting', 'Other'],
    required: true
  },
  size: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    required: true
  },
  headquarters: String,
  website: String,
  logo: String,
  coverImage: String,
  foundedYear: Number,
  specializations: [{ type: String }],
  socialLinks: {
    linkedin: String,
    twitter: String,
    facebook: String,
    instagram: String
  },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: String,
  analytics: {
    totalViews: { type: Number, default: 0 },
    totalApplications: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    lastViewedAt: Date
  },
  settings: {
    emailNotifications: { type: Boolean, default: true },
    newApplicationAlert: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    applicationAutoArchive: { type: Boolean, default: false },
    autoRejectAfterDays: { type: Number }
  },
  teamMembers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    role: { type: String, enum: ['owner', 'admin', 'recruiter', 'viewer'], default: 'viewer' },
    invitedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  }],
  branding: {
    primaryColor: { type: String, default: '#4F46E5' },
    accentColor: { type: String, default: '#10B981' }
  },
}, { 
  timestamps: true 
});

companySchema.index({ status: 1 });
companySchema.index({ verified: 1 });
companySchema.index({ verified: 1, createdAt: -1 });
companySchema.index({ industry: 1 });
companySchema.index({ createdAt: -1 });
companySchema.index({ 'analytics.totalViews': -1 });
companySchema.index({ 'analytics.totalApplications': -1 });

companySchema.virtual('jobs', {
  ref: 'Job',
  localField: '_id',
  foreignField: 'company'
});

companySchema.virtual('activeJobs', {
  ref: 'Job',
  localField: '_id',
  foreignField: 'company',
  match: { status: 'approved', isActive: true }
});

companySchema.methods.incrementViews = function() {
  this.analytics.totalViews += 1;
  this.analytics.lastViewedAt = new Date();
  return this.save();
};

companySchema.methods.incrementProfileViews = function() {
  this.analytics.profileViews += 1;
  return this.save();
};

companySchema.methods.incrementApplications = function() {
  this.analytics.totalApplications += 1;
  return this.save();
};

companySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    industry: this.industry,
    size: this.size,
    headquarters: this.headquarters,
    website: this.website,
    logo: this.logo,
    coverImage: this.coverImage,
    foundedYear: this.foundedYear,
    specializations: this.specializations,
    socialLinks: this.socialLinks,
    verified: this.verified,
    createdAt: this.createdAt
  };
};

// Cascade delete middleware
companySchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const companyId = this._id;

    // Import models here to avoid circular dependencies
    const Job = (await import('./Job.js')).default;
    const Application = (await import('./Application.js')).default;
    const Interview = (await import('./Interview.js')).default;
    const Notification = (await import('./Notification.js')).default;

    // Get all jobs for this company
    const jobs = await Job.find({ company: companyId });
    const jobIds = jobs.map(job => job._id);

    // Delete all applications for these jobs
    await Application.deleteMany({ job: { $in: jobIds } });

    // Delete all interviews for applications of these jobs
    const applications = await Application.find({ job: { $in: jobIds } });
    const applicationIds = applications.map(app => app._id);
    await Interview.deleteMany({ application: { $in: applicationIds } });

    // Delete notifications related to these jobs/applications
    await Notification.deleteMany({ link: { $regex: `(${jobIds.join('|')}|${applicationIds.join('|')})` } });

    // Delete all jobs
    await Job.deleteMany({ company: companyId });

    next();
  } catch (error) {
    console.error('Error in company cascade delete:', error);
    next(error);
  }
});

export default mongoose.model('Company', companySchema);