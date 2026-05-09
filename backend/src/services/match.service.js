/**
 * Match Service - Business logic cho like/pass/super/match
 */

import User from '../models/User.js';
import Match from '../models/Match.js';
import Swipe from '../models/Swipe.js';

export const likeUser = async (swiperId, targetUserId) => {
  if (swiperId.toString() === targetUserId.toString()) {
    return { error: 'You cannot like yourself', status: 400 };
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return { error: 'User not found', status: 404 };

  await Swipe.findOneAndUpdate(
    { swiperId, swipedId: targetUserId },
    { swiperId, swipedId: targetUserId, action: 'like' },
    { upsert: true, new: true }
  );

  const mutualLike = await Swipe.isMutualLike(swiperId, targetUserId);

  if (mutualLike) {
    let match = await Match.findMatch(swiperId, targetUserId);

    if (!match) {
      match = await Match.create({
        user1Id: swiperId,
        user2Id: targetUserId,
        matchedAt: new Date()
      });
      await match.populate('user1Id user2Id', '-password -passwordHash');
    } else {
      match.isActive = true;
      match.matchedAt = new Date();
      await match.save();
    }

    return { matched: true, match, message: 'You have a new match!' };
  }

  return { matched: false, message: 'User liked successfully' };
};

export const passUser = async (swiperId, targetUserId) => {
  console.log('[passUser] Called with:', { swiperId, targetUserId });
  
  // Validate input
  if (!swiperId || !targetUserId) {
    console.error('[passUser] Missing required params');
    return { error: 'Missing required parameters', status: 400 };
  }
  
  try {
    // Convert to string in case they're ObjectIds
    const swiperIdStr = swiperId.toString();
    const targetUserIdStr = targetUserId.toString();
    
    if (swiperIdStr === targetUserIdStr) {
      return { error: 'You cannot pass yourself', status: 400 };
    }

    const targetUser = await User.findById(targetUserIdStr);
    if (!targetUser) {
      console.error('[passUser] Target user not found:', targetUserIdStr);
      return { error: 'User not found', status: 404 };
    }

    console.log('[passUser] Creating/updating swipe record');
    
    // Use proper ObjectId casting
    const mongoose = await import('mongoose');
    const swipe = await Swipe.findOneAndUpdate(
      { 
        swiperId: new mongoose.default.Types.ObjectId(swiperIdStr), 
        swipedId: new mongoose.default.Types.ObjectId(targetUserIdStr) 
      },
      { 
        swiperId: new mongoose.default.Types.ObjectId(swiperIdStr), 
        swipedId: new mongoose.default.Types.ObjectId(targetUserIdStr), 
        action: 'pass' 
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    console.log('[passUser] Swipe record created:', swipe._id);
    return { message: 'User passed' };
  } catch (error) {
    console.error('[passUser] Error:', error);
    throw error; // Let controller handle it
  }
};

/**
 * Super Like - Premium feature
 * User can super like someone once per day (configurable)
 * If mutual, it's an instant match
 */
export const superLikeUser = async (swiperId, targetUserId) => {
  console.log('[superLikeUser] Called with:', { swiperId, targetUserId });
  
  if (!swiperId || !targetUserId) {
    return { error: 'Missing required parameters', status: 400 };
  }
  
  try {
    const swiperIdStr = swiperId.toString();
    const targetUserIdStr = targetUserId.toString();
    
    if (swiperIdStr === targetUserIdStr) {
      return { error: 'You cannot super like yourself', status: 400 };
    }

    const targetUser = await User.findById(targetUserIdStr);
    if (!targetUser) {
      console.error('[superLikeUser] Target user not found:', targetUserIdStr);
      return { error: 'User not found', status: 404 };
    }

    // Import mongoose for ObjectId
    const mongoose = await import('mongoose');
    const mongooseId = mongoose.default.Types.ObjectId;
    
    // Create/update swipe with super_like action
    const swipe = await Swipe.findOneAndUpdate(
      { 
        swiperId: new mongooseId(swiperIdStr), 
        swipedId: new mongooseId(targetUserIdStr) 
      },
      { 
        swiperId: new mongooseId(swiperIdStr), 
        swipedId: new mongooseId(targetUserIdStr), 
        action: 'super_like' 
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    console.log('[superLikeUser] Super like recorded:', swipe._id);
    
    // Check if the other user has liked us (mutual super like or regular like)
    const otherLikedMe = await Swipe.findOne({
      swiperId: new mongooseId(targetUserIdStr),
      swipedId: new mongooseId(swiperIdStr),
      action: { $in: ['like', 'super_like'] }
    });

    // If mutual like exists, create a match
    if (otherLikedMe) {
      console.log('[superLikeUser] Mutual like detected - creating match');
      
      let match = await Match.findMatch(swiperIdStr, targetUserIdStr);

      if (!match) {
        // Populate both users for notification
        const swiper = await User.findById(swiperIdStr).select('username fullName avatar');
        match = await Match.create({
          user1Id: swiperIdStr,
          user2Id: targetUserIdStr,
          matchedAt: new Date(),
          matchType: 'super_like' // Mark as super like match
        });
      } else {
        match.isActive = true;
        match.matchedAt = new Date();
        match.matchType = 'super_like';
        await match.save();
      }
      
      return { 
        matched: true, 
        match, 
        message: "It's a Super Match! You both liked each other! 🌟",
        isSuperMatch: true
      };
    }

    // Not mutual yet - the other user will see they were super liked
    return { 
      matched: false, 
      message: 'Super like sent! They will see you liked them with a Super Like ⭐',
      isSuperMatch: false
    };
  } catch (error) {
    console.error('[superLikeUser] Error:', error);
    throw error;
  }
};

export const getLikedUsers = async (userId) => {
  const likedSwipes = await Swipe.getLikedUsers(userId);
  const likedUsers = likedSwipes
    .map(swipe => swipe.swipedId)
    .filter(Boolean);

  return { users: likedUsers };
};

export const getMutualMatches = async (userId) => {
  const matches = await Match.findUserMatches(userId);
  const mutualMatches = matches.filter(match => match.isActive !== false);

  const formattedMatches = mutualMatches.map(match => {
    const otherUserId = match.getOtherUser(userId);
    return {
      _id: match._id,
      matchId: match._id,
      userId: otherUserId,
      matchedAt: match.matchedAt || match.createdAt,
      lastActivity: match.lastActivity,
      createdAt: match.createdAt
    };
  });

  const populatedMatches = await Match.populate(formattedMatches, {
    path: 'userId',
    select: '-password -passwordHash'
  });

  return { matches: populatedMatches };
};

export const unmatchUser = async (userId, matchId) => {
  const match = await Match.findById(matchId);
  if (!match) return { error: 'Match not found', status: 404 };

  if (!match.hasUser(userId)) {
    return { error: 'Not authorized to unmatch', status: 403 };
  }

  // Determine the other user
  const otherUserId = match.hasUser(match.user1Id)
    ? match.user2Id?.toString() === userId.toString()
      ? match.user1Id
      : match.user2Id
    : match.user1Id;

  const u1 = match.user1Id?.toString();
  const u2 = match.user2Id?.toString();
  const other = u1 === userId.toString() ? u2 : u1;

  // 1. Deactivate match
  match.isActive = false;
  await match.save();

  // 2. Delete all messages for this match (both matchId and conversationId-based)
  try {
    const Message = (await import('../models/Message.js')).default;
    await Message.deleteMany({
      $or: [
        { matchId: match._id },
        { conversationId: match._id }
      ]
    });
  } catch (msgErr) {
    console.error('[unmatchUser] Failed to delete messages:', msgErr.message);
  }

  // 3. Add mutual "pass" swipes so neither appears in Discover for the other
  if (other) {
    try {
      const mongoose = await import('mongoose');
      const ObjId = mongoose.default.Types.ObjectId;
      const userIdObj = new ObjId(userId.toString());
      const otherIdObj = new ObjId(other);

      // Current user passes the other
      await Swipe.findOneAndUpdate(
        { swiperId: userIdObj, swipedId: otherIdObj },
        { swiperId: userIdObj, swipedId: otherIdObj, action: 'pass' },
        { upsert: true, new: true }
      );
      // Other user passes current user (so they don't see them either)
      await Swipe.findOneAndUpdate(
        { swiperId: otherIdObj, swipedId: userIdObj },
        { swiperId: otherIdObj, swipedId: userIdObj, action: 'pass' },
        { upsert: true, new: true }
      );
    } catch (swipeErr) {
      console.error('[unmatchUser] Failed to create pass swipes:', swipeErr.message);
    }
  }

  return { message: 'Unmatched successfully' };
};

export const getSwipeHistory = async (userId, { limit = 100 } = {}) => {
  const swipes = await Swipe.find({ swiperId: userId })
    .populate('swipedId', '-password -passwordHash')
    .sort({ createdAt: -1 })
    .limit(limit);

  return { swipes };
};

export default {
  likeUser,
  passUser,
  superLikeUser,
  getLikedUsers,
  getMutualMatches,
  unmatchUser,
  getSwipeHistory
};
