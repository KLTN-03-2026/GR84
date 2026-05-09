import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
dotenv.config();

const AI_URL = process.env.AI_URL || 'http://localhost:8000';
const aiService = {
    generateSuperBio: (age, gender, bio, interests, vibeTags) => {
        const genderText = gender === 'male' ? 'Nam' : 'Nữ';
        return `Tôi là ${genderText}, ${age} tuổi. Giới thiệu: ${bio}. Sở thích của tôi là: ${interests.join(', ')}. Vibe phong cách của tôi: ${vibeTags.join(', ')}.`;
    },

    // ĐỒNG BỘ HỒ SƠ LÊN MILVUS
    syncProfileToAI: async (user, avatarBuffer, originalname) => {
        try {
            const formData = new FormData();
            formData.append('user_id', user._id.toString());
            formData.append('age', user.age.toString());

            const genderInt = user.gender === 'male' ? 0 : 1;
            formData.append('gender', genderInt.toString());

            formData.append('lat', user.location?.coordinates[1]?.toString() || '16.047079'); // Mặc định Đà Nẵng
            formData.append('lng', user.location?.coordinates[0]?.toString() || '108.206230');

            const superBio = aiService.generateSuperBio(
                user.age, user.gender, user.bio,
                user.interests || [],
                user.vibeTags || ['Năng động', 'Hiện đại']
            );
            formData.append('super_bio', superBio);

            formData.append('file', avatarBuffer, { filename: originalname });

            const response = await axios.post(`${AI_URL}/register`, formData, {
                headers: { ...formData.getHeaders() }
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi Sync AI:", error.response?.data || error.message);
            throw error;
        }
    },

    getSmartMatches: async (userId, targetGender, minAge, maxAge, lat, lng, swiped_ids = []) => {
        try {
            // NÉM THẲNG DATA VÀO BODY, TÊN BIẾN Y HỆT PYTHON MATCHREQUEST
            const response = await axios.post(`${AI_URL}/match`, {
                user_id: userId.toString(),
                target: parseInt(targetGender),
                min: parseInt(minAge),
                max: parseInt(maxAge),
                lat: parseFloat(lat) || 16.047079,
                lng: parseFloat(lng) || 108.206230,
                swiped_ids: swiped_ids,
                limit: 100
            }, {
                timeout: 10000 // 10s timeout
            });
            return response.data;
        } catch (error) {
            // Nếu AI Server không chạy (ECONNREFUSED / timeout) → trả về rỗng thay vì 500
            const isNetworkError = !error.response || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
            if (isNetworkError) {
                console.warn('[AI Service] AI Server offline hoặc timeout — fallback empty list');
                return { data: [] };
            }
            // Các lỗi khác (4xx từ Python) vẫn log rõ
            console.error('LỖI TỪ AI SERVER (Python):', JSON.stringify(error.response?.data || error.message));
            throw error;
        }
    },
    sendLikeAI: async (userId, likedUserId) => {
        try {
            const response = await axios.post(`${AI_URL}/like`, {
                user_id: userId.toString(),
                likedUserId: likedUserId.toString()
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Like:", error.response?.data || error.message);
            throw error;
        }
    },
    sendPassAI: async (userId, passedUserId) => {
        try {
            const response = await axios.post(`${AI_URL}/pass`, {
                user_id: userId.toString(),
                likedUserId: passedUserId.toString()
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi AI Pass:", error.response?.data || error.message);
            throw error;
        }
    },

    // XÁC THỰC 
    verifyBiometric: async (userId, imageBuffer, originalname) => {
        try {
            const formData = new FormData();
            formData.append('user_id', userId.toString());
            formData.append('file', imageBuffer, { filename: originalname });

            const response = await axios.post(`${AI_URL}/verify-biometric`, formData, {
                headers: { ...formData.getHeaders() }
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi KYC:", error.response?.data || error.message);
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