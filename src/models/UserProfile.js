import mongoose from 'mongoose';

const userProfileSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true, 
    unique: true 
  },
  role: { 
    type: String, 
    enum: ['candidate', 'employer', 'admin'], 
    default: 'candidate' 
  },
  bio: { type: String, maxlength: 500 },
  headline: { type: String, maxlength: 200 },
  skills: [{ type: String }],
  yearsOfExperience: { type: Number, min: 0 },
  education: [{
    institution: String,
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    grade: String,
    description: String
  }],
  experience: [{
    company: String,
    title: String,
    location: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    description: String,
    companyLogo: String
  }],
  resume: {
    url: String,
    fileName: String,
    uploadedAt: Date
  },
  resumeVersions: [{
    url: String,
    fileName: String,
    version: Number,
    uploadedAt: Date,
    isPrimary: Boolean
  }],
  phone: String,
  location: String,
  country: String,
  website: String,
  linkedin: String,
  github: String,
  twitter: String,
  preferredJobTypes: [{
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance']
  }],
  preferredLocations: [{ type: String }],
  expectedSalary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  availability: {
    available: { type: Boolean, default: true },
    noticePeriod: { type: String },
    startDate: Date
  },
  isActive: { type: Boolean, default: true },
  isProfileComplete: { type: Boolean, default: false },
  profileCompletionScore: { type: Number, default: 0 },
  lastUpdateIdempotencyKey: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const calculateProfileCompletion = (profile = {}) => {
  let score = 0;
  const totalFields = 10;

  if (profile.bio && profile.bio.trim() !== '') score++;
  if (profile.headline && profile.headline.trim() !== '') score++;
  if (profile.location && profile.location.trim() !== '') score++;
  if (profile.phone && profile.phone.trim() !== '') score++;
  if (profile.website && profile.website.trim() !== '') score++;
  if (profile.skills && profile.skills.length > 0) score++;
  if (profile.education && profile.education.length > 0) score++;
  if (profile.experience && profile.experience.length > 0) score++;
  if (profile.resume && profile.resume.url) score++;
  if (profile.availability && (profile.availability.available !== undefined || profile.availability.startDate)) score++;

  const profileCompletionScore = Math.round((score / totalFields) * 100);
  return {
    score: profileCompletionScore,
    isComplete: profileCompletionScore >= 70
  };
};

userProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  const completion = calculateProfileCompletion(this);
  this.profileCompletionScore = completion.score;
  this.isProfileComplete = completion.isComplete;
  next();
});

// Add indexes for common queries
userProfileSchema.index({ role: 1 });
userProfileSchema.index({ isProfileComplete: 1 });
userProfileSchema.index({ skills: 1 });
userProfileSchema.index({ location: 1 });
userProfileSchema.index({ 'preferredLocations': 1 });
userProfileSchema.index({ profileCompletionScore: -1 });

export default mongoose.model('UserProfile', userProfileSchema);