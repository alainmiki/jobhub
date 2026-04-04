export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message);
  
  const status = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred' 
    : err.message;
  
  if (req.headers.accept?.includes('json') || req.xhr || req.path.startsWith('/api')) {
    return res.status(status).json({ error: message });
  }
  
  res.status(status).render('error', { message });
};

export const notFoundHandler = (req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
};

export default asyncHandler;