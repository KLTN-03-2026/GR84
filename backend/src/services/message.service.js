/**
 * Message Service - Business logic cho chat/messages
 */

import Message from '../models/Message.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const checkMatchAccess = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) return { error: 'Match not found', status: 404 };
  if (!match.hasUser(userId)) return { error: 'Not authorized', status: 403 };
  if (!match.isActive || match.status === 'unmatched') {
    return { error: 'Cuộc trò chuyện đã kết thúc hoặc bị hủy tương hợp', status: 403 };
  }
  return { match };
};

export const getMessages = async (matchId, userId, { page = 1, limit = 50 } = {}) => {
  const access = await checkMatchAccess(matchId, userId);
  if (access.error) return access;

  const { match } = access;
  const skip = (page - 1) * limit;

  const query = match.conversationId
    ? { conversationId: match.conversationId }
    : { matchId };

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate('senderId', 'username fullName avatar')  // Only populate senderId
      .sort({ createdAt: 1 }) // ASC = chronological order (oldest first)
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments(query)
  ]);

  // Transform: map senderId → sender object for frontend compatibility
  const transformedMessages = messages.map(msg => ({
    ...msg,
    sender: msg.senderId || null,  // Use populated senderId as sender
    senderId: msg.senderId?._id || msg.senderId || msg.senderId  // Keep ObjectId
  }));

  await Message.updateMany(
    {
      ...query,
      sender: { $ne: userId },
      senderId: { $ne: userId },
      isRead: false
    },
    { isRead: true, status: 'seen' }
  );

  return {
    messages: transformedMessages, // Already in chronological order (ASC)
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

export const sendMessage = async (matchId, userId, { content, image, mediaUrl, messageType }) => {
  const access = await checkMatchAccess(matchId, userId);
  if (access.error) return access;

  const { match } = access;

  const messageData = {
    senderId: userId,
    sender: userId,
    content,
    messageType: messageType || 'text',
    isRead: false,
    status: 'sent'
  };

  if (image || mediaUrl) {
    messageData.image = image || mediaUrl;
    messageData.mediaUrl = mediaUrl || image;
    messageData.messageType = 'image';
  }

  if (match.conversationId) {
    messageData.conversationId = match.conversationId;
  } else {
    messageData.matchId = match._id;
  }

  const message = await Message.create(messageData);

  // Populate senderId and rename to sender
  await message.populate('senderId', 'username fullName avatar');
  const populatedMessage = message.toObject();

  // For frontend compatibility: replace senderId with sender object
  populatedMessage.sender = populatedMessage.senderId;
  delete populatedMessage.senderId;

  match.lastActivity = new Date();
  match.lastMessage = content || (image || mediaUrl ? '[Hình ảnh]' : '');
  match.lastMessageAt = new Date();
  await match.save();

  const receiverId = match.getOtherUser(userId);
  if (receiverId) {
    try {
      const exists = await Notification.exists({ messageId: populatedMessage._id });
      if (!exists) {
        await Notification.create({
          recipient: receiverId,
          type: 'message',
          sender: userId,
          matchId: match._id,
          messageId: populatedMessage._id,
          content: content || (image || mediaUrl ? '[Hình ảnh]' : ''),
          read: false
        });
      }
    } catch (notifErr) {
      console.error('[Notification Error] Failed to save notification:', notifErr.message);
    }
  }

  return { message: populatedMessage };
};

export const getConversations = async (userId) => {
  // Ensure matches are sorted with most recent activity first
  const matches = await Match.find({
    $or: [
      { user1Id: userId },
      { user2Id: userId }
    ],
    isActive: true,
    status: 'active'
  })
    .populate('users', 'username avatar _id')
    .sort({ lastActivity: -1, updatedAt: -1 });

  if (matches.length === 0) return { conversations: [] };

  const matchIds = matches.map(m => m._id);

  const lastMessages = await Message.aggregate([
    { $match: { matchId: { $in: matchIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$matchId',
        lastMessage: { $first: '$$ROOT' }
      }
    }
  ]);

  const lastMessageMap = new Map(
    lastMessages.map(m => [m._id.toString(), m.lastMessage])
  );

  const unreadCounts = await Message.aggregate([
    {
      $match: {
        matchId: { $in: matchIds },
        sender: { $ne: userId },
        senderId: { $ne: userId },
        isRead: false
      }
    },
    { $group: { _id: '$matchId', count: { $sum: 1 } } }
  ]);

  const unreadCountMap = new Map(
    unreadCounts.map(u => [u._id.toString(), u.count])
  );

  const senderIds = [...new Set(
    lastMessages
      .map(m => m.lastMessage?.senderId || m.lastMessage?.sender)
      .filter(Boolean)
      .map(id => id.toString())
  )];

  const senders = await User.find({ _id: { $in: senderIds } })
    .select('username fullName avatar')
    .lean();

  const senderMap = new Map(senders.map(s => [s._id.toString(), s]));

  const conversations = matches.map(match => {
    const otherUser = match.users.find(
      u => u._id.toString() !== userId.toString()
    );

    if (!otherUser) return null;

    const lastMessage = lastMessageMap.get(match._id.toString());

    if (lastMessage) {
      const senderKey = (lastMessage.senderId || lastMessage.sender)?.toString();
      if (senderMap.has(senderKey)) {
        lastMessage.sender = senderMap.get(senderKey);
      }
    }

    return {
      matchId: match._id,
      userId: otherUser._id,
      user: otherUser,
      lastMessage: lastMessage || null,
      unreadCount: unreadCountMap.get(match._id.toString()) || 0,
      lastActivity: match.lastActivity || match.updatedAt || match.createdAt || new Date(),
      updatedAt: match.updatedAt
    };
  });

  const filteredConversations = conversations.filter(Boolean);

  const populatedConversations = await Match.populate(filteredConversations, {
    path: 'userId',
    model: 'User',
    select: 'username fullName avatar isOnline lastSeen'
  });

  return { conversations: populatedConversations };
};

export const markMessagesAsRead = async (matchId, userId) => {
  const access = await checkMatchAccess(matchId, userId);
  if (access.error) return access;

  await Message.updateMany(
    {
      matchId,
      sender: { $ne: userId },
      senderId: { $ne: userId },
      isRead: false
    },
    { isRead: true, status: 'seen' }
  );

  return { message: 'Messages marked as read' };
};

export const getOrCreateConversation = async (userId, receiverId) => {
  if (userId.toString() === receiverId.toString()) {
    return { error: 'You cannot chat with yourself', status: 400 };
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return { error: 'Recipient not found', status: 404 };
  }

  // Find existing match (conversation)
  let match = await Match.findMatch(userId, receiverId);

  if (!match) {
    console.log(`[Chat] Creating new conversation between ${userId} and ${receiverId}`);
    // For this app, a conversation is a Match
    match = await Match.create({
      user1Id: userId,
      user2Id: receiverId,
      matchedAt: new Date(),
      isActive: true,
      status: 'active'
    });
  } else if (!match.isActive || match.status === 'unmatched') {
    console.log(`[Chat] Reactivating existing conversation ${match._id}`);
    match.isActive = true;
    match.status = 'active';
    match.matchedAt = new Date();
    await match.save();
  } else {
    console.log(`[Chat] Reusing existing conversation ${match._id}`);
  }

  return { conversation: match };
};

export default {
  getMessages,
  sendMessage,
  getConversations,
  markMessagesAsRead,
  getOrCreateConversation
};
