/**
 * Database Migration Utility
 * Chứa logic cập nhật dữ liệu chat và thiết lập collection notifications
 * Có thể chạy từ startup server hoặc từ script độc lập
 */

import mongoose from 'mongoose';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

export const runDatabaseMigration = async () => {
  try {
    console.log('\n==================================================');
    console.log('[Migration] Starting database migration tasks...');
    console.log('==================================================');

    // =========================================================================
    // 1. TẠO COLLECTION NOTIFICATIONS & THIẾT LẬP INDEXES
    // =========================================================================
    console.log('\n--- PHẦN 1: Thiết lập collection notifications ---');
    const collections = await mongoose.connection.db.listCollections({ name: 'notifications' }).toArray();
    if (collections.length === 0) {
      console.log('[Migration] Creating notifications collection...');
      await mongoose.connection.db.createCollection('notifications');
      console.log('[Migration] Notifications collection created.');
    } else {
      console.log('[Migration] Notifications collection already exists.');
    }

    const collection = mongoose.connection.db.collection('notifications');
    console.log('[Migration] Ensuring notification indexes...');
    
    // Index hỗ trợ tìm kiếm nhanh theo người nhận và thời gian
    await collection.createIndex({ recipient: 1, createdAt: -1 });
    await collection.createIndex({ recipient: 1, read: 1 });
    await collection.createIndex({ matchId: 1 });
    await collection.createIndex({ sender: 1 });
    
    // Index độc nhất chống duplicate cho thông báo tin nhắn (messageId unique & sparse)
    await collection.createIndex({ messageId: 1 }, { unique: true, sparse: true });
    console.log('[Migration] Notification indexes ensured.');

    // =========================================================================
    // 2. CẬP NHẬT MATCH COLLECTION CHO FIELD SORT CONVERSATION
    // =========================================================================
    console.log('\n--- PHẦN 2: Backfill dữ liệu sắp xếp cho Match ---');
    console.log('[Migration] Fetching all Matches...');
    const matches = await Match.find({});
    console.log(`[Migration] Found ${matches.length} Matches.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      // Tìm tin nhắn mới nhất thuộc về Match này
      const latestMessage = await Message.findOne({
        $or: [
          { matchId: match._id },
          { conversationId: match._id }
        ]
      }).sort({ createdAt: -1 });

      let needsUpdate = false;
      const updateData = {};

      if (latestMessage) {
        const latestTime = latestMessage.createdAt;

        // Chỉ cập nhật nếu lastActivity chưa có, bị null hoặc thời gian tin nhắn mới nhất lớn hơn
        if (!match.lastActivity || latestTime > match.lastActivity) {
          updateData.lastActivity = latestTime;
          needsUpdate = true;
        }

        // Chỉ cập nhật nếu lastMessageAt chưa có, bị null hoặc thời gian tin nhắn mới nhất lớn hơn
        if (!match.lastMessageAt || latestTime > match.lastMessageAt) {
          updateData.lastMessageAt = latestTime;
          needsUpdate = true;
        }

        // Cập nhật nội dung tin nhắn cuối cùng nếu chưa khớp
        const latestMsgText = latestMessage.content || (latestMessage.mediaUrl || latestMessage.image ? '[Hình ảnh]' : '');
        if (!match.lastMessage || match.lastMessage !== latestMsgText) {
          updateData.lastMessage = latestMsgText;
          needsUpdate = true;
        }
      } else {
        // Nếu không có tin nhắn nào, set mặc định là updatedAt hoặc createdAt của chính Match đó
        const defaultTime = match.updatedAt || match.createdAt || new Date();
        if (!match.lastActivity) {
          updateData.lastActivity = defaultTime;
          needsUpdate = true;
        }
        if (!match.lastMessageAt) {
          updateData.lastMessageAt = defaultTime;
          needsUpdate = true;
        }
        if (!match.lastMessage) {
          updateData.lastMessage = '';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await Match.findByIdAndUpdate(match._id, { $set: updateData });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`[Migration] Match update completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // =========================================================================
    // 3. BACKFILL NOTIFICATIONS TỪ DỮ LIỆU CŨ (Nếu cấu hình BACKFILL_NOTIFICATIONS=true)
    // =========================================================================
    console.log('\n--- PHẦN 3: Backfill thông báo lịch sử (Tùy chọn) ---');
    const shouldBackfill = process.env.BACKFILL_NOTIFICATIONS === 'true';
    if (shouldBackfill) {
      console.log('[Migration] Backfill notifications enabled (BACKFILL_NOTIFICATIONS=true). Running...');
      
      const recentMessages = await Message.find({})
        .sort({ createdAt: -1 })
        .limit(100);

      let createdNotifCount = 0;
      let skippedNotifCount = 0;

      for (const msg of recentMessages) {
        const mId = msg.matchId || msg.conversationId;
        if (!mId) continue;

        const matchObj = await Match.findById(mId);
        if (!matchObj) continue;

        const senderId = msg.senderId || msg.sender;
        const receiverId = matchObj.getOtherUser(senderId);

        if (receiverId) {
          // Kiểm tra sự tồn tại tránh duplicate
          const exists = await Notification.exists({
            $or: [
              { messageId: msg._id },
              {
                recipient: receiverId,
                type: 'message',
                sender: senderId,
                matchId: matchObj._id,
                content: msg.content || (msg.mediaUrl || msg.image ? '[Hình ảnh]' : ''),
                createdAt: msg.createdAt
              }
            ]
          });

          if (!exists) {
            await Notification.create({
              recipient: receiverId,
              type: 'message',
              sender: senderId,
              matchId: matchObj._id,
              messageId: msg._id,
              content: msg.content || (msg.mediaUrl || msg.image ? '[Hình ảnh]' : ''),
              read: msg.isRead || msg.status === 'seen',
              createdAt: msg.createdAt
            });
            createdNotifCount++;
          } else {
            skippedNotifCount++;
          }
        }
      }
      console.log(`[Migration] Notification backfill completed. Created: ${createdNotifCount}, Skipped/Duplicates: ${skippedNotifCount}`);
    } else {
      console.log('[Migration] Notification backfill disabled. Set BACKFILL_NOTIFICATIONS=true to run backfill.');
    }

    console.log('\n==================================================');
    console.log('[Migration] All database migration tasks finished successfully!');
    console.log('==================================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ [Migration Error] Failed to complete migration:', error.message);
    throw error;
  }
};
