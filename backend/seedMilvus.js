import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';

import User from './src/models/User.js';

dotenv.config();

// ==============================
// CONFIG
// ==============================
const AI_API = process.env.AI_URL || "https://nbinh3120-ai-dating.hf.space";

// ==============================
// HELPER
// ==============================

// convert gender -> int (Milvus yêu cầu: 0: Nam, 1: Nữ - Khớp với file test_ui.py của bạn)
function mapGender(gender) {
    if (!gender) return 0;
    gender = gender.toLowerCase();
    if (gender === 'male') return 0; // Sửa lại cho chuẩn logic: Nam = 0, Nữ = 1
    if (gender === 'female') return 1;
    return 0;
}

// convert ObjectId -> int64
function convertUserId(objectId) {
    // lấy 12 ký tự cuối -> convert sang int
    return parseInt(objectId.toString().slice(-12), 16);
}

// tải ảnh
async function downloadImageAsBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error(`❌ Lỗi tải ảnh: ${url}`);
        return null;
    }
}

// ==============================
// CALL FASTAPI
// ==============================
async function sendToAI(user, imageBuffer) {

    const form = new FormData();

    form.append('user_id', convertUserId(user._id));
    form.append('age', user.age || 20);
    form.append('gender', mapGender(user.gender));

    // ==========================================
    // 1. BỔ SUNG GPS
    // Mặc định Đà Nẵng nếu user test chưa có tọa độ
    // ==========================================
    const lat = user.location?.coordinates?.[1] || 16.047079;
    const lng = user.location?.coordinates?.[0] || 108.206230;
    form.append('lat', lat.toString());
    form.append('lng', lng.toString());

    // ==========================================
    // 2. BỔ SUNG SUPER BIO
    // Gom tất cả sở thích, vibe và bio thành 1 đoạn văn bản cho AI đọc
    // ==========================================
    const interests = user.interests && user.interests.length > 0 ? user.interests.join(', ') : 'Nghe nhạc, Đi dạo, Cafe';
    const vibeTags = user.vibeTags && user.vibeTags.length > 0 ? user.vibeTags.join(', ') : 'Hiện đại, Năng động, Vui vẻ';
    const genderText = mapGender(user.gender) === 0 ? 'Nam' : 'Nữ';
    const bioText = user.bio || 'Mình muốn tìm một nửa phù hợp để trò chuyện.';

    const superBio = `Tôi là ${genderText}, ${user.age || 20} tuổi. Giới thiệu: ${bioText}. Sở thích: ${interests}. Vibe phong cách: ${vibeTags}.`;
    form.append('super_bio', superBio);

    form.append('file', imageBuffer, {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg'
    });

    const res = await axios.post(
        `${AI_API}/register`,
        form,
        { headers: form.getHeaders() }
    );

    return res.data;
}

// ==============================
// MAIN
// ==============================
async function syncExistingUsersToMilvus() {

    try {
        // Ưu tiên dùng MONGODB_URI từ file .env để lấy đúng DB thật
        const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dating-app';
        await mongoose.connect(dbUri);
        console.log(`🔗 MongoDB connected to: ${mongoose.connection.host}`);

        const users = await User.find({});
        console.log(`👥 Found ${users.length} users`);

        let success = 0;
        let fail = 0;

        for (const user of users) {

            try {
                if (!user.avatar) {
                    console.log(`⏭️ Skip (no avatar): ${user.username || user.fullName || user._id}`);
                    fail++;
                    continue;
                }

                console.log(`⏳ Processing: ${user.username || user.fullName || user._id}`);

                const imageBuffer = await downloadImageAsBuffer(user.avatar);
                if (!imageBuffer) {
                    fail++;
                    continue;
                }

                await sendToAI(user, imageBuffer);

                console.log(`✅ Synced: ${user.username || user.fullName || user._id}`);
                success++;

                // Tránh spam API làm Hugging Face chặn IP
                await new Promise(r => setTimeout(r, 600));

            } catch (err) {
                console.error(`❌ Fail: ${user.username || user.fullName || user._id}`, err.response?.data || err.message);
                fail++;
            }
        }

        console.log('\n🎉 HOÀN TẤT ĐỒNG BỘ!');
        console.log(`✅ Thành công: ${success}`);
        console.log(`❌ Bỏ qua/Thất bại: ${fail}`);

        process.exit(0);

    } catch (err) {
        console.error('💥 Script error:', err);
        process.exit(1);
    }
}

syncExistingUsersToMilvus();