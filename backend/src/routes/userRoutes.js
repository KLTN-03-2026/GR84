import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import config from '../config/index.js';

import { getUsers } from '../controllers/user/getUsers.controller.js';
import { getUserById } from '../controllers/user/getUserById.controller.js';
import { updateProfile } from '../controllers/user/updateProfile.controller.js';
import { getUserMatches } from '../controllers/user/getUserMatches.controller.js';
import { getRecommendedUsers } from '../controllers/user/getRecommendedUsers.controller.js';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only image files are allowed!'), false);
};

// Storage configuration - use Cloudinary if available, otherwise local
let storage;
let upload;

if (config.cloudinary?.cloud_name) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret
  });

  // Use Cloudinary storage
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'dating-app/profiles',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  });
  console.log('[Upload] Using Cloudinary for profile images');
} else {
  // Create upload directory for local storage
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Use local storage (fallback - NOT for production!)
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  console.warn('[Upload] WARNING: Using local storage for profile images - NOT suitable for production!');
}

// Multer upload configuration
upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});

const router = express.Router();

router.get('/', authenticate, getUsers);
router.get('/recommendations', authenticate, getRecommendedUsers);
router.get('/matches', authenticate, getUserMatches);
router.get('/:id', authenticate, getUserById);
router.put('/profile', authenticate, upload.single('avatar'), updateProfile);

export default router;
