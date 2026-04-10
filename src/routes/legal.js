import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

export const initLegalRouter = (auth) => {
  const router = express.Router();

  // Privacy Policy page
  router.get('/privacy', asyncHandler(async (req, res) => {
    logger.info('Privacy Policy page accessed');
    res.render('legal/privacy', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Privacy Policy',
      activeSection: 'privacy'
    });
  }));

  // Terms of Service page
  router.get('/terms', asyncHandler(async (req, res) => {
    logger.info('Terms of Service page accessed');
    res.render('legal/terms', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Terms of Service',
      activeSection: 'terms'
    });
  }));

  // Cookie Policy page
  router.get('/cookies', asyncHandler(async (req, res) => {
    logger.info('Cookie Policy page accessed');
    res.render('legal/cookies', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Cookie Policy',
      activeSection: 'cookies'
    });
  }));

  return router;
};