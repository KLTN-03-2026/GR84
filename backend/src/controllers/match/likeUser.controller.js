import matchService from '../../services/match.service.js';
import { resolveUserId } from '../../utils/idResolver.js';
import Notification from '../../models/Notification.js';

export const likeUser = async (req, res, next) => {
  try {
    // Decode and resolve target ID safely (either hex ObjectId or Base64 encoded)
    const targetUserId = resolveUserId(req.body.userId);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid or malformed user ID' });
    }

    const result = await matchService.likeUser(req.user._id, targetUserId);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    const io = req.app.get('io');
    const otherUser = req.user;

    // ========== MATCH: Create conversation and navigate ==========
    if (result.matched && result.match) {
      if (io) {
        // Emit to the target user: "You have a new match!"
        io.to(`user:${targetUserId}`).emit('new_match', {
          matchId: result.match._id,
          match: result.match,
          matchedBy: {
            _id: otherUser._id,
            username: otherUser.username,
            fullName: otherUser.fullName,
            avatar: otherUser.avatar,
            age: otherUser.age,
            bio: otherUser.bio
          },
          message: `${otherUser.username || 'Ai đó'} đã thích bạn!`
        });

        console.log(`[Socket.IO] 📢 Sent 'new_match' to user ${targetUserId}`);
      }

      // Create persistent DB notification for target user
      try {
        await Notification.create({
          recipient: targetUserId,
          type: 'match',
          matchedBy: otherUser._id,
          matchId: result.match._id,
          read: false
        });
      } catch (notifErr) {
        console.error('[Notification Error] Failed to save match notification:', notifErr.message);
      }

      // Return match data with conversationId for frontend navigation
      res.json({
        success: true,
        matched: true,
        matchId: result.match._id,
        conversationId: result.match._id, // match._id is the conversationId
        match: result.match,
        message: 'You have a new match!'
      });
    } else {
      // ========== NON-MUTUAL LIKE: Send notification to target user ==========
      if (io) {
        io.to(`user:${targetUserId}`).emit('new_like', {
          from: {
            _id: otherUser._id,
            username: otherUser.username,
            fullName: otherUser.fullName,
            avatar: otherUser.avatar,
            age: otherUser.age,
            bio: otherUser.bio
          },
          message: `${otherUser.username || 'Ai đó'} đã thích bạn`
        });

        console.log(`[Socket.IO] 💖 Sent 'new_like' notification to user ${targetUserId}`);
      }

      // Create persistent DB notification for target user
      try {
        await Notification.create({
          recipient: targetUserId,
          type: 'like',
          from: otherUser._id,
          read: false
        });
      } catch (notifErr) {
        console.error('[Notification Error] Failed to save like notification:', notifErr.message);
      }

      res.json({
        success: true,
        matched: false,
        message: 'User liked successfully'
      });
    }
  } catch (error) {
    next(error);
  }
};

export default { likeUser };
