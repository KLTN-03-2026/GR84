import matchService from '../../services/match.service.js';
import { io } from '../../index.js';
import User from '../../models/User.js';
import { resolveUserId } from '../../utils/idResolver.js';
import Notification from '../../models/Notification.js';

export const superLikeUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = resolveUserId(req.body.userId);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid or malformed user ID' });
    }

    console.log('[SuperLike] User:', currentUserId, 'super liking:', targetUserId);

    const result = await matchService.superLikeUser(currentUserId, targetUserId);

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    // If not mutual yet, send notification to target user
    if (!result.matched && !result.isSuperMatch) {
      // Find the current user's info for notification
      const currentUser = await User.findById(currentUserId).select('username fullName avatar');
      
      // Emit notification to the target user via socket
      const targetUser = await User.findById(targetUserId).select('socketId');
      if (targetUser?.socketId) {
        io.to(targetUser.socketId).emit('new_like', {
          type: 'super_like',
          from: currentUser,
          message: `${currentUser.username || currentUser.fullName} đã Super Like bạn ⭐`,
          createdAt: new Date()
        });
      }

      // Create DB notification
      try {
        await Notification.create({
          recipient: targetUserId,
          type: 'like',
          from: currentUserId,
          content: 'đã Super Like bạn ⭐',
          read: false
        });
      } catch (notifErr) {
        console.error('[Notification Error] Failed to save superlike notification:', notifErr.message);
      }
    }

    // If it's a Super Match, emit match notification
    if (result.isSuperMatch) {
      const currentUser = await User.findById(currentUserId).select('username fullName avatar');
      const targetUser = await User.findById(targetUserId).select('socketId');
      
      if (targetUser?.socketId) {
        io.to(targetUser.socketId).emit('new_match', {
          matchedBy: currentUser,
          matchId: result.match._id,
          isSuperMatch: true,
          message: `${currentUser.username || currentUser.fullName} đã Super Match với bạn! 🌟`
        });
      }

      // Create DB notification
      try {
        await Notification.create({
          recipient: targetUserId,
          type: 'match',
          matchedBy: currentUserId,
          matchId: result.match._id,
          read: false
        });
      } catch (notifErr) {
        console.error('[Notification Error] Failed to save supermatch notification:', notifErr.message);
      }
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[SuperLike] Error:', error);
    next(error);
  }
};

export default { superLikeUser };
