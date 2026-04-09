import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

export const connectDB = async (retries = 5) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn.connection.db; // Return the underlying DB for the auth adapter
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    if (retries <= 0) {
      logger.error('MongoDB connection failed after retries. Exiting application.');
      process.exit(1);
    }
    logger.warn(`Retrying MongoDB connection (${retries} attempts left)...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return connectDB(retries - 1);
  }
};