/**
 * Send Email Utility
 * NODE_ENV = development | production
 * EMAIL_MODE = console | gmail | smtp | resend
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  emailMode: process.env.EMAIL_MODE || 'console',
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS
};

// Generic timeout wrapper
const withTimeout = (promise, ms, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    )
  ]);
};

export const sendOTP = async (email, otp) => {
  console.log("[EMAIL] Checking env");

  // Safe configuration logging
  if (config.emailMode === 'resend') {
    console.log("[EMAIL CONFIG]", {
      mode: "resend",
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
      emailFrom: process.env.EMAIL_FROM || "LoveAI <onboarding@resend.dev>"
    });
  } else {
    console.log("[EMAIL CONFIG]", {
      mode: process.env.EMAIL_MODE || config.emailMode,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT || null,
      smtpSecure: process.env.SMTP_SECURE || null,
      hasSmtpUser: Boolean(process.env.SMTP_USER || process.env.EMAIL_USER),
      hasSmtpPass: Boolean(process.env.SMTP_PASS || process.env.EMAIL_PASS)
    });
  }

  if (config.emailMode === 'console' || (!config.emailMode && config.nodeEnv === 'development')) {
    console.log('========================================');
    console.log('EMAIL OTP (Development Mode)');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`OTP: [PROTECTED]`);
    console.log(`Expires in: 5 minutes`);
    console.log('========================================');
    return { success: true, message: 'OTP logged to console', mode: 'console' };
  }

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://dating-deploy-kxhn.vercel.app';
  const resetLink = `${frontendUrl.replace(/\/$/, '')}/#/forgot-password`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 20px 20px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px;">LoveAI - Password Reset</h1>
      </div>
      <div style="background: #fff9fa; padding: 30px; border-radius: 0 0 20px 20px; border: 1px solid #ffe4e6; border-top: none;">
        <p style="font-size: 16px; color: #333; font-weight: bold;">Xin chào,</p>
        <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">Chúng tôi đã nhận được yêu cầu khôi phục mật khẩu từ tài khoản của bạn. Vui lòng sử dụng mã xác thực OTP bên dưới để hoàn tất việc đổi mật khẩu:</p>
        
        <div style="background: white; padding: 24px; text-align: center; margin: 24px 0; border-radius: 16px; border: 2px dashed #f43f5e; box-shadow: 0 4px 12px rgba(244,63,94,0.02);">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px 0; font-weight: bold; uppercase; tracking-wider;">Mã OTP của bạn:</p>
          <p style="font-size: 38px; font-weight: 900; color: #f43f5e; margin: 0; letter-spacing: 6px;">${otp}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 15px rgba(244,63,94,0.25);">Đi tới trang đặt lại mật khẩu</a>
        </div>

        <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">* Lưu ý: Mã xác nhận OTP này chỉ có hiệu lực trong vòng <strong>5 phút</strong>.</p>
        <p style="font-size: 13px; color: #9ca3af;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này để bảo mật tài khoản.</p>
      </div>
    </div>
  `;

  // Resend API Mode
  if (config.emailMode === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      console.error("[EMAIL CONFIG ERROR] Missing RESEND_API_KEY for resend mode");
      return { success: false, message: "Email service is not configured" };
    }

    try {
      console.log("[EMAIL] Sending with Resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const emailFrom = process.env.EMAIL_FROM || "LoveAI <onboarding@resend.dev>";

      const sendPromise = resend.emails.send({
        from: emailFrom,
        to: email,
        subject: "Mã xác thực đặt lại mật khẩu",
        html: htmlContent
      });

      const result = await withTimeout(sendPromise, 15000, "Resend send email");

      if (result.error) {
        console.error("[EMAIL ERROR] Resend reported failure:", result.error);
        return { success: false, message: result.error.message || "Resend send email failed" };
      }

      console.log("[EMAIL] Resend mail sent successfully");
      return { success: true, message: 'OTP sent via Resend', mode: 'resend' };
    } catch (error) {
      console.error("[EMAIL ERROR]", {
        name: error.name,
        message: error.message
      });
      return { success: false, message: 'Failed to send email via Resend: ' + error.message };
    }
  }

  // Gmail and SMTP flow using nodemailer
  let transporter = null;
  let fromAddress = '';

  let smtpHost = '';
  let smtpPort = 587;
  let smtpSecure = false;
  let smtpUser = '';
  let smtpPass = '';

  if (config.emailMode === 'gmail') {
    if (!config.emailUser || !config.emailPass) {
      console.error("[EMAIL CONFIG ERROR] Missing EMAIL_USER or EMAIL_PASS for gmail mode");
      return { success: false, message: "Email service is not configured" };
    }

    console.log("[EMAIL] Gmail mode active - using SMTP fallback config (smtp.gmail.com:587)");
    smtpHost = "smtp.gmail.com";
    smtpPort = 587;
    smtpSecure = false;
    smtpUser = config.emailUser;
    smtpPass = config.emailPass;

  } else if (config.emailMode === 'smtp') {
    smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    smtpPort = Number(process.env.SMTP_PORT || 587);
    smtpSecure = String(process.env.SMTP_SECURE) === "true";
    smtpUser = process.env.SMTP_USER || config.emailUser;
    smtpPass = process.env.SMTP_PASS || config.emailPass;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      const missing = [];
      if (!smtpHost) missing.push('SMTP_HOST');
      if (!smtpPort) missing.push('SMTP_PORT');
      if (!smtpUser) missing.push('SMTP_USER/EMAIL_USER');
      if (!smtpPass) missing.push('SMTP_PASS/EMAIL_PASS');
      console.error(`[EMAIL CONFIG ERROR] Missing SMTP env: ${missing.join(', ')}`);
      return { success: false, message: "Email service is not configured" };
    }

    // Validate port/secure pairs
    if (smtpPort === 587 && smtpSecure === true) {
      console.error("[EMAIL CONFIG ERROR] Incorrect port/secure pair: Port 587 must have SMTP_SECURE set to false");
      return { success: false, message: "Email service is not configured" };
    }
    if (smtpPort === 465 && smtpSecure === false) {
      console.error("[EMAIL CONFIG ERROR] Incorrect port/secure pair: Port 465 must have SMTP_SECURE set to true");
      return { success: false, message: "Email service is not configured" };
    }

  } else {
    console.error(`[EMAIL CONFIG ERROR] Unknown or unsupported EMAIL_MODE: ${config.emailMode}`);
    return { success: false, message: "Email service is not configured" };
  }

  console.log("[EMAIL] Creating transporter");
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  fromAddress = process.env.EMAIL_FROM || smtpUser;

  const mailOptions = {
    from: fromAddress.includes('<') ? fromAddress : `"LoveAI Team" <${fromAddress}>`,
    to: email,
    subject: 'Mã xác thực đặt lại mật khẩu',
    html: htmlContent
  };

  try {
    console.log("[EMAIL] Verifying transporter");
    await withTimeout(transporter.verify(), 10000, "SMTP verify");
    console.log("[EMAIL] Transporter verified");

    console.log("[EMAIL] Sending mail");
    await withTimeout(transporter.sendMail(mailOptions), 15000, "SMTP sendMail");
    console.log("[EMAIL] Mail sent successfully");

    return { success: true, message: 'OTP sent to email', mode: config.emailMode };
  } catch (error) {
    console.error("[EMAIL ERROR]", {
      name: error.name,
      code: error.code,
      message: error.message,
      command: error.command
    });
    return { success: false, message: 'Failed to send email: ' + error.message };
  }
};

export default { sendOTP };
