import express from 'express';
import multer from 'multer';
import aiController from '../controllers/ai/ai.controller.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Simple in-memory rate limiter
const rateLimitCache = new Map();
const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}_${req.user?._id || 'guest'}`;
    const now = Date.now();
    const limit = 5; // max 5 requests
    const windowMs = 15 * 60 * 1000; // 15 minutes

    if (!rateLimitCache.has(key)) {
        rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const data = rateLimitCache.get(key);
    if (now > data.resetTime) {
        rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
        return next();
    }

    if (data.count >= limit) {
        return res.status(429).json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.' });
    }

    data.count += 1;
    rateLimitCache.set(key, data);
    next();
};

router.post('/match', authenticate, aiController.getDiscovery);
router.post('/like', authenticate, aiController.sendLike);
router.post('/icebreaker', authenticate, aiController.getIcebreaker);
router.post('/photo/:action', authenticate, upload.single('file'), aiController.handlePhotoAI);
router.post('/sync', authenticate, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'biometricPhoto', maxCount: 1 }
]), aiController.syncProfile);
router.post('/pass', authenticate, aiController.sendPass);
router.post('/verify-biometric', authenticate, rateLimiter, upload.single('file'), aiController.verifyBiometric);
router.post('/vibe', authenticate, upload.single('file'), aiController.analyzeVibe);
router.post('/deep-match', authenticate, aiController.getDeepMatch);
router.post('/active-liveness', authenticate, upload.single('file'), aiController.verifyActiveLiveness);
router.post('/verify-cccd', authenticate, rateLimiter, upload.fields([
    { name: 'cccdFront', maxCount: 1 },
    { name: 'cccdBack', maxCount: 1 }
]), aiController.verifyCccd);
router.post('/upload-gallery', authenticate, upload.single('file'), aiController.uploadSingleGalleryPhoto);
router.get('/violations', authenticate, aiController.getViolations);
router.post('/violations/:id/action', authenticate, aiController.handleViolationAction);
export default router;