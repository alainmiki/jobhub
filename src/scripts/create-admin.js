import dotenv from 'dotenv';
dotenv.config();
import { initAuth } from "../config/auth.js"
import { connectDB } from '../config/db.js';
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
    } else {
      console.log('Profile updated!');

      console.log('\n========================================');
      console.log('  Admin account ready!');
      console.log('========================================');
      console.log('  Email:    ' + email);
      console.log('  Password: ' + password);
      console.log('  Name:     ' + name);
      console.log('  Role:     admin');
      console.log('========================================');
    }
  }
  catch (error) {
    console.log("errors:", error);

  }



  // await mongoose.disconnect();
  mongoose.disconnect().then(e => {
    console.log("DB DISCONNECTED");
    return 0
  }).catch(Error => {
    console.log(Error);

  });
  process.exit(0);

}


createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});

