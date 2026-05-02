/**
 * Login Controller - Thin layer, delegates to service
 */
import authService from '../../services/auth.service.js';

export const login = async (req, res, next) => {
  try {
    console.log('[Login Controller] Received body:', req.body);
    const result = await authService.loginUser(req.body, req);

    if (result.error) {
      console.log('[Login Controller] Auth service returned error:', result.error);
      return res.status(result.status).json({
        success: false,
        message: result.error,
        status: result.status
      });
    }

    console.log('[Login Controller] Login success for user:', result.user?.username);
    res.json({ success: true, token: result.token, user: result.user });
  } catch (error) {
    console.error('[Login Controller] Unexpected error:', error);
    next(error);
  }
};

export default { login };
