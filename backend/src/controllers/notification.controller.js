import { Notification } from '../models/index.js';

// Get notifications for current user
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'username fullName avatar')
      .populate('matchedBy', 'username fullName avatar')
      .populate('from', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    // Map to the format the frontend expects
    const formattedNotifications = notifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      read: n.read,
      timestamp: n.createdAt,
      matchId: n.matchId,
      content: n.content,
      message: n.message,
      sender: n.sender,
      matchedBy: n.matchedBy,
      from: n.from
    }));

    res.json({
      success: true,
      notifications: formattedNotifications
    });
  } catch (error) {
    next(error);
  }
};

// Mark a single notification as read
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true }
    );

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Clear all notifications
export const clearAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ recipient: userId });

    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    next(error);
  }
};
