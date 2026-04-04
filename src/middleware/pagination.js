import { PAGINATION } from '../config/constants.js';

export const paginate = (defaultLimit = PAGINATION.DEFAULT_PAGE_SIZE, maxLimit = PAGINATION.MAX_PAGE_SIZE) => {
  return (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || defaultLimit, maxLimit);
    
    req.pagination = {
      skip: (page - 1) * limit,
      limit,
      page,
      offset: (page - 1) * limit
    };
    
    res.locals.pagination = {
      page,
      limit,
      offset: req.pagination.skip
    };
    
    next();
  };
};

export const getPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

export default paginate;