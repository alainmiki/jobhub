import express from 'express';
import Job from '../models/Job.js';
import UserProfile from '../models/UserProfile.js';
import Company from '../models/Company.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import { createAuthMiddleware, isAuthenticated } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();

const calculateMatchScore = (candidateProfile, job) => {
  let score = 0;
  const maxScore = 100;
  
  if (candidateProfile.skills && job.skills) {
    const matchingSkills = candidateProfile.skills.filter(skill =>
      job.skills.some(js => 
        js.toLowerCase() === skill.toLowerCase()
      )
    );
    const skillScore = (matchingSkills.length / job.skills.length) * 30;
    score += Math.min(skillScore, 30);
  }
  
  if (candidateProfile.location && job.location) {
    if (job.location === 'Remote' || candidateProfile.location === job.location) {
      score += 20;
    }
  }
  
  if (job.experienceLevel && candidateProfile.experience) {
    const expYears = candidateProfile.experience.length;
    const levelScores = { 'Entry': 1, 'Mid': 3, 'Senior': 5, 'Lead': 7 };
    const requiredExp = levelScores[job.experienceLevel] || 1;
    if (expYears >= requiredExp) {
      score += 20;
    }
  }
  
  const daysSincePosted = Math.floor(
    (new Date() - job.createdAt) / (1000 * 60 * 60 * 24)
  );
  if (daysSincePosted < 7) score += 15;
  else if (daysSincePosted < 14) score += 10;
  else if (daysSincePosted < 30) score += 5;
  
  if (job.type) score += 15;
  
  return Math.min(score, maxScore);
};

export const initMatchesRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/', isAuthenticated(auth), async (req, res) => {
    try {
      const candidateProfile = await UserProfile.findOne({ userId: req.userId });
      
      if (!candidateProfile) {
        return res.redirect('/profile?complete=true');
      }
      
      const jobs = await Job.find({
        status: 'approved',
        isActive: true
      }).populate('company', 'name logo');
      
      const matches = jobs.map(job => ({
        job,
        score: calculateMatchScore(candidateProfile, job)
      }))
      .filter(m => m.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
      
      res.render('matches/index', { 
        matches, 
        profile: candidateProfile,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    } catch (error) {
      logger.error(`Match loading error: ${error.message}`);
      res.status(500).render('error', { message: 'Failed to load matches' });
    }
  });

  // GET /matches/candidates - Browse candidates for employers
  router.get('/candidates', isAuthenticated(auth), async (req, res) => {
    try {
      const company = await Company.findOne({ userId: req.userId });

      if (!company) {
        req.flash('error', 'You need to create a company profile first');
        return res.redirect('/company/create');
      }

      const { search, skills, location, experience, sort, page = 1 } = req.query;
      const limit = 20;
      const skip = (parseInt(page) - 1) * limit;

      const query = {
        role: 'candidate',
        isActive: true,
        isProfileComplete: true
      };

      if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { headline: searchRegex },
          { bio: searchRegex },
          { skills: searchRegex }
        ];
      }

      if (skills) {
        const skillArray = skills.split(',').map(s => s.trim()).filter(s => s);
        if (skillArray.length > 0) {
          query.skills = { $in: skillArray };
        }
      }

      if (location) {
        const locationRegex = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = query.$or || [];
        query.$or.push(
          { location: locationRegex },
          { country: locationRegex }
        );
      }

      if (experience) {
        if (experience === '0-2') query.yearsOfExperience = { $lte: 2 };
        else if (experience === '3-5') query.yearsOfExperience = { $gte: 3, $lte: 5 };
        else if (experience === '6-10') query.yearsOfExperience = { $gte: 6, $lte: 10 };
        else if (experience === '10+') query.yearsOfExperience = { $gte: 10 };
      }

      let sortOption = { profileCompletionScore: -1, updatedAt: -1 };
      if (sort === 'experience_desc') {
        sortOption = { yearsOfExperience: -1, ...sortOption };
      } else if (sort === 'experience_asc') {
        sortOption = { yearsOfExperience: 1, ...sortOption };
      }

      const [candidates, total] = await Promise.all([
        UserProfile.find(query)
          .populate('userId', 'name email image createdAt')
          .sort(sortOption)
          .skip(skip)
          .limit(limit),
        UserProfile.countDocuments(query)
      ]);

      res.render('matches/candidates', {
        candidates,
        company,
        filters: { search, skills, location, experience, sort },
        pagination: {
          page: parseInt(page),
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    } catch (error) {
      logger.error(`Candidate browsing error: ${error.message}`);
      res.status(500).render('error', { message: 'Failed to load candidates' });
    }
  });

  router.get('/jobs/:id/candidates', isAuthenticated(auth), async (req, res) => {
    try {
      const job = await Job.findById(req.params.id)
        .populate('company');
      
      if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
      }
      
      if (job.postedBy.toString() !== req.userId) {
        return res.status(403).render('error', { message: 'Access denied' });
      }
      
      const candidates = await UserProfile.find({
        role: 'candidate'
      }).populate('userId', 'name email image');
      
      const matches = candidates.map(candidate => ({
        candidate,
        score: calculateMatchScore(candidate, job),
        hasApplied: false
      }))
      .filter(m => m.score >= 30)
      .sort((a, b) => b.score - a.score);
      
      const applications = await Application.find({ job: job._id });
      const appliedIds = applications.map(a => a.candidate.toString());
      
      matches.forEach(m => {
        m.hasApplied = appliedIds.includes(m.candidate._id.toString());
      });
      
      res.render('matches/candidates', { job, matches, csrfToken: req.csrfToken ? req.csrfToken() : '' });
    } catch (error) {
      logger.error(`Candidate match loading error: ${error.message}`);
      res.status(500).render('error', { message: 'Failed to load candidates' });
    }
  });

  router.post('/generate', isAuthenticated(auth), async (req, res) => {
    try {
      const candidates = await UserProfile.find({ role: 'candidate' });
      
      for (const candidate of candidates) {
        const jobs = await Job.find({ status: 'approved', isActive: true });
        
        const matches = jobs.map(job => ({
          job,
          score: calculateMatchScore(candidate, job)
        }))
        .filter(m => m.score >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
        
        if (matches.length > 0) {
          for (const match of matches) {
            const existingNotification = await Notification.findOne({
              recipient: candidate.userId,
              type: 'job_match',
              'data.jobId': match.job._id
            });
            
            if (!existingNotification) {
              const notification = new Notification({
                recipient: candidate.userId,
                type: 'job_match',
                title: 'New Job Match',
                message: `We found a job that matches your profile: ${match.job.title}`,
                link: `/jobs/${match.job._id}`,
                data: { jobId: match.job._id, score: match.score }
              });
              await notification.save();
            }
          }
        }
      }
      
      res.json({ success: true, message: 'Matching process completed' });
    } catch (error) {
      logger.error(`Match generation error: ${error.message}`);
      res.status(500).json({ error: 'Failed to generate matches' });
    }
  });

  return router;
};

export default initMatchesRouter;