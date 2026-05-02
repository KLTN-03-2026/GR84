/**
 * Like User Controller - Thin layer, delegates to service
 * FIX: Return conversationId on match, send notification for non-mutual like
 */
import matchService from '../../services/match.service.js';

export const likeUser = async (req, res, next) => {
  try {
    // Decode the Base64 user ID back to standard string (Database ID format)
    const targetUserIdRaw = req.body.userId;
    const targetUserId = targetUserIdRaw ? Buffer.from(targetUserIdRaw, 'base64').toString('ascii') : null;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
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
