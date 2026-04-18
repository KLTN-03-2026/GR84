/**
 * Upload Media Controller - Handle image uploads for chat messages
 */

import path from 'path';
import fs from 'fs';
import config from '../../config/index.js';

// Ensure upload directory exists (for local fallback)
const ensureUploadDir = () => {
  const uploadDir = path.join(config.uploadPath, 'messages');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

export const uploadMessageImage = async (req, res, next) => {
  try {
    // Only ensure local directory if not using Cloudinary
    if (!config.cloudinary?.cloud_name) {
      ensureUploadDir();
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Build URL based on storage type
    let mediaUrl;

    if (req.file.path && req.file.path.startsWith('http')) {
      // Cloudinary returns full secure URL in file.path
      mediaUrl = req.file.path;
      console.log('[Upload] Cloudinary URL:', mediaUrl);
    } else if (req.file.path) {
      // Local storage - build relative URL
      mediaUrl = `/uploads/messages/${req.file.filename}`;
      console.log('[Upload] Local URL:', mediaUrl);
    } else {
      // Alternative: Cloudinary may put URL in different field
      mediaUrl = req.file.secure_url || req.file.url || `/uploads/messages/${req.file.filename}`;
      console.log('[Upload] Alt URL:', mediaUrl);
    }

    return res.json({
      success: true,
      mediaUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    next(error);
  }
};

export default { uploadMessageImage };