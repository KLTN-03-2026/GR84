import messageService from '../../services/message.service.js';
import aiService from '../../services/ai.service.js'; 
import Violation from '../../models/Violation.js'; // 
import User from '../../models/User.js'; 
import { sendToMatch, sendToUser } from '../../socket/index.js';
import Match from '../../models/Match.js';

export const sendMessage = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;
    const { content, image, mediaUrl, messageType } = req.body;

    const trimmedContent = content?.trim() || '';
    
    if (!trimmedContent && !image && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
    }

    // ============================================
    // 🛡️ BƯỚC 1: KIỂM TRA AI ANTI-SPAM (PADDLEOCR + PHOBERT)
    // ============================================
    if (trimmedContent && (messageType === 'text' || !messageType)) {
      try {
        // Gọi sang AI Server để phân tích nội dung
        const aiCheck = await aiService.analyzeText(trimmedContent);

        if (aiCheck && aiCheck.is_violation) {
          const confidence = aiCheck.confidence || 0;
          const label = aiCheck.label;

          // 1. Phân loại mức độ xử lý (Auto-Pilot)
          let status = 'PENDING';
          let note = 'Chờ Admin kiểm duyệt';
          
          if (confidence >= 0.95) {
            status = 'AUTO_BANNED';
            note = 'AI tự động khóa: Vi phạm quá rõ ràng (>95%)';
            await User.findByIdAndUpdate(userId, { isBanned: true, trustScore: 0 });
          } else if (confidence >= 0.85) {
            status = 'AUTO_WARNED';
            note = 'AI tự động cảnh cáo';
            await User.findByIdAndUpdate(userId, { $inc: { trustScore: -15, warnings: 1 } });
          }

          // 2. Lưu bằng chứng vào bảng Violation để Dashboard Admin hiển thị
          await Violation.create({
            userId: userId,
            type: label === 'toxic' ? 'text_toxic' : 'image_routing',
            textContent: trimmedContent,
            aiScore: confidence,
            note: note,
            status: status,
            aiDetails: { 
              "Nhãn AI": label, 
              "Độ tin cậy": `${(confidence * 100).toFixed(1)}%` 
            }
          });

          // 3. Chặn tin nhắn ngay tại đây
          const errorMsg = label === 'toxic' 
            ? "Tin nhắn vi phạm tiêu chuẩn cộng đồng (Ngôn từ thô tục)!" 
            : "Phát hiện dấu hiệu lôi kéo qua nền tảng khác!";
            
          return res.status(400).json({ success: false, message: errorMsg });
        }
      } catch (aiErr) {
        console.error("AI Check failed, bypassing to ensure UX:", aiErr.message);
        // Nếu AI Server sập, cho phép gửi tin nhắn để không làm gián đoạn trải nghiệm người dùng
      }
    }

    // ============================================
    // BƯỚC 2: GỬI TIN NHẮN (Nếu qua được bộ lọc AI)
    // ============================================
    const result = await messageService.sendMessage(matchId, userId, {
      content: trimmedContent,
      image,
      mediaUrl,
      messageType: messageType || 'text'
    });

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    const message = result.message;

    // ============================================
    // REAL-TIME BROADCAST (Socket.IO)
    // ============================================
    const io = req.app.get('io');
    if (io) {
      sendToMatch(io, matchId, 'receive_message', message);
      const match = await Match.findById(matchId);
      if (match) {
        const otherUserId = match.getOtherUser(userId);
        if (otherUserId) {
          sendToUser(io, otherUserId.toString(), 'unread_update', {
            matchId,
            increment: 1,
            lastMessage: message
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công',
      data: message
    });
  } catch (error) {
    console.error('[SendMessage] Error:', error);
    next(error);
  }
};