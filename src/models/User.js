import mongoose from 'mongoose';

// This schema allows Mongoose to "populate" user data from the collection managed by Better-Auth
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  image: { type: String },
  coverImage: { type: String },
  role: { 
    type: String, 
    enum: ['candidate', 'employer', 'admin'], 
    default: 'candidate' 
  },
  isActive: { type: Boolean, default: true },
}, { 
  collection: 'user',
  strict: false,
  timestamps: true
});

// Performance indexes for admin filtering and sorting
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.models.user || mongoose.model('user', userSchema);
export default User;
