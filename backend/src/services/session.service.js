/**
 * Session Service - Business logic cho Quản trị phiên làm việc (PB23)
 */

import UserSession from '../models/UserSession.js';
import User from '../models/User.js';

/**
 * Lấy danh sách sessions với filter & pagination
 * Dùng cho Admin Dashboard: GET /api/admin/sessions
 */
export const getSessions = async ({
  currentUser,
  page = 1,
  limit = 20,
  status = 'active',
  riskLevel,
  search,
  sortBy = 'loginAt',
  sortOrder = 'desc'
}) => {
  // 1. Xác định danh sách roles mà currentUser có quyền xem
  const getVisibleRoles = (role) => {
    // Map database roles to logic
    if (role === 'super_admin') return ['user', 'premium', 'admin'];
    if (role === 'admin') return ['user', 'premium'];
    return [];
  };

  const visibleRoles = getVisibleRoles(currentUser.role);
  if (visibleRoles.length === 0) {
    return { sessions: [], total: 0, page, totalPages: 0 };
  }

  const filter = {};

  // Filter theo status
  if (status && status !== 'all') {
    filter.status = status;
  }

  // Filter theo risk level
  if (riskLevel && riskLevel !== 'all') {
    filter.riskLevel = riskLevel;
  }

  // 2. Filter theo Role (Bắt buộc)
  // Tìm tất cả users có role nằm trong danh sách visibleRoles
  const userRoleFilter = { role: { $in: visibleRoles } };
  
  // Nếu có search, kết hợp với search
  if (search) {
    const searchTrimmed = search.trim();
    const isIPSearch = /^[\d.]+$/.test(searchTrimmed);

    if (isIPSearch) {
      filter.ipAddress = { $regex: searchTrimmed, $options: 'i' };
    } else {
      userRoleFilter.$or = [
        { username: { $regex: searchTrimmed, $options: 'i' } },
        { fullName: { $regex: searchTrimmed, $options: 'i' } },
        { email: { $regex: searchTrimmed, $options: 'i' } }
      ];
    }
  }

  const matchingUsers = await User.find(userRoleFilter).select('_id').lean();
  
  if (matchingUsers.length === 0) {
    return { sessions: [], total: 0, page: Number(page), totalPages: 0 };
  }

  filter.userId = { $in: matchingUsers.map(u => u._id) };

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [sessions, total] = await Promise.all([
    UserSession.find(filter)
      .populate('userId', 'username fullName avatar email')
      .populate('revokedBy', 'username fullName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    UserSession.countDocuments(filter)
  ]);

  return {
    sessions,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Lấy thống kê sessions
 * Dùng cho dashboard: Tổng phiên, Số người dùng trực tuyến, Số rủi ro cao
 */
export const getSessionStats = async (currentUser) => {
  // Xác định roles hiển thị
  const getVisibleRoles = (role) => {
    if (role === 'super_admin') return ['user', 'premium', 'admin'];
    if (role === 'admin') return ['user', 'premium'];
    return [];
  };

  const visibleRoles = getVisibleRoles(currentUser.role);
  if (visibleRoles.length === 0) {
    return { totalActive: 0, onlineUsers: 0, totalRisky: 0, totalSuspicious: 0, totalHighRisk: 0 };
  }

  // Lấy danh sách User IDs thỏa mãn role
  const visibleUserIds = await User.find({ role: { $in: visibleRoles } }).distinct('_id');

  const [sessionStats, userStats] = await Promise.all([
    UserSession.aggregate([
      { $match: { status: 'active', userId: { $in: visibleUserIds } } },
      {
        $group: {
          _id: null,
          totalActive: { $sum: 1 },
          suspicious: { $sum: { $cond: [{ $eq: ['$riskLevel', 'suspicious'] }, 1, 0] } },
          highRisk: { $sum: { $cond: [{ $eq: ['$riskLevel', 'high_risk'] }, 1, 0] } }
        }
      }
    ]),
    UserSession.distinct('userId', { status: 'active', userId: { $in: visibleUserIds } })
  ]);

  const stats = sessionStats[0] || { totalActive: 0, suspicious: 0, highRisk: 0 };

  return {
    totalActive: stats.totalActive,
    onlineUsers: userStats.length,
    totalRisky: stats.suspicious + stats.highRisk,
    totalSuspicious: stats.suspicious,
    totalHighRisk: stats.highRisk
  };
};

/**
 * Dọn dẹp các session hết hạn và cập nhật trạng thái online của User
 * Chạy định kỳ bởi cron job
 */
export const cleanupExpiredSessions = async () => {
  const now = new Date();

  // 1. Tìm các session đã hết hạn nhưng vẫn ở trạng thái 'active'
  const expiredSessions = await UserSession.find({
    status: 'active',
    tokenExpiresAt: { $lt: now }
  }).select('userId');

  if (expiredSessions.length > 0) {
    console.log(`[Cleanup] Found ${expiredSessions.length} expired sessions. Cleaning up...`);
    
    // 2. Cập nhật status của session thành 'expired'
    await UserSession.updateMany(
      { _id: { $in: expiredSessions.map(s => s._id) } },
      { status: 'expired' }
    );

    // 3. Cập nhật isOnline cho các user bị ảnh hưởng
    const affectedUserIds = [...new Set(expiredSessions.map(s => s.userId.toString()))];
    
    for (const userId of affectedUserIds) {
      const activeSessionsCount = await UserSession.countDocuments({
        userId,
        status: 'active'
      });

      if (activeSessionsCount === 0) {
        await User.findByIdAndUpdate(userId, { isOnline: false });
        console.log(`[Cleanup] Set user ${userId} to offline`);
      }
    }
  }

  return { expiredCount: expiredSessions.length };
};

/**
 * Kill (revoke) 1 session cụ thể
 * Trả về session info + userId để emit force_logout
 */
export const killSession = async (sessionId, currentUser, reason) => {
  const session = await UserSession.findById(sessionId).populate('userId', 'role');

  if (!session) {
    return { error: 'Phiên làm việc không tồn tại', status: 404 };
  }

  if (session.status === 'revoked') {
    return { error: 'Phiên làm việc đã bị ngắt trước đó', status: 400 };
  }

  // Kiểm tra quyền (RBAC)
  const canKill = (adminRole, targetRole) => {
    if (adminRole === 'super_admin') return true; // SuperAdmin kill all
    if (adminRole === 'admin') {
      return ['user', 'premium'].includes(targetRole);
    }
    return false;
  };

  if (!canKill(currentUser.role, session.userId.role)) {
    return { error: 'Bạn không có quyền ngắt phiên của người dùng này', status: 403 };
  }

  const revokedSession = await UserSession.revokeSession(sessionId, currentUser._id, reason);

  return {
    session: revokedSession,
    userId: session.userId
  };
};

/**
 * Kill nhiều sessions cùng lúc (bulk)
 * Trả về danh sách userIds để emit force_logout
 */
export const bulkKillSessions = async (sessionIds, currentUser, reason) => {
  if (!sessionIds || sessionIds.length === 0) {
    return { error: 'Vui lòng chọn ít nhất 1 phiên', status: 400 };
  }

  // Lấy userId và role từ các sessions trước khi revoke để kiểm tra quyền
  const sessions = await UserSession.find({
    _id: { $in: sessionIds },
    status: 'active'
  }).populate('userId', 'role').lean();

  if (sessions.length === 0) {
    return { error: 'Không tìm thấy phiên hoạt động nào', status: 404 };
  }

  // Kiểm tra quyền cho từng session (RBAC)
  const canKill = (adminRole, targetRole) => {
    if (adminRole === 'super_admin') return true;
    if (adminRole === 'admin') return ['user', 'premium'].includes(targetRole);
    return false;
  };

  const allowedSessions = sessions.filter(s => canKill(currentUser.role, s.userId.role));

  if (allowedSessions.length === 0) {
    return { error: 'Bạn không có quyền ngắt bất kỳ phiên nào trong danh sách đã chọn', status: 403 };
  }

  const allowedIds = allowedSessions.map(s => s._id);

  // Revoke các session được phép
  await UserSession.updateMany(
    { _id: { $in: allowedIds }, status: 'active' },
    {
      status: 'revoked',
      revokedAt: new Date(),
      revokedBy: currentUser._id,
      revokeReason: reason || 'Admin bulk kill sessions'
    }
  );

  // Lấy unique userIds để emit force_logout
  const userIds = [...new Set(allowedSessions.map(s => s.userId._id.toString()))];

  return {
    revokedCount: allowedSessions.length,
    userIds
  };
};

export default {
  getSessions,
  getSessionStats,
  killSession,
  bulkKillSessions
};
