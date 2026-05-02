import aiService from '../../services/ai.service.js';
import User from '../../models/User.js';

const getDiscovery = async (req, res) => {
    try {
        // Chuyển từ req.query sang req.body để nhận dữ liệu từ POST request
        const { target, min, max, swiped_ids } = req.body;

        // Tọa độ lấy từ body, nếu không có thì lấy từ user hoặc mặc định
        const lat = req.body.lat || req.user.location?.coordinates[1] || 16.047079;
        const lng = req.body.lng || req.user.location?.coordinates[0] || 108.206230;

        // swiped_ids lúc này sẽ là một mảng [] gửi từ Frontend, không cần split(',') nữa
        const swipedIdsArray = Array.isArray(swiped_ids) ? swiped_ids : [];

        const aiResponse = await aiService.getSmartMatches(
            req.user._id,
            target,
            min,
            max,
            lat,
            lng,
            swipedIdsArray
        );

        const candidates = aiResponse.data || [];
        if (candidates.length === 0) return res.json({ success: true, data: [] });

        const userIds = candidates.map(c => c.user_id);
        const userDetails = await User.find({ _id: { $in: userIds } }, 'name avatar bio').lean();

        const finalData = candidates.map(candidate => {
            const detail = userDetails.find(u => u._id.toString() === candidate.user_id.toString());
            return {
                ...candidate,
                name: detail?.name || "Người dùng mới",
                avatar: detail?.avatar || "https://i.pravatar.cc/600",
                bio: detail?.bio || ""
            };
        });

        res.json({ success: true, data: finalData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const sendLike = async (req, res) => {
    try {
        const result = await aiService.sendLikeAI(req.user._id, req.body.likedUserId);
        res.json({ success: true, data: result });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const sendPass = async (req, res) => {
    try {
        const { passedUserId } = req.body;
        const result = await aiService.sendPassAI(req.user._id, passedUserId);
        res.status(200).json(result);
    } catch (error) {
        console.error("Lỗi Controller Pass:", error);
        res.status(500).json({ error: error.message });
    }
};

const syncProfile = async (req, res) => {
    try {
        const { age, gender, bio } = req.body;
        let interests = req.body.interests;
        if (typeof interests === 'string') {
            try { interests = JSON.parse(interests); } catch (e) { interests = []; }
        }

        const avatarFile = req.files['avatar'] ? req.files['avatar'][0] : null;
        const biometricFile = req.files['biometricPhoto'] ? req.files['biometricPhoto'][0] : null;

        if (!avatarFile || !biometricFile) {
            return res.status(400).json({ error: "Vui lòng tải lên cả ảnh đại diện và ảnh xác thực." });
        }

        const currentUser = req.user;
        currentUser.age = age;
        currentUser.gender = gender;
        currentUser.bio = bio;
        currentUser.interests = interests;

        res.json({
            success: true,
            message: "Hồ sơ đang được hệ thống AI xử lý nền!"
        });
        aiService.syncProfileToAI(currentUser, avatarFile.buffer, avatarFile.originalname)
            .then((result) => {
                console.log(`[Background Job] Đồng bộ AI thành công cho user ${currentUser._id}`);
            })
            .catch((err) => {
                console.error(`[Background Job] Lỗi AI user ${currentUser._id}:`, err);
            });

    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};

const getIcebreaker = async (req, res) => {
    try {
        const result = await aiService.generateIcebreaker(req.body.myBio, req.body.partnerBio);
        res.json({ success: true, icebreakers: result });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const handlePhotoAI = async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");
        const result = await aiService.processImageAI(req.user._id, req.params.action, req.file.buffer, req.file.originalname);

        // KIỂM TRA PHẢN HỒI TỪ AI SERVER
        if ((req.params.action === 'check-frame' || req.params.action === 'upload-photo') && result) {
            // Kiểm tra 18+ áp dụng cho cả avatar và gallery
            const isNsfw = result.nsfw_score >= 0.8 || result.nsfw >= 80 || (result.nsfw === 100);

            if (req.params.action === 'check-frame') {
                const isFake = result.result === 'fake' || result.is_real === false || result.status === 'fake';
                if (isFake) {
                    return res.status(400).json({ error: "Ảnh không hợp lệ (Phát hiện không phải người thật hoặc không có mặt)." });
                }
            }

            if (isNsfw) {
                return res.status(400).json({ error: "Ảnh vi phạm tiêu chuẩn cộng đồng (18+)." });
            }
        }

        res.json({ success: true, data: result });
    } catch (error) {
        const status = error.response?.status || 500;
        const detail = error.response?.data?.detail || error.response?.data?.message || error.response?.data || error.message;

        // Bỏ qua lỗi không tìm thấy khuôn mặt nếu người dùng đang thêm ảnh vào thư viện
        const type = req.body?.type || 'avatar';
        if (type === 'gallery') {
            const errorStr = String(detail).toLowerCase();
            if (errorStr.includes('face') || errorStr.includes('mặt') || errorStr.includes('fake') || errorStr.includes('người')) {
                return res.json({ success: true, data: { status: 'bypassed_face_check' } });
            }
        }

        res.status(status).json({ detail: detail, error: detail });
    }
};
const verifyBiometric = async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No image uploaded for KYC");
        const result = await aiService.verifyBiometric(req.user._id, req.file.buffer, req.file.originalname);

        // Cập nhật isVerified = true nếu AI xác nhận hợp lệ
        if (result && result.verified) {
            await User.findByIdAndUpdate(req.user._id, { isVerified: true });
        }

        res.json({ success: true, verified: result.verified, data: result, message: 'Xác minh thành công' });
    } catch (error) {
        const status = error.response?.status || 500;
        res.status(status).json({ error: error.response?.data || error.message });
    }
};

export default { getDiscovery, sendLike, sendPass, getIcebreaker, handlePhotoAI, syncProfile, verifyBiometric };