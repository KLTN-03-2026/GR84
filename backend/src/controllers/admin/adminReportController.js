import Report from '../../models/Report.js';
import User from '../../models/User.js';
import AdminLog from '../../models/AdminLog.js';

/**
 * @desc    Get all user reports for admin
 * @route   GET /api/admin/reports
 * @access  Private (Admin only)
 */
export const getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporterId', 'username fullName avatar')
      .populate('targetId', 'username fullName avatar status trustScore')
      .populate('conversationId', 'matchedAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách báo cáo'
    });
  }
};

/**
 * @desc    Handle report action (dismiss, warn, or ban)
 * @route   POST /api/admin/reports/:id/action
 * @access  Private (Admin only)
 */
export const handleReportAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, status } = req.body;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
    }

    const targetUser = await User.findById(report.targetId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người bị báo cáo' });
    }

    if (action === 'warn') {
      targetUser.warnings = (targetUser.warnings || 0) + 1;
      targetUser.trustScore = Math.max(0, (targetUser.trustScore || 100) - 10);
      await targetUser.save();
    } else if (action === 'ban') {
      targetUser.isLocked = true;
      targetUser.status = 'banned';
      await targetUser.save();
    }

    report.status = status || 'resolved';
    report.adminNote = req.body.note || '';
    report.resolvedAt = new Date();
    await report.save();

    // Log action
    await AdminLog.logAction(req.user, `Xử lý báo cáo: ${action}`, 'Thành công', `Admin đã xử lý báo cáo ${id} với hành động ${action}`, req);

    res.json({
      success: true,
      message: 'Đã xử lý báo cáo thành công'
    });
  } catch (error) {
    console.error('Error handling report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xử lý báo cáo'
    });
  }
};

export default { getReports, handleReportAction };
