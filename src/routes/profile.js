import express from 'express';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import Application from '../models/Application.js';
import Interview from '../models/Interview.js';
import Job from '../models/Job.js';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { upload, handleMulterError } from '../config/multer.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger.js';
import validator from 'validator';
import mongoose from 'mongoose';

export const initProfileRouter = (auth) => {
  const router = express.Router();
  router.use(isAuthenticated(auth));

  // Helper to delete old files when replaced
  const deleteOldFile = async (filePath) => {
    if (!filePath) return;
    try {
      const absolutePath = path.join(process.cwd(), 'public', filePath);
      await fs.unlink(absolutePath);
    } catch (err) {
      logger.warn(`Could not delete old file: ${filePath}`);
    }
  };

  router.get('/', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image createdAt');

    if (!profile) {
      profile = new UserProfile({ 
        userId: req.userId, 
        role: req.user.role || 'candidate' 
      });
      await profile.save();
      await profile.populate('userId', 'name email image createdAt');
      logger.info(`Auto-created profile for user: ${req.userId}`);
    }

    const applications = await Application.find({ applicantUserId: req.userId })
      .populate('job', 'title company')
      .sort({ createdAt: -1 })
      .limit(5);

    const stats = {
      totalApplications: await Application.countDocuments({ applicantUserId: req.userId }),
      pendingApplications: await Application.countDocuments({ applicantUserId: req.userId, status: 'pending' }),
      shortlisted: await Application.countDocuments({ applicantUserId: req.userId, status: 'shortlisted' }),
      interviewsAttended: await Interview.countDocuments({ candidate: profile._id, status: 'completed' }),
      upcomingInterviews: await Interview.countDocuments({ candidate: profile._id, status: { $in: ['scheduled', 'confirmed'] }, scheduledAt: { $gte: new Date() } })
    };

    res.render('profile/view', { 
      profile, 
      stats, 
      recentApplications: applications,
      showGuidance: req.query.complete === 'true'
    });
  }));

  router.get('/edit', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image');

    if (!profile) {
      profile = new UserProfile({ userId: req.userId, role: req.user.role || 'candidate' });
      await profile.save();
      await profile.populate('userId', 'name email image');
    }
    res.render('profile/edit', {
      profile,
      showGuidance: req.query.complete === 'true',
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }));

  router.post('/',
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
      { name: 'resume', maxCount: 1 }
    ]),
    handleMulterError,
    asyncHandler(async (req, res) => {
      // CSRF check for multipart forms
      if (!req.body._csrf) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }
      if (req.csrfToken && req.csrfToken() !== req.body._csrf) {
        return res.status(403).json({ error: 'CSRF token invalid' });
      }
      const {
        bio, headline, location, country, phone, website, linkedin, github, twitter,
        // role removed from body to prevent privilege escalation
        skills, education, experience,
        preferredJobTypes, preferredLocations,
        expectedSalaryMin, expectedSalaryMax, expectedSalaryCurrency,
        availabilityAvailable, noticePeriod, availabilityStartDate,
        idempotencyKey
      } = req.body;

      const existingProfile = await UserProfile.findOne({ userId: req.userId });
      if (existingProfile && existingProfile.lastUpdateIdempotencyKey === idempotencyKey && idempotencyKey) {
        logger.info(`Duplicate request detected for user: ${req.userId}, key: ${idempotencyKey}`);
        return res.redirect('/profile');
      }

      const sanitizedBio = bio ? validator.escape(bio.trim().substring(0, 500)) : '';
      const sanitizedHeadline = headline ? validator.escape(headline.trim().substring(0, 200)) : '';
      const sanitizedLocation = location ? validator.escape(location.trim().substring(0, 100)) : '';
      const sanitizedCountry = country ? validator.escape(country.trim().substring(0, 100)) : '';
      const sanitizedPhone = phone ? validator.trim(validator.escape(phone)) : '';
      const sanitizedWebsite = website ? validator.trim(validator.escape(website)) : '';
      const sanitizedLinkedin = linkedin ? validator.trim(validator.escape(linkedin)) : '';
      const sanitizedGithub = github ? validator.trim(validator.escape(github)) : '';
      const sanitizedTwitter = twitter ? validator.trim(validator.escape(twitter)) : '';

      if (website && !validator.isURL(website, { protocols: ['http', 'https'], require_protocol: true })) {
        req.flash('error', 'Please enter a valid website URL (include http:// or https://)');
        return res.redirect('/profile/edit');
      }
      if (linkedin && !validator.isURL(linkedin, { protocols: ['http', 'https'], require_protocol: true })) {
        req.flash('error', 'Please enter a valid LinkedIn URL');
        return res.redirect('/profile/edit');
      }
      if (github && !validator.isURL(github, { protocols: ['http', 'https'], require_protocol: true })) {
        req.flash('error', 'Please enter a valid GitHub URL');
        return res.redirect('/profile/edit');
      }
      if (twitter && !validator.isURL(twitter, { protocols: ['http', 'https'], require_protocol: true })) {
        req.flash('error', 'Please enter a valid Twitter URL');
        return res.redirect('/profile/edit');
      }

      if (sanitizedPhone && !/^[\d\s\-+()]+$/.test(sanitizedPhone)) {
        req.flash('error', 'Please enter a valid phone number');
        return res.redirect('/profile/edit');
      }

      if (expectedSalaryMin && (isNaN(expectedSalaryMin) || parseInt(expectedSalaryMin) < 0)) {
        req.flash('error', 'Minimum salary must be a positive number');
        return res.redirect('/profile/edit');
      }
      if (expectedSalaryMax && (isNaN(expectedSalaryMax) || parseInt(expectedSalaryMax) < 0)) {
        req.flash('error', 'Maximum salary must be a positive number');
        return res.redirect('/profile/edit');
      }
      if (expectedSalaryMin && expectedSalaryMax && parseInt(expectedSalaryMin) > parseInt(expectedSalaryMax)) {
        req.flash('error', 'Minimum salary cannot be greater than maximum salary');
        return res.redirect('/profile/edit');
      }
      
      const userUpdates = {};
      const currentUser = await User.findById(req.userId);

      if (req.files['image']) {
        if (currentUser.image) await deleteOldFile(currentUser.image);
        userUpdates.image = `/uploads/${req.files['image'][0].filename}`;
      }
      if (req.files['coverImage']) {
        if (currentUser.coverImage) await deleteOldFile(currentUser.coverImage);
        userUpdates.coverImage = `/uploads/${req.files['coverImage'][0].filename}`;
      }
      
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(req.userId, userUpdates);
      }

      const profileUpdates = {
        bio: sanitizedBio,
        headline: sanitizedHeadline,
        location: sanitizedLocation,
        country: sanitizedCountry,
        phone: sanitizedPhone,
        website: sanitizedWebsite,
        linkedin: sanitizedLinkedin,
        twitter: sanitizedTwitter,
        github: sanitizedGithub,
        lastUpdateIdempotencyKey: idempotencyKey || null,
        updatedAt: new Date()
      };

      if (skills) {
        profileUpdates.skills = Array.isArray(skills) 
          ? skills.filter(s => s.trim() !== '')
          : skills.split(',').map(s => s.trim()).filter(s => s !== '');
      }

      if (education && Array.isArray(education)) {
        profileUpdates.education = education.filter(e => e.institution).map(e => ({
          ...e,
          current: e.current === 'true' || e.current === 'on'
        }));
      }

      if (experience && Array.isArray(experience)) {
        profileUpdates.experience = experience.filter(e => e.company).map(e => ({
          ...e,
          current: e.current === 'true' || e.current === 'on'
        }));
      }

      if (preferredJobTypes) {
        profileUpdates.preferredJobTypes = Array.isArray(preferredJobTypes) 
          ? preferredJobTypes 
          : [preferredJobTypes];
      }

      if (preferredLocations) {
        profileUpdates.preferredLocations = Array.isArray(preferredLocations)
          ? preferredLocations
          : preferredLocations.split(',').map(l => l.trim()).filter(l => l);
      }

      if (expectedSalaryMin || expectedSalaryMax) {
        profileUpdates.expectedSalary = {
          min: expectedSalaryMin ? parseInt(expectedSalaryMin) : undefined,
          max: expectedSalaryMax ? parseInt(expectedSalaryMax) : undefined,
          currency: expectedSalaryCurrency || 'USD'
        };
      }

      if (availabilityAvailable !== undefined) {
        profileUpdates.availability = {
          available: availabilityAvailable === 'true' || availabilityAvailable === 'on',
          noticePeriod,
          startDate: availabilityStartDate ? new Date(availabilityStartDate) : undefined
        };
      }

      if (req.files['resume']) {
        // Delete the previous primary resume file if it exists
        if (existingProfile && existingProfile.resume && existingProfile.resume.url) {
          await deleteOldFile(existingProfile.resume.url);
        }
        const profile = await UserProfile.findOne({ userId: req.userId });
        const newVersion = {
          url: `/uploads/${req.files['resume'][0].filename}`,
          fileName: req.files['resume'][0].originalname,
          version: profile && profile.resumeVersions ? profile.resumeVersions.length + 1 : 1,
          uploadedAt: new Date(),
          isPrimary: !profile || !profile.resume
        };
        
        profileUpdates.resume = newVersion;
        
        if (profile && profile.resumeVersions) {
          profileUpdates.resumeVersions = [...profile.resumeVersions.map(v => ({ ...v, isPrimary: false })), newVersion];
        } else {
          profileUpdates.resumeVersions = [newVersion];
        }
      }

      const profile = await UserProfile.findOneAndUpdate(
        { userId: req.userId },
        profileUpdates,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      logger.info(`Profile updated for user: ${req.userId}`);
      
      req.flash('success', 'Profile updated successfully!');
      res.redirect('/profile');
    })
  );

    router.get('/settings', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image createdAt');

    if (!profile) {
      profile = new UserProfile({ userId: req.userId, role: req.user?.role || 'candidate' });
      await profile.save();
      await profile.populate('userId', 'name email image createdAt');
    }
    
    res.render('profile/settings', { profile });
  }));

  router.post('/settings', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      profile = new UserProfile({ userId: req.userId, role: req.user?.role || 'candidate' });
      await profile.save();
    }

    const { emailNotifications, jobAlerts, weeklyDigest, visibility } = req.body;
    
    const update = {
      'settings.emailNotifications': emailNotifications === 'true',
      'settings.jobAlerts': jobAlerts === 'true',
      'settings.weeklyDigest': weeklyDigest === 'true',
      'settings.profileVisibility': visibility || 'public'
    };

    await UserProfile.findOneAndUpdate({ userId: req.userId }, update);
    
    req.flash('success', 'Settings updated successfully!');
    res.redirect('/profile/settings');
  }));


  // POST /profile/applications/:id/withdraw - Allow candidates to withdraw applications
  router.post('/applications/:id/withdraw', asyncHandler(async (req, res) => {
    const application = await Application.findOne({
      _id: req.params.id,
      applicantUserId: req.userId
    });

    if (!application) {
      req.flash('error', 'Application not found or unauthorized.');
      return res.redirect('/profile/applications');
    }

    if (['accepted', 'rejected'].includes(application.status)) {
      req.flash('error', `Cannot withdraw an application that has already been ${application.status}.`);
      return res.redirect('/profile/applications');
    }

    application.status = 'withdrawn';
    await application.save();

    req.flash('success', 'Application withdrawn successfully.');
    res.redirect('/profile/applications');
  }));

  // GET /profile/matches - Personalized job matches for candidates
  router.get('/matches', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId });

    if (!profile) return res.redirect('/profile/edit');

    // Enhanced matching logic with scoring
    let matchConditions = {
      status: 'approved',
      isActive: true
    };

    // Location matching
    if (profile.location || profile.preferredLocations?.length > 0) {
      const locations = [];
      if (profile.location) locations.push(profile.location);
      if (profile.preferredLocations) locations.push(...profile.preferredLocations);

      matchConditions.$or = matchConditions.$or || [];
      matchConditions.$or.push(
        { location: { $in: locations } },
        { city: { $in: locations } },
        { country: profile.country }
      );
    }

    // Skills matching
    if (profile.skills?.length > 0) {
      matchConditions.$or = matchConditions.$or || [];
      matchConditions.$or.push({ skills: { $in: profile.skills } });
    }

    // Job type matching
    if (profile.preferredJobTypes?.length > 0) {
      matchConditions.type = { $in: profile.preferredJobTypes };
    }

    // Experience level matching
    if (profile.yearsOfExperience) {
      if (profile.yearsOfExperience < 2) {
        matchConditions.experienceLevel = 'Entry';
      } else if (profile.yearsOfExperience < 5) {
        matchConditions.experienceLevel = { $in: ['Entry', 'Mid'] };
      } else if (profile.yearsOfExperience < 8) {
        matchConditions.experienceLevel = { $in: ['Mid', 'Senior'] };
      } else {
        matchConditions.experienceLevel = { $in: ['Senior', 'Lead', 'Executive'] };
      }
    }

    // Salary range matching
    if (profile.expectedSalary?.min || profile.expectedSalary?.max) {
      const salaryFilter = {};
      if (profile.expectedSalary.min) {
        salaryFilter.$or = [
          { 'salary.min': { $gte: profile.expectedSalary.min } },
          { 'salary.max': { $gte: profile.expectedSalary.min } }
        ];
      }
      if (profile.expectedSalary.max) {
        salaryFilter.$and = salaryFilter.$and || [];
        salaryFilter.$and.push({
          $or: [
            { 'salary.max': { $lte: profile.expectedSalary.max } },
            { 'salary.min': { $lte: profile.expectedSalary.max } }
          ]
        });
      }
      if (Object.keys(salaryFilter).length > 0) {
        Object.assign(matchConditions, salaryFilter);
      }
    }

    const jobs = await Job.find(matchConditions)
      .populate('company', 'name logo verified')
      .sort({ createdAt: -1 })
      .limit(50);

    // Calculate match scores
    const jobsWithScores = jobs.map(job => {
      let score = 0;
      const maxScore = 100;

      // Skills match (40% weight)
      const skillMatches = job.skills?.filter(skill => profile.skills?.includes(skill)) || [];
      score += (skillMatches.length / Math.max(job.skills?.length || 1, 1)) * 40;

      // Location match (20% weight)
      const locationMatch = (
        job.location === profile.location ||
        job.city === profile.location ||
        job.country === profile.country ||
        profile.preferredLocations?.includes(job.location) ||
        profile.preferredLocations?.includes(job.city)
      );
      if (locationMatch) score += 20;

      // Job type match (15% weight)
      if (profile.preferredJobTypes?.includes(job.type)) score += 15;

      // Experience level match (15% weight)
      if (profile.yearsOfExperience) {
        const profileLevel = profile.yearsOfExperience < 2 ? 'Entry' :
                           profile.yearsOfExperience < 5 ? 'Mid' :
                           profile.yearsOfExperience < 8 ? 'Senior' : 'Lead';
        if (job.experienceLevel === profileLevel) score += 15;
      }

      // Salary match (10% weight)
      if (profile.expectedSalary && job.salary) {
        const jobMin = job.salary.min || 0;
        const jobMax = job.salary.max || jobMin;
        const profileMin = profile.expectedSalary.min || 0;
        const profileMax = profile.expectedSalary.max || profileMin;

        if (jobMax >= profileMin && jobMin <= profileMax) {
          score += 10;
        }
      }

      return {
        ...job.toObject(),
        matchScore: Math.round(Math.min(score, maxScore)),
        matchReasons: {
          skills: skillMatches.length > 0,
          location: locationMatch,
          jobType: profile.preferredJobTypes?.includes(job.type),
          experience: score > 60 // Rough indicator
        }
      };
    });

    // Sort by match score descending
    jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);

    res.render('matches/index', { jobs: jobsWithScores, profile });
  }));

  router.post('/resume/:versionId/set-primary', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile || !profile.resumeVersions) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const version = profile.resumeVersions.id(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: 'Resume version not found' });
    }

    profile.resumeVersions.forEach(v => v.isPrimary = false);
    version.isPrimary = true;
    profile.resume = { url: version.url, fileName: version.fileName, uploadedAt: version.uploadedAt };
    await profile.save();

    logger.info(`Primary resume set to version ${version.version} for user: ${req.userId}`);
    req.flash('success', 'Primary resume updated!');
    res.redirect('/profile/edit#resume');
  }));

  router.post('/resume/:versionId/delete', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile || !profile.resumeVersions) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const version = profile.resumeVersions.id(req.params.versionId);
    if (!version) {
      return res.status(404).json({ error: 'Resume version not found' });
    }

    if (version.isPrimary && profile.resumeVersions.length > 1) {
      const remaining = profile.resumeVersions.filter(v => v._id.toString() !== req.params.versionId);
      if (remaining.length > 0) {
        remaining[0].isPrimary = true;
        profile.resume = { url: remaining[0].url, fileName: remaining[0].fileName, uploadedAt: remaining[0].uploadedAt };
      }
    }

    const versionToDelete = profile.resumeVersions.find(v => v._id.toString() === req.params.versionId);
    if (versionToDelete) {
      await deleteOldFile(versionToDelete.url);
    }

    profile.resumeVersions = profile.resumeVersions.filter(v => v._id.toString() !== req.params.versionId);
    await profile.save();

    logger.info(`Resume version deleted for user: ${req.userId}`);
    req.flash('success', 'Resume version deleted!');
    res.redirect('/profile/edit#resume');
  }));

  router.get('/applications', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { status, search } = req.query;
    
    const query = { applicantUserId: req.userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('job', 'title location type company salary status')
        .populate({
          path: 'job',
          populate: { path: 'company', select: 'name logo' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query)
    ]);

    const stats = {
      total: await Application.countDocuments({ applicantUserId: req.userId }),
      pending: await Application.countDocuments({ applicantUserId: req.userId, status: 'pending' }),
      shortlisted: await Application.countDocuments({ applicantUserId: req.userId, status: 'shortlisted' }),
      rejected: await Application.countDocuments({ applicantUserId: req.userId, status: 'rejected' }),
      accepted: await Application.countDocuments({ applicantUserId: req.userId, status: 'accepted' }),
      interviewScheduled: await Application.countDocuments({ applicantUserId: req.userId, status: 'interview_scheduled' })
    };

    res.render('profile/applications', {
      applications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { status, search }
    });
  }));

  router.get('/interviews', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      profile = new UserProfile({ userId: req.userId, role: req.user?.role || 'candidate' });
      await profile.save();
    }

    let upcomingInterviews = [];
    let pastInterviews = [];
    
    try {
      upcomingInterviews = await Interview.find({
        candidate: profile._id,
        scheduledAt: { $gte: new Date() },
        status: { $in: ['scheduled', 'confirmed'] }
      })
      .populate({
        path: 'application',
        populate: { path: 'job', populate: { path: 'company', select: 'name logo' } }
      })
      .populate('interviewer', 'name image')
      .sort({ scheduledAt: 1 })
      .limit(10);

      pastInterviews = await Interview.find({
        candidate: profile._id,
        $or: [
          { scheduledAt: { $lt: new Date() } },
          { status: { $in: ['completed', 'cancelled', 'no_show'] } }
        ]
      })
      .populate({
        path: 'application',
        populate: { path: 'job', populate: { path: 'company', select: 'name logo' } }
      })
      .populate('interviewer', 'name image')
      .sort({ scheduledAt: -1 })
      .limit(10);
    } catch (interviewError) {
      logger.warn(`Error fetching interviews for profile ${profile._id}: ${interviewError.message}`);
    }

    res.render('profile/interviews', { upcomingInterviews: upcomingInterviews || [], pastInterviews: pastInterviews || [] });
  }));

  router.post('/interviews/:id/confirm', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      req.flash('error', 'Profile not found');
      return res.redirect('/profile');
    }

    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      req.flash('error', 'Invalid interview ID');
      return res.redirect('/profile/interviews');
    }
    
    const interview = await Interview.findOne({
      _id: req.params.id,
      candidate: profile._id
    });

    if (!interview) {
      req.flash('error', 'Interview not found');
      return res.redirect('/profile/interviews');
    }

    interview.status = 'confirmed';
    await interview.save();

    logger.info(`Interview confirmed: ${interview._id}`);
    req.flash('success', 'Interview confirmed successfully!');
    res.redirect('/profile/interviews');
  }));

  router.post('/interviews/:id/reschedule', asyncHandler(async (req, res) => {
    const { scheduledAt, reason } = req.body;
    const profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      req.flash('error', 'Profile not found');
      return res.redirect('/profile');
    }

    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      req.flash('error', 'Invalid interview ID');
      return res.redirect('/profile/interviews');
    }
    
    const interview = await Interview.findOne({
      _id: req.params.id,
      candidate: profile._id
    });

    if (!interview) {
      req.flash('error', 'Interview not found');
      return res.redirect('/profile/interviews');
    }

    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      req.flash('error', 'Please select a future date and time');
      return res.redirect('/profile/interviews');
    }

    interview.scheduledAt = new Date(scheduledAt);
    interview.status = 'rescheduled';
    interview.candidateNotes = reason;
    await interview.save();

    logger.info(`Interview rescheduled: ${interview._id}`);
    req.flash('success', 'Interview rescheduled successfully!');
    res.redirect('/profile/interviews');
  }));

  router.post('/interviews/:id/cancel', asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const profile = await UserProfile.findOne({ userId: req.userId });
    
    if (!profile) {
      req.flash('error', 'Profile not found');
      return res.redirect('/profile');
    }

    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      req.flash('error', 'Invalid interview ID');
      return res.redirect('/profile/interviews');
    }
    
    const interview = await Interview.findOne({
      _id: req.params.id,
      candidate: profile._id
    });

    if (!interview) {
      req.flash('error', 'Interview not found');
      return res.redirect('/profile/interviews');
    }

    interview.status = 'cancelled';
    interview.candidateNotes = reason;
    await interview.save();

    logger.info(`Interview cancelled: ${interview._id}`);
    req.flash('success', 'Interview cancelled successfully!');
    res.redirect('/profile/interviews');
  }));


  router.get('/export', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="profile-${profile.userId.name}.json"`);
    res.json(profile);
  }));

  return router;
};
