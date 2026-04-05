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
  isProfileComplete: { type: Boolean, default: false },
  profileCompletionScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  let score = 0;
  const totalFields = 10;
  
  if (this.bio && this.bio.trim() !== '') score++;
  if (this.headline && this.headline.trim() !== '') score++;
  if (this.location && this.location.trim() !== '') score++;
  if (this.phone && this.phone.trim() !== '') score++;
  if (this.website && this.website.trim() !== '') score++;
  if (this.linkedin && this.linkedin.trim() !== '') score++;
  if (this.skills && this.skills.length > 0) score++;
  if (this.education && this.education.length > 0) score++;
  if (this.experience && this.experience.length > 0) score++;
  if (this.resume && this.resume.url) score++;
  
  this.profileCompletionScore = Math.round((score / totalFields) * 100);
  this.isProfileComplete = this.profileCompletionScore >= 70;
  next();
});

export default mongoose.model('UserProfile', userProfileSchema);