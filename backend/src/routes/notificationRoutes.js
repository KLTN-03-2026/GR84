import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications
} from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getNotifications);
router.patch('/read-all', authenticate, markAllAsRead);
router.patch('/:id/read', authenticate, markAsRead);
router.delete('/', authenticate, clearAllNotifications);

export default router;
