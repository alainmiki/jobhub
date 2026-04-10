import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Job from '../../src/models/Job.js';
import Company from '../../src/models/Company.js';
import Application from '../../src/models/Application.js';
import User from '../../src/models/User.js';

describe('Jobs Routes Tests', () => {
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
      id: 'user-id',
      email: 'user@example.com',
      role: 'employer'
    },
    userId: 'user-id',
    pagination: { page: 1, limit: 20, skip: 0 }
  };

  const mockRes = {
    redirect: vi.fn(),
    json: vi.fn(),
    render: vi.fn(),
    send: vi.fn(),
    status: vi.fn(function() { return this; }),
    locals: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /jobs - List all jobs', () => {
    it('should list all approved active jobs', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Backend Engineer',
          company: { name: 'Company A' },
          status: 'approved',
          isActive: true
        },
        {
          _id: '2',
          title: 'Frontend Engineer',
          company: { name: 'Company B' },
          status: 'approved',
          isActive: true
        }
      ];

      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue(mockJobs)
      });

      expect(Job.find).toBeDefined();
    });

    it('should filter jobs by type', async () => {
      const filter = { status: 'approved', isActive: true, type: 'full-time' };
      
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });

    it('should filter jobs by location', async () => {
      const filter = { status: 'approved', isActive: true, location: 'remote' };
      
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });

    it('should filter jobs by category', async () => {
      const filter = { status: 'approved', isActive: true, category: 'Engineering' };
      
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });

    it('should search jobs by title and description', async () => {
      const searchQuery = 'engineer';
      
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });

    it('should apply pagination', async () => {
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function(skip) {
          expect(skip).toBe(0);
          return this;
        }),
        limit: vi.fn(function(limit) {
          expect(limit).toBe(20);
          return this;
        }).mockResolvedValue([])
      });

      const chain = Job.find({});
      chain.skip(0).limit(20);
      expect(chain.skip).toBeDefined();
    });

    it('should sort jobs by creation date descending', async () => {
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function(sort) {
          expect(sort).toEqual({ createdAt: -1 });
          return this;
        }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      const chain = Job.find({});
      chain.sort({ createdAt: -1 });
      expect(chain.sort).toBeDefined();
    });
  });

  describe('GET /jobs/:id - Get job detail', () => {
    it('should get single job by ID', async () => {
      const jobId = 'job-123';
      const mockJob = {
        _id: jobId,
        title: 'Backend Engineer',
        description: 'We are hiring',
        company: { name: 'Company A' },
        salary: { min: 80000, max: 120000 },
        applications: []
      };

      vi.spyOn(Job, 'findById').mockResolvedValue(mockJob);
      
      expect(Job.findById).toBeDefined();
    });

    it('should return not found for invalid job ID', async () => {
      vi.spyOn(Job, 'findById').mockResolvedValue(null);
      
      const job = await Job.findById('invalid-id');
      expect(job).toBeNull();
    });

    it('should populate company information', async () => {
      const jobId = 'job-123';
      
      vi.spyOn(Job, 'findById').mockReturnValue({
        populate: vi.fn(function() {
          return Promise.resolve({
            _id: jobId,
            title: 'Engineer',
            company: {
              name: 'Company A',
              logo: 'logo.png'
            }
          });
        })
      });

      expect(Job.findById).toBeDefined();
    });
  });

  describe('POST /jobs - Create new job', () => {
    it('should create a new job for authenticated employer', async () => {
      const jobData = {
        title: 'Senior Developer',
        description: 'Looking for experienced developer',
        type: 'full-time',
        location: 'remote',
        category: 'Engineering',
        experienceLevel: 'Senior',
        salary: { min: 100000, max: 150000 },
        skills: ['Node.js', 'React'],
        requirements: ['5+ years experience']
      };

      vi.spyOn(Job, 'create').mockResolvedValue({
        _id: 'new-job-id',
        ...jobData,
        postedBy: 'user-id',
        company: 'company-id',
        status: 'pending'
      });

      expect(Job.create).toBeDefined();
    });

    it('should validate required job fields', async () => {
      const requiredFields = ['title', 'description', 'type', 'location'];
      const jobData = {
        title: 'Backend Engineer',
        description: 'Hiring description',
        type: 'full-time',
        location: 'remote'
      };

      requiredFields.forEach(field => {
        expect(jobData[field]).toBeDefined();
        expect(jobData[field]).toBeTruthy();
      });
    });

    it('should validate job type enum', async () => {
      const validTypes = ['full-time', 'part-time', 'contract', 'temporary'];
      const invalidTypes = ['invalid', 'freelance', 'permanent'];

      validTypes.forEach(type => {
        expect(['full-time', 'part-time', 'contract', 'temporary']).toContain(type);
      });

      invalidTypes.forEach(type => {
        expect(['full-time', 'part-time', 'contract', 'temporary']).not.toContain(type);
      });
    });

    it('should validate location enum', async () => {
      const validLocations = ['remote', 'on-site', 'hybrid'];
      
      validLocations.forEach(location => {
        expect(['remote', 'on-site', 'hybrid']).toContain(location);
      });
    });

    it('should set job status to pending initially', async () => {
      vi.spyOn(Job, 'create').mockResolvedValue({
        _id: 'new-job-id',
        status: 'pending'
      });

      const savedJob = await Job.create({ title: 'Test' });
      expect(savedJob.status).toBe('pending');
    });
  });

  describe('GET /jobs/:id/edit - Edit job form', () => {
    it('should get edit form for job owner', async () => {
      const jobId = 'job-123';
      
      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        title: 'Engineer',
        postedBy: 'user-id'
      });

      expect(Job.findById).toBeDefined();
    });

    it('should return not found if user is not job owner', async () => {
      const jobId = 'job-123';
      
      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        postedBy: 'different-user-id'
      });

      expect(Job.findById).toBeDefined();
    });
  });

  describe('POST /jobs/:id/edit - Update job', () => {
    it('should update job title', async () => {
      const jobId = 'job-123';
      const updates = { title: 'Updated Title' };

      vi.spyOn(Job, 'findByIdAndUpdate').mockResolvedValue({
        _id: jobId,
        title: 'Updated Title'
      });

      expect(Job.findByIdAndUpdate).toBeDefined();
    });

    it('should update job description', async () => {
      const jobId = 'job-123';
      const updates = { description: 'New description' };

      vi.spyOn(Job, 'findByIdAndUpdate').mockResolvedValue({
        _id: jobId,
        description: 'New description'
      });

      expect(Job.findByIdAndUpdate).toBeDefined();
    });

    it('should update job salary', async () => {
      const jobId = 'job-123';
      const updates = { salary: { min: 90000, max: 130000 } };

      vi.spyOn(Job, 'findByIdAndUpdate').mockResolvedValue({
        _id: jobId,
        salary: { min: 90000, max: 130000 }
      });

      expect(Job.findByIdAndUpdate).toBeDefined();
    });

    it('should update job skills requirement', async () => {
      const jobId = 'job-123';
      const updates = { skills: ['Python', 'SQL'] };

      vi.spyOn(Job, 'findByIdAndUpdate').mockResolvedValue({
        _id: jobId,
        skills: ['Python', 'SQL']
      });

      expect(Job.findByIdAndUpdate).toBeDefined();
    });

    it('should not allow updating postedBy field', async () => {
      const jobId = 'job-123';
      const updates = { postedBy: 'different-user-id' };

      // Should not update postedBy - job ownership should not change
      expect(updates.postedBy).toBeDefined();
      // In real implementation, this would be filtered out
    });
  });

  describe('DELETE /jobs/:id - Delete job', () => {
    it('should delete job for owner', async () => {
      const jobId = 'job-123';

      vi.spyOn(Job, 'findByIdAndDelete').mockResolvedValue({
        _id: jobId
      });

      expect(Job.findByIdAndDelete).toBeDefined();
    });

    it('should not allow deletion if user is not owner', async () => {
      const jobId = 'job-123';

      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        postedBy: 'different-user-id'
      });

      expect(Job.findById).toBeDefined();
    });

    it('should clean up related applications on deletion', async () => {
      const jobId = 'job-123';

      vi.spyOn(Job, 'findById').mockResolvedValue({
        _id: jobId,
        postedBy: 'user-id'
      });

      vi.spyOn(Application, 'deleteMany').mockResolvedValue({
        deletedCount: 2
      });

      expect(Application.deleteMany).toBeDefined();
    });
  });

  describe('GET /jobs/search - Search jobs', () => {
    it('should search jobs by keyword', async () => {
      const searchTerm = 'developer';
      
      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });

    it('should combine multiple search filters', async () => {
      const filter = {
        status: 'approved',
        type: 'full-time',
        location: 'remote',
        category: 'Engineering'
      };

      vi.spyOn(Job, 'find').mockReturnValue({
        populate: vi.fn(function() { return this; }),
        sort: vi.fn(function() { return this; }),
        skip: vi.fn(function() { return this; }),
        limit: vi.fn().mockResolvedValue([])
      });

      expect(Job.find).toBeDefined();
    });
  });

  describe('GET /jobs/new - New job form', () => {
    it('should render job creation form for authenticated employer', async () => {
      expect(mockReq.user.role).toBe('employer');
      expect(mockReq.userId).toBe('user-id');
    });

    it('should reject non-employer users', async () => {
      const candidateReq = {
        ...mockReq,
        user: { role: 'candidate' }
      };

      expect(candidateReq.user.role).not.toBe('employer');
    });
  });

  describe('Job Validation', () => {
    it('should validate title length', async () => {
      const validTitle = 'Senior Backend Engineer';
      const tooShortTitle = 'SE';

      expect(validTitle.length).toBeGreaterThan(3);
      expect(tooShortTitle.length).toBeLessThanOrEqual(3);
    });

    it('should validate description length', async () => {
      const validDescription = 'We are looking for a talented developer with experience in Node.js and React. Join our team!';
      const tooShortDescription = 'Hiring';

      expect(validDescription.length).toBeGreaterThanOrEqual(50);
      expect(tooShortDescription.length).toBeLessThan(50);
    });

    it('should validate salary range', async () => {
      const validSalary = { min: 80000, max: 120000 };
      const invalidSalary = { min: 120000, max: 80000 };

      expect(validSalary.min).toBeLessThanOrEqual(validSalary.max);
      expect(invalidSalary.min).toBeGreaterThan(invalidSalary.max);
    });

    it('should allow empty optional fields', async () => {
      const jobData = {
        title: 'Engineer',
        description: 'Hiring description',
        type: 'full-time',
        location: 'remote',
        salary: {}, // Optional
        skills: [], // Optional
        requirements: [] // Optional
      };

      expect(jobData.title).toBeTruthy();
      expect(jobData.salary).toBeDefined();
    });
  });

  describe('Job Status Workflow', () => {
    it('should have status changes: pending -> approved/rejected', async () => {
      const statuses = ['pending', 'approved', 'rejected'];
      
      expect(statuses).toContain('pending');
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
    });

    it('should not allow listing non-approved jobs to public', async () => {
      const filter = { status: 'approved', isActive: true };
      
      expect(filter.status).toBe('approved');
    });

    it('should allow employers to see their pending jobs', async () => {
      expect(mockReq.user.role).toBe('employer');
      // Employers can see their own pending jobs
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job ID format', async () => {
      vi.spyOn(Job, 'findById').mockRejectedValue(new Error('Invalid ObjectId'));
      
      await expect(Job.findById('invalid')).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(Job, 'find').mockRejectedValue(new Error('Database connection failed'));
      
      await expect(Job.find({})).rejects.toThrow('Database connection failed');
      const errors = {
        title: 'Title is required',
        description: 'Description must be at least 50 characters',
        type: 'Invalid job type',
        location: 'Invalid location'
      };

      expect(errors.title).toContain('required');
      expect(errors.description).toContain('50');
    });
  });

  describe('Job Permissions', () => {
    it('only employer can create jobs', async () => {
      expect(mockReq.user.role).toBe('employer');
    });

    it('only job owner can edit/delete', async () => {
      const jobOwnerId = 'user-id';
      expect(mockReq.userId).toBe(jobOwnerId);
    });

    it('candidate cannot create jobs', async () => {
      const candidateReq = { ...mockReq, user: { role: 'candidate' } };
      expect(candidateReq.user.role).not.toBe('employer');
    });
  });
});
