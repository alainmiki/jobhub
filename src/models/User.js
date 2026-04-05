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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'user',
  strict: false,
  timestamps: true
});

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.models.user || mongoose.model('user', userSchema);
export default User;
