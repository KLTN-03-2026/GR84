/**
 * UserProfile Controller - Handle HTTP requests for profile management
 * PB06 - Personal Profile Management
 */

import {
  getProfileByUserId,
  createOrUpdateProfile,
  getProfileStats
} from '../../services/userProfile.service.js';
import { sendSuccess, sendError, sendValidationError } from '../../utils/apiResponse.js';
import aiMatchService from '../../services/ai.service.js';
import User from '../../models/User.js';
import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs/promises';
/**
 * GET /api/profile
 * Get current user's profile
 * Requires authentication (JWT)
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  // Try dd/mm/yyyy
  const dmyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(dmyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  // Try ISO or standard
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const profile = {
      id: user._id.toString(),
      _id: user._id.toString(),
      userId: user._id.toString(),
      fullName: user.fullName || user.username || '',
      email: user.email || '',
      gender: user.gender || '',
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : null,
      age: user.age || null,
      bio: user.bio || '',
      avatar: user.avatar || '',
      photos: user.photos || [],
      locationText: user.locationText || '',
      occupation: user.occupation || '',
      education: user.education || '',
      height: user.height || null,
      drinking: user.drinking || '',
      smoking: user.smoking || '',
      lookingFor: user.lookingFor || '',
      interests: user.interests || [],
      preferences: {
        maxDistance: user.preferences?.maxDistance || 25,
        minAge: user.preferences?.minAge || 18,
        maxAge: user.preferences?.maxAge || 50,
        gender: user.preferences?.gender || 'both'
      },
      verificationLevel: user.verificationLevel || 1,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return sendSuccess(res, {
      profile,
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};


/**
 * PUT /api/profile
 * Create or update current user's profile
 * Requires authentication (JWT)
 * 
 * Body:
 * {
 *   fullName: string (required)
 *   gender: 'male' | 'female' | 'other' | ''
 *   dateOfBirth: ISO date string (required, age >= 18)
 *   bio: string
 *   preferences: {
 *     maxDistance: number (1-500 km)
 *     preferredAgeRange: { min: number, max: number }
 *     preferredGender: 'male' | 'female' | 'other' | 'all'
 *   }
 * }
 */
const getImageBuffer = async (file) => {
  if (file.path && file.path.startsWith('http')) {
    // Nếu ảnh đang ở trên Cloudinary
    const response = await axios.get(file.path, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } else if (file.path) {
    // Nếu ảnh lưu trên disk local
    return await fs.readFile(file.path);
  }
  return file.buffer;
};
export const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const files = req.files;
    const aiUserId = parseInt(userId.toString().slice(-12), 16);
    const currentUserProfile = await User.findById(userId);
    let verificationLevel = currentUserProfile?.verificationLevel || 1;
    const allowedFields = [
      'fullName', 'bio', 'gender', 'age', 'interests',
      'locationText', 'occupation', 'education', 'height',
      'drinking', 'smoking', 'lookingFor'
    ];

    const updateData = {};

    for (let key of allowedFields) {
      if (req.body[key] !== undefined) {
        let value = req.body[key];

        // Handle JSON strings from FormData
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parse fails
          }
        }

        updateData[key] = value;
      }
    }

    // Handle preferences and dateOfBirth specifically
    if (req.body.preferences) {
      updateData.preferences = typeof req.body.preferences === 'string'
        ? JSON.parse(req.body.preferences)
        : req.body.preferences;
    }

    if (req.body.dateOfBirth) {
      const birthDate = parseDate(req.body.dateOfBirth);
      if (!birthDate) {
        return res.status(400).json({
          success: false,
          message: 'Ngày sinh không đúng định dạng. Vui lòng sử dụng dd/mm/yyyy hoặc yyyy-mm-dd.'
        });
      }

      updateData.dateOfBirth = birthDate;
      // Calculate age
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Validate age: must be between 18 and 100
      if (!Number.isInteger(age) || age < 18 || age > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tuổi của bạn phải từ 18 đến 100 tuổi để sử dụng ứng dụng.'
        });
      }

      updateData.age = age;
    }

    if (req.body.interests) {
      updateData.interests = typeof req.body.interests === 'string'
        ? JSON.parse(req.body.interests)
        : req.body.interests;
    }

    if (req.body.photos) {
      updateData.photos = typeof req.body.photos === 'string'
        ? JSON.parse(req.body.photos)
        : req.body.photos;
    }

    if (updateData.locationText) {
      const coords = await geocode(updateData.locationText);
      if (coords) {
        updateData.location = {
          type: "Point",
          coordinates: coords
        };
      }
    }

    // Handle avatar file
    if (files?.avatar) {
      const avatarFile = files.avatar[0];
      updateData.avatar = avatarFile.path || `/uploads/${avatarFile.filename}`;
      console.log('[ProfileUpdate] req.file (avatar):', avatarFile);
      console.log('[ProfileUpdate] uploaded avatar url:', updateData.avatar);
      
      // Auto-add avatar to photos gallery if gallery is empty or doesn't exist
      const currentPhotos = updateData.photos || currentUserProfile.photos || [];
      if (currentPhotos.length === 0) {
        updateData.photos = [updateData.avatar];
        console.log('[ProfileUpdate] Added avatar to empty photos gallery');
      }
    }

    // Handle multiple photos if any (some versions of frontend might send photos as files)
    if (files?.photos) {
      const photoUrls = files.photos.map(f => f.path || `/uploads/${f.filename}`);
      console.log('[ProfileUpdate] req.files (photos):', files.photos);
      updateData.photos = [...(updateData.photos || []), ...photoUrls];
    }

    // ================= LƯU DB TRƯỚC TIÊN =================
    // Đảm bảo thông tin user luôn được lưu dù AI Server có lỗi
    console.log('[ProfileUpdate] verification mode:', req.body.verificationMode || 'false');
    console.log('[ProfileUpdate] Updating user in DB:', userId, {
      ...updateData,
      avatar: updateData.avatar ? 'EXISTS' : 'NONE',
      photosCount: updateData.photos?.length || 0
    });

    let profile = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (profile) {
      profile.profileCompletion = profile.calculateProfileCompletion();
      await profile.save();
    }

    // ================= REGISTER AVATAR VỚI AI =================
    if (files?.avatar) {
      try {
        const avatarBuffer = await getImageBuffer(files.avatar[0]);
        // Register avatar in background - don't let it block the response if possible
        aiMatchService.syncProfileToAI(profile, avatarBuffer, 'avatar.jpg')
          .then(() => console.log("✅ [ProfileUpdate] Đã lưu mẫu khuôn mặt vào AI:", userId))
          .catch(err => console.error("❌ [ProfileUpdate] Lỗi Register AI:", err.message));
      } catch (err) {
        console.error("❌ [ProfileUpdate] Lỗi chuẩn bị buffer cho AI:", err.message);
      }
    }

    // ================= VERIFY BIOMETRIC (ONLY IF REQUESTED) =================
    if (files?.biometricPhoto) {
      try {
        console.log('[ProfileUpdate] Processing biometric verification...');
        const bioBuffer = await getImageBuffer(files.biometricPhoto[0]);
        const aiRes = await aiMatchService.verifyBiometric(userId, bioBuffer, 'verify.jpg');

        console.log("[ProfileUpdate] AI VERIFY RESPONSE:", aiRes);

        if (aiRes?.verified === true) {
          profile.isVerifiedProfile = true;
          profile.verificationLevel = 2;
          await profile.save();
          verificationLevel = 2;
          console.log("✅ [ProfileUpdate] Face verified");
        } else {
          verificationLevel = 1;
          console.log("❌ [ProfileUpdate] Face verify failed:", aiRes?.message);
        }
      } catch (err) {
        verificationLevel = 1;
        console.error("❌ [ProfileUpdate] Verify lỗi:", err.response?.data || err.message);
      }
    }

    // ================= ONBOARDING COMPLETION CHECK =================
    // Mandatory: fullName, dateOfBirth, locationText, interests (at least 3)
    const hasName = !!(profile.fullName && profile.fullName.trim());
    const hasDob = !!profile.dateOfBirth;
    const hasLocation = !!(profile.locationText && profile.locationText.trim());
    const hasInterests = !!(profile.interests && profile.interests.length >= 3);

    const isMandatoryFieldsPresent = hasName && hasDob && hasLocation && hasInterests;

    if (isMandatoryFieldsPresent) {
      profile.onboardingCompleted = true;
      profile.status = 'active';
      await profile.save();
      console.log(`[Onboarding] User ${userId} completed onboarding successfully.`);
    } else {
      console.log(`[Onboarding] User ${userId} profile incomplete:`, { hasName, hasDob, hasLocation, hasInterests });
    }

    // ================= RESPONSE =================
    return res.status(200).json({
      success: true,
      verified: verificationLevel >= 2,
      isVerified: verificationLevel >= 2,
      verificationLevel: verificationLevel,
      onboardingCompleted: profile.onboardingCompleted,
      status: profile.status,
      message: profile.onboardingCompleted ? "Hoàn tất đăng ký thành công" : "Thông tin đã được lưu",
      user: profile
    });

  } catch (error) {
    console.error("🔥 Lỗi logic updateMyProfile:", error.message);
    next(error);
  }
};
async function geocode(address) {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json'
      },
      headers: {
        'User-Agent': 'DatingApp/1.0 (contact@datingapp.com)'
      }
    });

    if (!res.data || res.data.length === 0) return null;

    return [
      parseFloat(res.data[0].lon),
      parseFloat(res.data[0].lat)
    ];
  } catch (error) {
    console.error('[Geocode Error]:', error.message);
    return null; // Return null on error so it doesn't crash the whole update
  }
}
/**
 * GET /api/profile/stats
 * Get profile completion statistics
 * Requires authentication (JWT)
 */
export const getMyProfileStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const fieldsCompleted = [];
    let completionPercentage = 0;

    if (user.fullName && user.fullName.trim() !== '') {
      fieldsCompleted.push('fullName');
      completionPercentage += 20;
    }

    if (user.gender && user.gender !== '') {
      fieldsCompleted.push('gender');
      completionPercentage += 10;
    }

    if (user.dateOfBirth) {
      fieldsCompleted.push('dateOfBirth');
      completionPercentage += 15;
    }

    if (user.bio && user.bio.trim() !== '') {
      fieldsCompleted.push('bio');
      completionPercentage += 15;
    }

    if (user.avatar && user.avatar.trim() !== '') {
      fieldsCompleted.push('avatar');
      completionPercentage += 20;
    }

    if (user.interests && user.interests.length > 0) {
      fieldsCompleted.push('interests');
      completionPercentage += 10;
    }

    if (user.photos && user.photos.length > 0) {
      fieldsCompleted.push('photos');
      completionPercentage += 10;
    }

    const stats = {
      hasProfile: true,
      completionPercentage,
      fieldsCompleted,
      totalFields: 7
    };

    return sendSuccess(res, {
      stats,
      message: 'Profile statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const uploadToGallery = async (req, res, next) => {
  try {
    const userId = req.user._id;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file tải lên.'
      });
    }

    const imageUrl = req.file.path || `/uploads/${req.file.filename}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản người dùng.'
      });
    }

    user.photos = user.photos || [];
    if (user.photos.length >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chỉ có thể thêm tối đa 5 bức ảnh vào thư viện.'
      });
    }

    user.photos.push(imageUrl);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đã thêm ảnh vào thư viện thành công!',
      photos: user.photos,
      url: imageUrl
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyProfile,
  updateMyProfile,
  getMyProfileStats,
  uploadToGallery
};

