/**
 * Notification Component - Handles match, like, and call notifications
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../store/authStore';

// ===========================================
// LIKE NOTIFICATION
// ===========================================

const LikeNotification = ({ likeData, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (!likeData) return null;

  const fromUser = likeData.from || likeData;

  const handleViewProfile = () => {
    onClose();
    if (fromUser?._id) {
      navigate(`/profile/${fromUser._id}`);
    }
  };

  const handleGoToDiscover = () => {
    onClose();
    navigate('/discover');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-5xl mb-3">💖</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Ai đó đã thích bạn!</h2>
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-semibold text-gray-700">{fromUser?.username || fromUser?.fullName || 'Một người'}</span> đã thích hồ sơ của bạn
          </p>

          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-pink-400 shadow-lg">
              {fromUser?.avatar ? (
                <img src={fromUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {fromUser?.username?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={handleViewProfile} className="w-full py-2.5 px-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-full">
              💕 Xem hồ sơ
            </button>
            <button onClick={handleGoToDiscover} className="w-full py-2 px-6 bg-gray-100 text-gray-600 font-medium rounded-full">
              Tiếp tục khám phá
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================
// MATCH NOTIFICATION
// ===========================================

const MatchNotification = ({ matchData, onClose }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  if (!matchData) return null;

  // The partner user - this is the matched user (NOT current user)
  const otherUser = matchData.matchedBy || matchData.user || matchData;

  const handleGoToChat = () => {
    onClose();
    if (matchData.matchId) {
      console.log('[MatchNotification] Going to chat:', matchData.matchId);
      navigate(`/messages/${matchData.matchId}`);
    }
  };

  const handleViewProfile = () => {
    onClose();
    if (otherUser?._id) {
      // DEBUG: Log to verify we're using the correct user ID
      console.log('[MatchNotification] Viewing profile:', {
        partnerId: otherUser._id,
        partnerUsername: otherUser.username || otherUser.fullName,
        currentUserId: currentUser?._id,
        isCorrect: otherUser._id !== currentUser?._id
      });
      navigate(`/profile/${otherUser._id}`);
    } else {
      console.warn('[MatchNotification] No partner user ID available:', otherUser);
    }
  };

  const handleGoToDiscover = () => {
    onClose();
    navigate('/discover');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-6xl mb-4">💕</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Kết đôi!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Bạn và <span className="font-semibold text-gray-700">{otherUser?.username || otherUser?.fullName || 'Ai đó'}</span> đã thích nhau!
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-pink-400">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{currentUser?.username?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
              )}
            </div>
            <div className="text-2xl">❤️</div>
            <div 
              className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-purple-400 cursor-pointer hover:scale-105 hover:ring-4 transition-all"
              onClick={handleViewProfile}
              title={`Xem hồ sơ của ${otherUser?.username || 'người này'}`}
            >
              {otherUser?.avatar ? (
                <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{otherUser?.username?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleGoToChat} className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-full">
              💬 Nhắn tin ngay
            </button>
            <button onClick={handleViewProfile} className="w-full py-2.5 px-6 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold rounded-full hover:from-purple-600 hover:to-violet-600 transition-colors">
              👤 Xem hồ sơ {otherUser?.username || ''}
            </button>
            <button onClick={handleGoToDiscover} className="w-full py-2 px-6 bg-gray-100 text-gray-600 font-medium rounded-full">
              Tiếp tục khám phá
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================
// INCOMING CALL NOTIFICATION
// ===========================================

const IncomingCallNotification = ({ callData, onAccept, onReject }) => {
  if (!callData) return null;

  const caller = callData.caller;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-md" />
      <div className="relative bg-[#1e293b] border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-pink-500/10 rounded-full animate-ping opacity-20" />

        <div className="relative flex flex-col items-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-pink-500/30">
              {caller?.avatar ? (
                <img src={caller.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{caller?.username?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center border-2 border-[#1e293b] animate-bounce">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-1">{caller?.username || caller?.fullName || 'Ai đó'}</h2>
          <p className="text-pink-400 font-bold text-xs uppercase tracking-[0.2em] mb-8 animate-pulse">Đang gọi cho bạn...</p>

          <div className="flex items-center justify-center gap-8 w-full">
            <div className="flex flex-col items-center gap-3">
              <button onClick={onReject} className="w-16 h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-[0_10px_20px_rgba(244,63,94,0.3)]">
                <svg className="w-8 h-8 mx-auto" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm4.59 3.59L12 14.17 7.41 9.59 6 11l6 6 6-6-1.41-1.41z" transform="rotate(-135, 12, 12)" />
                </svg>
              </button>
              <span className="text-[10px] font-bold text-rose-300 uppercase">Từ chối</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button onClick={onAccept} className="w-16 h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <span className="text-[10px] font-bold text-emerald-300 uppercase">Chấp nhận</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================
// HOOK TO MANAGE NOTIFICATIONS
// ===========================================

export const useMatchNotification = () => {
  const [matchNotification, setMatchNotification] = useState(null);
  const [likeNotification, setLikeNotification] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const { socket, isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const matchTimerRef = useRef(null);
  const likeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
      if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
    };
  }, []);

  const handleNewMatch = useCallback((data) => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    if (likeTimerRef.current) clearTimeout(likeTimerRef.current);

    setMatchNotification(data);
    setLikeNotification(null);

    matchTimerRef.current = setTimeout(() => {
      setMatchNotification(null);
    }, 15000);
  }, []);

  const handleNewLike = useCallback((data) => {
    if (!matchNotification) {
      if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
      setLikeNotification(data);
      likeTimerRef.current = setTimeout(() => {
        setLikeNotification(null);
      }, 8000);
    }
  }, [matchNotification]);

  const handleIncomingCall = useCallback((data) => {
    if (!location.pathname.includes('/video-call/')) {
      setIncomingCall(data);
    }
  }, [location.pathname]);

  const handleCallEnded = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('new_match', handleNewMatch);
    socket.on('new_like', handleNewLike);
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_rejected', handleCallEnded);

    return () => {
      socket.off('new_match', handleNewMatch);
      socket.off('new_like', handleNewLike);
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallEnded);
    };
  }, [socket, isConnected, handleNewMatch, handleNewLike, handleIncomingCall, handleCallEnded]);

  const closeMatchNotification = () => setMatchNotification(null);
  const closeLikeNotification = () => setLikeNotification(null);

  const acceptCall = () => {
    if (incomingCall) {
      const matchId = incomingCall.matchId;
      navigate(`/video-call/${matchId}`, { state: { incomingCall } });
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socket?.emit('reject_call', {
        callerId: incomingCall.caller._id,
        matchId: incomingCall.matchId
      });
      setIncomingCall(null);
    }
  };

  return {
    matchNotification,
    likeNotification,
    incomingCall,
    closeMatchNotification,
    closeLikeNotification,
    acceptCall,
    rejectCall
  };
};

// ===========================================
// PROVIDER
// ===========================================

export const MatchNotificationProvider = ({ children }) => {
  const {
    matchNotification,
    likeNotification,
    incomingCall,
    closeMatchNotification,
    closeLikeNotification,
    acceptCall,
    rejectCall
  } = useMatchNotification();

  return (
    <>
      {children}
      {matchNotification && (
        <MatchNotification matchData={matchNotification} onClose={closeMatchNotification} />
      )}
      {likeNotification && (
        <LikeNotification likeData={likeNotification} onClose={closeLikeNotification} />
      )}
      {incomingCall && (
        <IncomingCallNotification callData={incomingCall} onAccept={acceptCall} onReject={rejectCall} />
      )}
    </>
  );
};

export default MatchNotification;
