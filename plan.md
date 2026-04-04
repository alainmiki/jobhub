# Plan: Email Notifications, Security Hardening & Better-Auth Integration

## Goal
Add email notification support using Gmail SMTP, security features (helmet, input sanitization), and ensure all better-auth routes are properly integrated for signup, signin, password reset, email verification, etc.

## Tasks

### 1. Install Required Packages
- `nodemailer` - Email sending
- `helmet` - Security headers
- `validator` - Input sanitization

### 2. Email Configuration
Create `src/config/email.js`:
- Gmail SMTP transporter setup
- `sendEmail()` helper
- `sendVerificationEmail()` for email verification (called by better-auth)
- `sendPasswordResetEmail()` for password reset (called by better-auth)
- `sendApplicationNotification()` for job application status updates

Environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=16-char-app-password
SMTP_FROM=JobHub <noreply@jobhub.com>
```

### 3. Update Auth Configuration
Update `src/config/auth.js`:
- Enable `emailAndPassword` with:
  - `requireEmailVerification: true` (optional - user can choose)
  - `minPasswordLength: 8`
  - `sendVerificationEmail` callback → uses email config
  - `sendResetPassword` callback → uses email config
  - `onPasswordReset` hook
- Keep `rateLimit` enabled (100 req/10s)
- Keep session security (7 day expiry, cookie cache)

### 4. Add Security Middleware
Update `src/middleware/auth.js`:
- Add `validateInput` middleware using `validator.escape()`
- Add owner/resource ownership checks (`isOwner`)
- Session expiry validation in `isAuthenticated`
- Role validation before resource access

### 5. Update Index.js
Update `index.js`:
- Add helmet middleware (import and use before routes)
- Add input sanitization middleware
- Keep better-auth mounted at `/api/auth/*splat`
- Keep CSRF protection

### 6. Update Views to Use Better-Auth Routes
Update existing views:

**sign-in.njk**:
- Form action: `/api/auth/sign-in/email`
- Add hidden `redirect` field
- Add CSRF token field

**sign-up.njk**:
- Form action: `/api/auth/sign-up/email`
- Add role selector (candidate/employer)
- Add hidden `redirect` field
- Add CSRF token field

**Create new views**:
- `forgot-password.njk` - Form to request password reset → POST `/api/auth/forget-password`
- `reset-password.njk` - Form with new password → POST `/api/auth/reset-password`
- `verify-email.njk` - Handle email verification success/failure

### 7. Update Header Navigation
Update `partials/header.njk`:
- Add "Forgot Password?" link on sign-in page
- Add proper sign-out link → `/api/auth/sign-out`

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/config/email.js` | CREATE - SMTP email service |
| `src/config/auth.js` | MODIFY - Add email callbacks |
| `src/middleware/auth.js` | MODIFY - Add security functions |
| `index.js` | MODIFY - Add helmet, sanitize middleware |
| `src/views/sign-in.njk` | MODIFY - Use better-auth route |
| `src/views/sign-up.njk` | MODIFY - Use better-auth route |
| `src/views/forgot-password.njk` | CREATE |
| `src/views/reset-password.njk` | CREATE |
| `.env` | MODIFY - Add SMTP config |

## Implementation Order
1. Create `src/config/email.js` (email service)
2. Update `src/config/auth.js` (add email callbacks)
3. Update `src/middleware/auth.js` (add security)
4. Update `index.js` (add helmet)
5. Update auth views
6. Test auth flows

## Notes
- Better-auth handles auth routes at `/api/auth/*` automatically
- Forms need CSRF token from `res.locals.csrfToken`
- Gmail requires App Password (not regular password) - 16 characters
- All POST forms should include: `<input type="hidden" name="_gotcha" />` (honeypot)

