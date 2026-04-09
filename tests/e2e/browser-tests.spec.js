import { test, expect } from '@playwright/test';

test.describe('JobHub Application Tests', () => {
  const baseURL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for navigation
    test.setTimeout(60000);
  });

  test('Application loads successfully', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page).toHaveTitle(/JobHub/);
    await expect(page.locator('text=JobHub')).toBeVisible();
  });

  test('Admin login and dashboard access', async ({ page }) => {
    await page.goto(`${baseURL}/sign-in`);

    // Fill login form (adjust selectors based on actual form)
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'adminpass');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard/**');
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
  });

  test('Admin user creation workflow', async ({ page }) => {
    // Login as admin first
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'adminpass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to user creation
    await page.goto(`${baseURL}/admin/users/create`);
    await expect(page.locator('text=Create New User')).toBeVisible();

    // Fill user creation form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.selectOption('select[name="role"]', 'candidate');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect back to users list
    await page.waitForURL('**/admin/users**');
    await expect(page.locator('text=Test User')).toBeVisible();
  });

  test('Admin audit logs access', async ({ page }) => {
    // Login as admin
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'adminpass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to audit logs
    await page.goto(`${baseURL}/admin/audit-logs`);
    await expect(page.locator('text=Audit Logs')).toBeVisible();

    // Check if table loads
    await expect(page.locator('table')).toBeVisible();
  });

  test('Admin notification sending', async ({ page }) => {
    // Login as admin
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'adminpass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Navigate to notification send
    await page.goto(`${baseURL}/admin/notifications/send`);
    await expect(page.locator('text=Send System Notification')).toBeVisible();

    // Fill notification form
    await page.fill('input[name="title"]', 'Test Notification');
    await page.fill('textarea[name="message"]', 'This is a test notification');
    await page.check('input[name="recipientType"][value="all"]');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Notification sent')).toBeVisible();
  });

  test('Candidate dashboard features', async ({ page }) => {
    // Login as candidate
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'candidate@example.com');
    await page.fill('input[name="password"]', 'candidatepass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Check dashboard elements
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Recent Notifications')).toBeVisible();
    await expect(page.locator('text=Recent Applications')).toBeVisible();
    await expect(page.locator('text=Upcoming Interviews')).toBeVisible();
  });

  test('Employer dashboard and job posting', async ({ page }) => {
    // Login as employer
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'employer@example.com');
    await page.fill('input[name="password"]', 'employerpass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Check employer dashboard
    await expect(page.locator('text=Employer Dashboard')).toBeVisible();
  });

  test('Job application and status change', async ({ page }) => {
    // As candidate, apply to a job
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'candidate@example.com');
    await page.fill('input[name="password"]', 'candidatepass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Go to jobs and apply
    await page.goto(`${baseURL}/jobs`);
    await page.click('button:text("Apply")').first();
    await expect(page.locator('text=Application submitted')).toBeVisible();

    // As employer, change status
    await page.goto(`${baseURL}/sign-out`);
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'employer@example.com');
    await page.fill('input[name="password"]', 'employerpass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Go to applications and change status
    await page.goto(`${baseURL}/applications/employer`);
    await page.selectOption('select', 'interview_scheduled');
    await page.click('button:text("Update")');

    // Verify interview created
    await expect(page.locator('text=Interview Scheduled')).toBeVisible();
  });

  test('Profile management', async ({ page }) => {
    // Login as candidate
    await page.goto(`${baseURL}/sign-in`);
    await page.fill('input[name="email"]', 'candidate@example.com');
    await page.fill('input[name="password"]', 'candidatepass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    // Go to profile
    await page.goto(`${baseURL}/profile`);
    await expect(page.locator('text=Profile')).toBeVisible();

    // Edit profile
    await page.click('a:text("Edit Profile")');
    await page.fill('input[name="headline"]', 'Senior Developer');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Profile updated')).toBeVisible();
  });

  test('Security - unauthorized access', async ({ page }) => {
    // Try accessing admin without login
    await page.goto(`${baseURL}/admin/users`);
    await expect(page).toHaveURL(/sign-in/);

    // Login as candidate and try admin access
    await page.fill('input[name="email"]', 'candidate@example.com');
    await page.fill('input[name="password"]', 'candidatepass');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**');

    await page.goto(`${baseURL}/admin/users`);
    await expect(page.locator('text=Access denied')).toBeVisible();
  });

  test('Responsive design', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await page.goto(baseURL);
    await expect(page.locator('nav')).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await expect(page.locator('nav')).toBeVisible();
  });
});