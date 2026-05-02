import Tag from '../../models/Tag.js';
import AdminLog from '../../models/AdminLog.js';
import tagSyncService from '../../services/tagSync.service.js';

export const getCategories = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const categories = await Tag.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Tag.countDocuments(query);

    res.json({
      success: true,
      data: categories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách danh mục' });
  }
};

export const addCategory = async (req, res) => {
  try {
    const { name, category, description, icon } = req.body;
    const adminId = req.user._id;

    if (!name || name.trim() === '') {
      await AdminLog.logAction(req.user, 'Thêm danh mục', 'Thất bại', 'Tên danh mục không được để trống', req);
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' });
    }

    const existing = await Tag.findOne({ name: name.trim(), category });
    if (existing) {
      await AdminLog.logAction(req.user, 'Thêm danh mục', 'Thất bại', `Danh mục "${name.trim()}" đã tồn tại trong nhóm ${category}`, req);
      return res.status(400).json({ success: false, message: 'Tên danh mục đã tồn tại trong nhóm này' });
    }

    const newTag = new Tag({
      name: name.trim(),
      category: category || 'general',
      description: description || '',
      icon: icon || '',
      status: 'active'
    });

    await newTag.save();

    // PB24: Ghi nhật ký hệ thống
    await AdminLog.logAction(req.user, 'Thêm danh mục', 'Thành công', `Đã thêm danh mục mới: ${newTag.name} (Nhóm: ${newTag.category})`, req, {
      targetId: newTag._id
    });

    res.status(201).json({ success: true, message: 'Cập nhật danh mục thành công', data: newTag });
  } catch (error) {
    console.error('Lỗi khi thêm danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm danh mục' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, icon } = req.body;
    const adminId = req.user._id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' });
    }

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }

    // Check unique name in category
    const catToCheck = category || tag.category;
    const existing = await Tag.findOne({ name: name.trim(), category: catToCheck, _id: { $ne: id } });
    if (existing) {
      await AdminLog.logAction(req.user, 'Cập nhật danh mục', 'Thất bại', `Cập nhật thất bại: Tên "${name.trim()}" đã tồn tại trong nhóm ${catToCheck}`, req, { targetId: id });
      return res.status(400).json({ success: false, message: 'Tên danh mục đã tồn tại trong nhóm này' });
    }

    const oldName = tag.name;
    tag.name = name.trim();
    if (category) tag.category = category;
    if (description !== undefined) tag.description = description;
    if (icon !== undefined) tag.icon = icon;

    await tag.save();

    // PB24: Ghi nhật ký hệ thống
    await AdminLog.logAction(req.user, 'Cập nhật danh mục', 'Thành công', `Đã cập nhật danh mục: ${oldName} -> ${tag.name}`, req, {
      targetId: tag._id
    });

    res.json({ success: true, message: 'Cập nhật danh mục thành công', data: tag });
  } catch (error) {
    console.error('Lỗi khi cập nhật danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi chỉnh sửa danh mục' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }

    // Use usageCount from Tag model (which should be synced)
    const tagName = tag.name;
    const inUseCount = tag.usageCount || 0;

    if (inUseCount > 0) {
      await AdminLog.logAction(req.user, 'Xóa danh mục', 'Thất bại', `Không thể xóa danh mục "${tag.name}" vì đang có ${inUseCount} người dùng sử dụng`, req, { targetId: id });
      return res.status(400).json({
        success: false,
        message: 'Không được phép xóa danh mục đang có người dùng sử dụng. Hãy chuyển trạng thái sang Ẩn.'
      });
    }

    await Tag.findByIdAndDelete(id);

    // PB24: Ghi nhật ký hệ thống
    await AdminLog.logAction(req.user, 'Xóa danh mục', 'Thành công', `Đã xóa danh mục: ${tagName} (Nhóm: ${tag.category})`, req, {
      targetId: id
    });

    res.json({ success: true, message: 'Xóa danh mục thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa danh mục' });
  }
};

export const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    }

    tag.status = tag.status === 'active' ? 'hidden' : 'active';
    await tag.save();

    // PB24: Ghi nhật ký hệ thống
    await AdminLog.logAction(req.user, 'Đổi trạng thái danh mục', 'Thành công', `Chuyển trạng thái danh mục: ${tag.name} thành ${tag.status}`, req, {
      targetId: tag._id
    });

    res.json({ success: true, message: 'Cập nhật danh mục thành công', data: tag });
  } catch (error) {
    console.error('Lỗi khi đổi trạng thái danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const syncCategories = async (req, res) => {
  try {
    const adminId = req.user._id;

    const results = await tagSyncService.syncAllTagsUsage();

    // PB24: Ghi nhật ký hệ thống
    await AdminLog.logAction(req.user, 'Đồng bộ danh mục', 'Thành công', `Đã thực hiện đồng bộ hóa lượt sử dụng danh mục. Cập nhật ${results.updated}/${results.total} mục.`, req);

    res.json({
      success: true,
      message: `Đồng bộ hoàn tất. Đã cập nhật ${results.updated} danh mục có dữ liệu sai lệch.`,
      results
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đồng bộ dữ liệu' });
  }
};
