import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const requiredEnvVars = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'BETTER_AUTH_SECRET'
];

const optionalEnvVars = [
  'PORT',
  'NODE_ENV',
  'BETTER_AUTH_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'LOG_LEVEL'
];

export const validateEnv = () => {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  
  logger.info('Environment variables validated');
  return true;
};

export const getEnv = (key, defaultValue = null) => {
  return process.env[key] || defaultValue;
};

export const isProduction = () => process.env.NODE_ENV === 'production';

export const isDevelopment = () => process.env.NODE_ENV === 'development';

export default { validateEnv, getEnv, isProduction, isDevelopment };