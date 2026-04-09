import mongoose from 'mongoose';
import { auth } from '../config/auth.js';
import User from '../models/User.js';
import UserProfile from '../models/UserProfile.js';

export async function createTestUsers() {
  try {
    // Create admin user
    const adminSignUp = await auth.api.signUp({
      email: 'admin@example.com',
      password: 'adminpass123',
      name: 'Admin User'
    });

    if (adminSignUp.data?.user) {
      await User.findByIdAndUpdate(adminSignUp.data.user.id, { role: 'admin', isActive: true }, { upsert: true });
      await UserProfile.create({
        userId: adminSignUp.data.user.id,
        role: 'admin',
        isActive: true,
        headline: 'System Administrator',
        bio: 'Administrator account for system management'
      });
    }

    // Create employer user
    const employerSignUp = await auth.api.signUp({
      email: 'employer@example.com',
      password: 'employerpass123',
      name: 'Test Employer'
    });

    if (employerSignUp.data?.user) {
      await User.findByIdAndUpdate(employerSignUp.data.user.id, { role: 'employer', isActive: true }, { upsert: true });
      await UserProfile.create({
        userId: employerSignUp.data.user.id,
        role: 'employer',
        isActive: true,
        headline: 'HR Manager',
        bio: 'Looking for talented developers',
        location: 'New York, NY'
      });
    }

    // Create candidate user
    const candidateSignUp = await auth.api.signUp({
      email: 'candidate@example.com',
      password: 'candidatepass123',
      name: 'Test Candidate'
    });

    if (candidateSignUp.data?.user) {
      await User.findByIdAndUpdate(candidateSignUp.data.user.id, { role: 'candidate', isActive: true }, { upsert: true });
      await UserProfile.create({
        userId: candidateSignUp.data.user.id,
        role: 'candidate',
        isActive: true,
        headline: 'Full Stack Developer',
        bio: 'Experienced developer seeking new opportunities',
        skills: ['JavaScript', 'React', 'Node.js', 'Python'],
        location: 'San Francisco, CA',
        yearsOfExperience: 5
      });
    }

    console.log('✅ Test users created successfully');
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  }
}

export async function cleanupTestUsers() {
  try {
    const testEmails = ['admin@example.com', 'employer@example.com', 'candidate@example.com'];

    for (const email of testEmails) {
      const user = await User.findOne({ email });
      if (user) {
        await UserProfile.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(user._id);
      }
    }

    console.log('🧹 Test users cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test users:', error);
  }
}