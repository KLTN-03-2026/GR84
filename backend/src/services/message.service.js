/**
 * Message Service - Business logic cho chat/messages
 */

import Message from '../models/Message.js';
import Match from '../models/Match.js';
import User from '../models/User.js';

const checkMatchAccess = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) return { error: 'Match not found', status: 404 };
  if (!match.hasUser(userId)) return { error: 'Not authorized', status: 403 };
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
  await match.save();

  return { message: populatedMessage };
};

export const getConversations = async (userId) => {
  // 4. Ensure users are populated
  const matches = await Match.find({
    $or: [
      { user1Id: userId },
      { user2Id: userId }
    ],
    isActive: true
  }).populate('users', 'username avatar _id');

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
    // 3. Fix logic to correctly determine the "other user" in a match
    const otherUser = match.users.find(
      u => u._id.toString() !== userId.toString()
    );

    // 6. Add safety: If otherUser is missing -> skip this conversation
    if (!otherUser) return null;

    const lastMessage = lastMessageMap.get(match._id.toString());

    if (lastMessage) {
      const senderKey = (lastMessage.senderId || lastMessage.sender)?.toString();
      if (senderMap.has(senderKey)) {
        lastMessage.sender = senderMap.get(senderKey);
      }
    }

    // 5. Fix response structure
    return {
      matchId: match._id,
      userId: otherUser._id,
      user: otherUser,
      lastMessage: lastMessage || null,
      unreadCount: unreadCountMap.get(match._id.toString()) || 0,
      updatedAt: match.updatedAt
    };
  });

  const populatedConversations = await Match.populate(conversations, {
    path: 'userId',
    model: 'User',
    select: 'username fullName avatar isOnline lastSeen'
  });

  return { conversations };
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

export default {
  getMessages,
  sendMessage,
  getConversations,
  markMessagesAsRead
};
