# JobHub - Professional Job Portal Platform

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/express-5.2.1-blue)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/mongodb-9.4.1-green)](https://www.mongodb.com/)
[![Better Auth](https://img.shields.io/badge/better--auth-1.5.6-orange)](https://better-auth.com/)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

A comprehensive, production-ready job portal platform built with modern web technologies, featuring secure authentication, real-time notifications, advanced matching algorithms, and comprehensive admin tools.

## 🌟 Features

### Core Functionality
- **Dual User Roles**: Separate interfaces for job candidates and employers
- **Advanced Job Search**: Filter by location, type, category with full-text search
- **Intelligent Matching**: AI-powered candidate-job matching system
- **Application Management**: Complete application lifecycle with status tracking
- **Interview Scheduling**: Automated interview coordination system
- **Real-time Notifications**: WebSocket-powered instant notifications
- **File Upload Support**: Resume and company logo uploads with validation

### Security & Authentication
- **Better Auth Integration**: Secure authentication with email/password
- **Two-Factor Authentication**: TOTP-based 2FA with QR code setup
- **CSRF Protection**: Comprehensive CSRF token validation
- **Security Headers**: Helmet.js security middleware
- **Rate Limiting**: DDoS protection with configurable limits
- **Session Management**: Secure MongoDB-backed sessions

### Admin Features
- **User Management**: Create, edit, and manage all user accounts
- **Content Moderation**: Approve/reject jobs and companies
- **Audit Logging**: Comprehensive admin action tracking
- **Bulk Notifications**: Send system-wide announcements
- **Analytics Dashboard**: User and job statistics

### Developer Experience
- **Modern Stack**: ES6+ JavaScript with async/await
- **Testing Suite**: Vitest for unit and integration tests
- **Code Quality**: ESLint configuration and pre-commit hooks
- **API Documentation**: RESTful API with comprehensive docs
- **Docker Support**: Containerized development environment with Docker Compose and deployment documentation

## 🏗️ Architecture

### Tech Stack

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Better Auth 1.x
- **Validation**: Express Validator
- **Security**: Helmet, CSRF, Rate Limiting
- **Email**: Nodemailer with Gmail SMTP
- **File Upload**: Multer with security validation
- **Templating**: Nunjucks
- **Real-time**: Socket.io
- **Logging**: Winston

#### Frontend
- **CSS Framework**: Tailwind CSS v4
- **Icons**: Heroicons
- **Fonts**: DM Sans, Outfit, JetBrains Mono
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG 2.1 AA compliance

#### Development Tools
- **Testing**: Vitest + Playwright (E2E)
- **Build**: PostCSS for CSS processing
- **Linting**: ESLint
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions (planned)

### Project Structure

```
jobhub/
├── src/
│   ├── config/          # Configuration files
│   │   ├── auth.js      # Better Auth setup
│   │   ├── db.js        # Database connection
│   │   ├── email.js     # Email service
│   │   ├── logger.js    # Winston logger
│   │   └── validateEnv.js # Environment validation
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # Authentication middleware
│   │   ├── errorHandler.js # Error handling
│   │   ├── pagination.js # Pagination logic
│   │   └── validation.js # Input validation
│   ├── models/          # Mongoose models
│   │   ├── User.js      # User model
│   │   ├── Job.js       # Job posting model
│   │   ├── Company.js   # Company profile model
│   │   ├── Application.js # Job application model
│   │   └── Notification.js # Notification model
│   ├── routes/          # Route handlers
│   │   ├── auth.js      # Authentication routes
│   │   ├── jobs.js      # Job CRUD routes
│   │   ├── companies.js # Company management
│   │   ├── applications.js # Application handling
│   │   ├── matches.js   # Candidate matching
│   │   ├── dashboard.js # User dashboards
│   │   ├── notifications.js # Notification routes
│   │   └── admin.js     # Admin panel routes
│   ├── utils/           # Utility functions
│   │   ├── authUtils.js # Auth helpers
│   │   └── helpers.js   # General utilities
│   ├── views/           # Nunjucks templates
│   │   ├── layouts/     # Base layouts
│   │   ├── partials/    # Reusable components
│   │   ├── auth/        # Authentication pages
│   │   ├── jobs/        # Job-related pages
│   │   ├── dashboard/   # Dashboard pages
│   │   └── admin/       # Admin interface
│   ├── public/          # Static assets
│   │   ├── css/         # Stylesheets
│   │   ├── js/          # Client-side scripts
│   │   └── uploads/     # User uploads
│   └── index.js         # Application entry point
├── tests/               # Test suites
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── e2e/             # End-to-end tests
│   └── fixtures/        # Test data
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── package.json         # Dependencies and scripts
├── vitest.config.js     # Test configuration
├── postcss.config.mjs   # CSS build config
└── README.md            # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **MongoDB**: Version 5.0 or higher (local or cloud)
- **Git**: For version control
- **Gmail Account**: For email notifications (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/jobhub.git
   cd jobhub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/jobhub

   # Session Security
   SESSION_SECRET=your-super-secure-session-secret-here

   # Better Auth
   BETTER_AUTH_SECRET=your-better-auth-secret
   BETTER_AUTH_URL=http://localhost:3000

   # Email Configuration (Gmail SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=JobHub <noreply@jobhub.com>

   # Application
   NODE_ENV=development
   PORT=3000
   ```

4. **Database Setup**
   ```bash
   # Ensure MongoDB is running
   mongosh
   use jobhub
   ```

5. **Build Assets**
   ```bash
   npm run build
   ```

6. **Seed Database (Optional)**
   ```bash
   node scripts/seed-jobs.js
   ```

### Running the Application

#### Development Mode
```bash
npm run dev
```
- Starts the server with hot reload
- Serves on http://localhost:3000
- Watches for file changes

#### Production Mode
```bash
npm start
```
- Optimized production build
- Serves on configured PORT

#### Development with CSS Watch
```bash
npm run server
```
- Runs both server and CSS compiler in parallel

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npx playwright test
```

## 📖 Usage Guide

### For Job Candidates

1. **Sign Up**: Create account with email verification
2. **Complete Profile**: Add resume, skills, experience
3. **Browse Jobs**: Use advanced filters to find opportunities
4. **Apply**: Submit applications with cover letters
5. **Track Progress**: Monitor application status and interviews
6. **Receive Notifications**: Get real-time updates via dashboard

### For Employers

1. **Company Setup**: Create company profile with logo
2. **Post Jobs**: Create detailed job postings
3. **Review Applications**: Manage incoming applications
4. **Schedule Interviews**: Coordinate interview process
5. **Find Candidates**: Use matching system to discover talent
6. **Send Notifications**: Communicate with candidates

### For Administrators

1. **User Management**: Create and manage user accounts
2. **Content Moderation**: Approve jobs and companies
3. **System Monitoring**: View audit logs and analytics
4. **Bulk Communications**: Send system notifications
5. **Data Management**: Oversee all platform data

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `SESSION_SECRET` | Session encryption key | Yes | - |
| `BETTER_AUTH_SECRET` | Better Auth encryption key | Yes | - |
| `BETTER_AUTH_URL` | Base URL for auth | Yes | - |
| `SMTP_HOST` | Email SMTP host | No | - |
| `SMTP_PORT` | Email SMTP port | No | 587 |
| `SMTP_USER` | Email username | No | - |
| `SMTP_PASS` | Email password/app key | No | - |
| `NODE_ENV` | Environment mode | No | development |
| `PORT` | Server port | No | 3000 |

### Security Configuration

The application includes several security measures:

- **Helmet.js**: Security headers and CSP
- **CSRF Protection**: Token validation on all forms
- **Rate Limiting**: API and auth endpoint protection
- **Input Sanitization**: XSS prevention
- **File Upload Security**: Type and size validation
- **Session Security**: HttpOnly, Secure, SameSite cookies

## 🧪 Testing Strategy

### Test Coverage

- **Unit Tests**: Individual functions and utilities
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Complete user workflows
- **Security Tests**: Vulnerability scanning

### Running Tests

```bash
# Unit and integration tests
npm test

# E2E tests
npx playwright install
npx playwright test

# Test with coverage
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t jobhub .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   For full deployment and production Docker guidance, see `docs/DEPLOYMENT_GUIDE.md`.

### Manual Deployment

1. **Build assets**
   ```bash
   npm run build
   ```

2. **Set production environment**
   ```bash
   export NODE_ENV=production
   ```

3. **Start the server**
   ```bash
   npm start
   ```

### Environment Setup

- Use PM2 for process management
- Configure reverse proxy (nginx)
- Set up SSL certificates
- Configure log rotation
- Set up monitoring (optional)

## 📊 API Documentation

See `docs/API_DOCUMENTATION.md` for the full API reference, request examples, and response formats.

### Authentication Endpoints

```
POST /api/auth/sign-up/email     # User registration
POST /api/auth/sign-in/email     # User login
POST /api/auth/sign-out          # User logout
POST /api/auth/forget-password   # Password reset request
POST /api/auth/reset-password    # Password reset
POST /api/auth/verify-email      # Email verification
```

### Job Endpoints

```
GET  /api/jobs                   # List jobs with filters
POST /api/jobs                   # Create job (employer)
GET  /api/jobs/:id               # Get job details
PUT  /api/jobs/:id               # Update job (employer)
DELETE /api/jobs/:id             # Delete job (employer)
```

### Application Endpoints

```
POST /api/applications           # Submit application
GET  /api/applications           # List user applications
PUT  /api/applications/:id       # Update application status
```

### Admin Endpoints

```
GET  /api/admin/users            # List all users
POST /api/admin/users            # Create user
PUT  /api/admin/users/:id        # Update user
DELETE /api/admin/users/:id      # Delete user
POST /api/admin/notifications    # Send bulk notifications
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages
- Ensure all tests pass

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Better Auth**: For secure authentication
- **Tailwind CSS**: For utility-first styling
- **MongoDB**: For flexible document database
- **Express.js**: For robust web framework
- **Socket.io**: For real-time features

## 📞 Support

For support, email support@jobhub.com or join our Discord community.

## 🗺️ Roadmap

### Version 2.0
- [ ] Mobile application (React Native)
- [ ] Advanced analytics dashboard
- [ ] Video interview integration
- [ ] AI-powered resume parsing
- [ ] Multi-language support

### Version 1.5
- [ ] Company pages with reviews
- [ ] Advanced search with AI
- [ ] Integration with job boards
- [ ] Referral program
- [ ] Premium employer features

---

**JobHub** - Connecting talent with opportunity, one application at a time.</content>
<parameter name="filePath">e:\workstation\javascript\nodejs\express\jobhub\README.md