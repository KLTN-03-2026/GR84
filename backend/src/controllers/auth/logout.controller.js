/**
 * Logout Controller - Thin layer, delegates to service
 */
import authService from '../../services/auth.service.js';

export const logout = async (req, res, next) => {
  try {
    // Lấy token từ header để revoke session
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    await authService.logoutUser(req.user._id, token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export default { logout };
