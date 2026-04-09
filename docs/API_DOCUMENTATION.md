# JobHub API Documentation

This document describes the main REST API endpoints for JobHub. All endpoints are JSON-based unless otherwise noted.

## Authentication

### `POST /api/auth/sign-up/email`
Register a new user.

Request body:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Alex Candidate"
}
```

### `POST /api/auth/sign-in/email`
Authenticate an existing user.

Request body:
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

### `POST /api/auth/sign-out`
Log out the current user.

### `POST /api/auth/forget-password`
Request a password reset email.

### `POST /api/auth/reset-password`
Reset the password using a token sent to email.

### `POST /api/auth/verify-email`
Verify a new user email address.

## Jobs

### `GET /api/jobs`
List approved jobs with optional filters.

Query parameters:
- `q` — text search
- `type` — job type
- `location` — job location
- `category` — job category
- `page` — page number
- `limit` — page size

### `POST /api/jobs`
Create a new job posting (employers only).

Required body fields:
- `title`
- `description`
- `location`
- `type`
- `category`
- `companyId`

### `GET /api/jobs/:id`
Get a single job by ID.

### `PUT /api/jobs/:id`
Update a job posting.

### `DELETE /api/jobs/:id`
Delete a job posting.

## Applications

### `POST /api/applications`
Submit a job application.

Body fields:
- `jobId`
- `coverLetter`
- `resume`

### `GET /api/applications`
List applications for the current user.

### `PUT /api/applications/:id`
Update application status or feedback.

## Companies

### `GET /api/company`
List companies or view company details.

### `POST /api/company`
Create a company profile (employers only).

### `PUT /api/company/:id`
Update company profile.

## Admin

### `GET /api/admin/users`
List all users.

### `POST /api/admin/users`
Create a new user.

### `PUT /api/admin/users/:id`
Update a user.

### `DELETE /api/admin/users/:id`
Delete a user.

### `POST /api/admin/notifications`
Send a bulk notification.

## Notifications

### `GET /api/notifications`
List notifications for the current user.

### `POST /api/notifications/mark-read`
Mark notifications as read.

## Headers

Use the following headers when needed:
- `Content-Type: application/json`
- `X-CSRF-Token: <token>` for protected forms and API routes

## Response Format

Successful responses typically return:
```json
{
  "success": true,
  "data": { ... }
}
```
Error responses typically return:
```json
{
  "success": false,
  "error": "Message"
}
```
