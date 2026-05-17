import User from '../../models/User.js';
import Match from '../../models/Match.js';
import sessionService from '../../services/session.service.js';

/**
 * @desc    Lấy các chỉ số thống kê tổng quan cho Dashboard
 * @route   GET /api/admin/dashboard/stats
 * @access  Private/Admin
 */
export const getDashboardStats = async (req, res) => {
  try {
    const getVisibleRoles = (role) => {
      if (role === 'super_admin') return ['user', 'premium', 'admin'];
      if (role === 'admin') return ['user', 'premium'];
      return [];
    };

    const visibleRoles = getVisibleRoles(req.user.role);
    const roleFilter = { role: { $in: visibleRoles } };

    const totalUsers = await User.countDocuments(roleFilter);
    const sessionStats = await sessionService.getSessionStats(req.user);
    
    // Đối với matches, ta lọc những match có ít nhất 1 người thuộc role được phép xem
    // Tuy nhiên để đơn giản và chính xác theo context dashboard, ta đếm matches của những users này
    const visibleUserIds = await User.find(roleFilter).distinct('_id');
    const totalMatches = await Match.countDocuments({ 
      isActive: true,
      $or: [
        { user1: { $in: visibleUserIds } },
        { user2: { $in: visibleUserIds } }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        onlineUsers: sessionStats.onlineUsers,
        totalActiveSessions: sessionStats.totalActive,
        totalMatches,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tải dữ liệu thống kê tổng quan',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy dữ liệu tăng trưởng người dùng (theo ngày)
 * @route   GET /api/admin/dashboard/growth
 * @access  Private/Admin
 */
export const getUserGrowth = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const getVisibleRoles = (role) => {
      if (role === 'super_admin') return ['user', 'premium', 'admin'];
      if (role === 'admin') return ['user', 'premium'];
      return [];
    };
    const visibleRoles = getVisibleRoles(req.user.role);

    const growthData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          role: { $in: visibleRoles }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: growthData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tải dữ liệu tăng trưởng người dùng',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy phân bổ giới tính người dùng
 * @route   GET /api/admin/dashboard/gender
 * @access  Private/Admin
 */
export const getGenderDistribution = async (req, res) => {
  try {
    const getVisibleRoles = (role) => {
      if (role === 'super_admin') return ['user', 'premium', 'admin'];
      if (role === 'admin') return ['user', 'premium'];
      return [];
    };
    const visibleRoles = getVisibleRoles(req.user.role);

    const genderDist = await User.aggregate([
      {
        $match: { role: { $in: visibleRoles } }
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format lại dữ liệu cho dễ dùng ở frontend
    const formattedData = {
      male: 0,
      female: 0,
      other: 0,
      unknown: 0
    };

    genderDist.forEach(item => {
      if (item._id === 'male') formattedData.male = item.count;
      else if (item._id === 'female') formattedData.female = item.count;
      else if (item._id === 'other') formattedData.other = item.count;
      else formattedData.unknown += item.count;
    });

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tải dữ liệu phân bổ giới tính',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy danh sách người dùng mới nhất
 * @route   GET /api/admin/dashboard/recent-users
 * @access  Private/Admin
 */
export const getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const getVisibleRoles = (role) => {
      if (role === 'super_admin') return ['user', 'premium', 'admin'];
      if (role === 'admin') return ['user', 'premium'];
      return [];
    };
    const visibleRoles = getVisibleRoles(req.user.role);

    const users = await User.find({ role: { $in: visibleRoles } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('fullName email avatar kycStatus createdAt status');

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách người dùng mới',
      error: error.message
    });
  }
};
