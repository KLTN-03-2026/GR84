/**
 * Pass User Controller - Thin layer, delegates to service
 */
import matchService from '../../services/match.service.js';

export const passUser = async (req, res, next) => {
  try {
    const targetUserIdRaw = req.body.userId;
    const targetUserId = targetUserIdRaw ? Buffer.from(targetUserIdRaw, 'base64').toString('ascii') : null;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const result = await matchService.passUser(req.user._id, targetUserId);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export default { passUser };
