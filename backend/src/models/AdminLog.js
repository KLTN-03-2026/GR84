import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  adminName: { 
    type: String, 
    required: true 
  }, 
  adminRole: { 
    type: String, 
    required: true 
  }, 
  action: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Thành công', 'Thất bại'], 
    required: true 
  }, 
  targetId: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  description: { 
    type: String, 
    default: '' 
  },
  deviceInfo: { 
    type: String, 
    default: '' 
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  }
}, { timestamps: true });

// Optimize query
adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ createdAt: -1 });

/**
 * SECURITY ALERT: Khóa Read-only cấp độ Database
 */
adminLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'findOneAndDelete', 'deleteMany'], function(next) {
  next(new Error('SECURITY ALERT: Dữ liệu nhật ký là nguyên bản. Nghiêm cấm sửa/xóa!'));
});

/**
 * Ghi log hành động admin (PB24)
 * Tự động trích xuất Snapshot Tên, Chức vụ và thông tin thiết bị/IP
 */
adminLogSchema.statics.logAction = async function(user, action, status, description, req = null, options = {}) {
  try {
    if (!user) return null;

    const logData = {
      adminId: user._id,
      adminName: user.fullName || user.username || 'Admin',
      adminRole: user.role || 'admin',
      action,
      status,
      description,
      targetId: options.targetId || null,
      deviceInfo: req ? (req.headers['user-agent'] || 'N/A') : (options.deviceInfo || 'Unknown'),
      metadata: {
        ...(options.metadata || {}),
        ip: req ? (req.ip || req.headers['x-forwarded-for']) : undefined
      }
    };

    return await this.create(logData);
  } catch (error) {
    console.error('LOGGING ERROR:', error.message);
    return null;
  }
};

export default mongoose.model('AdminLog', adminLogSchema);
