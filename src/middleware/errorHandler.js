import logger from '../config/logger.js';

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);

  const status = err.statusCode || err.status || 500;

  // Provide user-friendly error messages based on error type
  let userMessage = 'An unexpected error occurred. Please try again.';

  if (status === 400) {
    userMessage = 'Invalid request. Please check your input and try again.';
  } else if (status === 401) {
    userMessage = 'You need to sign in to access this page.';
  } else if (status === 403) {
    userMessage = 'You don\'t have permission to access this page.';
  } else if (status === 404) {
    userMessage = 'The page you\'re looking for doesn\'t exist.';
  } else if (status === 413) {
    userMessage = 'The file you uploaded is too large.';
  } else if (status === 429) {
    userMessage = 'Too many requests. Please wait a moment and try again.';
  } else if (status === 500) {
    userMessage = 'Server error. Our team has been notified and is working to fix this.';
  }

  // Log additional details for debugging
  if (status >= 500) {
    logger.error('Server Error:', {
      url: req.url,
      method: req.method,
      userId: req.userId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      error: err.message,
      stack: err.stack
    });
  }

  if (req.headers.accept?.includes('json') || req.xhr || req.path.startsWith('/api')) {
    return res.status(status).json({
      error: userMessage,
      ...(process.env.NODE_ENV !== 'production' && { details: err.message })
    });
  }

  res.status(status).render('error', {
    message: userMessage,
    status,
    ...(process.env.NODE_ENV !== 'production' && { details: err.message })
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
};

export default asyncHandler;