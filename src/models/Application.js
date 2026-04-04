import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  job: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Job', 
    required: true 
  },
  candidate: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UserProfile', 
    required: true 
  },
  applicantUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'viewed', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending'
  },
  coverLetter: { type: String },
  resume: {
    url: String,
    fileName: String
  },
  notes: { type: String },
  employerNotes: { type: String },
  timeline: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    updatedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index({ applicantUserId: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

applicationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      updatedAt: new Date()
    });
  }
  next();
});

export default mongoose.model('Application', applicationSchema);