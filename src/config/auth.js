import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { twoFactor } from "better-auth/plugins";
import { createAuthMiddleware } from "../middleware/auth.js";
import UserProfile from "../models/UserProfile.js";
import { sendVerificationEmail, sendPasswordResetEmail, initEmailService } from "./email.js";
import logger from "./logger.js";

initEmailService();

const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
const disableSignUp = process.env.DISABLE_SIGN_UP === 'true';

export const initAuth = async (db) => {
  return betterAuth({
    database: mongodbAdapter(db, {
      models: {
        user: "user",
        session: "session",
        account: "account",
        verification: "verification"
      }
    }),
    appName: "JobHub",
    emailAndPassword: {
      enabled: true,
      disableSignUp: disableSignUp,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: requireEmailVerification,
      autoSignIn: true,
      sendResetPassword: async ({ user, url, token }, request) => {
        await sendPasswordResetEmail({ user, url, token });
      },
      onPasswordReset: async ({ user }, request) => {
        logger.info(`Password reset completed for user: ${user.email}`);
      }
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }, request) => {
        await sendVerificationEmail({ user, url, token });
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 300
      }
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      customRules: {
        "/sign-in/email": {
          window: 60,
          max: 5
        },
        "/sign-up/email": {
          window: 300,
          max: 3
        },
        "/forgot-password": {
          window: 300,
          max: 3
        },
        "/reset-password": {
          window: 300,
          max: 5
        },
        "/two-factor/enable": {
          window: 60,
          max: 3
        },
        "/two-factor/verify-totp": {
          window: 60,
          max: 5
        },
        "/two-factor/verify-otp": {
          window: 60,
          max: 5
        },
        "/two-factor/verify-backup-code": {
          window: 60,
          max: 10
        }
      }
    },
    user: {
      modelName: "user",
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "candidate",
          inputable: false
        },
        image: {
          type: "string",
          required: false,
          defaultValue: null,
          inputable: true
        },
        coverImage: {
          type: "string",
          required: false,
          defaultValue: null,
          inputable: true
        },
        twoFactorEnabled: {
          type: "boolean",
          required: false,
          defaultValue: false,
          inputable: false
        }
      }
    },
    plugins: [
      twoFactor({
        issuer: "JobHub",
        allowPasswordless: false,
        backupCodes: {
          length: 10,
          amount: 10
        }
      })
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            logger.info(`User created: ${user.email} ID: ${user.id}`);
            
            const role = user.role || 'candidate';
            
            const profile = new UserProfile({
              userId: user.id,
              role: role,
              skills: [],
              education: [],
              experience: [],
              isProfileComplete: role === 'candidate' || role === 'employer' ? false : true
            });
            
            await profile.save();
            logger.info(`UserProfile created for: ${user.email} with role: ${role}`);
          }
        }
      }
    },
    advanced: {
      disableOriginCheck: false,
      useSecureCookies: process.env.NODE_ENV === "production",
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip", "x-real-ip"]
      }
    },
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
      "http://localhost:3000"
    ],
    secret: process.env.BETTER_AUTH_SECRET
  });
};

export { createAuthMiddleware };
