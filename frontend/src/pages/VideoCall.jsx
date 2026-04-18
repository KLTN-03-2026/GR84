/**
 * VideoCall Component - Standalone video call interface
 * Extracted from Chat.jsx, handles WebRTC video calls
 *
 * Features:
 * - WebRTC peer connection
 * - Socket.IO signaling
 * - Incoming call modal
 * - Call controls (end, accept, reject)
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../context/SocketContext';
import { userService, matchService } from '../services/api';

const VideoCall = () => {
  const { matchId, userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // State
  const [otherUser, setOtherUser] = useState(null);
  const [currentMatchId, setCurrentMatchId] = useState(matchId || null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  // Fetch other user info
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!matchId) return;
      try {
        const matchesResponse = await userService.getMatches();
        const matchList = matchesResponse?.matches || matchesResponse?.data || [];
        const match = Array.isArray(matchList) ? matchList.find(m => m._id === matchId) : null;

        if (match) {
          const other = match.users?.find(u => u._id !== user?._id) ||
            (match.user1Id?.toString() === user?._id?.toString() ? match.user2Id : match.user1Id);
          setOtherUser(other);
        }
      } catch (err) {
        console.error('[VideoCall] Failed to fetch other user:', err);
      }
    };

    fetchOtherUser();
  }, [matchId, user?._id]);

  // Socket event listeners for call events
  useEffect(() => {
    if (!socket || !matchId) return;

    const handleIncomingCall = (data) => {
      setIncomingCall(data);
    };

    const handleCallAccepted = (data) => {
      handleCallAcceptedFn(data);
    };

    const handleCallRejected = () => {
      alert('Call was rejected');
      endCall();
    };

    const handleCallEnded = () => {
      endCall();
    };

    const handleRemoteStream = (stream) => {
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    const handleIceCandidate = async (data) => {
      if (peerConnection.current && data.candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[VideoCall] Failed to add ICE candidate:', err);
        }
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('remote_stream', handleRemoteStream);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('remote_stream', handleRemoteStream);
      socket.off('ice_candidate', handleIceCandidate);
    };
  }, [socket, matchId]);

  // Start outgoing video call
  const startVideoCall = async () => {
    if (!otherUser?._id) {
      alert('Cannot start call: other user not found');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit('ice_candidate', {
            targetUserId: otherUser._id,
            candidate: event.candidate,
            matchId
          });
        }
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket?.emit('call_user', {
        targetUserId: otherUser._id,
        signalData: offer,
        callType: 'video',
        matchId
      });

      setIsVideoCallActive(true);
    } catch (err) {
      console.error('[VideoCall] Failed to start call:', err);
      alert('Could not start video call. Please check camera/microphone permissions.');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit('ice_candidate', {
            targetUserId: incomingCall.caller._id,
            candidate: event.candidate,
            matchId
          });
        }
      };

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket?.emit('accept_call', {
        callerId: incomingCall.caller._id,
        signalData: answer,
        matchId
      });

      setIncomingCall(null);
      setIsVideoCallActive(true);
    } catch (err) {
      console.error('[VideoCall] Failed to accept call:', err);
      alert('Could not accept call.');
    }
  };

  // Handle call accepted (for caller side)
  const handleCallAcceptedFn = async (data) => {
    try {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.signal));
      setIsVideoCallActive(true);
    } catch (err) {
      console.error('[VideoCall] Failed to handle call accepted:', err);
    }
  };

  // End call
  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setRemoteStream(null);
    setIsVideoCallActive(false);

    if (otherUser?._id) {
      socket?.emit('end_call', {
        targetUserId: otherUser._id,
        matchId
      });
    }

    // Navigate back to messages
    navigate(`/messages`);
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall?.caller?._id) {
      socket?.emit('reject_call', {
        callerId: incomingCall.caller._id,
        matchId
      });
    }
    setIncomingCall(null);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={endCall}
            className="p-2 hover:bg-gray-700 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gray-700 overflow-hidden">
                {otherUser?.avatar ? (
                  <img src={otherUser.avatar} alt={otherUser.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-500">
                    <span className="text-xl font-bold text-white">
                      {otherUser?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {otherUser?.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-3 border-gray-800 rounded-full"></div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-white">
                {otherUser?.fullName || otherUser?.username}
              </h2>
              <p className="text-xs text-gray-400">
                {isVideoCallActive ? 'Video call in progress' : 'Calling...'}
              </p>
            </div>
          </div>
        </div>

        {/* Call status indicator */}
        {isVideoCallActive && (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{localStream ? 'Connected' : 'Connecting...'}</span>
          </div>
        )}
      </div>

      {/* Video Call UI */}
      {isVideoCallActive && (
        <div className="relative flex-1 bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 w-32 h-44 object-cover rounded-xl border-2 border-white/30 shadow-lg"
          />
          <button
            onClick={endCall}
            className="absolute top-4 right-4 p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && !isVideoCallActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
              {incomingCall.caller?.avatar ? (
                <img src={incomingCall.caller.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {incomingCall.caller?.username?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {incomingCall.caller?.username || 'Incoming Call'}
            </h3>
            <p className="text-gray-400 mb-8">Incoming video call...</p>
            <div className="flex justify-center gap-6">
              <button
                onClick={rejectCall}
                className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
              <button
                onClick={acceptCall}
                className="p-5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all shadow-lg"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Call Button (when not in call and no incoming call) */}
      {!isVideoCallActive && !incomingCall && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gray-800 overflow-hidden">
              {otherUser?.avatar ? (
                <img src={otherUser.avatar} alt={otherUser.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">
                    {otherUser?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {otherUser?.fullName || otherUser?.username || 'Loading...'}
            </h2>
            <p className="text-gray-400 mb-8">
              {otherUser?.isOnline ? 'Online' : 'Offline'}
            </p>
            <button
              onClick={startVideoCall}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg"
            >
              Start Video Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
