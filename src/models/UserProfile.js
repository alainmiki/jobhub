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
  skills: [{ type: String }],
  education: [{
    institution: String,
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date,
    current: Boolean
  }],
  experience: [{
    company: String,
    title: String,
    location: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    description: String
  }],
  resume: {
    url: String,
    fileName: String,
    uploadedAt: Date
  },
  phone: String,
  location: String,
  website: String,
  linkedin: String,
  isProfileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('UserProfile', userProfileSchema);