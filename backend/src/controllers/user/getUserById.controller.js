import userService from '../../services/user.service.js';
import { resolveUserId } from '../../utils/idResolver.js';

export const getUserById = async (req, res, next) => {
  try {
    const targetUserId = resolveUserId(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid or malformed user ID' });
    }

    const result = await userService.getUserById(targetUserId);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    res.json({ success: true, user: result.user });
  } catch (error) {
    next(error);
  }
};

export default { getUserById };
