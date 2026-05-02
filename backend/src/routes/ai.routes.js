import express from 'express';
import multer from 'multer';
import aiController from '../controllers/ai/ai.controller.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();
const upload = multer();

router.post('/match', authenticate, aiController.getDiscovery);
router.post('/like', authenticate, aiController.sendLike);
router.post('/icebreaker', authenticate, aiController.getIcebreaker);
router.post('/photo/:action', authenticate, upload.single('file'), aiController.handlePhotoAI);
router.post('/sync', authenticate, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'biometricPhoto', maxCount: 1 }
]), aiController.syncProfile);
 router.post('/pass', authenticate, aiController.sendPass);
router.post('/verify-biometric', authenticate, upload.single('file'), aiController.verifyBiometric);

export default router;