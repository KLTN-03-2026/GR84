import aiService from '../../services/ai.service.js';
import userService from '../../services/user.service.js';
import User from '../../models/User.js';
import Profile from '../../models/UserProfile.js';
import { v2 as cloudinary } from 'cloudinary';
import Violation from '../../models/Violation.js';

const getDiscovery = async (req, res) => {
    try {
        const { target, min, max, swiped_ids } = req.body;
        const userInDb = await User.findById(req.user._id);
        if (!userInDb) return res.status(404).json({ success: false, error: "Không tìm thấy user" });

        const lat = req.body.lat || req.user.location?.coordinates?.[1] || 16.047079;
        const lng = req.body.lng || req.user.location?.coordinates?.[0] || 108.206230;

        const swipedIdsArray = Array.isArray(swiped_ids) ? swiped_ids : [];
        const dbSwipedIds = userInDb?.swiped_ids || [];
        const finalExcludedIds = [...new Set([...swipedIdsArray, ...dbSwipedIds.map(id => id.toString())])];

        const aiResponse = await aiService.getSmartMatches(
            req.user._id, target, min, max, lat, lng, swipedIdsArray, finalExcludedIds
        );

        const candidates = aiResponse?.data || [];
        if (candidates.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const userIds = candidates.map(c => c.user_id);

        const userDetails = await User.find(
            { _id: { $in: userIds }, status: 'active' },
            'fullName name avatar photos bio age gender location isVerified verificationLevel interests'
        ).lean();

        const finalData = candidates.reduce((acc, candidate) => {
            const detail = userDetails.find(
                u => u._id.toString() === candidate.user_id.toString()
            );

            if (detail) {
                acc.push({
                    ...candidate,
                    _id: detail._id,
                    id: detail._id,
                    fullName: detail.fullName || detail.name,
                    avatar: detail.avatar || "https://i.pravatar.cc/600",
                    photos: detail.photos || [],
                    bio: detail.bio || "",
                    isVerified: detail.isVerified || false,
                    verificationLevel: detail.verificationLevel || 1,
                    age: detail.age || null,
                    gender: detail.gender || null,
                    location: detail.location || null,
                    interests: detail.interests || []
                });
            }
            return acc;
        }, []);

        res.json({ success: true, data: finalData });

    } catch (error) {
        console.error("DISCOVERY ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const uploadToCloudinary = (buffer, folder = 'dating_app/general') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

const sendLike = async (req, res) => {
    try {
        const { likedUserId } = req.body;
        const userId = req.user._id;
        await User.findByIdAndUpdate(userId, {
            $addToSet: { swiped_ids: likedUserId }
        });
        aiService.sendLikeAI(req.user._id, likedUserId)
            .then(() => console.log(`[AI] Ghi nhận thói quen LIKE cho user ${req.user._id}`))
            .catch(err => console.error("[AI] Lỗi đồng bộ Like ngầm:", err.message));
        res.json({ success: true, message: "Đã thích" });
    } catch (error) {
        console.error("LIKE ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const sendPass = async (req, res) => {
    try {
        const { passedUserId } = req.body;
        const userId = req.user._id;
        await User.findByIdAndUpdate(userId, {
            $addToSet: { swiped_ids: passedUserId }
        });
        aiService.sendPassAI(req.user._id, passedUserId)
            .then(() => console.log(`[AI] Ghi nhận thói quen PASS cho user ${req.user._id}`))
            .catch(err => console.error("[AI] Lỗi đồng bộ Pass ngầm:", err.message));
        res.status(200).json({ success: true, message: "Đã bỏ qua" });
    } catch (error) {
        console.error("PASS ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const syncProfile = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        if (!currentUser) return res.status(404).json({ error: "User not found" });
        const fields = ['fullName', 'age', 'gender', 'bio', 'dateOfBirth', 'occupation', 'lookingFor', 'education', 'height', 'drinking', 'smoking', 'locationText', 'avatar'];

        fields.forEach(field => {
            if (req.body[field]) {
                if (field === 'age') currentUser[field] = parseInt(req.body[field]);
                else if (field === 'fullName') {
                    currentUser.fullName = req.body[field];
                    currentUser.name = req.body[field];
                } else {
                    currentUser[field] = req.body[field];
                }
            }
        });

        const lat = req.body['location[lat]'] || req.body.lat;
        const lng = req.body['location[lng]'] || req.body.lng;
        if (lat && lng) {
            currentUser.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
        }

        let avatarFile = null;
        let biometricFile = null;
        if (req.files && Array.isArray(req.files)) {
            avatarFile = req.files.find(f => f.fieldname === 'avatar');
            biometricFile = req.files.find(f => f.fieldname === 'biometricPhoto');
        } else if (req.files && typeof req.files === 'object') {
            avatarFile = req.files['avatar']?.[0];
            biometricFile = req.files['biometricPhoto']?.[0];
        }

        if (avatarFile) {
            currentUser.avatar = await uploadToCloudinary(avatarFile.buffer);
        }

        currentUser.onboardingCompleted = true;
        let savedUser = await currentUser.save();

        await Profile.findOneAndUpdate(
            { userId: req.user._id },
            {
                fullName: savedUser.fullName,
                bio: savedUser.bio,
                avatar: savedUser.avatar,
                age: savedUser.age,
                gender: savedUser.gender,
                interests: savedUser.interests,
                location: savedUser.location,
                locationText: savedUser.locationText,
                isVerified: savedUser.isVerified || false
            },
            { upsert: true, new: true }
        );

        if (biometricFile) {
            try {
                console.log("[AI-SYNC] Đang đẩy ảnh Sinh trắc học vào Milvus để trích xuất Vector...");
                await aiService.syncProfileToAI(savedUser, biometricFile.buffer, 'biometric_live.jpg');

                // CHỈ KHI PYTHON NHẬN THÀNH CÔNG MỚI CẤP LEVEL 2
                savedUser.verificationLevel = 2;
                savedUser.isVerified = true;
                savedUser.aiStatus = 'synced';
                savedUser = await savedUser.save();

                await Profile.findOneAndUpdate(
                    { userId: req.user._id },
                    { isVerified: true },
                    { new: true }
                );
            } catch (err) {
                console.error("Lỗi AI Sync (Milvus):", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Hệ thống AI không thể đồng bộ khuôn mặt của bạn. Vui lòng thử lại! Lỗi: " + err.message
                });
            }
        } else {
            console.log("CẢNH BÁO: Backend KHÔNG nhận được file 'biometricPhoto' từ Frontend gửi lên!");
        }
        res.json({ success: true, user: savedUser });
    } catch (error) {
        console.error("SYNC PROFILE ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
const handlePhotoAI = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No file uploaded" });
        }
        if (req.params.action === 'nsfw-check') {
            const result = await aiService.checkNSFW(req.file.buffer);
            return res.json({ success: true, data: result });
        }
        const result = await aiService.processImageAI(req.user._id, req.params.action, req.file.buffer, req.file.originalname);
        return res.json({ success: true, data: result });
    } catch (error) {
        const status = error.response?.status || 500;
        const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
        const type = req.body?.type || 'avatar';
        if (type === 'gallery') {
            const errorStr = String(detail).toLowerCase();
            const bypassableErrors = ['no face', 'multiple faces', 'bad framing', 'khuôn mặt', 'mặt'];
            const shouldBypass = bypassableErrors.some(err => errorStr.includes(err));
            if (shouldBypass) {
                return res.json({ success: true, data: { status: 'bypassed_face_check' } });
            }
        }
        return res.status(status).json({ success: false, detail, error: detail });
    }
};

export const analyzeVibe = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file" });
        }
        const result = await aiService.analyzeVibe(req.user._id, req.file.buffer, req.file.originalname);
        if (result.status === 'success') {
            await User.findByIdAndUpdate(req.user._id, {
                vibeTags: [result.primary_vibe.name, result.secondary_vibe.name],
                vibeUpdatedAt: Date.now()
            });
            try {
                await aiService.updateVibeEmbedding(req.user._id, result.primary_vibe.name, result.secondary_vibe.name);
            } catch (e) {
                console.error("VIBE EMBEDDING ERROR:", e.message);
            }
        }
        res.json(result);
    } catch (error) {
        console.error("ANALYZE VIBE ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getDeepMatch = async (req, res) => {
    try {
        const { targetId, currentVibe } = req.body;
        const result = await aiService.getDeepMatch(req.user._id, targetId, currentVibe || null);
        res.json(result);
    } catch (error) {
        console.error("DEEP MATCH CONTROLLER ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const uploadSingleGalleryPhoto = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const aiCheck = await aiService.checkFrame(req.user._id, req.file.buffer);
        if (!aiCheck.valid) {
            return res.status(400).json({ success: false, message: aiCheck.message || "Ảnh không đạt chuẩn AI" });
        }

        const url = await uploadToCloudinary(req.file.buffer, 'dating_app/gallery');

        const user = await User.findById(req.user._id);
        if (user) {
            user.photos = user.photos || [];
            user.photos.push(url);
            await user.save();
            await Profile.findOneAndUpdate({ userId: req.user._id }, { photos: user.photos });
        }

        res.json({
            success: true,
            url: url,
            user: user,
            message: "Tải lên và lưu vào Database thành công (Đã qua AI check)"
        });
    } catch (error) {
        console.error("Lỗi Upload Gallery:", error);
        res.status(500).json({ success: false, message: error.message || "Lỗi hệ thống khi tải ảnh" });
    }
};

export const verifyActiveLiveness = async (req, res) => {
    try {
        const result = await aiService.verifyActiveLiveness(req.user._id, req.body.challenge, req.file.buffer);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getIcebreaker = async (req, res) => {
    try {
        const result = await aiService.generateIcebreaker(req.body.myBio, req.body.partnerBio);
        res.json({ success: true, icebreakers: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const verifyBiometric = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, verified: false, message: "Thiếu ảnh xác thực khuôn mặt" });
        }

        const currentUser = await User.findById(req.user._id);
        if (!currentUser || !currentUser.avatar) {
            return res.status(400).json({ success: false, verified: false, message: "Thiếu ảnh hồ sơ để đối chiếu. Vui lòng cập nhật ảnh đại diện trước." });
        }

        const result = await aiService.verifyBiometric(req.user._id, req.file.buffer, req.file.originalname);
        if (result && result.verified) {
            const liveFaceUrl = await uploadToCloudinary(req.file.buffer);
            try {
                console.log("[AI-FIX] Đang cấu trúc lại Vector cho Deepmatch...");
                await aiService.syncProfileToAI(currentUser, req.file.buffer, 'face_sync_deepmatch.jpg');
            } catch (syncErr) {
                console.error("Cảnh báo: Lỗi lúc đồng bộ Vector Deepmatch", syncErr);
            }
            await User.findByIdAndUpdate(req.user._id, {
                isVerified: true,
                verificationLevel: 2,
                verifiedFaceUrl: liveFaceUrl,
                aiStatus: 'synced'
            });

            await Profile.findOneAndUpdate({ userId: req.user._id }, { isVerified: true });

            return res.json({
                success: true,
                verified: true,
                verificationLevel: 2,
                message: 'Xác minh khuôn mặt thành công',
                data: result
            });

            // Sync to Profile
            await Profile.findOneAndUpdate(
                { userId: req.user._id },
                { isVerified: true }
            );

            return res.json({
                success: true,
                verified: true,
                verificationLevel: 2,
                isVerified: true,
                message: 'Xác minh khuôn mặt thành công',
                data: result
            });
        }

        return res.json({
            success: false,
            verified: false,
            verificationLevel: 1,
            isVerified: false,
            message: result?.message || 'Khuôn mặt không khớp',
            data: result
        });

    } catch (error) {
        console.error("VERIFY BIOMETRIC ERROR:", error.message);
        let status = error.response?.status || 500;
        let message = "Lỗi hệ thống khi xác thực";

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            status = 503;
            message = "AI service timeout, vui lòng thử lại sau (Hệ thống AI đang khởi động)";
        } else if (status === 503 || status === 502 || status === 504) {
            status = 503;
            message = "AI service hiện không khả dụng, vui lòng thử lại sau";
        } else if (error.response?.data) {
            const aiData = error.response.data;
            message = aiData.message || aiData.error || aiData.detail || message;
        } else {
            message = error.message || message;
        }

        const finalMessage = typeof message === 'string' ? message : JSON.stringify(message);
        return res.status(status).json({ success: false, verified: false, message: finalMessage, error: finalMessage });
    }
};

export const getViolations = async (req, res) => {
    try {
        const queue = await Violation.find({ status: 'PENDING' })
            .populate('userId', 'fullName username avatar trustScore isAiVerified')
            .sort({ createdAt: -1 }).limit(50);
        const aiLogs = await Violation.find({ status: { $in: ['AUTO_BANNED', 'AUTO_WARNED'] } })
            .populate('userId', 'username avatar')
            .sort({ createdAt: -1 }).limit(20);
        res.json({ success: true, queue, aiLogs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const handleViolationAction = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;
        const violation = await Violation.findById(id);
        let status = 'IGNORED';

        if (action === 'warn') {
            status = 'MANUAL_WARNED';
            await User.findByIdAndUpdate(violation.userId, { $inc: { trustScore: -15, warnings: 1 } });
        } else if (action === 'ban') {
            status = 'MANUAL_BANNED';
            await User.findByIdAndUpdate(violation.userId, { isBanned: true, trustScore: 0 });
        }

        violation.status = status;
        violation.actionTakenAt = new Date();
        await violation.save();

        res.json({ success: true, message: `Đã xử lý: ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const verifyCccd = async (req, res) => {
    try {
        if (!req.files || !req.files['cccdFront']) {
            return res.status(400).json({ error: "Vui lòng tải lên ảnh mặt trước CCCD" });
        }

        const frontFile = req.files['cccdFront'][0];
        const backFile = req.files['cccdBack'][0];
        const pythonResult = await aiService.verifyCccdWithPython(
            req.user._id,
            frontFile.buffer,
            frontFile.originalname,
            backFile.buffer,
            backFile.originalname
        );
        console.log("👀 DỮ LIỆU PYTHON TRẢ VỀ:", JSON.stringify(pythonResult, null, 2));
        if (!pythonResult.success) {
            return res.status(400).json({ error: pythonResult.message });
        }

        const ocrData = pythonResult.ocr_data;
        const idNumber = ocrData.id_number;
        const dob = ocrData.dob;

        if (!idNumber) {
            return res.status(400).json({ error: "Không thể đọc được số CCCD, vui lòng chụp lại rõ nét hơn." });
        }

        const existingUser = await User.findOne({
            verifiedIdNumber: idNumber,
            _id: { $ne: req.user._id }
        });

        if (existingUser) {
            return res.status(400).json({ error: "CCCD này đã được sử dụng cho một tài khoản khác để đảm bảo an toàn." });
        }

        const updateData = {
            verificationLevel: 3,
            verifiedDob: dob,
            verifiedIdNumber: idNumber,
            cccdVerifiedAt: new Date()
        };

        await User.findByIdAndUpdate(req.user._id, updateData);

        res.json({
            success: true,
            verified: true,
            verificationLevel: 3,
            message: 'Xác minh CCCD thành công',
            ocrData: { dob: dob, id: idNumber }
        });
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || "Lỗi hệ thống khi phân tích CCCD";
        console.error("Lỗi Controller Verify CCCD:", errorMessage);
        res.status(500).json({ error: errorMessage });
    }
};

export default {
    getDiscovery, sendLike, sendPass, getIcebreaker,
    handlePhotoAI, syncProfile, verifyBiometric, getViolations, handleViolationAction,
    analyzeVibe, getDeepMatch, verifyActiveLiveness, verifyCccd, uploadSingleGalleryPhoto
};