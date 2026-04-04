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
    facebook: String
  },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

companySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Company', companySchema);