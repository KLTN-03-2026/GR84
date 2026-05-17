import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User, { isUserPremium } from '../models/User.js';
import Message from '../models/Message.js';
import Match from '../models/Match.js';
import VideoCall from '../models/VideoCall.js';
import Notification from '../models/Notification.js';
import redis, {
  removeFromWaitingQueue,
  getValidPartner,
  getQueueSize,
  addToWaitingQueue
} from './redis.js';

// Redis instance and helpers are imported from ./redis.js


// ===========================================
// STATE - In-memory (per instance)
// ===========================================

// ===========================================
// STATE - In-memory (per instance)
// ===========================================

// User to socket mapping for direct calls and emitting
let userSocketMap = {};



// ===========================================
// INITIALIZE SOCKET
// ===========================================

export const initializeSocket = (io) => {
  // ===========================================
  // AUTHENTICATION MIDDLEWARE
  // ===========================================
  const authenticateSocket = async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        next(new Error('Invalid token'));
      } else {
        next(new Error('Authentication failed'));
      }
    }
  };

  io.use(authenticateSocket);

  // ===========================================
  // CONNECTION HANDLER
  // ===========================================
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const username = socket.user.username;

    console.log(`[Socket] Connected: ${username} (${userId}) socket:${socket.id}`);

    // Connect to Redis if not connected
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      try {
        await redis.connect();
      } catch (err) {
        console.error('[Socket] Redis connect failed:', err.message);
      }
    }

    // Store user socket mapping
    userSocketMap[userId] = socket.id;

    // Join personal room for direct calls
    socket.join(`user:${userId}`);

    // Update online status
    User.findByIdAndUpdate(socket.user._id, {
      isOnline: true,
      lastSeen: new Date()
    }, { new: true }).exec();

    // ===========================================
    // CHAT - Room Management
    // ===========================================

    socket.on('join_room', (payload) => {
      const matchId = payload && typeof payload === 'object' ? payload.matchId : payload;

      if (!matchId) {
        console.warn(`[Socket] join_room missing matchId from ${username} (${userId}) payload:`, payload);
        return;
      }

      socket.join(`match:${matchId}`);
      console.log(`[Socket] ${username} (${userId}) socket:${socket.id} joined room match:${matchId}`);
    });

    socket.on('leave_room', (payload) => {
      const matchId = payload && typeof payload === 'object' ? payload.matchId : payload;

      if (!matchId) {
        console.warn(`[Socket] leave_room missing matchId from ${username} (${userId}) payload:`, payload);
        return;
      }

      socket.leave(`match:${matchId}`);
      console.log(`[Socket] ${username} (${userId}) socket:${socket.id} left room match:${matchId}`);
    });

    // ===========================================
    // CHAT - Messages
    // ===========================================

    socket.on('send_message', async (data) => {
      try {
        const { matchId, content, type } = data;

        if (!matchId || !content) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        const match = await Match.findById(matchId);
        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        const isParticipant = match.users.some(
          userId => userId.toString() === socket.user._id.toString()
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const message = await Message.create({
          matchId,
          senderId: socket.user._id,
          sender: socket.user._id,
          content,
          messageType: type || 'text',
          isRead: false,
          status: 'sent'
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username fullName avatar');

        match.lastActivity = new Date();
        match.lastMessage = content || (type === 'image' ? '[Hình ảnh]' : '');
        match.lastMessageAt = new Date();
        await match.save();

        const otherUserId = match.getOtherUser(socket.user._id);
        if (otherUserId) {
          try {
            const exists = await Notification.exists({ messageId: message._id });
            if (!exists) {
              await Notification.create({
                recipient: otherUserId,
                type: 'message',
                sender: socket.user._id,
                matchId: match._id,
                messageId: message._id,
                content: content || (type === 'image' ? '[Hình ảnh]' : ''),
                read: false
              });
            }
          } catch (notifErr) {
            console.error('[Notification Error] Failed to save socket notification:', notifErr.message);
          }
        }

        const roomName = `match:${matchId}`;
        console.log(`[Socket] send_message success. Broadcast to room ${roomName} | callId/matchId: ${matchId} | sender: ${socket.user._id} | receiver: ${otherUserId || 'none'}`);

        io.to(roomName).emit('receive_message', populatedMessage);
      } catch (error) {
        console.error('[Chat] send_message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      const { matchId } = data;
      if (!matchId) return;

      socket.to(`match:${matchId}`).emit('user_typing', {
        matchId,
        user: { _id: socket.user._id, username: socket.user.username }
      });
    });

    socket.on('stop_typing', (data) => {
      const { matchId } = data;
      if (!matchId) return;

      socket.to(`match:${matchId}`).emit('user_stop_typing', {
        matchId,
        userId: socket.user._id
      });
    });

    socket.on('message_read', async (data) => {
      const { matchId } = data;
      if (!matchId) return;

      try {
        const match = await Match.findById(matchId);
        if (!match) return;

        const isParticipant = match.users.some(
          userId => userId.toString() === socket.user._id.toString()
        );

        if (!isParticipant) return;

        await Message.updateMany(
          { matchId, sender: { $ne: socket.user._id }, isRead: false },
          { isRead: true }
        );

        socket.to(`match:${matchId}`).emit('messages_read', {
          matchId,
          reader: { _id: socket.user._id, username: socket.user.username }
        });
      } catch (error) {
        console.error('[Chat] message_read error:', error);
      }
    });

    // ===========================================
    // SYSTEM 1: RANDOM VIDEO MATCH (Redis-based)
    // ===========================================

    /**
     * Find random partner - Redis queue matching
     */
    socket.on('find_random_partner', async () => {
      const currentUserId = userId;
      console.log(`[RANDOM] find_random_partner: ${username} (${currentUserId})`);

      try {
        // Kiểm tra quyền Premium từ Database
        const dbUser = await User.findById(currentUserId);
        
        // CHỐNG BYPASS: User chưa onboarding không được dùng random video
        if (!dbUser?.onboardingCompleted) {
          console.log(`[RANDOM BLOCKED] User ${username} attempted random but onboarding incomplete.`);
          socket.emit('video_error', { message: 'Vui lòng hoàn tất onboarding trước khi tham gia.' });
          return;
        }

        const isPremium = isUserPremium(dbUser);

        const hasActiveMembership = Boolean(
          dbUser &&
          dbUser.membership &&
          dbUser.membership.status === "active" &&
          dbUser.membership.premiumUntil &&
          new Date(dbUser.membership.premiumUntil) > new Date()
        );

        let premiumSource = "none";
        if (hasActiveMembership) {
          premiumSource = "membership";
        } else if (dbUser && dbUser.role === "premium") {
          premiumSource = "role";
        }

        console.log("[RANDOM PREMIUM CHECK]", {
          userId: currentUserId,
          role: dbUser?.role,
          membershipStatus: dbUser?.membership?.status,
          premiumUntil: dbUser?.membership?.premiumUntil,
          isPremium,
          premiumSource
        });

        if (!isPremium) {
          console.log(`[RANDOM LOCKED] User ${username} (${currentUserId}) attempted random matchmaking but is not Premium.`);
          socket.emit('random_video_locked', {
            message: 'Random Video là tính năng dành riêng cho thành viên Premium.'
          });
          return;
        }

        // Remove any existing entry (idempotent)
        await removeFromWaitingQueue(currentUserId);

        const queueSize = await getQueueSize();
        console.log(`[RANDOM][REDIS] Queue size: ${queueSize}`);

        // Try to find a valid partner
        const partnerId = await getValidPartner(currentUserId, userSocketMap);

        if (partnerId) {
          // MATCH FOUND
          console.log(`[RANDOM] MATCH: ${username} <-> ${partnerId}`);

          // Create session in DB
          const session = await VideoCall.create({
            callerId: currentUserId,
            receiverId: partnerId,
            sessionType: 'random',
            status: 'connected',
            startedAt: new Date()
          });

          const sessionId = session._id.toString();

          // Get user info
          const partner = await User.findById(partnerId).select('username avatar _id').lean();
          const currentUser = await User.findById(currentUserId).select('username avatar _id').lean();

          // Emit to current user
          socket.emit('random_partner_found', {
            sessionId,
            partner: partner,
            sessionType: 'random',
            role: 'caller'
          });

          // Emit to partner via socket ID
          const partnerSocketId = userSocketMap[partnerId];
          if (partnerSocketId) {
            io.to(partnerSocketId).emit('random_partner_found', {
              sessionId,
              partner: currentUser,
              sessionType: 'random',
              role: 'receiver'
            });
            console.log(`[RANDOM] Notified partner ${partnerId} via socket ${partnerSocketId}`);
          }

        } else {
          // NO PARTNER - Add to Redis queue
          await addToWaitingQueue(currentUserId);
          socket.emit('waiting_for_partner');

          const newQueueSize = await getQueueSize();
          console.log(`[RANDOM][REDIS] Added to queue. Queue size: ${newQueueSize}`);
        }
      } catch (error) {
        console.error('[RANDOM] Error in find_random_partner:', error);
        socket.emit('video_error', { message: 'Failed to find partner' });
      }
    });

    /**
     * Cancel search - remove from Redis queue
     */
    socket.on('cancel_find_partner', async () => {
      const currentUserId = userId;

      try {
        await removeFromWaitingQueue(currentUserId);
        const queueSize = await getQueueSize();
        console.log(`[RANDOM] Cancelled: ${username}. Queue: ${queueSize}`);
        socket.emit('search_cancelled');
      } catch (error) {
        console.error('[RANDOM] Error in cancel_find_partner:', error);
        socket.emit('search_cancelled');
      }
    });

    /**
     * Skip current partner and find new one
     */
    socket.on('next_random', async (data) => {
      const { sessionId, partnerId } = data;
      console.log(`[RANDOM] next_random: ${username} session:${sessionId}`);

      try {
        // End current session
        if (sessionId) {
          await VideoCall.findByIdAndUpdate(sessionId, {
            status: 'ended',
            endedAt: new Date()
          });

          // Notify partner via socket
          if (partnerId && userSocketMap[partnerId]) {
            io.to(userSocketMap[partnerId]).emit('partner_left');
            console.log(`[RANDOM] Notified partner left: ${partnerId}`);
          }
        }

        // Remove from queue (idempotent)
        await removeFromWaitingQueue(userId);

        socket.emit('finding_new_partner');

        // Small delay before finding new partner
        setTimeout(async () => {
          try {
            // Find new partner from Redis queue
            const newPartnerId = await getValidPartner(userId, userSocketMap);

            if (newPartnerId) {
              console.log(`[RANDOM] NEW MATCH: ${username} <-> ${newPartnerId}`);

              const session = await VideoCall.create({
                callerId: userId,
                receiverId: newPartnerId,
                sessionType: 'random',
                status: 'connected',
                startedAt: new Date()
              });

              const newSessionId = session._id.toString();

              const newPartner = await User.findById(newPartnerId).select('username avatar _id').lean();
              const currentUser = await User.findById(userId).select('username avatar _id').lean();

              socket.emit('random_partner_found', {
                sessionId: newSessionId,
                partner: newPartner,
                sessionType: 'random',
                role: 'caller'
              });

              const newPartnerSocketId = userSocketMap[newPartnerId];
              if (newPartnerSocketId) {
                io.to(newPartnerSocketId).emit('random_partner_found', {
                  sessionId: newSessionId,
                  partner: currentUser,
                  sessionType: 'random',
                  role: 'receiver'
                });
              }

            } else {
              // No partners - add to Redis queue
              await addToWaitingQueue(userId);
              socket.emit('waiting_for_partner');
              console.log(`[RANDOM] No partners. Added to queue.`);
            }
          } catch (err) {
            console.error('[RANDOM] Error finding new partner:', err);
            socket.emit('video_error', { message: 'Failed to find new partner' });
          }
        }, 1000);
      } catch (error) {
        console.error('[RANDOM] Error in next_random:', error);
        socket.emit('video_error', { message: 'Failed to find new partner' });
      }
    });

    /**
     * End random session
     */
    socket.on('end_random_session', async (data) => {
      const { sessionId, partnerId } = data;
      console.log(`[RANDOM] end_session: ${username} session:${sessionId}`);

      try {
        if (sessionId) {
          const session = await VideoCall.findById(sessionId);
          if (session) {
            session.status = 'ended';
            session.endedAt = new Date();
            session.duration = Math.floor((new Date() - session.startedAt) / 1000);
            await session.save();
          }
        }

        // Notify partner
        if (partnerId && userSocketMap[partnerId]) {
          io.to(userSocketMap[partnerId]).emit('partner_left');
          console.log(`[RANDOM] Notified partner ended: ${partnerId}`);
        }

        // Remove from Redis queue (idempotent)
        await removeFromWaitingQueue(userId);

        socket.emit('session_ended');
      } catch (error) {
        console.error('[RANDOM] Error in end_random_session:', error);
      }
    });

    // ===========================================
    // SYSTEM 2: DIRECT VIDEO CALL (in-memory)
    // ===========================================

    /**
     * Initiate a call to specific user
     */
    socket.on('call_user', (data) => {
      const { targetUserId, receiverId, callerId, signalData, callType, matchId, callId } = data;
      const finalReceiverId = receiverId || targetUserId;
      const finalCallerId = callerId || socket.user._id;

      if (!finalReceiverId || !signalData) {
        console.warn('[CALL] Invalid call data', { finalReceiverId, hasSignal: !!signalData });
        return;
      }

      const targetSocketId = userSocketMap[finalReceiverId];

      console.log(`[SOCKET_EVENT: call_user] callId:${callId} | matchId:${matchId} | callerId:${finalCallerId} | receiverId:${finalReceiverId} | sender_socket:${socket.id} | target_socket:${targetSocketId}`);

      if (!targetSocketId) {
        socket.emit('call_error', { message: 'User is offline' });
        return;
      }

      io.to(targetSocketId).emit('incoming_call', {
        signal: signalData,
        caller: {
          _id: socket.user._id,
          username: socket.user.username,
          avatar: socket.user.avatar
        },
        callType: callType || 'video',
        matchId,
        callId
      });
    });

    /**
     * Accept incoming call
     */
    socket.on('accept_call', (data) => {
      const { callerId, receiverId, signalData, matchId, callId } = data;
      const finalCallerId = callerId;
      const finalReceiverId = receiverId || socket.user._id;

      if (!finalCallerId || !signalData) {
        console.warn('[CALL] Invalid accept data', { finalCallerId, hasSignal: !!signalData });
        return;
      }

      const callerSocketId = userSocketMap[finalCallerId];

      console.log(`[SOCKET_EVENT: accept_call] callId:${callId} | matchId:${matchId} | callerId:${finalCallerId} | receiverId:${finalReceiverId} | sender_socket:${socket.id} | target_socket:${callerSocketId}`);

      if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', {
          signal: signalData,
          callee: {
            _id: socket.user._id,
            username: socket.user.username,
            avatar: socket.user.avatar
          },
          callId
        });
      }
    });

    /**
     * Reject incoming call
     */
    socket.on('reject_call', (data) => {
      const { callerId, matchId, callId } = data;

      if (!callerId) return;

      const callerSocketId = userSocketMap[callerId];

      console.log(`[SOCKET_EVENT: reject_call] callId:${callId} | matchId:${matchId} | callerId:${callerId} | receiverId:${socket.user._id} | sender_socket:${socket.id} | target_socket:${callerSocketId}`);

      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected', {
          callee: {
            _id: socket.user._id,
            username: socket.user.username
          },
          callId
        });
      }
    });

    /**
     * End active call
     */
    socket.on('end_call', (data) => {
      const { targetUserId, toUserId, matchId, callId } = data;
      const finalToUserId = toUserId || targetUserId;

      if (!finalToUserId) return;

      const targetSocketId = userSocketMap[finalToUserId];

      console.log(`[SOCKET_EVENT: end_call] callId:${callId} | matchId:${matchId} | fromUserId:${socket.user._id} | toUserId:${finalToUserId} | sender_socket:${socket.id} | target_socket:${targetSocketId}`);

      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ended', {
          caller: {
            _id: socket.user._id,
            username: socket.user.username
          },
          callId
        });
      }
    });

    /**
     * Relay ICE Candidates
     */
    socket.on('ice_candidate', (data) => {
      const { targetUserId, toUserId, candidate, matchId, callId } = data;
      const finalToUserId = toUserId || targetUserId;

      if (!finalToUserId || !candidate) return;

      const targetSocketId = userSocketMap[finalToUserId];

      console.log(`[SOCKET_EVENT: ice_candidate] callId:${callId} | matchId:${matchId} | fromUserId:${socket.user._id} | toUserId:${finalToUserId} | sender_socket:${socket.id} | target_socket:${targetSocketId}`);

      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', {
          candidate,
          from: socket.user._id,
          matchId,
          callId
        });
      }
    });

    // ===========================================
    // WebRTC SIGNALING (in-memory emit)
    // ===========================================

    /**
     * WebRTC signal relay (offer/answer/candidate)
     */
    socket.on('webrtc_signal', (data) => {
      const { targetUserId, toUserId, fromUserId, signal, type, matchId, callId } = data;
      const finalToUserId = toUserId || targetUserId;
      const finalFromUserId = fromUserId || socket.user._id;

      if (!finalToUserId || !signal) {
        console.warn('[WebRTC] Invalid signal data');
        return;
      }

      const targetSocketId = userSocketMap[finalToUserId];

      console.log(`[SOCKET_EVENT: webrtc_signal] callId:${callId} | matchId:${matchId} | fromUserId:${finalFromUserId} | toUserId:${finalToUserId} | sender_socket:${socket.id} | target_socket:${targetSocketId} | signal_type:${type}`);

      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_signal', {
          signal,
          type,
          callId,
          matchId,
          from: {
            _id: socket.user._id,
            username: socket.user.username
          }
        });
      }
    });

    /**
     * WebRTC signal relay for RANDOM video call
     */
    socket.on('random_webrtc_signal', (data) => {
      const { targetUserId, signal, type, callId } = data;

      if (!targetUserId || !signal) {
        console.warn('[WebRTC Random] Invalid signal data');
        return;
      }

      const targetSocketId = userSocketMap[targetUserId];

      if (targetSocketId) {
        console.log(`[WebRTC Random] Relaying ${type} from ${userId} to ${targetUserId}`);
        io.to(targetSocketId).emit('random_webrtc_signal', {
          signal,
          type,
          callId,
          from: {
            _id: socket.user._id,
            username: socket.user.username
          }
        });
      }
    });



    // ===========================================
    // DISCONNECT
    // ===========================================

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Disconnected: ${username} (${reason})`);

      try {
        // Remove from Redis waiting queue
        await removeFromWaitingQueue(userId);
        console.log(`[RANDOM][REDIS] Removed from queue on disconnect: ${userId}`);

        // Remove from user socket map
        if (userSocketMap[userId] === socket.id) {
          delete userSocketMap[userId];
          console.log(`[Socket] Removed from userSocketMap: ${userId}`);
        }

        // Update user offline status
        await User.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastSeen: new Date()
        });

        console.log(`[Socket] Cleanup complete for ${username}`);
      } catch (error) {
        console.error('[Socket] Error during disconnect:', error);
      }
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${username}:`, error);
    });
  });

  return io;
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

export const sendToUser = (io, userId, event, data) => {
  const socketId = userSocketMap[userId.toString()];
  if (socketId) {
    io.to(socketId).emit(event, data);
    return true;
  }
  console.warn(`[Socket] sendToUser failed: User ${userId} not found`);
  return false;
};

export const sendToMatch = (io, matchId, event, data) => {
  io.to(`match:${matchId}`).emit(event, data);
};

export const getUserSocketId = (userId) => {
  return userSocketMap[userId.toString()];
};

export const isUserOnline = (userId) => {
  return userSocketMap.hasOwnProperty(userId.toString());
};


export { initializeRedis, createRedisAdapterClients, getRedisClient, isRedisAvailable } from './redis.js';
