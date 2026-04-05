import express from 'express';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import Application from '../models/Application.js';
import Interview from '../models/Interview.js';
import { isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { upload } from '../config/multer.js';
import logger from '../config/logger.js';

export const initProfileRouter = (auth) => {
  const router = express.Router();
  router.use(isAuthenticated(auth));

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

    res.render('profile/view', { profile, stats, recentApplications: applications });
  }));

  router.get('/edit', asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image');

    if (!profile) {
      profile = new UserProfile({ userId: req.userId, role: req.user.role || 'candidate' });
      await profile.save();
      await profile.populate('userId', 'name email image');
    }
    res.render('profile/edit', { profile });
  }));

  router.put('/', 
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
      { name: 'resume', maxCount: 1 }
    ]),
    asyncHandler(async (req, res) => {
      const { 
        bio, headline, location, country, phone, website, linkedin, github, twitter,
        role, skills, education, experience,
        preferredJobTypes, preferredLocations,
        expectedSalaryMin, expectedSalaryMax, expectedSalaryCurrency,
        availabilityAvailable, noticePeriod, availabilityStartDate
      } = req.body;
      
      const userUpdates = {};
      if (req.files['image']) userUpdates.image = `/uploads/${req.files['image'][0].filename}`;
      if (req.files['coverImage']) userUpdates.coverImage = `/uploads/${req.files['coverImage'][0].filename}`;
      
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(req.userId, userUpdates);
      }

      const profileUpdates = {
        bio,
        headline,
        location,
        country,
        phone,
        website,
        linkedin,
        github,
        twitter,
        role: role || req.user.role,
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

  router.put('/settings', asyncHandler(async (req, res) => {
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

  router.get('/export', asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email image');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="profile-${profile.userId.name}.json"`);
    res.json(profile);
  }));

  return router;
};
