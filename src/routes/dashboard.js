import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

const router = express.Router();

export const initDashboardRouter = (auth) => {

  router.get('/',
    isAuthenticated(auth),
    asyncHandler(async (req, res) => {
      const role = req.user?.role || 'candidate';
      if (role === 'employer') {
        return res.redirect('/employer');
      } else if (role === 'admin') {
        return res.redirect('/admin');
      }
      res.redirect('/candidate');
    })
  );

  return router;
};

export default initDashboardRouter;