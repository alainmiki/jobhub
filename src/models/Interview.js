import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema({
  application: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Application', 
    required: true 
  },
  candidate: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UserProfile', 
    required: true 
  },
  interviewer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user',
    required: true 
  },
  scheduledBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user' 
  },
  type: {
    type: String,
    enum: ['phone', 'video', 'onsite', 'technical', 'behavioral', 'panel'],
    default: 'video'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'],
    default: 'scheduled'
  },
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, default: 60 },
  endTime: { type: Date },
  timezone: { type: String, default: 'UTC' },
  location: { type: String },
  meetingLink: { type: String },
  meetingId: { type: String },
  notes: { type: String },
  candidateNotes: { type: String },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    strengths: { type: String },
    improvements: { type: String },
    recommendation: { 
      type: String, 
      enum: ['hire', 'no_hire', 'undecided'],
      default: 'undecided'
    },
    submittedAt: { type: Date }
  },
  reminderSent: { type: Boolean, default: false },
}, {
  timestamps: true
});

interviewSchema.index({ application: 1 });
interviewSchema.index({ candidate: 1, scheduledAt: 1, status: 1 });
interviewSchema.index({ interviewer: 1, scheduledAt: 1, status: 1 });
interviewSchema.index({ status: 1 });

interviewSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.endTime) {
    this.endTime = new Date();
  }
  next();
});

export default mongoose.model('Interview', interviewSchema);
