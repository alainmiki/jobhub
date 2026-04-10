import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

export const initHelpRouter = (auth) => {
  const router = express.Router();

  // Main help center page
  router.get('/', asyncHandler(async (req, res) => {
    logger.info('Help center accessed');
    res.render('help/index', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Help Center',
      activeSection: 'help-center'
    });
  }));

  // How It Works page
  router.get('/how-it-works', asyncHandler(async (req, res) => {
    logger.info('How It Works page accessed');
    res.render('help/how-it-works', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'How It Works',
      activeSection: 'how-it-works'
    });
  }));

  // Resume Tips page
  router.get('/resume-tips', asyncHandler(async (req, res) => {
    logger.info('Resume Tips page accessed');
    res.render('help/resume-tips', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Resume Tips',
      activeSection: 'resume-tips'
    });
  }));

  // Interview Preparation page
  router.get('/interview-prep', asyncHandler(async (req, res) => {
    logger.info('Interview Preparation page accessed');
    res.render('help/interview-prep', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Interview Preparation',
      activeSection: 'interview-prep'
    });
  }));

  // Salary Guide page
  router.get('/salary-guide', asyncHandler(async (req, res) => {
    logger.info('Salary Guide page accessed');
    res.render('help/salary-guide', {
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      title: 'Salary Guide',
      activeSection: 'salary-guide'
    });
  }));

  return router;
};