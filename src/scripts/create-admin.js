import dotenv from 'dotenv';
dotenv.config();
import { initAuth } from "../config/auth.js"
import mongoose from 'mongoose';

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Admin';
const role = "admin"

if (!email || !password) {
  console.log('Usage: node src/scripts/create-admin.js <email> <password> [name]');
  process.exit(1);
}



await connectDB();
import { connectDB } from '../config/db.js';
const mongoDb = mongoose.connection.db;
const auth = await initAuth(mongoDb);
async function createAdmin() {

  try {
    const response = await auth.api.signUpEmail({
      body: { name, email, password, role },
      // headers: req.headers,
      asResponse: true
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(errorData);

      const message = errorData.message || errorData.error?.message || 'Registration failed';
      throw new Error(message);
    }
  }
  catch (error) {
    console.log("errors:", error);

  }

  mongoose.disconnect().then(e => {
    console.log("DB DISCONNECTED");
    return 0
  }).catch(Error => {
    console.log(Error);

  });

  return 0;
}


// async function createAdmin1() {
//   await mongoose.connect(process.env.MONGODB_URI);
//   const db = mongoose.connection.db;

//   const User = db.collection('user');
//   const Account = db.collection('account');
//   const Profile = db.collection('userProfile');

//   let user = await User.findOne({ email });

//   if (user) {
//     console.log('User exists, updating to admin...');
//     await User.updateOne({ email }, { $set: { name, role: 'admin' } });
//   } else {
//     console.log('Creating new admin user...');
//     const { ObjectId } = mongoose.mongo;
//     user = {
//       id: new ObjectId().toString(),
//       name,
//       email,
//       emailVerified: false,
//       image: null,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       role: 'admin'
//     };
//     await User.insertOne(user);

//     await Account.insertOne({
//       id: new ObjectId().toString(),
//       userId: user.id,
//       accountId: new ObjectId().toString(),
//       providerId: 'email',
//       provider: 'email',
//       encryptedPassword: password,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     });
//     console.log('User created!');
//   }

//   user = await User.findOne({ email });

//   await Profile.updateOne(
//     { userId: user.id },
//     {
//       $set: {
//         userId: user.id,
//         role: 'admin',
//         bio: 'System Administrator',
//         skills: ['Management', 'Security'],
//         education: [],
//         experience: [],
//         resume: null,
//         phone: '',
//         location: '',
//         website: '',
//         linkedin: '',
//         isProfileComplete: true,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       }
//     },
//     { upsert: true }
//   );
//   console.log('Profile updated!');

//   console.log('\n========================================');
//   console.log('  Admin account ready!');
//   console.log('========================================');
//   console.log('  Email:    ' + email);
//   console.log('  Password: ' + password);
//   console.log('  Name:     ' + name);
//   console.log('  Role:     admin');
//   console.log('========================================');

//   await mongoose.disconnect();
//   process.exit(0);
// }

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});

