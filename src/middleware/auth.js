import { fromNodeHeaders } from "better-auth/node";
import UserProfile from '../models/UserProfile.js';
import validator from 'validator';
import Notification from '../models/Notification.js'; // Import Notification model

export const createAuthMiddleware = (auth) => {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers)
      });

      if (session) {
        req.authSession = session.session;
        req.user = session.user;
        req.userId = session.user.id;

        if (session.user.role) {
          req.user.role = session.user.role;
        }

        // Fetch user profile
        const userProfile = await UserProfile.findOne({ userId: session.user.id });
        if (userProfile) {
          req.userProfile = userProfile;
          if (!req.user.role) {
            req.user.role = userProfile.role;
          }

          // Fetch unread notification count
          const unreadNotificationsCount = await Notification.countDocuments({
            recipient: req.userId,
            isRead: false
          });
          req.user.unreadNotificationsCount = unreadNotificationsCount;
        }
      } else {
        req.authSession = null;
        req.user = null;
        req.userId = null;
        req.userProfile = null;
      }

      next();
    } catch (error) {
      console.error('[Auth Middleware] Error:', error.message);
      req.authSession = null;
      req.user = null;
      req.userId = null;
      req.userProfile = null;
      next();
    }
  };
};

export const isAuthenticated = (auth) => {
  return (req, res, next) => {
    if (!req.user) {
      const redirectTo = encodeURIComponent(req.originalUrl);
      return res.redirect(`/sign-in?redirect=${redirectTo}`);
    }

    if (req.user.isActive === false) {
      req.flash('error', 'Your account has been deactivated. Please contact an administrator.');
      return res.redirect('/deactivated');
    }

    next();
  };
};

export const checkActiveStatus = (req, res, next) => {
  if (req.user && req.user.isActive === false) {
    req.flash('error', 'Your account is currently disabled. Please contact support.');
    return res.redirect('/deactivated');
  }
  next();
};

export const isRole = (auth, ...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      const redirectTo = encodeURIComponent(req.originalUrl);
      return res.redirect(`/sign-in?redirect=${redirectTo}`);
    }
    
    const userRole = req.user.role || 'candidate';
    if (!roles.includes(userRole)) {
      return res.status(403).render('error', {
        message: `Access denied. This page requires ${roles.join(' or ')} role.`,
        title: "403 - Access Denied"
      });
    }
    next();
  };
};

export const isCandidate = (auth) => isRole(auth, 'candidate');
export const isEmployer = (auth) => isRole(auth, 'employer');
export const isAdmin = (auth) => isRole(auth, 'admin');

export const requireProfileComplete = (auth) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.redirect(`/sign-in?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    
    if (req.userProfile && !req.userProfile.isProfileComplete) {
      req.flash('info', 'Please complete at least 70% of your profile to access this feature.');
      return res.redirect('/profile?complete=true');
    }

    if (req.user.isActive === false) {
      req.flash('error', 'Action restricted: Account is inactive.');
      return res.redirect('/deactivated');
    }

    next();
  };
};

export const getUserProfile = async (userId) => {
  return UserProfile.findOne({ userId });
};

export const validateInput = (req, res, next) => {
  const excludedFields = [
    'password', 
    'confirmPassword', 
    'newPassword', 
    'currentPassword', 
    '_csrf',
    'website',
    'linkedin',
    'github',
    'twitter',
    'image',
    'coverImage',
    'resume',
    'bio',
    'headline',
    'coverLetter',
    'description',
    'notes',
    'skills',
    'education',
    'experience'
  ];

  const sanitize = (value) => {
    if (typeof value === 'string') {
      return validator.escape(value.trim());
    }
    return value;
  };

  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string' && !excludedFields.includes(key)) {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }

  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitize(req.query[key]);
      }
    }
  }

  next();
};

export const isOwner = (auth, resourceOwnerField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      const redirectTo = encodeURIComponent(req.originalUrl);
      return res.redirect(`/sign-in?redirect=${redirectTo}`);
    }

    const resourceOwnerId = req.params[resourceOwnerField] || req.body[resourceOwnerField];
    
    if (!resourceOwnerId) {
      return res.status(400).render('error', {
        message: 'Resource owner not specified',
        title: '400 - Bad Request'
      });
    }

    if (req.user.id !== resourceOwnerId && req.user.role !== 'admin') {
      return res.status(403).render('error', {
        message: 'You do not have permission to access this resource',
        title: '403 - Access Denied'
      });
    }

    next();
  };
};