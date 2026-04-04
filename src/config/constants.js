export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  JOB_LIST_SIZE: 50
};

export const SESSION = {
  MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  COOKIE_NAME: 'jobhub_session'
};

export const UPLOAD = {
  MAX_RESUME_SIZE: 5 * 1024 * 1024,
  MAX_LOGO_SIZE: 2 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx'],
  ALLOWED_LOGO_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  RESUME_PATH: 'src/public/uploads/resumes/',
  LOGO_PATH: 'src/public/uploads/logos/'
};

export const JOB_TYPE = [
  'Full-time',
  'Part-time',
  'Internship',
  'Contract',
  'Freelance'
];

export const JOB_LOCATION = [
  'Remote',
  'On-site',
  'Hybrid',
  'Flexible'
];

export const JOB_CATEGORY = [
  'Engineering',
  'Design',
  'Marketing',
  'Sales',
  'Finance',
  'HR',
  'Operations',
  'Other'
];

export const EXPERIENCE_LEVEL = [
  'Entry',
  'Mid',
  'Senior',
  'Lead',
  'Executive'
];

export const APPLICATION_STATUS = [
  'pending',
  'shortlisted',
  'rejected',
  'accepted'
];

export const COMPANY_SIZE = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+'
];

export const RATE_LIMIT = {
  SEARCH_WINDOW: 15 * 60 * 1000,
  SEARCH_MAX: 50,
  API_WINDOW: 60 * 1000,
  API_MAX: 100
};

export default {
  PAGINATION,
  SESSION,
  UPLOAD,
  JOB_TYPE,
  JOB_LOCATION,
  JOB_CATEGORY,
  EXPERIENCE_LEVEL,
  APPLICATION_STATUS,
  COMPANY_SIZE,
  RATE_LIMIT
};