import matchService from '../../services/match.service.js';
import { resolveUserId } from '../../utils/idResolver.js';

export const passUser = async (req, res, next) => {
  try {
    const targetUserId = resolveUserId(req.body.userId);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid or malformed user ID' });
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
