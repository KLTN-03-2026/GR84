/**
 * Auth Service - Production-ready authentication
 * All operations are safe, stable, and logged
 */

import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import { hashPassword, comparePassword } from '../utils/hashPassword.js';
import { generateToken } from '../utils/jwt.js';
import { generateOTP, getOTPExpiry } from '../utils/generateOTP.js';
import { sendOTP } from '../utils/sendEmail.js';
import { validateUsername, validateEmail, validatePassword } from '../utils/validators.js';

// ===========================================
// USER REGISTRATION
// ===========================================

export const registerUser = async ({ username, email, password, confirmPassword }) => {
  const trimmedUsername = username?.trim().toLowerCase() || '';
  const trimmedEmail = email?.trim().toLowerCase() || '';
  const trimmedPassword = password?.trim() || '';

  const usernameError = validateUsername(trimmedUsername);
  if (usernameError) return { error: usernameError, status: 400 };

  const emailError = validateEmail(trimmedEmail);
  if (emailError) return { error: emailError, status: 400 };

  const passwordError = validatePassword(trimmedPassword);
  if (passwordError) return { error: passwordError, status: 400 };

  if (trimmedPassword !== (confirmPassword || '').trim()) {
    return { error: 'Passwords do not match', status: 400 };
  }

  const existingUser = await User.findOne({
    $or: [
      { email: trimmedEmail },
      { username: trimmedUsername }
    ]
  });

  if (existingUser) {
    if (existingUser.email === trimmedEmail) {
      return { error: 'Email already registered', status: 400 };
    }
    return { error: 'Username already taken', status: 400 };
  }

  const passwordHash = await hashPassword(trimmedPassword);

  const user = await User.create({
    username: trimmedUsername,
    email: trimmedEmail,
    passwordHash,
    loginMethod: 'email',
    isEmailVerified: false,
    profileCompletion: 0
  });

  const token = generateToken(user._id);

  return {
    user: sanitizeUser(user),
    token,
    profileCompletion: 0,
    needsOnboarding: true
  };
};

// ===========================================
// USER LOGIN
// ===========================================

export const loginUser = async ({ email, password, username, facebookId, googleId }, req = null) => {
  const normalizedPassword = password?.trim() || '';
  const identifier = (email || username)?.trim().toLowerCase();

  if (facebookId) {
    return handleSocialLogin('facebook', facebookId, req);
  }

  if (googleId) {
    return handleSocialLogin('google', googleId, req);
  }

  if (!identifier || !normalizedPassword) {
    console.log('[Auth] Login failed: Missing identifier or password');
    return { error: 'Email/username and password are required', status: 400 };
  }

  console.log(`[Auth] Login attempt for: ${identifier}`);

  const user = await User.findOne({
    $or: [
      { email: identifier },
      { username: identifier }
    ]
  }).select('+passwordHash');

  if (!user) {
    console.log(`[Auth] Login failed: User not found for ${identifier}`);
    return { error: 'Email hoặc tên người dùng không tồn tại', status: 401 };
  }

  if (!user.passwordHash) {
    console.error(`[Auth] Login failed: User ${identifier} has no passwordHash (social login user)`);
    return { error: 'Tài khoản này đăng nhập bằng Google/Facebook. Vui lòng sử dụng đăng nhập mạng xã hội.', status: 401 };
  }

  if (user.isLocked) {
    console.log(`[Auth] Login failed: Account locked for ${identifier}`);
    return { error: 'Account is locked. Please try again later.', status: 423 };
  }

  const isMatch = await comparePassword(normalizedPassword, user.passwordHash);

  if (!isMatch) {
    console.log(`[Auth] Login failed: Invalid password for ${identifier}`);
    return { error: 'Mật khẩu không đúng. Vui lòng thử lại.', status: 401 };
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLogin: new Date(),
        isOnline: true,
        failedAttempts: 0
      }
    }
  );

  const token = generateToken(user._id);

  if (req) {
    try {
      await UserSession.createSession(user._id, token, req);
    } catch (err) {
      console.error('[Session] Failed to create session:', err.message);
    }
  }

  console.log(`[Auth] Login success for: ${identifier}`);
  return { user: sanitizeUser(user), token };
};

// ===========================================
// SOCIAL LOGIN HANDLER
// ===========================================

async function handleSocialLogin(provider, profileId, req) {
  console.log(`[Auth] Social login attempt via ${provider}`);

  const field = provider === 'google' ? 'googleId' : 'facebookId';
  let user = await User.findOne({ [field]: profileId });

  if (!user && req?.body?.email) {
    const email = req.body.email.trim().toLowerCase();
    user = await User.findOne({ email });

    if (user) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            [field]: profileId,
            loginMethod: provider,
            isEmailVerified: true
          }
        }
      );
      console.log(`[Auth] Linked ${provider} to existing user: ${email}`);
    }
  }

  if (!user) {
    const email = req?.body?.email?.trim().toLowerCase();
    const safeUsername = await generateSafeUsername(
      req?.body?.fullName || email || profileId,
      provider
    );

    const passwordHash = await hashPassword(`social_${provider}_${Date.now()}`);

    user = await User.create({
      [field]: profileId,
      email: email || undefined,
      username: safeUsername,
      fullName: req?.body?.fullName || '',
      avatar: req?.body?.avatar || '',
      loginMethod: provider,
      isEmailVerified: true,
      passwordHash
    });
    console.log(`[Auth] Created new social user: ${safeUsername}`);
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        lastLogin: new Date(),
        isOnline: true
      }
    }
  );

  const token = generateToken(user._id);
  console.log(`[Auth] Social login success: ${provider} user`);

  return { user: sanitizeUser(user), token };
}

// ===========================================
// CURRENT USER
// ===========================================

export const getCurrentUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };
  return { user: sanitizeUser(user) };
};

// ===========================================
// LOGOUT
// ===========================================

export const logoutUser = async (userId, token = null) => {
  await User.updateOne(
    { _id: userId },
    { $set: { isOnline: false } }
  );

  if (token) {
    try {
      await UserSession.revokeByToken(token);
    } catch (err) {
      console.error('[Session] Failed to revoke session on logout:', err.message);
    }
  }

  console.log(`[Auth] User ${userId} logged out`);
  return { success: true };
};

// ===========================================
// LINK SOCIAL ACCOUNT TO USER
// ===========================================

export const linkSocialAccountToUser = async (userId, { facebookId, googleId }) => {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  const provider = facebookId ? 'facebook' : 'google';
  const field = facebookId ? 'facebookId' : 'googleId';
  const idValue = facebookId || googleId;

  const existingUser = await User.findOne({ [field]: idValue });
  if (existingUser && existingUser._id.toString() !== userId) {
    return { error: `${provider} account already linked to another user`, status: 400 };
  }

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        [field]: idValue,
        loginMethod: provider
      }
    }
  );

  console.log(`[Auth] Linked ${provider} to user ${userId}`);
  return { user: sanitizeUser(user) };
};

// ===========================================
// PASSWORD RESET
// ===========================================

export const requestPasswordReset = async ({ email }) => {
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail) return { error: 'Email is required', status: 400 };

  const user = await User.findOne({ email: trimmedEmail });
  if (!user) {
    return { message: 'If your email is registered, you will receive an OTP code' };
  }

  if (user.loginMethod === 'facebook' || user.loginMethod === 'google') {
    return {
      error: `This account uses ${user.loginMethod} login. Please use ${user.loginMethod} to sign in.`,
      status: 400
    };
  }

  const otp = generateOTP();
  const otpExpire = getOTPExpiry();

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        resetOTP: otp,
        resetOtpExpire: otpExpire
      }
    }
  );

  console.log(`[OTP] Generated for ${trimmedEmail}`);
  await sendOTP(trimmedEmail, otp);

  return { message: 'If your email is registered, you will receive an OTP code' };
};

export const verifyPasswordResetOTP = async ({ email, otp }) => {
  const trimmedEmail = email?.trim()?.toLowerCase();
  const trimmedOTP = otp?.trim();

  if (!trimmedEmail || !trimmedOTP) {
    return { error: 'Email and OTP are required', status: 400 };
  }

  const user = await User.findOne({ email: trimmedEmail });
  if (!user) return { error: 'Invalid email or OTP', status: 400 };

  if (!user.resetOTP || !user.resetOtpExpire) {
    return { error: 'No OTP requested. Please request a new OTP.', status: 400 };
  }

  if (new Date() > new Date(user.resetOtpExpire)) {
    return { error: 'OTP has expired. Please request a new OTP.', status: 400 };
  }

  if (user.resetOTP !== trimmedOTP) {
    return { error: 'Invalid OTP. Please try again.', status: 400 };
  }

  console.log(`[OTP] Verified for ${trimmedEmail}`);
  return { message: 'OTP verified successfully' };
};

export const resetUserPassword = async ({ email, otp, newPassword }) => {
  const trimmedEmail = email?.trim()?.toLowerCase();
  const trimmedOTP = otp?.trim();
  const trimmedPassword = newPassword?.trim();

  if (!trimmedEmail || !trimmedOTP || !trimmedPassword) {
    return { error: 'Email, OTP, and new password are required', status: 400 };
  }

  if (trimmedPassword.length < 6) {
    return { error: 'Password must be at least 6 characters', status: 400 };
  }

  const user = await User.findOne({ email: trimmedEmail }).select('+passwordHash');
  if (!user) return { error: 'Invalid email or OTP', status: 400 };

  if (!user.resetOTP || !user.resetOtpExpire) {
    return { error: 'No OTP requested. Please request a new OTP.', status: 400 };
  }

  if (new Date() > new Date(user.resetOtpExpire)) {
    return { error: 'OTP has expired. Please request a new OTP.', status: 400 };
  }

  if (user.resetOTP !== trimmedOTP) {
    return { error: 'Invalid OTP. Please try again.', status: 400 };
  }

  const passwordHash = await hashPassword(trimmedPassword);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        resetOTP: null,
        resetOtpExpire: null
      },
      $unset: {
        resetOTP: '',
        resetOtpExpire: ''
      }
    }
  );

  console.log(`[Auth] Password reset successful for ${trimmedEmail}`);
  return { message: 'Password has been reset successfully. You can now login with your new password.' };
};

// ===========================================
// HELPERS
// ===========================================

async function generateSafeUsername(displayName, provider) {
  const MAX_LENGTH = 30;
  const RANDOM_SUFFIX_LENGTH = 3;

  let baseUsername = (displayName || 'user')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (!baseUsername) baseUsername = 'user';

  const maxBaseLength = MAX_LENGTH - RANDOM_SUFFIX_LENGTH - 1;
  if (baseUsername.length > maxBaseLength) {
    baseUsername = baseUsername.substring(0, maxBaseLength);
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.random().toString(36).substring(2, 2 + RANDOM_SUFFIX_LENGTH);
    const candidateUsername = `${baseUsername}_${randomSuffix}`;
    const existingUser = await User.findOne({ username: candidateUsername });
    if (!existingUser) return candidateUsername;
  }

  const timestampSuffix = Date.now().toString().slice(-5);
  return baseUsername.substring(0, MAX_LENGTH - 6) + '_' + timestampSuffix;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName || '',
    age: user.age || null,
    gender: user.gender || '',
    avatar: user.avatar || null,
    bio: user.bio || '',
    location: user.location || null,
    interests: user.interests || [],
    photos: user.photos || [],
    profileCompletion: user.profileCompletion || 0,
    loginMethod: user.loginMethod,
    isEmailVerified: user.isEmailVerified,
    isOnline: user.isOnline,
    lastLogin: user.lastLogin,
    role: user.role,
    createdAt: user.createdAt
  };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  registerUser,
  loginUser,
  getCurrentUserById,
  logoutUser,
  socialLogin: (data, req) => handleSocialLogin(
    data.facebookId ? 'facebook' : 'google',
    data.facebookId || data.googleId,
    req
  ),
  linkSocialAccountToUser,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetUserPassword
};
