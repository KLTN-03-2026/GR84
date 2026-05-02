import AdminLog from '../../models/AdminLog.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * @desc    Lấy danh sách nhật ký quản trị (PB24)
 * @route   GET /api/admin/logs
 * @access  Private (Superadmin/Admin)
 */
export const getAdminLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      action, 
      startDate, 
      endDate,
      status
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Xây dựng bộ lọc
    const query = {};
    
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Đảm bảo lấy hết ngày kết thúc
        query.createdAt.$lte = end;
      }
    }

    const logs = await AdminLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AdminLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhật ký:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi truy xuất nhật ký' });
  }
};

/**
 * @desc    Xuất báo cáo nhật ký quản trị ra file Excel (PB24)
 * @route   GET /api/admin/logs/export/excel
 * @access  Private (Superadmin/Admin)
 */
export const exportExcel = async (req, res) => {
  try {
    const { action, startDate, endDate, status } = req.query;

    // Xây dựng bộ lọc giống hệt API lấy danh sách
    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const logs = await AdminLog.find(query).sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Admin Logs');

    // Định nghĩa cột
    worksheet.columns = [
      { header: 'Thời gian', key: 'time', width: 25 },
      { header: 'Quản trị viên', key: 'name', width: 25 },
      { header: 'Chức vụ', key: 'role', width: 15 },
      { header: 'Loại thao tác', key: 'action', width: 20 },
      { header: 'Nội dung chi tiết', key: 'description', width: 50 },
      { header: 'Kết quả', key: 'status', width: 15 }
    ];

    // Style cho Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Thêm dữ liệu
    logs.forEach(log => {
      worksheet.addRow({
        time: new Date(log.createdAt).toLocaleString('vi-VN'),
        name: log.adminName,
        role: log.adminRole,
        action: log.action,
        description: log.description,
        status: log.status
      });
    });

    // Thiết lập HTTP headers để download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=admin_logs_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Lỗi khi xuất file Excel:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xuất file Excel' });
  }
};

/**
 * @desc    Xuất báo cáo nhật ký quản trị ra file PDF (PB24)
 * @route   GET /api/admin/logs/export/pdf
 * @access  Private (Superadmin/Admin)
 */
export const exportPDF = async (req, res) => {
  try {
    const { action, startDate, endDate, status } = req.query;

    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const logs = await AdminLog.find(query).sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    // Thiết lập HTTP headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=admin_logs_${Date.now()}.pdf`);

    doc.pipe(res);

    // Tiêu đề
    doc.fontSize(20).text('NHẬT KÝ QUẢN TRỊ HỆ THỐNG', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`, { align: 'right' });
    doc.moveDown();

    // Vẽ bảng đơn giản
    const tableTop = 150;
    const colWidths = [120, 100, 80, 100, 300, 80];
    const columns = ['Thời gian', 'Quản trị viên', 'Chức vụ', 'Loại thao tác', 'Nội dung chi tiết', 'Kết quả'];
    
    // Header bảng
    let currentY = tableTop;
    doc.font('Helvetica-Bold');
    let currentX = 30;
    columns.forEach((col, i) => {
      doc.text(col, currentX, currentY);
      currentX += colWidths[i];
    });

    doc.moveTo(30, currentY + 15).lineTo(780, currentY + 15).stroke();
    currentY += 25;

    // Body bảng
    doc.font('Helvetica');
    logs.forEach((log, index) => {
      // Kiểm tra tràn trang
      if (currentY > 500) {
        doc.addPage({ layout: 'landscape' });
        currentY = 50;
      }

      currentX = 30;
      const rowData = [
        new Date(log.createdAt).toLocaleString('vi-VN'),
        log.adminName,
        log.adminRole,
        log.action,
        log.description,
        log.status
      ];

      rowData.forEach((text, i) => {
        doc.text(text.toString(), currentX, currentY, { width: colWidths[i] - 5 });
        currentX += colWidths[i];
      });

      doc.moveTo(30, currentY + 20).lineTo(780, currentY + 20).strokeColor('#EEEEEE').stroke();
      currentY += 30;
    });

    doc.end();

  } catch (error) {
    console.error('Lỗi khi xuất file PDF:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xuất file PDF' });
  }
};
