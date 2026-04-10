import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

export const initAuthRouter = (auth) => {
  const router = express.Router();

  // Standard Auth UI Routes
  router.get('/sign-in', (req, res, next) => {
    const redirect = req.query.redirect || '/';
    res.render('sign-in', { redirect, redirectQuery: `redirect=${encodeURIComponent(redirect)}`, csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.post('/sign-in', asyncHandler(async (req, res, next) => {
    const { email, password, redirect = '/' } = req.body;
    try {
      const response = await auth.api.signInEmail({
        body: { email, password },
        headers: req.headers,
        asResponse: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid email or password');
      }

      response.headers.forEach((v, k) => res.append(k, v));
      if (response.response?.twoFactorRedirect) {
        return res.redirect('/2fa');
      }
      else{
        if (redirect && redirect !== '/sign-in' && redirect !== '/sign-up') {
          if(req.user.role === 'employer'){
            return res.redirect('/employer');
          }else if(req.user.role === 'candidate'){
            return res.redirect('/candidate');
          }else if(req.user.role === 'admin'){
            return res.redirect('/admin');
          }else{
            return res.redirect('/candidate');
          }
        }}
        
    } catch (error) {
      return res.render('sign-in', { 
        error: error.message, 
        email, 
        redirect, 
        redirectQuery: `redirect=${encodeURIComponent(redirect)}`,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }
  }));

  router.get('/sign-up', (req, res, next) => {
    const redirect = req.query.redirect || '/';
    res.render('sign-up', { redirect, redirectQuery: `redirect=${encodeURIComponent(redirect)}`, csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.post('/sign-up', asyncHandler(async (req, res, next) => {
    const { name, email, password, role = 'candidate', redirect = '/' } = req.body;
    try {
      const response = await auth.api.signUpEmail({
        body: { name, email, password, role },
        headers: req.headers,
        asResponse: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        const message = errorData.message || errorData.error?.message || 'Registration failed';
        throw new Error(message);
      }

      response.headers.forEach((v, k) => res.append(k, v));
      // Redirect to appropriate dashboard based on role
      const userRole = req.user?.role || role || 'candidate';
      if (userRole === 'employer') {
        return res.redirect('/employer');
      } else if (userRole === 'admin') {
        return res.redirect('/admin');
      }
      return res.redirect('/candidate');
    } catch (error) {
      return res.render('sign-up', { 
        error: error.message, 
        formData: req.body,
        redirect, 
        redirectQuery: `redirect=${encodeURIComponent(redirect)}`,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }
  }));

  router.get('/forgot-password', (req, res, next) => {
    res.render('forgot-password', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.post('/forgot-password', asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    try {
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/reset-password` },
        headers: req.headers
      });
      return res.render('forgot-password', { success: 'If an account exists, a reset link has been sent.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
    } catch (error) {
      return res.render('forgot-password', { error: error.message, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }
  }));

  router.get('/reset-password', (req, res, next) => {
    const token = req.query.token;
    if (!token) {
      return res.redirect('/forgot-password');
    }
    res.render('reset-password', { token, csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.post('/reset-password', asyncHandler(async (req, res, next) => {
    const { password, confirmPassword, token } = req.body;

    if (!token) return res.redirect('/forgot-password');

    if (password !== confirmPassword) {
      return res.render('reset-password', { error: 'Passwords do not match', token, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }

    try {
      const response = await auth.api.resetPassword({
        body: { newPassword: password, token },
        headers: req.headers,
        asResponse: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset password. The link may have expired.');
      }

      response.headers.forEach((v, k) => res.append(k, v));

      return res.render('reset-password', { 
        success: 'Your password has been reset successfully. You can now sign in.', 
        token,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    } catch (error) {
      return res.render('reset-password', { error: error.message, token, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }
  }));

  router.post('/change-password', isAuthenticated(auth), asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    try {
      const response = await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: req.headers,
        asResponse: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      response.headers.forEach((v, k) => res.append(k, v));
      return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }));

  router.get('/logout', asyncHandler(async (req, res, next) => {
    try {
      const response = await auth.api.signOut({
        headers: req.headers,
        asResponse: true
      });
      response.headers.forEach((v, k) => res.append(k, v));
    } catch (error) {
      logger.error('Logout error:', error);
    }
    return res.redirect('/sign-in');
  }));

  router.get('/verify-email', asyncHandler(async (req, res, next) => {
    const { token } = req.query;
    if (!token) return res.render('verify-email', { success: false, csrfToken: req.csrfToken ? req.csrfToken() : '' });

    try {
      const response = await auth.api.verifyEmail({
        query: { token },
        headers: req.headers,
        asResponse: true
      });

      if (response.ok) {
        response.headers.forEach((v, k) => res.append(k, v));
        return res.render('verify-email', { success: true, csrfToken: req.csrfToken ? req.csrfToken() : '' });
      }
      return res.render('verify-email', { success: false, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    } catch (error) {
      logger.error('Email verification error:', error);
      return res.render('verify-email', { success: false, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    }
  }));

  // 2FA Flow UI Routes
  router.get('/2fa', (req, res, next) => {
    if (!req.user) return res.redirect('/sign-in');
    res.render('2fa', { user: req.user, csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.get('/deactivated', (req, res) => {
    res.render('deactivated', { csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  router.get('/enable-2fa', (req, res, next) => {
    if (!req.user) return res.redirect('/sign-in');
    res.render('enable-2fa', { user: req.user, csrfToken: req.csrfToken ? req.csrfToken() : '' });
  });

  // 2FA API Handlers
  router.post('/api/auth/two-factor/verify-totp', asyncHandler(async (req, res, next) => {
    try {
      const { code, trustDevice } = req.body;
      const result = await auth.api.verifyTOTP({
        body: { code, trustDevice: trustDevice === 'on' },
        headers: { cookie: req.headers.cookie }
      });
      
      if (result.response?.twoFactorRedirect) return res.json({ error: '2FA verification failed' });
      res.redirect('/dashboard');
    } catch (error) {
      res.redirect('/2fa?error=Invalid+code');
    }
  }));

  router.post('/api/auth/two-factor/send-otp', asyncHandler(async (req, res, next) => {
    try {
      await auth.api.sendTwoFactorOTP({
        body: { trustDevice: false },
        headers: { cookie: req.headers.cookie }
      });
      res.redirect('/2fa?method=otp');
    } catch (error) {
      res.redirect('/2fa?error=Failed+to+send+code');
    }
  }));

  router.post('/api/auth/two-factor/verify-otp', asyncHandler(async (req, res, next) => {
    try {
      const { code, trustDevice } = req.body;
      const result = await auth.api.verifyTwoFactorOTP({
        body: { code, trustDevice: trustDevice === 'on' },
        headers: { cookie: req.headers.cookie }
      });
      
      if (result.response?.twoFactorRedirect) return res.json({ error: '2FA verification failed' });
      res.redirect('/dashboard');
    } catch (error) {
      res.redirect('/2fa?error=Invalid+code');
    }
  }));

  router.post('/api/auth/two-factor/verify-backup-code', asyncHandler(async (req, res, next) => {
    try {
      const { code } = req.body;
      const result = await auth.api.verifyBackupCode({
        body: { code, disableSession: false, trustDevice: false },
        headers: { cookie: req.headers.cookie }
      });
      
      if (result.response?.twoFactorRedirect) return res.json({ error: 'Invalid backup code' });
      res.redirect('/dashboard');
    } catch (error) {
      res.redirect('/2fa?method=backup&error=Invalid+backup+code');
    }
  }));

  router.post('/enable-2fa', asyncHandler(async (req, res, next) => {
    try {
      const { step, password, code } = req.body;
      if (!req.user?.id) return res.redirect('/sign-in');
      
      if (step === 'verify') {
        const result = await auth.api.signInEmail({
          body: { email: req.user.email, password },
          headers: { cookie: req.headers.cookie }
        });
        
        if (result.response?.twoFactorRedirect !== true) {
          const totpResult = await auth.api.enableTwoFactor({
            body: { password, issuer: 'JobHub' },
            headers: { cookie: req.headers.cookie }
          });
          
          return res.render('enable-2fa', { 
            step: 'setup', 
            user: req.user,
            secret: totpResult.response?.secret,
            totpUri: totpResult.response?.totpURI,
            csrfToken: req.csrfToken ? req.csrfToken() : ''
          });
        }
      }
      
      if (step === 'verify-code') {
        const verifyResult = await auth.api.verifyTOTP({
          body: { code },
          headers: { cookie: req.headers.cookie }
        });
        
        if (!verifyResult.response?.twoFactorRedirect) {
          const backupResult = await auth.api.generateBackupCodes({
            body: { password },
            headers: { cookie: req.headers.cookie }
          });
          
          return res.render('enable-2fa', { 
            step: 'backup-codes', 
            user: req.user,
            backupCodes: backupResult.response?.backupCodes,
            csrfToken: req.csrfToken ? req.csrfToken() : ''
          });
        }
      }
      
      res.redirect('/enable-2fa?error=Verification+failed');
    } catch (error) {
      logger.error('Enable 2FA error:', error);
      res.redirect('/enable-2fa?error=' + encodeURIComponent(error.message));
    }
  }));

  return router;
};

export default initAuthRouter;