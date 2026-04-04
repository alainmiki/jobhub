import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import UserProfile from '../models/UserProfile.js';
import { createAuthMiddleware, isAuthenticated } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { UPLOAD } from '../config/constants.js';

const router = express.Router();

const MAGIC_NUMBERS = {
  'pdf': [0x25, 0x50, 0x44, 0x46],
  'doc': [0xd0, 0xcf, 0x11, 0xe0],
  'docx': [0x50, 0x4b, 0x03, 0x04]
};

const validateMagicNumber = (buffer, ext) => {
  const magic = MAGIC_NUMBERS[ext.toLowerCase()];
  if (!magic) return false;
  
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
};

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.doc', '.docx'];
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Invalid file extension'));
  }
  
  const allowedMime = allowedMimes.includes(file.mimetype) || file.mimetype === '';
  if (!allowedMime) {
    return cb(new Error('Invalid MIME type'));
  }
  
  const buffer = Buffer.alloc(4);
  const fd = fs.openSync(file.path, 'r');
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  
  if (!validateMagicNumber(buffer, ext.replace('.', ''))) {
    fs.unlinkSync(file.path);
    return cb(new Error('File content does not match extension'));
  }
  
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = UPLOAD.RESUME_PATH;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD.MAX_RESUME_SIZE },
  fileFilter
});

export const initProfileRouter = (auth) => {
  router.use(createAuthMiddleware(auth));

  router.get('/', isAuthenticated(auth), async (req, res) => {
    try {
      let profile = await UserProfile.findOne({ userId: req.userId })
        .populate('userId', 'name email image');
      
      if (!profile) {
        profile = new UserProfile({ userId: req.userId, role: 'candidate' });
        await profile.save();
      }
      
      res.render('profile/edit', { profile });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).render('error', { message: 'Failed to load profile' });
    }
  });

  router.post('/', isAuthenticated(auth), upload.single('resume'), async (req, res) => {
    try {
      const profileData = {
        userId: req.userId,
        skills: req.body.skills ? req.body.skills.split(',').map(s => s.trim()) : []
      };
      
      const role = req.body.role;
      if (role) profileData.role = role;
      
      const bio = req.body.bio;
      if (bio) profileData.bio = bio;
      
      const location = req.body.location;
      if (location) profileData.location = location;
      
      if (req.file) {
        profileData.resume = {
          url: `/uploads/resumes/${req.file.filename}`,
          fileName: req.file.originalname,
          uploadedAt: new Date()
        };
      }
      
      if (req.body.education) {
        profileData.education = JSON.parse(req.body.education);
      }
      if (req.body.experience) {
        profileData.experience = JSON.parse(req.body.experience);
      }
      
      const profile = await UserProfile.findOneAndUpdate(
        { userId: req.userId },
        profileData,
        { upsert: true, new: true }
      );
      
      res.redirect('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).render('error', { message: 'Failed to update profile' });
    }
  });

  router.get('/view/:id', async (req, res) => {
    try {
      const profile = await UserProfile.findById(req.params.id)
        .populate('userId', 'name email image');
      
      if (!profile) {
        return res.status(404).render('error', { message: 'Profile not found' });
      }
      
      res.render('profile/view', { profile: profile });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).render('error', { message: 'Failed to load profile' });
    }
  });

  return router;
};

export default initProfileRouter;