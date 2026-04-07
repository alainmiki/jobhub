import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';

const UPLOAD_DIR = path.join(process.cwd(), 'src', 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  logger.info(`Created upload directory: ${UPLOAD_DIR}`);
}

const FILE_TYPE_MAP = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'image' || file.fieldname === 'coverImage') {
    if (!FILE_TYPE_MAP[mimeType] || !['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(extension)) {
      return cb(new Error('Image file type not supported. Use JPEG, PNG, GIF, or WebP.'), false);
    }
  } else if (file.fieldname === 'resume') {
    if (!FILE_TYPE_MAP[mimeType] || !['.pdf', '.doc', '.docx'].includes(extension)) {
      return cb(new Error('Resume file type not supported. Use PDF, DOC, or DOCX.'), false);
    }
  } else {
    return cb(new Error('Unknown file field'), false);
  }
  
  cb(null, true);
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 3
  },
  fileFilter: fileFilter
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).render('error', {
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).render('error', {
        message: 'Too many files uploaded. Maximum is 3 files.'
      });
    }
    return res.status(400).render('error', {
      message: `File upload error: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).render('error', {
      message: err.message || 'File upload failed'
    });
  }
  next();
};