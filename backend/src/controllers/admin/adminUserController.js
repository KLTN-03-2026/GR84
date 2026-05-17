import User from '../../models/User.js';
import UserSession from '../../models/UserSession.js';
import AdminLog from '../../models/AdminLog.js';

/**
 * @desc    Lấy danh sách tài khoản người dùng
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
export const getUsers = async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page, 10) || 1;
    const limitNum = parseInt(req.query.limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const search = req.query.search || '';
    const { role, gender, status, startDate, endDate } = req.query;

    // Build query: Hỗ trợ tìm kiếm theo email, username, fullName
    const query = {};

    // RBAC Visibility Logic: Chỉ xem những role được phép
    const getVisibleRoles = (requesterRole) => {
      if (requesterRole === 'super_admin') return ['user', 'premium', 'admin'];
      if (requesterRole === 'admin') return ['user', 'premium'];
      return [];
    };

    const visibleRoles = getVisibleRoles(req.user.role);
    query.role = { $in: visibleRoles };

    // Tìm kiếm text
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    // Các bộ lọc bổ sung
    if (role && visibleRoles.includes(role)) {
      query.role = role;
    } else if (role) {
      // Nếu filter role không hợp lệ so với quyền, trả về rỗng hoặc bỏ qua
      // Ở đây ta chọn ép buộc role filter phải nằm trong visibleRoles
      query.role = { $in: [role].filter(r => visibleRoles.includes(r)) };
    }
    if (gender) query.gender = gender;
    if (status) query.status = status;

    // Lọc theo khoảng thời gian tham gia
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
      // Clean up empty object if somehow datestrings are invalid
      if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
    }

    // Thực hiện tìm kiếm
    const users = await User.find(query)
      .select('username email fullName avatar role gender createdAt isLocked status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Đếm tổng số tài khoản
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách User (Admin):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách người dùng'
    });
  }
};

/**
 * @desc    Thay đổi trạng thái tài khoản (Khóa/Mở Khóa)
 * @route   PUT /api/admin/users/:id/status
 * @access  Private (Admin only)
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;
    const requesterRole = req.user.role;

    // Tìm user mục tiêu
    const user = await User.findById(id);

    // PB19: "Nếu tài khoản không tồn tại, báo: Không thể thực hiện thao tác, vui lòng thử lại sau."
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không thể thực hiện thao tác, vui lòng thử lại sau.'
      });
    }

    // PB19: Security check - Admin không được đụng vào Admin/SuperAdmin
    if (requesterRole === 'admin') {
      if (user.role === 'admin' || user.role === 'super_admin') {
        // PB24: Ghi log thất bại do vi phạm quyền hạn
        await AdminLog.logAction(req.user, 'Khóa/Mở khóa tài khoản', 'Thất bại', `Admin cố gắng thao tác trên tài khoản Admin/SuperAdmin (ID: ${user._id})`, req);

        return res.status(403).json({
          success: false,
          message: 'Từ chối truy cập: Bạn không có quyền thực hiện hành động này trên tài khoản mục tiêu.'
        });
      }
    }
    // Đối với Super Admin: Toàn quyền (không cần check)

    // Toggle trạng thái isLocked
    user.isLocked = !user.isLocked;

    // Đồng bộ với trường status
    user.status = user.isLocked ? 'banned' : 'active';

    // Lưu lại User
    await user.save();

    // NẾU KHÓA TÀI KHOẢN -> KILL ALL SESSIONS NGAY LẬP TỨC
    if (user.isLocked) {
      try {
        console.log(`[Security] Account locked: Revoking all sessions for user ${user._id}`);
        
        // 1. Revoke trong DB
        await UserSession.revokeAllUserSessions(user._id, adminId, 'Tài khoản đã bị khóa bởi quản trị viên');
        
        // 2. Cập nhật trạng thái offline
        await User.findByIdAndUpdate(user._id, { isOnline: false });

        // 3. Emit force_logout qua Socket.IO
        const io = req.app.get('io');
        if (io) {
          // Kick user văng ra ngoài ngay lập tức
          io.to(`user:${user._id}`).emit('force_logout', {
            reason: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
            code: 'ACCOUNT_LOCKED'
          });
          
          // Cập nhật stats cho admin dashboard
          io.to('admin_room').emit('admin_stats_update');
        }
      } catch (err) {
        console.error('[Security] Failed to kill sessions during lock:', err.message);
      }
    }

    // PB24: Ghi nhật ký hệ thống sử dụng Model mới
    const actionStr = user.isLocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
    const descriptionStr = `${requesterRole.toUpperCase()} đã ${user.isLocked ? 'khóa' : 'mở khóa'} tài khoản User (Username: ${user.username}, Role: ${user.role}).`;
    
    await AdminLog.logAction(req.user, actionStr, 'Thành công', descriptionStr, req, {
      targetId: user._id
    });

    // PB19: "Cập nhật trạng thái tài khoản thành công."
    res.json({
      success: true,
      message: 'Cập nhật trạng thái tài khoản thành công.',
      data: {
        _id: user._id,
        username: user.username,
        isLocked: user.isLocked,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Lỗi khi thay đổi trạng thái User (Admin):', error);
    res.status(500).json({
      success: false,
      message: 'Không thể thực hiện thao tác, vui lòng thử lại sau.'
    });
  }
};

/**
 * @desc    Cập nhật vai trò người dùng (user / premium / admin)
 * @route   PUT /api/admin/users/:id/role
 * @access  Private (Admin only)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user._id;
    const requesterRole = req.user.role;

    // 1. Kiểm tra tính hợp lệ của role mới
    const validRoles = ['user', 'premium', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Vai trò không hợp lệ.'
      });
    }

    // 2. Tìm user mục tiêu
    const user = await User.findById(id);

    // PB19: "Nếu tài khoản không tồn tại, báo: Không thể thực hiện thao tác, vui lòng thử lại sau."
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không thể thực hiện thao tác, vui lòng thử lại sau.'
      });
    }

    // 3. PB19: Phân quyền logic (Authorization Guards)

    // Rule Mới: Tuyệt đối không cho phép nâng cấp bất kỳ ai lên super_admin qua API
    if (role === 'super_admin') {
      await AdminLog.logAction(req.user, 'Cập nhật vai trò', 'Thất bại', `Cố gắng nâng cấp user (ID: ${user._id}) lên Super Admin bị chặn bởi hệ thống.`, req);
      return res.status(403).json({
        success: false,
        message: 'Từ chối truy cập: Hệ thống không cho phép thăng cấp lên Super Admin qua giao diện quản trị.'
      });
    }

    // Nếu requester là ADMIN
    if (requesterRole === 'admin') {
      // Rule 3.1: Tuyệt đối không được thao tác trên ADMIN/SUPER_ADMIN khác
      if (user.role === 'admin' || user.role === 'super_admin') {
        await AdminLog.logAction(req.user, 'Cập nhật vai trò', 'Thất bại', `Admin cố gắng đổi quyền của Admin/SuperAdmin khác (ID: ${user._id})`, req);
        return res.status(403).json({
          success: false,
          message: 'Từ chối truy cập: Bạn không có quyền thực hiện hành động này trên tài khoản mục tiêu.'
        });
      }

      // Rule 3.2: Chỉ được phép đổi role giữa USER và PREMIUM
      // Chặn nếu đích đến là admin
      if (role === 'admin') {
        await AdminLog.logAction(req.user, 'Cập nhật vai trò', 'Thất bại', `Admin cố gắng nâng cấp user (ID: ${user._id}) lên Admin bị chặn.`, req);
        return res.status(403).json({
          success: false,
          message: 'Từ chối truy cập: Bạn không có quyền nâng cấp tài khoản lên cấp độ này.'
        });
      }
    }

    // Nếu requester là SUPER_ADMIN: Có toàn quyền (Trừ việc tạo thêm super_admin đã check ở trên)

    // 4. Thực hiện cập nhật
    const oldRole = user.role;
    user.role = role;
    await user.save();

    // 5. Ghi nhật ký hệ thống (Logging) - PB24
    const descriptionStr = `${requesterRole.toUpperCase()} đã đổi quyền User (Username: ${user.username}) từ ${oldRole} sang ${role}.`;

    await AdminLog.logAction(req.user, 'Cập nhật vai trò', 'Thành công', descriptionStr, req, {
      targetId: user._id
    });

    // 6. Phản hồi thành công
    res.json({
      success: true,
      message: 'Cập nhật vai trò tài khoản thành công.',
      data: {
        _id: user._id,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật vai trò User (Admin):', error);
    res.status(500).json({
      success: false,
      message: 'Không thể thực hiện thao tác, vui lòng thử lại sau.'
    });
  }
};
