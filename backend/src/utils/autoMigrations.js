import User from '../models/User.js';
import Payment from '../models/Payment.js';

/**
 * Hàm chạy auto-migration an toàn khi Backend khởi động
 */
export const runAutoMigrations = async () => {
  try {
    console.log('\n==================================================');
    console.log('[AUTO MIGRATION] Starting database auto-migrations...');
    console.log('==================================================');

    // 1. Kiểm tra số lượng người dùng chưa có cấu trúc membership
    const missingCount = await User.countDocuments({ membership: { $exists: false } });
    console.log(`[AUTO MIGRATION] Users missing membership: ${missingCount}`);

    if (missingCount > 0) {
      // Cập nhật an toàn (chỉ những user chưa có trường membership mới được set mặc định)
      const updateResult = await User.updateMany(
        { membership: { $exists: false } },
        {
          $set: {
            membership: {
              plan: "free",
              status: "inactive",
              premiumUntil: null,
              provider: null,
              lastPaymentId: null
            }
          }
        }
      );
      console.log(`[AUTO MIGRATION] Users updated to free membership: ${updateResult.modifiedCount}`);
    } else {
      console.log('[AUTO MIGRATION] No users missing membership schema. Skipping user backfill.');
    }

    // 2. Thiết lập index cho Payment collection một cách an toàn
    console.log('[AUTO MIGRATION] Ensuring Payment model indexes...');
    await Payment.createIndexes();
    console.log('[AUTO MIGRATION] Payment indexes ensured');

    console.log('==================================================');
    console.log('[AUTO MIGRATION] Completed successfully!');
    console.log('==================================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ [AUTO MIGRATION] Failed during startup:', error.message);
    // Không ném lỗi ra ngoài (throw error) để tránh làm sập server chính
    return false;
  }
};
