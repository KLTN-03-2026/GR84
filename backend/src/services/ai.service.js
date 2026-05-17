import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import User from '../models/User.js';
dotenv.config();

const AI_URL = process.env.AI_URL || process.env.AI_SERVER_URL || process.env.AI_API_URL || 'http://localhost:8000';

const logAIRequest = (method, path, userId = 'N/A') => {
    console.log(`[AI-REQUEST] ${new Date().toISOString()} | Method: ${method} | Path: ${path} | UserID: ${userId} | BaseURL: ${AI_URL ? 'Configured' : 'MISSING'}`);
};

const aiService = {
    generateSuperBio: (age, gender, bio, interests, vibeTags) => {
        const genderText = gender === 'male' ? 'Nam' : 'Nữ';
        const safeInterests = Array.isArray(interests) ? interests : [];
        const safeVibeTags = Array.isArray(vibeTags) ? vibeTags : [];
        const safeBio = bio || "Chưa có tiểu sử";

        return `Tôi là ${genderText}, ${age || 18} tuổi. Giới thiệu: ${safeBio}. Sở thích của tôi là: ${safeInterests.join(', ')}. Vibe phong cách của tôi: ${safeVibeTags.join(', ')}.`;
    },

    syncProfileToAI: async (user, avatarBuffer, originalname) => {
        try {
            logAIRequest('POST', '/register', user._id);
            const formData = new FormData();
            formData.append('user_id', user._id.toString());
            formData.append('age', (user.age || 18).toString());
            formData.append('gender', user.gender === 'male' ? '0' : '1');
            formData.append('lat', user.location?.coordinates[1]?.toString() || '16.047');
            formData.append('lng', user.location?.coordinates[0]?.toString() || '108.206');
            const interestsStr = (user.interests && user.interests.length > 0) ? user.interests.join(', ') : 'Không có';
            const bioText = user.bio || 'Không có';
            const occupationText = user.occupation || 'Chưa cập nhật';
            const lookingForText = user.lookingFor || 'Mở rộng mối quan hệ';

            const superBio = `Nghề nghiệp: ${occupationText}. Sở thích: ${interestsStr}. Giới thiệu: ${bioText}. Tìm kiếm: ${lookingForText}.`;
            formData.append('super_bio', superBio);
            formData.append('interests', JSON.stringify(user.interests || []));

            formData.append('file', avatarBuffer, { filename: originalname || 'avatar.jpg' });

            const response = await axios.post(`${AI_URL}/register`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 60000 
            });

            if (response.data) {
                await User.findByIdAndUpdate(user._id, { aiStatus: 'synced' });
                console.log("[AI] Python đã xử lý Vector Milvus. Đã cập nhật aiStatus: synced cho User:", user._id);
            }
            return response.data;
        } catch (error) {
            console.error("Lỗi Sync Profile AI:", error.response?.data || error.message);
            throw error;
        }
    },
    checkFrame: async (userId, fileBuffer) => {
        return { valid: true, message: "Bypassed by AI Engine" };
    },
    
    uploadPhoto: async (userId, fileBuffer) => {
        return { valid: true, message: "Bypassed by AI Engine" };
    },

    verifyIdFaceWithLive: async (userId, imageBuffer, filename) => {
        try {
            logAIRequest('POST', '/verify-id-face', userId);
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', imageBuffer, { filename: filename || 'live_face.jpg' });

            const response = await axios.post(`${AI_URL}/verify-id-face`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi đọ mặt CCCD:", error.response?.data || error.message);
            throw error;
        }
    },
    verifyActiveLiveness: async (userId, challenge, imageBuffer, originalname) => {
        try {
            logAIRequest('POST', '/verify-active-liveness', userId);
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('challenge', challenge); 
            formData.append('file', imageBuffer, { filename: originalname || 'live.jpg' });

            const response = await axios.post(`${AI_URL}/verify-active-liveness`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 60000
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    getSmartMatches: async (userId, targetGender, minAge, maxAge, lat, lng, swiped_ids = []) => {
        try {
            logAIRequest('POST', '/match', userId);
            const response = await axios.post(`${AI_URL}/match`, {
                user_id: userId.toString(),
                target: parseInt(targetGender),
                min: parseInt(minAge),
                max: parseInt(maxAge),
                lat: parseFloat(lat) || 16.047079,
                lng: parseFloat(lng) || 108.206230,
                swiped_ids: swiped_ids,
                limit: 100
            }, { timeout: 60000 });
            return response.data;
        } catch (error) {
            console.error("LỖI TỪ AI SERVER (Python):", JSON.stringify(error.response?.data || error.message));
            throw error;
        }
    },
    sendLikeAI: async (userId, likedUserId) => {
        try {
            logAIRequest('POST', '/like', userId);
            const response = await axios.post(`${AI_URL}/like`, {
                user_id: userId.toString(),
                likedUserId: likedUserId.toString()
            }, { timeout: 10000 });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Like:", error.response?.data || error.message);
            throw error;
        }
    },
    sendPassAI: async (userId, passedUserId) => {
        try {
            logAIRequest('POST', '/pass', userId);
            const response = await axios.post(`${AI_URL}/pass`, {
                user_id: userId.toString(),
                likedUserId: passedUserId.toString()
            }, { timeout: 10000 });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Pass:", error.response?.data || error.message);
            throw error;
        }
    },

    verifyBiometric: async (userId, imageBuffer, originalname) => {
        try {
            logAIRequest('POST', '/verify-biometric', userId);
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', imageBuffer, { filename: originalname });

            const response = await axios.post(`${AI_URL}/verify-biometric`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 60000 
            });
            
            if (response.status !== 200) {
                console.warn(`[AI-RESPONSE] Path: /verify-biometric | Status: ${response.status}`);
            } else {
                console.log(`[AI-RESPONSE] Path: /verify-biometric | Status: 200 | Verified: ${response.data?.verified}`);
            }

            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const msg = error.response?.data || error.message;
            console.error(`[AI-ERROR] Path: /verify-biometric | Status: ${status || 'N/A'} | Error:`, msg);
            throw error;
        }
    },
    analyzeVibe: async (userId, imageBuffer, originalname) => {
        try {
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', imageBuffer, { filename: originalname || 'vibe.jpg' });

            const response = await axios.post(`${AI_URL}/analyze-vibe`, formData, {
                headers: { ...formData.getHeaders() }
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Vibe Checker:", error.message);
            throw error;
        }
    },

    verifyCccdWithPython: async (userId, frontBuffer, frontName, backBuffer, backName) => {
        try {
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', frontBuffer, { filename: frontName || 'cccd_front.jpg' });

            if (backBuffer) {
                formData.append('file_back', backBuffer, { filename: backName || 'cccd_back.jpg' });
            }

            const response = await axios.post(`${AI_URL}/verify-cccd-full`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi Python CCCD:", error.response?.data || error.message);
            throw error;
        }
    },
    analyzeText: async (text) => {
        try {
            const response = await axios.post(`${AI_URL}/analyze-text`, { text: text });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Anti-Spam:", error.message);
            throw error;
        }
    },

    processImageAI: async (userId, action, imageBuffer, originalname) => {
        try {
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', imageBuffer, { filename: originalname || 'image.jpg' });

            const validActions = ['check-frame', 'enhance-photo', 'upload-photo'];
            if (!validActions.includes(action)) {
                throw new Error("Action không hợp lệ");
            }

            const response = await axios.post(`${AI_URL}/${action}`, formData, {
                headers: { ...formData.getHeaders() }
            });
            return response.data;
        } catch (error) {
            console.error(`Lỗi Photo AI [${action}]:`, error.response?.data || error.message);
            throw error;
        }
    }
};

export default aiService;