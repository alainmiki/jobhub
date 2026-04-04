import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn.connection.db; // Return the underlying DB for the auth adapter
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};