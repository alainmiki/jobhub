# Better-Auth Integration Guide

A comprehensive guide for integrating Better-Auth into an Express.js application with MongoDB, covering client-side and server-side implementation, security best practices, and performance optimization.

## Table of Contents

1. [Overview](#overview)
2. [Server-Side Setup](#server-side-setup)
3. [Client-Side Integration](#client-side-integration)
4. [Authentication Flows](#authentication-flows)
5. [Security Best Practices](#security-best-practices)
6. [Performance Optimization](#performance-optimization)
7. [Deployment Recommendations](#deployment-recommendations)

---

## Overview

Better-Auth is a comprehensive authentication framework for TypeScript that provides:
- Email/password authentication
- OAuth (Google, GitHub, etc.)
- Session management with cookie-based auth
- Rate limiting built-in
- Email verification
- Password reset functionality
- Account linking

This guide covers integrating Better-Auth with Express.js and MongoDB.

---

## Server-Side Setup

### 1. Installation

```bash
npm install better-auth @better-auth/mongo-adapter
```

### 2. Basic Auth Configuration

```typescript
// src/config/auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

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
    
    // Email & Password Configuration
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      autoSignIn: true,
      sendResetPassword: async ({ user, url, token }, request) => {
        // Implement password reset email
        await sendPasswordResetEmail({ user, url, token });
      },
      onPasswordReset: async ({ user }, request) => {
        logger.info(`Password reset completed for user: ${user.email}`);
      }
    },
    
    // Email Verification (Optional)
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }, request) => {
        await sendVerificationEmail({ user, url, token });
      }
    },
    
    // Session Configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7,      // 7 days
      updateAge: 60 * 60 * 24,           // Update every 1 day
      cookieCache: {
        enabled: true,
        maxAge: 300,                      // 5 minutes cache
        strategy: "compact"               // Options: compact, jwt, jwe
      }
    },
    
    // Rate Limiting (Built-in)
    rateLimit: {
      enabled: true,
      window: 10,                         // 10 seconds
      max: 100                           // 100 requests per window
    },
    
    // Additional User Fields
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "candidate",
          inputable: true
        },
        image: {
          type: "string", 
          required: false,
          defaultValue: null,
          inputable: true
        }
      }
    },
    
    // Security Settings
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      disableOriginCheck: false
    },
    
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || "http://localhost:3000"
    ],
    
    secret: process.env.BETTER_AUTH_SECRET
  });
};
```

### 3. Express Server Integration

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { initAuth } from './config/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - MUST be before Better-Auth handler
app.use(cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Initialize Auth
const auth = await initAuth(mongoDb);

// Mount Better-Auth handler - catch-all route
app.all("/api/auth/*", toNodeHandler(auth));

// NOW add express.json() AFTER Better-Auth handler
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 4. Session Validation Middleware

```typescript
// src/middleware/auth.ts
import { fromNodeHeaders } from "better-auth/node";

export const createAuthMiddleware = (auth) => {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers)
      });

      if (session) {
        req.session = session.session;
        req.user = session.user;
        req.userId = session.user.id;
      } else {
        req.session = null;
        req.user = null;
        req.userId = null;
      }
      
      next();
    } catch (error) {
      console.error('[Auth Middleware] Error:', error.message);
      req.session = null;
      req.user = null;
      req.userId = null;
      next();
    }
  };
};

export const isAuthenticated = (auth) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };
};
```

### 5. Protected Route Example

```typescript
// src/routes/protected.ts
import { isAuthenticated } from '../middleware/auth.js';

router.get('/api/profile', isAuthenticated(auth), async (req, res) => {
  // req.user contains the authenticated user
  const userProfile = await UserProfile.findOne({ userId: req.user.id });
  res.json({ user: req.user, profile: userProfile });
});
```

### 6. Server-Side API Calls

```typescript
// Sign up from server
const user = await auth.api.signUpEmail({
  body: {
    name: "John Doe",
    email: "john@example.com",
    password: "securePassword123"
  }
});

// Sign in from server
const session = await auth.api.signInEmail({
  body: {
    email: "john@example.com",
    password: "securePassword123"
  },
  headers: await headers()
});

// Get current session from server
const session = await auth.api.getSession({
  headers: fromNodeHeaders(req.headers)
});

// Sign out from server
await auth.api.signOut({
  headers: await headers()
});

// Change password from server
await auth.api.changePassword({
  body: {
    newPassword: "newPassword123",
    currentPassword: "oldPassword123",
    revokeOtherSessions: true
  },
  headers: await headers()
});

// Request password reset
await auth.api.requestPasswordReset({
  body: {
    email: "user@example.com",
    redirectTo: "https://yoursite.com/reset-password"
  }
});
```

---

## Client-Side Integration

### 1. Client Setup

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000"
});
```

### 2. Sign Up

```typescript
import { authClient } from "@/lib/auth-client";

const signUp = async (name: string, email: string, password: string) => {
  const { data, error } = await authClient.signUp.email({
    name,
    email,
    password,
    callbackURL: "/dashboard"
  });

  if (error) {
    console.error('Sign up failed:', error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
```

### 3. Sign In

```typescript
import { authClient } from "@/lib/auth-client";

const signIn = async (email: string, password: string) => {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
    rememberMe: true,  // Keep session after browser close
    callbackURL: "/dashboard"
  });

  if (error) {
    console.error('Sign in failed:', error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
```

### 4. Sign Out

```typescript
import { authClient } from "@/lib/auth-client";

const signOut = async () => {
  const { data, error } = await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/sign-in";
      }
    }
  });
};
```

### 5. Get Current Session (React Example)

```typescript
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";

export const useSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await authClient.getSession();
      setSession(data);
      setLoading(false);
    };

    checkSession();
  }, []);

  return { session, loading };
};
```

### 6. Reactive Session Hook (React)

```typescript
import { authClient } from "@/lib/auth-client";

const { data: session } = authClient.useSession();

// Access session.user and session.session directly
// Automatically updates when session changes
```

### 7. Request Password Reset

```typescript
import { authClient } from "@/lib/auth-client";

const requestPasswordReset = async (email: string) => {
  const { data, error } = await authClient.requestPasswordReset({
    email,
    redirectTo: "/reset-password"
  });
};
```

### 8. Reset Password

```typescript
import { authClient } from "@/lib/auth-client";

const resetPassword = async (newPassword: string, token: string) => {
  const { data, error } = await authClient.resetPassword({
    newPassword,
    token  // From URL query param
  });
};
```

### 9. Change Password (Authenticated)

```typescript
import { authClient } from "@/lib/auth-client";

const changePassword = async (currentPassword: string, newPassword: string) => {
  const { data, error } = await authClient.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true  // Invalidate other sessions
  });
};
```

### 10. Update User Profile

```typescript
import { authClient } from "@/lib/auth-client";

const updateProfile = async (updates: { name?: string; image?: string }) => {
  const { data, error } = await authClient.updateUser(updates);
};
```

---

## Authentication Flows

### 1. Email/Password Sign Up Flow

```
Client                          Server
  |                               |
  |--- POST /api/auth/sign-up ---|
  |     (email, password, name)   |
  |                               |
  |<-- 200 OK + session cookie --|
  |     (user, session)           |
  |                               |
  |--- GET /api/auth/get-session-|
  |     (cookie)                 |
  |                               |
  |<-- 200 OK + user data -------|
```

### 2. Email Verification Flow

```typescript
// Server config
export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      // Send email with verification link
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<a href="${url}">Verify Email</a>`
      });
    }
  },
  emailAndPassword: {
    requireEmailVerification: true
  }
});

// Client - Send verification email
await authClient.sendVerificationEmail({
  email: "user@example.com",
  callbackURL: "/dashboard"
});
```

### 3. Password Reset Flow

```
Client                          Server
  |                               |
  |--- POST /api/auth/request ---|
  |     (password-reset)          |
  |     (email)                  |
  |                               |
  |<-- 200 OK -------------------|
  |     (sends reset email)      |
  |                               |
  |-- GET /reset-password?token -|
  |     (user clicks link)        |
  |                               |
  |--- POST /api/auth/reset -----|
  |     (newPassword, token)     |
  |                               |
  |<-- 200 OK -------------------|
```

---

## Security Best Practices

### 1. CSRF Protection

Better-Auth handles CSRF internally via its cookie-based sessions. However, for additional protection with your own forms:

```typescript
// Use csrf middleware for custom forms
import csrf from 'csurf';

app.use(csrf());

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

### 2. Rate Limiting

Better-Auth has built-in rate limiting. Configure it in your auth config:

```typescript
export const auth = betterAuth({
  rateLimit: {
    enabled: true,
    window: 60,          // 60 seconds
    max: 10              // 10 requests per window for auth endpoints
  }
});
```

For custom endpoints, use express-rate-limit:

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // limit each IP to 100 requests per windowMs
  message: "Too many requests"
});

app.use('/api/', authLimiter);
```

### 3. Session Security

```typescript
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7 days
    updateAge: 60 * 60 * 24,       // Update daily
    freshAge: 60 * 60,             // Session fresh for 1 hour
    cookieCache: {
      enabled: true,
      maxAge: 300,
      strategy: "jwe"              // Encrypted tokens
    }
  },
  advanced: {
    useSecureCookies: true,        // HTTPS-only cookies in prod
    disableOriginCheck: false       // Verify Origin header
  }
});
```

### 4. Password Security

Better-Auth uses scrypt by default. For enhanced security with Argon2:

```typescript
import { hash, verify } from "@node-rs/argon2";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => {
        return await hash(password, {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4
        });
      },
      verify: async ({ password, hash }) => {
        return await verify(hash, password);
      }
    }
  }
});
```

### 5. Input Validation

Always validate user input server-side:

```typescript
import { body, validationResult } from 'express-validator';

router.post('/api/custom', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process request
});
```

### 6. Token Encryption

For encrypting OAuth tokens in the database:

```typescript
export const auth = betterAuth({
  databaseHooks: {
    account: {
      create: {
        before(account, context) {
          const withEncryptedTokens = { ...account };
          if (account.accessToken) {
            withEncryptedTokens.accessToken = encrypt(account.accessToken);
          }
          return { data: withEncryptedTokens };
        }
      }
    }
  }
});
```

---

## Performance Optimization

### 1. Cookie Caching

Enable cookie caching to reduce database calls:

```typescript
export const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300,           // 5 minutes
      strategy: "compact"   // smallest, fastest
    }
  }
});
```

### 2. Stateless Sessions (No Database)

For high-traffic applications without a database:

```typescript
export const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,  // 7 days
      strategy: "jwe",
      refreshCache: true
    }
  },
  account: {
    storeStateStrategy: "cookie",
    storeAccountCookie: true
  }
});
```

### 3. Secondary Storage (Redis)

```typescript
import { redis } from "./redis";

export const auth = betterAuth({
  secondaryStorage: {
    get: async (key) => await redis.get(key),
    set: async (key, value, ttl) => await redis.set(key, value, "EX", ttl),
    delete: async (key) => await redis.del(key)
  },
  session: {
    cookieCache: {
      maxAge: 300,
      refreshCache: false
    }
  }
});
```

### 4. Defer Session Refresh

For read-replica databases:

```typescript
export const auth = betterAuth({
  session: {
    deferSessionRefresh: true
  }
});
```

### 5. Disable Session Refresh

For maximum performance when freshness isn't critical:

```typescript
export const auth = betterAuth({
  session: {
    disableSessionRefresh: true
  }
});
```

---

## Deployment Recommendations

### 1. Environment Variables

```env
# .env
NODE_ENV=production
PORT=3000
BETTER_AUTH_SECRET=your-256-bit-secret-key
BETTER_AUTH_URL=https://yourdomain.com
DATABASE_URL=mongodb://localhost:27017/jobhub
SESSION_SECRET=your-session-secret
REQUIRE_EMAIL_VERIFICATION=false
DISABLE_SIGN_UP=false
```

### 2. Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS with valid SSL certificates
- [ ] Configure `useSecureCookies: true`
- [ ] Set `trustedOrigins` to your production domain
- [ ] Use strong `BETTER_AUTH_SECRET` (256-bit)
- [ ] Enable rate limiting
- [ ] Configure email sending for verification/reset
- [ ] Set appropriate session expiration times
- [ ] Use cookie caching for performance
- [ ] Implement secondary storage (Redis) for scale

### 3. Cookie Configuration

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));
```

### 4. Health Check Endpoint

```typescript
app.get('/api/auth/ok', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## Common Issues & Solutions

### Issue: Session not persisting

**Solution**: Check cookie settings - `secure` must be true in production, `sameSite` should be 'strict'.

### Issue: CORS errors

**Solution**: Ensure `trustedOrigins` includes your frontend URL and CORS is configured before Better-Auth handler.

### Issue: Rate limit errors

**Solution**: Adjust rate limit configuration or implement custom rate limiting for high-traffic endpoints.

### Issue: Email not sending

**Solution**: Verify email service configuration and check spam folders. Use logging to debug.

### Issue: Password reset token expired

**Solution**: Default tokens expire in 1 hour. Increase `resetPasswordTokenExpiresIn` if needed.

---

## Reference: API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-up/email` | Register with email/password |
| POST | `/api/auth/sign-in/email` | Sign in with email/password |
| POST | `/api/auth/sign-out` | Sign out |
| GET | `/api/auth/get-session` | Get current session |
| POST | `/api/auth/request-password-reset` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/verify-email` | Verify email |
| POST | `/api/auth/send-verification-email` | Send verification email |
| POST | `/api/auth/link-social` | Link OAuth account |
| POST | `/api/auth/unlink-account` | Unlink account |
| POST | `/api/auth/two-factor/enable` | Enable 2FA |
| POST | `/api/auth/two-factor/disable` | Disable 2FA |
| POST | `/api/auth/two-factor/verify-totp` | Verify TOTP code |
| POST | `/api/auth/two-factor/verify-otp` | Verify OTP code |
| POST | `/api/auth/two-factor/verify-backup-code` | Verify backup code |
| POST | `/api/auth/two-factor/send-otp` | Send OTP to email |
| POST | `/api/auth/two-factor/get-totp-uri` | Get TOTP URI for QR code |
| POST | `/api/auth/two-factor/generate-backup-codes` | Generate backup codes |
| POST | `/api/auth/two-factor/view-backup-codes` | View backup codes |

---

## Two-Factor Authentication (2FA)

### Server Configuration

```typescript
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "JobHub",
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
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 3 },
      "/two-factor/enable": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-otp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 }
    }
  }
});
```

### Client Configuration

```typescript
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      }
    })
  ],
  fetchOptions: {
    onError: async (context) => {
      const { response } = context;
      if (response.status === 429) {
        const retryAfter = response.headers.get("X-Retry-After");
        throw new Error(`Too many requests. Please wait ${retryAfter} seconds.`);
      }
    }
  }
});
```

### 2FA Enable Flow

1. User visits `/enable-2fa` page
2. User enters password for verification
3. Server generates TOTP secret and returns QR code
4. User scans QR code with authenticator app
5. User enters verification code
6. Server generates 10 backup codes
7. User confirms backup codes saved
8. 2FA enabled successfully

### 2FA Verification Flow

1. User signs in with email/password
2. If 2FA enabled, response includes `twoFactorRedirect: true`
3. User redirected to `/2fa` page
4. User chooses verification method (TOTP, OTP, or backup code)
5. User enters code
6. Server verifies code and creates session

---

## Rate Limiting (Better-Auth Native)

All rate limiting is now handled exclusively by Better-Auth. Custom express-rate-limit has been removed.

### Configuration

```typescript
rateLimit: {
  enabled: true,
  window: 60,           // 60 seconds
  max: 100,             // 100 requests per window
  storage: "database",  // Database-backed storage
  customRules: {
    "/sign-in/email": { window: 60, max: 5 },
    "/sign-up/email": { window: 300, max: 3 },
    "/forgot-password": { window: 300, max: 3 },
    "/reset-password": { window: 300, max: 5 },
    "/two-factor/enable": { window: 60, max: 3 },
    "/two-factor/verify-totp": { window: 60, max: 5 },
    "/two-factor/verify-otp": { window: 60, max: 5 },
    "/two-factor/verify-backup-code": { window: 60, max: 10 }
  }
}
```

### IP Address Detection

```typescript
advanced: {
  ipAddress: {
    ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip", "x-real-ip"]
  }
}
```

### Handling Rate Limit Errors

When a request exceeds the rate limit, Better-Auth returns:
- HTTP Status: 429
- Header: `X-Retry-After` (seconds until retry)

---

## Security Fixes Applied

### 1. Role Assignment (Critical)
```typescript
role: {
  type: "string",
  required: false,
  defaultValue: "candidate",
  inputable: false  // FIXED: Was true
}
```

### 2. NoSQL Injection Prevention
```javascript
const sanitizeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[$^|(){}*+\\]/g, '\\$&');
};
```

### 3. Removed Custom Rate Limiting
- Removed express-rate-limit dependency
- All rate limiting handled by Better-Auth
- Database-backed rate limit storage

---

## Additional Resources

- [Better-Auth Documentation](https://www.better-auth.com/docs)
- [Email & Password Guide](https://www.better-auth.com/docs/authentication/email-password)
- [Session Management](https://www.better-auth.com/docs/concepts/session-management)
- [Security Reference](https://www.better-auth.com/docs/reference/security)
- [Rate Limiting](https://www.better-auth.com/docs/concepts/rate-limit)
