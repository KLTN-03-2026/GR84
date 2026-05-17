/**
 * Forgot Password Controller - Thin layer, delegates to service
 */
import authService from '../../services/auth.service.js';
import config from '../../config/index.js';

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("[FORGOT PASSWORD] Request received:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    console.log("[FORGOT PASSWORD] User lookup started");
    const result = await authService.requestPasswordReset({ email });
    console.log("[FORGOT PASSWORD] User lookup completed");

    if (result.error) {
      console.log("[FORGOT PASSWORD ERROR] Request failed with status:", result.status || 400);
      return res.status(result.status || 400).json({
        success: false,
        message: result.error
      });
    }

    console.log("[FORGOT PASSWORD] Sending response success");
    return res.status(200).json({
      success: true,
      message: result.message,
      ...(config.nodeEnv === 'development' && { _debug: 'Check server console for OTP' })
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD ERROR]", {
      name: error.name,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      message: "Không thể gửi email xác thực. Vui lòng kiểm tra lại sau."
    });
  }
};

export default { forgotPassword };
