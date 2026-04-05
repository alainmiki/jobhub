import { body, param, query, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessage = errors.array()[0].msg;
    if (req.headers.accept?.includes('json') || req.xhr) {
      return res.status(400).json({ error: errorMessage });
    }
    req.flash('error', errorMessage);
    return res.redirect(req.get('Referrer') || '/'); 
  }
  next();
};

export const jobValidators = {
  create: [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').trim().isLength({ min: 50, max: 5000 }).withMessage('Description must be 50-5000 characters'),
    body('location').isIn(['Remote', 'On-site', 'Hybrid', 'Flexible']).withMessage('Invalid location'),
    body('type').isIn(['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance']).withMessage('Invalid job type'),
    body('category').optional().isIn(['Engineering', 'Design', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Other']),
    body('experienceLevel').optional().isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive']),
    body('skills').optional().isArray({ max: 20 }).withMessage('Maximum 20 skills allowed'),
    body('salary.min').optional().isInt({ min: 0 }).withMessage('Minimum salary must be positive'),
    body('salary.max').optional().isInt({ min: 0 }).withMessage('Maximum salary must be positive')
  ],
  update: [
    param('id').isMongoId().withMessage('Invalid job ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').optional().trim().isLength({ min: 50, max: 5000 }).withMessage('Description must be 50-5000 characters'),
    body('location').optional().isIn(['Remote', 'On-site', 'Hybrid', 'Flexible']).withMessage('Invalid location'),
    body('type').optional().isIn(['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance']).withMessage('Invalid job type'),
    body('salary.min').optional().isInt({ min: 0 }).withMessage('Minimum salary must be positive'),
    body('salary.max').optional().isInt({ min: 0 }).withMessage('Maximum salary must be positive')
  ]
};

export const applicationValidators = {
  create: [
    body('jobId').isMongoId().withMessage('Invalid job ID'),
    body('coverLetter').optional().isLength({ max: 5000 }).withMessage('Cover letter must be under 5000 characters')
  ],
  updateStatus: [
    param('id').isMongoId().withMessage('Invalid application ID'),
    body('status').isIn(['pending', 'shortlisted', 'rejected', 'accepted']).withMessage('Invalid status'),
    body('notes').optional().isLength({ max: 2000 }).withMessage('Notes must be under 2000 characters')
  ]
};

export const companyValidators = {
  create: [
    body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
    body('description').optional().isLength({ max: 5000 }),
    body('industry').optional().isLength({ max: 100 }),
    body('size').optional().isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
    body('website').optional({ checkFalsy: true }).trim().isURL({ 
      require_protocol: false, 
      require_tld: false, 
      allow_underscores: true 
    }).withMessage('Invalid website URL'),
    body('headquarters').optional().trim().isLength({ max: 100 })
  ],
  update: [
    param('id').isMongoId().withMessage('Invalid company ID'),
    body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),
    body('description').optional().isLength({ max: 5000 }),
    body('website').optional({ checkFalsy: true }).trim().isURL({ 
      require_protocol: false, 
      require_tld: false, 
      allow_underscores: true 
    }).withMessage('Invalid website URL')
  ]
};

export const profileValidators = {
  update: [
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
    body('skills').optional().isArray({ max: 50 }).withMessage('Maximum 50 skills allowed'),
    body('location').optional().trim().isLength({ max: 200 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('website').optional({ checkFalsy: true }).trim().isURL({ 
      require_protocol: false, 
      require_tld: false, 
      allow_underscores: true 
    }).withMessage('Invalid website URL'),
    body('linkedin').optional({ checkFalsy: true }).trim().isURL({ 
      require_protocol: false, 
      require_tld: false, 
      allow_underscores: true 
    }).withMessage('Invalid LinkedIn URL'),
    body('education').optional().isArray({ max: 10 }),
    body('experience').optional().isArray({ max: 10 })
  ]
};

export const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
];

export const idParamValidator = [
  param('id').isMongoId().withMessage('Invalid ID'),
  validate
];

export default { validate, jobValidators, applicationValidators, companyValidators, profileValidators, paginationValidators };