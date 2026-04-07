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
    enum: ['pending', 'viewed', 'shortlisted', 'rejected', 'accepted', 'interview_scheduled', 'interview_completed', 'offer_extended', 'offer_declined', 'withdrawn'],
    default: 'pending'
  },
  coverLetter: { type: String },
  resume: {
    url: String,
    fileName: String
  },
  notes: { type: String },
  employerNotes: { type: String },
  internalRating: { type: Number, min: 1, max: 5 },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  source: {
    type: String,
    enum: ['direct', 'referral', 'linkedin', 'indeed', 'other'],
    default: 'direct'
  },
  timeline: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    updatedAt: { type: Date, default: Date.now }
  }],
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview'
  },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  viewedAt: { type: Date },
}, {
  timestamps: true
});

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index({ applicantUserId: 1, isArchived: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1, createdAt: -1 });
applicationSchema.index({ priority: 1 });

applicationSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      note: `Status changed to ${this.status}`,
      updatedAt: new Date()
    });
    if (this.status === 'viewed' && !this.viewedAt) {
      this.viewedAt = new Date();
    }
    if (this.status === 'withdrawn' && !this.archivedAt) {
      this.archivedAt = new Date();
      this.isArchived = true;
    }
  }
  next();
});

export default mongoose.model('Application', applicationSchema);