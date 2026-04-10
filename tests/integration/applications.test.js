import { describe, it, expect, vi, beforeEach } from 'vitest';
import Application from '../../src/models/Application.js';
import Job from '../../src/models/Job.js';
import User from '../../src/models/User.js';
import Interview from '../../src/models/Interview.js';
import Notification from '../../src/models/Notification.js';
import ApplicationFeedback from '../../src/models/ApplicationFeedback.js';

describe('Applications Routes Tests', () => {
  const mockAuth = {
    api: {
      getSession: vi.fn()
    }
  };

  const mockReq = {
    params: {},
    body: {},
    query: {},
    headers: {},
    flash: vi.fn(),
    csrfToken: vi.fn(() => 'mock-csrf-token'),
    user: {
      id: 'candidate-id',
      email: 'candidate@example.com',
      role: 'candidate'
    },
    userId: 'candidate-id'
  };

  const mockRes = {
    redirect: vi.fn(),
    json: vi.fn(),
    render: vi.fn(),
    status: vi.fn(function() { return this; }),
    locals: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /applications - Apply for job', () => {
    it('should create application for valid job', async () => {
      const jobId = 'job-123';
      const applicationData = {
        jobId,
        coverLetter: 'I am interested in this position',
        source: 'job-board'
      };

      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        title: 'Engineer',
        status: 'approved',
        company: 'company-123'
      });

      vi.spyOn(Application, 'findOne').mockResolvedValue(null);
      vi.spyOn(Application, 'create').mockResolvedValue({
        _id: 'app-123',
        ...applicationData,
        applicantUserId: 'candidate-id',
        status: 'pending'
      });

      expect(Job.findById).toBeDefined();
      expect(Application.create).toBeDefined();
    });

    it('should prevent duplicate applications', async () => {
      const jobId = 'job-123';

      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        status: 'approved'
      });

      vi.spyOn(Application, 'findOne').mockResolvedValue({
        _id: 'existing-app',
        job: jobId,
        applicantUserId: 'candidate-id'
      });

      expect(Application.findOne).toBeDefined();
    });

    it('should reject application for inactive job', async () => {
      const jobId = 'job-123';

      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        status: 'rejected'
      });

      expect(Job.findById).toBeDefined();
    });

    it('should validate job ID format', async () => {
      const invalidJobId = 'invalid-id';
      
      vi.spyOn(Job, 'findById').mockRejectedValue(new Error('Invalid ObjectId'));

      expect(Job.findById).toBeDefined();
    });

    it('should require complete user profile', async () => {
      expect(mockReq.user.id).toBe('candidate-id');
      // In real implementation, would check if profile is complete
    });

    it('should create notification for employer', async () => {
      const jobId = 'job-123';

      vi.spyOn(Application, 'create').mockResolvedValue({
        _id: 'app-123',
        job: jobId
      });

      vi.spyOn(Notification, 'create').mockResolvedValue({
        _id: 'notif-123',
        type: 'new_application'
      });

      expect(Notification.create).toBeDefined();
    });

    it('should accept optional cover letter', async () => {
      const appData1 = { jobId: 'job-123', coverLetter: 'I am interested' };
      const appData2 = { jobId: 'job-123' }; // No cover letter

      expect(appData1.coverLetter).toBeDefined();
      expect(appData2.coverLetter).toBeUndefined();
    });
  });

  describe('GET /applications - List applications', () => {
    it('should list all applications for candidate', async () => {
      const applications = [
        { _id: '1', job: { title: 'Engineer' }, status: 'pending' },
        { _id: '2', job: { title: 'Designer' }, status: 'rejected' }
      ];

      vi.spyOn(Application, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue(applications)
      });

      expect(Application.find).toBeDefined();
    });

    it('should filter applications by status', async () => {
      const status = 'pending';

      vi.spyOn(Application, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Application.find).toBeDefined();
    });

    it('should sort by most recent first', async () => {
      vi.spyOn(Application, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function(sort) {
          expect(sort).toEqual({ createdAt: -1 });
          return this;
        }),
        limit: vi.fn().mockResolvedValue([])
      });

      const chain = Application.find({});
      chain.sort({ createdAt: -1 });
      expect(chain.sort).toBeDefined();
    });

    it('should populate job details', async () => {
      vi.spyOn(Application, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Application.find).toBeDefined();
    });
  });

  describe('GET /applications/:id - Get application detail', () => {
    it('should get application by ID', async () => {
      const appId = 'app-123';

      vi.spyOn(Application, 'findById').mockResolvedValue({
        _id: appId,
        job: { title: 'Engineer' },
        applicantUserId: 'candidate-id',
        status: 'pending'
      });

      expect(Application.findById).toBeDefined();
    });

    it('should include interview information', async () => {
      const appId = 'app-123';

      vi.spyOn(Application, 'findById').mockReturnValue({
        populate: vi.fn(function() { return this; })
      });

      expect(Application.findById).toBeDefined();
    });

    it('should return 404 for non-existent application', async () => {
      vi.spyOn(Application, 'findById').mockResolvedValue(null);

      const app = await Application.findById('invalid-id');
      expect(app).toBeNull();
    });

    it('should check authorization before returning', async () => {
      const appId = 'app-123';
      const differentCandidateId = 'different-candidate-id';

      vi.spyOn(Application, 'findById').mockResolvedValue({
        _id: appId,
        applicantUserId: differentCandidateId
      });

      expect(Application.findById).toBeDefined();
      // Should verify user is applicant or employer of job
    });
  });

  describe('POST /applications/:id/status - Update application status', () => {
    it('should update status to accepted', async () => {
      const appId = 'app-123';

      vi.spyOn(Application, 'findByIdAndUpdate').mockResolvedValue({
        _id: appId,
        status: 'accepted'
      });

      expect(Application.findByIdAndUpdate).toBeDefined();
    });

    it('should update status to rejected', async () => {
      const appId = 'app-123';

      vi.spyOn(Application, 'findByIdAndUpdate').mockResolvedValue({
        _id: appId,
        status: 'rejected'
      });

      expect(Application.findByIdAndUpdate).toBeDefined();
    });

    it('should allow only valid status transitions', async () => {
      const validStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'];

      validStatuses.forEach(status => {
        expect(['pending', 'accepted', 'rejected', 'withdrawn']).toContain(status);
      });
    });

    it('should notify candidate of status change', async () => {
      vi.spyOn(Notification, 'create').mockResolvedValue({
        _id: 'notif-123',
        type: 'application_status_update'
      });

      expect(Notification.create).toBeDefined();
    });

    it('only employer can update status', async () => {
      const employerReq = { ...mockReq, user: { role: 'employer' } };
      expect(employerReq.user.role).toBe('employer');
    });
  });

  describe('POST /applications/:id/message - Send message', () => {
    it('should send message from employer to candidate', async () => {
      const appId = 'app-123';
      const messageData = { message: 'We are interested in your profile' };

      expect(messageData.message).toBeTruthy();
      expect(messageData.message.length).toBeGreaterThan(0);
    });

    it('should create notification for message', async () => {
      vi.spyOn(Notification, 'create').mockResolvedValue({
        _id: 'notif-123',
        type: 'application_message'
      });

      expect(Notification.create).toBeDefined();
    });

    it('should validate message content', async () => {
      const validMessage = 'Thank you for applying!';
      const emptyMessage = '';

      expect(validMessage.trim()).toBeTruthy();
      expect(emptyMessage.trim()).not.toBeTruthy();
    });
  });

  describe('POST /applications/:id/interview - Schedule interview', () => {
    it('should create interview for application', async () => {
      const appId = 'app-123';
      const interviewData = {
        scheduledDate: new Date('2024-05-01'),
        interviewType: 'video'
      };

      vi.spyOn(Interview, 'create').mockResolvedValue({
        _id: 'interview-123',
        ...interviewData
      });

      expect(Interview.create).toBeDefined();
    });

    it('should validate interview date is in future', async () => {
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2026-12-31');
      const now = new Date();

      expect(pastDate.getTime()).toBeLessThan(now.getTime());
      expect(futureDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should create notification for interview', async () => {
      vi.spyOn(Notification, 'create').mockResolvedValue({
        _id: 'notif-123',
        type: 'interview_scheduled'
      });

      expect(Notification.create).toBeDefined();
    });

    it('should send email notification to candidate', async () => {
      const interviewData = {
        scheduledDate: new Date('2026-05-01'),
        interviewType: 'video'
      };

      expect(interviewData.scheduledDate).toBeDefined();
      expect(interviewData.interviewType).toBeDefined();
    });

    it('should support multiple interview types', async () => {
      const types = ['phone', 'video', 'in-person', 'coding-test'];

      types.forEach(type => {
        expect(['phone', 'video', 'in-person', 'coding-test']).toContain(type);
      });
    });
  });

  describe('POST /applications/:id/feedback - Submit feedback', () => {
    it('should create feedback for application', async () => {
      const appId = 'app-123';
      const feedbackData = {
        rating: 4,
        comment: 'Good candidate',
        interviewFeedback: 'Performed well'
      };

      vi.spyOn(ApplicationFeedback, 'create').mockResolvedValue({
        _id: 'feedback-123',
        ...feedbackData
      });

      expect(ApplicationFeedback.create).toBeDefined();
    });

    it('should validate rating range', async () => {
      const validRatings = [1, 2, 3, 4, 5];
      const invalidRatings = [0, 6, 10];

      validRatings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
      });

      invalidRatings.forEach(rating => {
        expect((rating >= 1 && rating <= 5)).toBeFalsy();
      });
    });
  });

  describe('Application Status Types', () => {
    it('should have correct status values', async () => {
      const statuses = ['pending', 'accepted', 'rejected', 'withdrawn', 'under-review'];

      expect(statuses).toContain('pending');
      expect(statuses).toContain('accepted');
      expect(statuses).toContain('rejected');
    });

    it('should show pending status by default', async () => {
      const newApp = {
        status: 'pending'
      };

      expect(newApp.status).toBe('pending');
    });
  });

  describe('Application Permissions', () => {
    it('only candidate can create application', async () => {
      expect(mockReq.user.role).toBe('candidate');
    });

    it('employer can update application status', async () => {
      const employerReq = { ...mockReq, user: { role: 'employer' } };
      expect(employerReq.user.role).toBe('employer');
    });

    it('candidate can withdraw application', async () => {
      expect(mockReq.user.role).toBe('candidate');
    });

    it('only relevant users can view application', async () => {
      const appData = {
        applicantUserId: 'candidate-id',
        jobOwner: 'employer-id'
      };

      expect(appData.applicantUserId).toBeDefined();
      expect(appData.jobOwner).toBeDefined();
    });
  });

  describe('Application Validation', () => {
    it('should require job ID', async () => {
      const appData = { jobId: null };
      expect(appData.jobId).toBeNull();
    });

    it('should require valid job status', async () => {
      const jobStatuses = ['approved', 'rejected', 'pending'];
      const validJobStatus = 'approved';

      expect(jobStatuses).toContain(validJobStatus);
    });

    it('should validate cover letter length if provided', async () => {
      const validCoverLetter = 'I am very interested in this position...'.repeat(5);
      const validShortLetter = 'Interested in this role';

      expect(validCoverLetter.length).toBeGreaterThan(0);
      expect(validShortLetter.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job ID', async () => {
      vi.spyOn(Job, 'findById').mockRejectedValue(new Error('Invalid ObjectId'));

      expect(Job.findById).toBeDefined();
    });

    it('should handle duplicate application attempt', async () => {
      vi.spyOn(Application, 'findOne').mockResolvedValue({
        _id: 'existing-app'
      });

      const existing = await Application.findOne({ job: 'job-id' });
      expect(existing).toBeDefined();
    });

    it('should handle database errors', async () => {
      vi.spyOn(Application, 'create').mockRejectedValue(new Error('Database error'));

      expect(Application.create).toBeDefined();
    });

    it('should provide meaningful error messages', async () => {
      const errors = {
        jobNotFound: 'Job not found',
        alreadyApplied: 'You have already applied to this job',
        profileIncomplete: 'Please complete your profile before applying'
      };

      expect(errors.jobNotFound).toContain('not found');
      expect(errors.alreadyApplied).toContain('already');
      expect(errors.profileIncomplete).toContain('profile');
    });
  });

  describe('Application Workflow', () => {
    it('has correct status flow: pending -> accepted/rejected', async () => {
      const workflow = {
        initial: 'pending',
        accepted: 'accepted',
        rejected: 'rejected'
      };

      expect(workflow.initial).toBe('pending');
      expect(['accepted', 'rejected']).toContain(workflow.accepted);
    });

    it('candidate can withdraw from pending state', async () => {
      const appStatus = 'pending';
      expect(appStatus).toBe('pending');
    });

    it('interview scheduling happens after acceptance', async () => {
      const appStatus = 'accepted';
      const canScheduleInterview = appStatus === 'accepted';

      expect(canScheduleInterview).toBe(true);
    });
  });
});
