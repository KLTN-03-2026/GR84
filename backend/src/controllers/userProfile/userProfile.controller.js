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
export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile = await getProfileByUserId(userId.toString());

    if (!profile) {
      return sendSuccess(res, {
        profile: null,
        message: 'Profile not found. Please create your profile.'
      });
    }

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
  return file.buffer; // Nếu ảnh lưu trong RAM (memoryStorage)
};
export const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const files = req.files;
    const aiUserId = parseInt(userId.toString().slice(-12), 16);

    let isVerified = false; // 🔥 THÊM BIẾN NÀY

    const allowedFields = [
      'fullName', 'bio', 'gender', 'age', 'interests',
      'locationText', 'occupation', 'education',
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
      updateData.dateOfBirth = req.body.dateOfBirth;
      // Calculate age
      const birthDate = new Date(req.body.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
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
      console.log('[updateMyProfile] New avatar path:', updateData.avatar);
    }

    // ================= REGISTER AVATAR =================
    if (files?.avatar) {
      try {
        const avatarBuffer = await getImageBuffer(files.avatar[0]);

        const syncData = new FormData();
        syncData.append('user_id', aiUserId);

        const genderCode = req.body.gender === 'male' ? 1 : (req.body.gender === 'female' ? 2 : 0);
        syncData.append('gender', genderCode);

        const userAge = req.body.age ? parseInt(req.body.age) : 18;
        syncData.append('age', userAge);

        const superBio = req.body.bio ? req.body.bio.trim() : "Xin chào, rất vui được làm quen!";
        syncData.append('super_bio', superBio);

        if (updateData.location?.coordinates) {
          syncData.append('lng', updateData.location.coordinates[0]);
          syncData.append('lat', updateData.location.coordinates[1]);
        } else {
          syncData.append('lng', 108.20623);
          syncData.append('lat', 16.047079);
        }

        syncData.append('file', avatarBuffer, {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
          knownLength: avatarBuffer.length
        });

        await axios.post(`${process.env.AI_URL}/register`, syncData, {
          headers: syncData.getHeaders(),
          timeout: 45000
        });

        console.log("✅ Đã lưu mẫu khuôn mặt vào AI:", aiUserId);

      } catch (err) {
        console.error("❌ Lỗi Register:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          message: err.response?.data?.detail || err.response?.data?.message || err.response?.data || "Ảnh không hợp lệ hoặc chứa nội dung nhạy cảm."
        });
      }
    }

    // LƯU DB SAU KHI ĐÃ VƯỢT QUA AI
    let profile = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (profile) {
      profile.profileCompletion = profile.calculateProfileCompletion();
      await profile.save();
    }

    // ================= VERIFY BIOMETRIC =================
    if (files?.biometricPhoto) {
      try {
        const bioBuffer = await getImageBuffer(files.biometricPhoto[0]);

        const verifyData = new FormData();
        verifyData.append('user_id', aiUserId);
        verifyData.append('file', bioBuffer, {
          filename: 'verify.jpg',
          contentType: 'image/jpeg'
        });

        const aiRes = await axios.post(
          `${process.env.AI_URL}/verify-biometric`,
          verifyData,
          {
            headers: verifyData.getHeaders(),
            timeout: 45000
          }
        );

        console.log("AI RESPONSE:", aiRes.data); // 🔥 debug

        if (aiRes.data?.verified === true) {
          profile.isVerifiedProfile = true;
          await profile.save();
          isVerified = true; // 🔥 QUAN TRỌNG
          console.log("✅ Face verified");
        } else {
          isVerified = false;
          console.log("❌ Face verify failed:", aiRes.data);
        }

      } catch (err) {
        isVerified = false;
        console.error("❌ Verify lỗi:", err.response?.data || err.message);
      }
    }
    // ================= RESPONSE =================
    return res.status(200).json({
      success: true,
      verified: isVerified, // 🔥 THÊM DÒNG NÀY
      message: isVerified ? "Xác thực thành công" : "Xác thực thất bại",
      user: profile
    });

  } catch (error) {
    console.error("🔥 Lỗi logic:", error.message);
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

    const stats = await getProfileStats(userId.toString());

    return sendSuccess(res, {
      stats,
      message: 'Profile statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyProfile,
  updateMyProfile,
  getMyProfileStats
};
