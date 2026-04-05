import mongoose from 'mongoose';

const applicationFeedbackSchema = new mongoose.Schema({
  application: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Application', 
    required: true 
  },
  fromUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user',
    required: true 
  },
  toUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user',
    required: true 
  },
  type: {
    type: String,
    enum: ['employer_feedback', 'candidate_feedback', 'interview_feedback'],
    default: 'employer_feedback'
  },
  rating: { type: Number, min: 1, max: 5 },
  strengths: [{ type: String }],
  areasForImprovement: [{ type: String }],
  overallFeedback: { type: String, maxlength: 2000 },
  wouldRecommend: { type: Boolean },
  wouldHireAgain: { type: Boolean },
  isPublic: { type: Boolean, default: false },
  isAnonymous: { type: Boolean, default: false },
  responseRequested: { type: Boolean, default: false },
  candidateResponse: { 
    message: { type: String, maxlength: 1000 },
    respondedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

applicationFeedbackSchema.index({ application: 1 });
applicationFeedbackSchema.index({ toUser: 1 });
applicationFeedbackSchema.index({ type: 1 });

applicationFeedbackSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('ApplicationFeedback', applicationFeedbackSchema);
