import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../context/SocketContext';
import { userService, getFullImageUrl } from '../services/api';

// ===========================================
// WEBRTC CONFIG - TURN SERVER CRITICAL FOR PRODUCTION
// ===========================================
const ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "f8bdbcf9501081f2fcf1f412",
    credential: "99e1HWcSlY0Hf0mr",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "f8bdbcf9501081f2fcf1f412",
    credential: "99e1HWcSlY0Hf0mr",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "f8bdbcf9501081f2fcf1f412",
    credential: "99e1HWcSlY0Hf0mr",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "f8bdbcf9501081f2fcf1f412",
    credential: "99e1HWcSlY0Hf0mr",
  },
];

const VideoCall = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // State
  const [otherUser, setOtherUser] = useState(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(location.state?.incomingCall || null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteStreamReceived, setRemoteStreamReceived] = useState(false);
  const [mediaStatus, setMediaStatus] = useState({ video: true, audio: true });

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const pendingCandidates = useRef([]);
  const remoteStreamChecked = useRef(false);
  const isInitiator = useRef(false);
  const hasAutoStarted = useRef(false);

  // Fetch other user info
  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!matchId) return;
      try {
        const response = await userService.getMatches();
        const matchList = response?.matches || response?.data || [];
        const match = Array.isArray(matchList) ? matchList.find(m => m._id === matchId || m.matchId === matchId) : null;

        if (match) {
          const other = match.userId ||
            match.users?.find(u => u._id !== user?._id) ||
            (match.user1Id?.toString() === user?._id?.toString() ? match.user2Id : match.user1Id);

          if (other) {
            console.log('[VideoCall] Found partner:', other.username || other._id);
            setOtherUser(other);
          }
        }
      } catch (err) {
        console.error('[VideoCall] Error fetching matches:', err);
      }
    };

    fetchOtherUser();
  }, [matchId, user?._id]);



  // ===========================================
  // ICE CANDIDATE QUEUE MANAGEMENT
  // ===========================================

  const addPendingCandidate = useCallback(async (candidate) => {
    if (!peerConnection.current) {
      pendingCandidates.current.push(candidate);
      return;
    }

    try {
      if (peerConnection.current.remoteDescription) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidates.current.push(candidate);
      }
    } catch (err) {
      console.error('[ICE] Failed to add candidate:', err);
    }
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    if (!peerConnection.current || pendingCandidates.current.length === 0) return;

    const candidates = [...pendingCandidates.current];
    pendingCandidates.current = [];

    for (const candidate of candidates) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[ICE] Failed to flush candidate:', err);
      }
    }
  }, []);

  // Check remote stream periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (peerConnection.current && !remoteStreamReceived && !remoteStreamChecked.current) {
        const receivers = peerConnection.current.getReceivers();
        if (receivers.length > 0) {
          const track = receivers[0].track;
          if (track && track.readyState === 'live') {
            remoteStreamChecked.current = true;
            const stream = new MediaStream();
            receivers.forEach(r => {
              if (r.track) stream.addTrack(r.track);
            });
            setRemoteStream(stream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(() => { });
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [remoteStreamReceived]);

  // Ensure video streams are attached when video elements mount
  useEffect(() => {
    if (isVideoCallActive && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.playsInline = true;
      localVideoRef.current.autoplay = true;
    }
  }, [isVideoCallActive, localStream]);

  useEffect(() => {
    if (isVideoCallActive && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.playsInline = true;
      remoteVideoRef.current.autoplay = true;
      remoteVideoRef.current.play().catch(() => { });
    }
  }, [isVideoCallActive, remoteStream]);

  // ===========================================
  // SOCKET EVENT LISTENERS
  // ===========================================

  useEffect(() => {
    if (!socket || !matchId) return;

    const handleIncomingCall = (data) => {
      console.log('[VideoCall] Incoming call:', data);
      setIncomingCall(data);
    };

    const handleCallAccepted = (data) => {
      handleCallAcceptedFn(data);
    };

    const handleCallRejected = () => {
      console.log('[VideoCall] Call rejected');
      alert('Cuộc gọi đã bị từ chối');
      cleanupCall();
    };

    const handleCallEnded = () => {
      console.log('[VideoCall] Call ended');
      cleanupCall();
    };

    const handleIceCandidate = async (data) => {
      if (data.candidate) {
        await addPendingCandidate(data.candidate);
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('ice_candidate', handleIceCandidate);
    };
  }, [socket, matchId, addPendingCandidate]);

  // ===========================================
  // CLEANUP
  // ===========================================

  const cleanupCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setRemoteStream(null);
    setRemoteStreamReceived(false);
    setIsVideoCallActive(false);
    setIncomingCall(null);
    pendingCandidates.current = [];
    remoteStreamChecked.current = false;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [localStream]);

  // ===========================================
  // START VIDEO CALL
  // ===========================================

  const startVideoCall = async () => {
    if (!otherUser?._id) {
      alert('Không thể bắt đầu gọi: không tìm thấy người dùng');
      return;
    }

    try {
      console.log('[VideoCall] Starting call...');
      isInitiator.current = true;
      setRemoteStreamReceived(false);
      remoteStreamChecked.current = false;
      pendingCandidates.current = [];

      console.log('[MEDIA] Requesting permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      console.log('[MEDIA] Stream received:', stream);

      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());

      stream.getTracks().forEach(track => {
        console.log(track.kind, track.enabled);
      });

      setMediaStatus({
        video: stream.getVideoTracks().length > 0,
        audio: stream.getAudioTracks().length > 0
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.autoplay = true;
      }

      peerConnection.current = new RTCPeerConnection({
        iceServers: ICE_SERVERS
      });

      peerConnection.current.oniceconnectionstatechange = () => {
        console.log('[ICE STATE]:', peerConnection.current.iceConnectionState);
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log('[CONNECTION STATE]:', peerConnection.current.connectionState);
      };

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        console.log('[TRACK EVENT]:', event.streams);
        const [remote] = event.streams;
        if (remote) {
          setRemoteStream(remote);
          setRemoteStreamReceived(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remote;
            remoteVideoRef.current.playsInline = true;
            remoteVideoRef.current.autoplay = true;
            remoteVideoRef.current.play().catch(() => { });
          }
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
      console.error('[MEDIA ERROR]', err.name, err.message);

      if (err.name === 'NotAllowedError') {
        alert('Bạn đã từ chối quyền camera/micro. Hãy bật lại trong trình duyệt.');
      } else if (err.name === 'NotFoundError') {
        alert('Không tìm thấy camera hoặc microphone');
      } else {
        alert('Không thể bắt đầu cuộc gọi video. Vui lòng kiểm tra quyền truy cập camera/micro.');
      }
    }
  };

  // ===========================================
  // ACCEPT INCOMING CALL
  // ===========================================

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      console.log('[VideoCall] Accepting call...');
      isInitiator.current = false;
      setRemoteStreamReceived(false);
      remoteStreamChecked.current = false;

      console.log('[MEDIA] Requesting permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      console.log('[MEDIA] Stream received:', stream);

      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());

      stream.getTracks().forEach(track => {
        console.log(track.kind, track.enabled);
      });

      setMediaStatus({
        video: stream.getVideoTracks().length > 0,
        audio: stream.getAudioTracks().length > 0
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.autoplay = true;
      }

      peerConnection.current = new RTCPeerConnection({
        iceServers: ICE_SERVERS
      });

      peerConnection.current.oniceconnectionstatechange = () => {
        console.log('[ICE STATE]:', peerConnection.current.iceConnectionState);
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log('[CONNECTION STATE]:', peerConnection.current.connectionState);
      };

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        console.log('[TRACK EVENT]:', event.streams);
        const [remote] = event.streams;
        if (remote) {
          setRemoteStream(remote);
          setRemoteStreamReceived(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remote;
            remoteVideoRef.current.playsInline = true;
            remoteVideoRef.current.autoplay = true;
            remoteVideoRef.current.play().catch(() => { });
          }
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
      await flushPendingCandidates();

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
      console.error('[MEDIA ERROR]', err.name, err.message);

      if (err.name === 'NotAllowedError') {
        alert('Bạn đã từ chối quyền camera/micro. Hãy bật lại trong trình duyệt.');
      } else if (err.name === 'NotFoundError') {
        alert('Không tìm thấy camera hoặc microphone');
      } else {
        alert('Không thể nhận cuộc gọi.');
      }
    }
  };

  const handleCallAcceptedFn = async (data) => {
    try {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.signal));
      setTimeout(() => flushPendingCandidates(), 100);
      setIsVideoCallActive(true);
    } catch (err) {
      console.error('[VideoCall] Failed to handle call accepted:', err);
    }
  };

  // ===========================================
  // END / REJECT CALL
  // ===========================================

  const endCall = useCallback(() => {
    cleanupCall();

    if (otherUser?._id) {
      socket?.emit('end_call', { targetUserId: otherUser._id, matchId });
    }

    navigate('/messages');
  }, [cleanupCall, otherUser?._id, socket, matchId, navigate]);

  const rejectCall = useCallback(() => {
    if (incomingCall?.caller?._id) {
      socket?.emit('reject_call', {
        callerId: incomingCall.caller._id,
        matchId
      });
    }
    setIncomingCall(null);
  }, [incomingCall, socket, matchId]);

  // UI State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    }
    setIsVideoOff(!isVideoOff);
  };

  const displayName = otherUser?.fullName || otherUser?.username || 'Đang kết nối...';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E2034] to-[#12131C] flex flex-col font-sans select-none overflow-hidden relative">

      {/* Top Indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#2a2c42]/60 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
        <span className="text-[10px] font-medium tracking-widest text-gray-300 uppercase">Mã hóa đầu cuối</span>
      </div>

      {/* Pre-call UI */}
      {!isVideoCallActive && !incomingCall && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-20 z-10 w-full px-6">
          <div className="relative mb-6">
            <div className="w-40 h-40 rounded-full border-2 border-red-500 bg-[#2a2c42] overflow-hidden">
              {otherUser?.avatar ? (
                <img src={getFullImageUrl(otherUser.avatar)} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-br from-pink-400 to-purple-500">
                  {otherUser?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </div>

          <h1 className="text-[40px] font-black text-white tracking-tight mb-1">{displayName}</h1>
          <p className="text-gray-300 text-sm">Đang kết nối...</p>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#2a2c42]/40 border border-white/5 backdrop-blur-2xl px-6 py-4 rounded-3xl">
            <button onClick={startVideoCall} className="w-[68px] h-[68px] rounded-full bg-green-500 hover:bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button onClick={endCall} className="w-[68px] h-[68px] rounded-full bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center text-white">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm4.59 3.59L12 14.17 7.41 9.59 6 11l6 6 6-6-1.41-1.41z" transform="rotate(-135, 12, 12)" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Incoming Call UI */}
      {incomingCall && !isVideoCallActive && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-20 z-10 w-full px-6">
          <div className="w-40 h-40 rounded-full border-4 border-green-500 bg-[#2a2c42] shadow-[0_0_40px_rgba(34,197,94,0.3)] animate-pulse overflow-hidden mb-6">
            {incomingCall.caller?.avatar ? (
              <img src={getFullImageUrl(incomingCall.caller.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-br from-pink-400 to-purple-500">
                {incomingCall.caller?.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <h1 className="text-[40px] font-black text-white">{incomingCall.caller?.fullName || incomingCall.caller?.username || 'Ai đó'}</h1>
          <p className="text-green-400 text-sm">Đang gọi cho bạn...</p>

          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-10">
            <button onClick={rejectCall} className="w-[72px] h-[72px] bg-red-600 rounded-full flex items-center justify-center text-white">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm4.59 3.59L12 14.17 7.41 9.59 6 11l6 6 6-6-1.41-1.41z" transform="rotate(-135, 12, 12)" />
              </svg>
            </button>
            <button onClick={acceptCall} className="w-[72px] h-[72px] bg-green-500 rounded-full flex items-center justify-center text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {isVideoCallActive && (
        <div className="absolute inset-0 z-0 bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          <div className="absolute top-20 right-4 w-28 h-40 rounded-2xl border-2 border-white/20 bg-gray-900 overflow-hidden shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {!mediaStatus.video && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center px-2">
                <span className="text-white text-[10px] font-medium">No camera detected</span>
              </div>
            )}

            {!mediaStatus.audio && (
              <div className="absolute bottom-2 left-0 w-full flex justify-center">
                <span className="bg-red-500/80 text-white text-[9px] px-2 py-0.5 rounded-full">No microphone detected</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#2a2c42]/60 border border-white/10 backdrop-blur-xl px-7 py-5 rounded-[2rem]">
            <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${isVideoOff ? 'bg-red-500' : 'bg-white/10'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            <button onClick={endCall} className="w-[72px] h-[72px] rounded-full bg-red-600 flex items-center justify-center text-white">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm4.59 3.59L12 14.17 7.41 9.59 6 11l6 6 6-6-1.41-1.41z" transform="rotate(-135, 12, 12)" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
//new