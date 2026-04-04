export const testUsers = {
  candidate: {
    id: 'test-candidate-id',
    email: 'candidate@jobhub.test',
    name: 'Test Candidate',
    password: 'TestPass123!',
    role: 'candidate',
    twoFactorEnabled: false
  },
  employer: {
    id: 'test-employer-id',
    email: 'employer@jobhub.test',
    name: 'Test Employer',
    password: 'TestPass123!',
    role: 'employer',
    twoFactorEnabled: false
  },
  admin: {
    id: 'test-admin-id',
    email: 'admin@jobhub.test',
    name: 'Test Admin',
    password: 'TestPass123!',
    role: 'admin',
    twoFactorEnabled: false
  },
  candidateWith2FA: {
    id: 'test-candidate-2fa-id',
    email: 'candidate2fa@jobhub.test',
    name: 'Test Candidate 2FA',
    password: 'TestPass123!',
    role: 'candidate',
    twoFactorEnabled: true
  }
};

export const testCompanies = {
  valid: {
    name: 'Test Company',
    description: 'A test company for unit tests',
    industry: 'Technology',
    size: '11-50',
    headquarters: 'San Francisco',
    website: 'https://testcompany.com'
  },
  pendingVerification: {
    name: 'Pending Company',
    description: 'Company pending verification',
    industry: 'Finance',
    size: '1-10',
    verified: false,
    status: 'pending'
  },
  verified: {
    name: 'Verified Company',
    description: 'Verified company',
    industry: 'Technology',
    size: '51-200',
    verified: true,
    verifiedAt: new Date(),
    status: 'approved'
  }
};

export const testJobs = {
  valid: {
    title: 'Software Engineer',
    description: 'We are looking for a skilled software engineer to join our team. Must have experience with JavaScript, Node.js, and React.',
    requirements: ['3+ years experience', 'Bachelor\'s degree', 'Strong communication skills'],
    skills: ['JavaScript', 'Node.js', 'React', 'MongoDB'],
    location: 'Remote',
    type: 'Full-time',
    category: 'Engineering',
    experienceLevel: 'Mid',
    salary: { min: 80000, max: 120000, currency: 'USD' }
  },
  pending: {
    title: 'Marketing Intern',
    description: 'Looking for a marketing intern to help with social media and content creation.',
    location: 'On-site',
    type: 'Internship',
    status: 'pending'
  },
  approved: {
    title: 'Product Manager',
    description: 'Experienced product manager needed for our growing team.',
    location: 'Hybrid',
    type: 'Full-time',
    status: 'approved',
    isActive: true
  }
};

export const testApplications = {
  pending: {
    status: 'pending',
    coverLetter: 'I am very interested in this position...'
  },
  shortlisted: {
    status: 'shortlisted',
    employerNotes: 'Strong candidate for interview'
  },
  rejected: {
    status: 'rejected',
    employerNotes: 'Not a good fit for current openings'
  },
  accepted: {
    status: 'accepted',
    employerNotes: 'Offer extended and accepted'
  }
};

export const validPasswords = [
  'SecurePass123!',
  'MyP@ssw0rd!',
  'Str0ng#P@ss',
  'V@l1dP@ssw0rd'
];

export const invalidPasswords = [
  'short',
  '12345678',
  'password',
  'alllowercase',
  'ALLUPPERCASE',
  'NoNumbers',
  'NoSpecial!',
  ''
];

export const emailValidation = {
  valid: [
    'test@example.com',
    'user.name@domain.co.uk',
    'user+tag@example.com',
    'user@subdomain.domain.com'
  ],
  invalid: [
    'invalid',
    'test@',
    '@example.com',
    'test@.com',
    '',
    'spaces in@email.com'
  ]
};

export const rateLimitScenarios = {
  signIn: {
    endpoint: '/api/auth/sign-in/email',
    maxRequests: 5,
    windowSeconds: 60
  },
  signUp: {
    endpoint: '/api/auth/sign-up/email',
    maxRequests: 3,
    windowSeconds: 300
  },
  passwordReset: {
    endpoint: '/api/auth/forgot-password',
    maxRequests: 3,
    windowSeconds: 300
  },
  enable2FA: {
    endpoint: '/api/auth/two-factor/enable',
    maxRequests: 3,
    windowSeconds: 60
  },
  verify2FA: {
    endpoint: '/api/auth/two-factor/verify-totp',
    maxRequests: 5,
    windowSeconds: 60
  }
};

export const sessionConfig = {
  expiresIn: 7 * 24 * 60 * 60 * 1000,
  updateAge: 24 * 60 * 60 * 1000,
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60 * 1000
  }
};

export const totpCodes = {
  valid: ['123456', '000000', '999999'],
  invalid: ['12345', '1234567', 'abcdef', 'abc123', '']
};

export const backupCodes = {
  format: /^[A-Z0-9]{8,12}$/,
  length: 10,
  count: 10
};

export const roles = {
  candidate: 'candidate',
  employer: 'employer',
  admin: 'admin'
};

export const permissions = {
  candidate: [
    'browse-jobs',
    'apply-jobs',
    'view-profile',
    'edit-profile',
    'view-applications',
    'view-matches'
  ],
  employer: [
    'browse-candidates',
    'post-jobs',
    'edit-jobs',
    'delete-jobs',
    'view-applications',
    'manage-applications',
    'view-company',
    'edit-company'
  ],
  admin: [
    'approve-jobs',
    'reject-jobs',
    'verify-companies',
    'manage-users',
    'view-analytics',
    'access-admin-dashboard'
  ]
};