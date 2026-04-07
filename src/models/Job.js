import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  requirements: [{ type: String }],
  skills: [{ type: String }],
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  postedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true 
  },
  location: { 
    type: String, 
    required: true,
    enum: ['Remote', 'On-site', 'Hybrid', 'Flexible']
  },
  city: String,
  country: String,
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  type: { 
    type: String, 
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'], 
    required: true 
  },
  category: {
    type: String,
    enum: ['Engineering', 'Design', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Other'],
    default: 'Other'
  },
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'],
    default: 'Entry'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'closed'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  approvedAt: Date,
  applicationDeadline: Date,
  isRemote: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  applicationsCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true
});

jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
jobSchema.index({ status: 1, isActive: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ company: 1, status: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ type: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ isActive: 1 });

const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
export default Job;
