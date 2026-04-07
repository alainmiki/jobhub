# In-Depth Review: User Roles, Dashboards, and Workflows

## 1. Executive Summary
The current implementation provides a solid foundation using Better-Auth for session management and Mongoose for profile data. However, there are significant "blind spots" where the UI and the backend are decoupled, specifically regarding role-specific profile requirements and the transition between states (e.g., a Candidate becoming an Employer).

---

## 2. Candidate Role Analysis

### Capabilities
- **Profile Management:** Can maintain a detailed resume, education history, and skill set.
- **Application Tracking:** Can view status updates (Pending, Shortlisted, etc.).
- **Interview Management:** Can confirm or request rescheduling for interviews.

### Missing or Handled Poorly
- **Profile Genericness:** The `UserProfile` model is shared across all roles. While candidates need "Years of Experience," an Admin does not. The schema contains many fields that are null for non-candidates, leading to "sparse" data.
- **Job Matching Logic:** The navigation includes `/matches`, but the routes in `profile.js` and `dashboard.js` do not implement the recommendation engine logic. It is currently a dead link.
- **Application Withdrawal:** There is no route or UI component allowing a candidate to withdraw an application once submitted.
- **Resume Primary Status:** The logic to set a primary resume exists in the backend (`profile.js`), but the `view.html` template does not visually distinguish which resume is currently active/primary.

### Misconfigurations
- **Role Enforcement:** While `isAuthenticated` is used, the system automatically creates a `UserProfile` for any authenticated user. If an Admin logs in, they get a Candidate-style profile by default, which is inconsistent.

---

## 3. Employer Role Analysis

### Capabilities
- **Dashboard Stats:** Can see total views and applications for their jobs.
- **Verification State:** The dashboard displays verification status.

### Missing or Handled Poorly
- **Company-Role Coupling:** In `dashboard.js`, the employer dashboard logic looks for a `Company` associated with the `userId`. If the user is an `employer` but hasn't created a company yet, the dashboard shows "0 stats" rather than a "Create Company" call-to-action.
- **Candidate Search:** Similar to the candidate's "Matches," the employer's "Find Candidates" link is present in `header.html` but lacks a corresponding robust search implementation in the provided routes.
- **Job Management UI:** The dashboard shows "Recent Applications," but the ability to actually *post* a job is missing from the `dashboard.js` file (it likely exists in a separate `jobs.js` not fully reviewed here).

### Misconfigurations
- **Role Security:** The `isRole(auth, 'employer')` middleware is correctly applied in the dashboard, but `profile.js` allows anyone to update their `role` via a `PUT` request. **Security Risk:** A candidate can send a `PUT /profile` with `role: 'admin'` and potentially escalate privileges if the backend doesn't strictly validate the role transition.

---

## 4. Admin Role Analysis

### Capabilities
- **User Management:** Can view all users and filter by role.
- **System Oversight:** Can approve/reject jobs and verify companies.
- **Role Synchronization:** The `admin.js` route correctly updates both the `User` model (auth) and the `UserProfile` model (data).

### Missing or Handled Poorly
- **User Disablement:** The "Disable User" button in `user-detail.html` is a placeholder alert. There is no backend logic to "ban" or "deactivate" a session.
- **Audit Logs:** There is no UI for an admin to see a history of actions (e.g., who approved Job X).
- **Idempotency Handling:** The Admin dashboard performs POST actions (Approve/Reject). If a page is refreshed, it might re-trigger logic, though the `findOneAndUpdate` mitigates most state-change issues.

### Misconfigurations
- **Model Access:** `admin.js` uses `mongoose.model('user')`. This is risky if the model hasn't been initialized yet in the startup sequence. It should ideally import the User model directly or ensure initialization.

---

## 5. Profile & Dashboard Functionality Review

### Data Integrity
- **Profile Completion Score:** The logic in `UserProfile.js` is excellent for engagement. However, the `isProfileComplete` boolean (70% threshold) is not used in the routes to restrict actions (e.g., "You must complete 70% of your profile to apply for jobs").
- **Idempotency Keys:** `profile.js` implements an `idempotencyKey` check. This is a "world-class" addition that prevents duplicate profile updates on slow connections.

### Navigation & UX
- **Role-Based Header:** The `header.html` is well-configured. It dynamically changes menu items based on `user.role`.
- **Redundant Templates:** `src/views/profile.html` is identified as a redundant redirector. All logic should point directly to `/profile` which renders `profile/view.html`.

---

## 6. Technical Handling & Security

### Input Sanitization (Strict Review)
- **The Password Corruption Bug:** As noted in `FIX_GUIDE.md`, the global `validateInput` middleware was likely escaping HTML entities in passwords (e.g., `P@ss&1` becoming `P@ss&amp;1`), which breaks authentication. 
- **NoSQL Injection:** The `sanitizeRegex` utility in the docs is a great start, but it needs to be applied to all search queries across `admin.js` and `dashboard.js`.

### File Handling
- **Multer Integration:** The `profile.js` handles multiple fields (`image`, `coverImage`, `resume`). 
- **Issue:** If a user uploads a new resume, the old file remains on the server disk. There is no cleanup logic for orphaned files in the `uploads/` directory.

---

## 7. Actionable Recommendations

1.  **Strict Role Validation:** In `src/routes/profile.js`, remove the ability for a user to change their own role via the `PUT /` route. Role changes should be an Admin-only or a specific "Upgrade to Employer" workflow.
2.  **State-Based Dashboards:** Update `src/routes/dashboard.js` for Employers to check for the existence of a Company. If `null`, render a "Setup your Company" view instead of an empty dashboard.
3.  **Completion Enforcement:** Add a middleware `isProfileReady` that checks `profile.profileCompletionScore`. Apply this to the "Apply for Job" routes.
4.  **Admin Completion:** Implement the `POST /admin/users/:id/disable` route to make the Admin UI functional.
5.  **Schema Splitting (Optional but Recommended):** Consider using a Discriminator pattern for `UserProfile` if Candidate and Employer profiles diverge further in complexity.

---
*Review conducted by Gemini Code Assist - Technical Audit Phase*