// models/Violation.js
import mongoose from 'mongoose';

const violationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['image_nsfw', 'text_toxic', 'image_routing', 'other'], required: true },
    contentUrl: { type: String }, // Ảnh vi phạm (nếu có)
    textContent: { type: String }, // Tin nhắn vi phạm (nếu có)
    ocrText: { type: String }, // Chữ bóc được từ ảnh (nếu có)
    aiScore: { type: Number, required: true }, // Điểm Confidence (VD: 0.95)
    note: { type: String }, // Lý do
    aiDetails: { type: Object }, // Chi tiết PaddleOCR/PhoBERT
    
    // TRẠNG THÁI KIỂM DUYỆT
    status: { 
        type: String, 
        enum: ['PENDING', 'AUTO_BANNED', 'AUTO_WARNED', 'MANUAL_BANNED', 'MANUAL_WARNED', 'IGNORED'],
        default: 'PENDING'
    },
    actionTakenAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Violation', violationSchema);