/**
 * Messages Page - Trang tin nhắn với đầy đủ tính năng
 * Features:
 * - Full inline chat (không cần mở rộng)
 * - Media upload
 * - Emoji picker
 * - Read receipts
 * - Pagination (load more)
 * - Error retry
 * - Real-time updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../context/SocketContext';
import { messageService, matchService } from '../services/api';
import Navbar from '../components/Navbar';
import SidebarMenu from '../components/SidebarMenu';

const EMOJIS = ['😀', '😍', '🥰', '😂', '🤍', '🔥', '👏', '✨', '😭', '👍', '❤️', '🎉', '💯', '🌟', '💪'];
const ICEBREAKERS = ['Say Hi 👋', "What's your weekend plan?", 'Bạn thích hẹn hò ở đâu?'];
const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80';
const MAX_MESSAGE_LENGTH = 1000;

const getDateLabel = (iso) => {
  if (!iso) return 'Today';
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startToday - startDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
};

const Messages = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // State
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(location.state?.matchId || null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [failedMessages, setFailedMessages] = useState(new Map());
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState('');
  const [pendingImageName, setPendingImageName] = useState('');
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [unmatching, setUnmatching] = useState(false);

  // Refs
  const messagesContainerRef = useRef(null);
  const messagesStartRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileAttachmentInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const pendingConversationAutoScrollRef = useRef(false);
  const prevMessageCountRef = useRef(0);
  const showScrollButtonRef = useRef(false);

  // ============================================
  // FETCH CONVERSATIONS
  // ============================================
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const response = await messageService.getConversations();
      const rawData = response?.conversations || response?.data?.conversations || response?.data || [];
      const list = Array.isArray(rawData) ? rawData.filter(Boolean) : [];
      setConversations(list);

      // Keep messages landing on conversation list by default
      if (selectedConversationId && !list.some((conv) => (conv?.matchId || conv?._id) === selectedConversationId)) {
        setSelectedConversationId(null);
      }
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách cuộc trò chuyện');
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);

  // ============================================
  // FETCH MESSAGES (with pagination)
  // ============================================
  const fetchMessages = useCallback(async (matchId, pageNum = 1, append = false) => {
    if (!matchId) return;
    try {
      if (pageNum === 1) setLoadingMessages(true);
      else setLoadingMore(true);

      const response = await messageService.getMessages(matchId, pageNum, 50);
      const msgs = response?.messages || response?.data?.messages || response?.data || [];

      // Check pagination
      const pagination = response?.pagination || response?.data?.pagination || {};
      setHasMoreMessages(pagination.hasMore !== false && pagination.pages >= pageNum);

      if (append) {
        // Prepend older messages (backend already returns in chronological order)
        const container = messagesStartRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;
        const oldScrollTop = container?.scrollTop || 0;

        setMessages(prev => [...msgs, ...prev]);

        // Restore scroll position
        setTimeout(() => {
          if (container) {
            container.scrollTop = oldScrollTop + (container.scrollHeight - oldScrollHeight);
          }
        }, 50);
      } else {
        setMessages(Array.isArray(msgs) ? msgs : []); // Backend already returns chronological order
        setPage(1);
      }

      // Mark as read
      await messageService.markAsRead(matchId).catch(() => { });
    } catch (err) {
      setError('Không thể tải tin nhắn');
    } finally {
      setLoadingMessages(false);
      setLoadingMore(false);
    }
  }, []);

  // ============================================
  // LOAD MORE (scroll up)
  // ============================================
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMoreMessages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMessages(selectedConversationId, nextPage, true);
  }, [page, selectedConversationId, fetchMessages, loadingMore, hasMoreMessages]);

  // ============================================
  // HANDLE SCROLL
  // ============================================
  const handleMessagesScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    shouldAutoScrollRef.current = !isScrolledUp;

    if (isScrolledUp && !showScrollButtonRef.current) {
      showScrollButtonRef.current = true;
      setShowScrollButton(true);
    } else if (!isScrolledUp && showScrollButtonRef.current) {
      showScrollButtonRef.current = false;
      setShowScrollButton(false);
    }

    if (scrollTop < 100 && hasMoreMessages && !loadingMore) {
      loadMoreMessages();
    }
  }, [loadMoreMessages, hasMoreMessages, loadingMore]);

  // ============================================
  // SCROLL TO BOTTOM
  // ============================================
  const scrollToBottom = useCallback((behavior = 'smooth', force = false) => {
    if (!force && !shouldAutoScrollRef.current) return;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
      if (showScrollButtonRef.current) {
        showScrollButtonRef.current = false;
        setShowScrollButton(false);
      }
    }, 100);
  }, []);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    if (location.state?.matchId && location.state.matchId !== selectedConversationId) {
      setSelectedConversationId(location.state.matchId);
      // Clean up the state so it doesn't get stuck if user navigates back
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.matchId]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
      socket?.emit('join_room', { matchId: selectedConversationId });
      shouldAutoScrollRef.current = true;
      pendingConversationAutoScrollRef.current = true;
      prevMessageCountRef.current = 0;
      showScrollButtonRef.current = false;
      setShowScrollButton(false);
      setShowSafetyMenu(false);
      setShowComposerMenu(false);
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
    return () => {
      if (selectedConversationId) {
        socket?.emit('leave_room', { matchId: selectedConversationId });
      }
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    if (pendingConversationAutoScrollRef.current) {
      scrollToBottom('auto', true);
      pendingConversationAutoScrollRef.current = false;
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (loadingMore) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom('smooth');
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, selectedConversationId, loadingMore, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
    };
  }, [pendingImagePreview]);

  // ============================================
  // SOCKET LISTENERS
  // ============================================
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.matchId === selectedConversationId || message.conversationId === selectedConversationId) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom('smooth');
        messageService.markAsRead(selectedConversationId).catch(() => { });
      }
      fetchConversations();
    };

    const handleMessagesRead = ({ readAt }) => {
      setMessages(prev => prev.map(msg => ({
        ...msg,
        status: msg.status !== 'seen' && msg.sender !== user?._id ? msg.status : 'seen'
      })));
    };

    const handleTyping = ({ user: typer }) => {
      // Could show typing indicator
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleTyping);
    };
  }, [socket, selectedConversationId, user?._id, scrollToBottom, fetchConversations]);

  // ============================================
  // SEND MESSAGE
  // ============================================
  const handleSend = async (e) => {
    e?.preventDefault();
    const content = newMessage.trim();

    if (!content) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Tin nhắn không quá ${MAX_MESSAGE_LENGTH} ký tự`);
      return;
    }
    if (!selectedConversationId || sending) return;

    setSending(true);
    setSendError(null);

    const tempId = `temp-${Date.now()}`;

    try {
      const response = await messageService.sendMessage(selectedConversationId, {
        content,
        type: 'text'
      });

      // Handle both successful response formats
      if (response?.success || response?.data || response?.message) {
        // Clear input immediately
        setNewMessage('');

        // Add message to list if response has data
        if (response?.data) {
          setMessages(prev => [...prev, response.data].filter(Boolean));
        }

        // Emit stop typing and refresh
        socket?.emit('stop_typing', { matchId: selectedConversationId });
        fetchConversations();
        scrollToBottom();
        setSendError(null);
      } else {
        throw new Error(response?.message || 'Không thể gửi tin nhắn');
      }
    } catch (err) {
      let errorMsg = 'Không thể gửi tin nhắn';
      if (err.response?.status === 429) {
        errorMsg = 'Gửi tin nhắn quá nhanh. Vui lòng chờ.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setSendError(errorMsg);
      setFailedMessages(prev => new Map(prev).set(tempId, content));
    } finally {
      setSending(false);
    }
  };

  // Retry failed message
  const retryMessage = (tempId, content) => {
    setFailedMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(tempId);
      return newMap;
    });
    setNewMessage(content);
    setTimeout(() => {
      handleSend();
    }, 0);
  };

  // ============================================
  // TYPING HANDLER
  // ============================================
  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!typingTimeoutRef.current) {
      socket?.emit('typing', { matchId: selectedConversationId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('stop_typing', { matchId: selectedConversationId });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  // ============================================
  // MEDIA UPLOAD
  // ============================================
  const handleMediaSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Chỉ hỗ trợ ảnh JPG, PNG, GIF, WebP');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File quá lớn. Tối đa 5MB');
      return;
    }

    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }

    setPendingImageFile(file);
    setPendingImageName(file.name);
    setPendingImagePreview(URL.createObjectURL(file));

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPendingImage = useCallback(() => {
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(null);
    setPendingImagePreview('');
    setPendingImageName('');
  }, [pendingImagePreview]);

  const sendPendingImage = useCallback(async () => {
    if (!pendingImageFile || !selectedConversationId || uploadingMedia) return;

    setUploadingMedia(true);
    setSendError(null);
    try {
      const uploadRes = await messageService.uploadMedia(selectedConversationId, pendingImageFile);
      if (uploadRes?.success) {
        await messageService.sendMessage(selectedConversationId, {
          content: '',
          image: uploadRes?.mediaUrl,
          messageType: 'image'
        });
        fetchMessages(selectedConversationId);
        fetchConversations();
        clearPendingImage();
      }
    } catch {
      setSendError('Không thể gửi ảnh');
    } finally {
      setUploadingMedia(false);
    }
  }, [pendingImageFile, selectedConversationId, uploadingMedia, fetchMessages, fetchConversations, clearPendingImage]);

  // ============================================
  // HELPERS
  // ============================================
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatConversationTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(iso);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Get active conversation
  const activeConversation = conversations.find(c => c?.matchId === selectedConversationId);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (!conv) return false;
    if (activeFilter === 'unread' && !(conv?.unreadCount > 0)) return false;
    if (!search.trim()) return true;
    const otherUser = conv.userId;
    const name = otherUser?.fullName || otherUser?.username || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getLastMessage = (conv) => {
    if (conv.lastMessage) {
      const isMe = conv.lastMessage.sender === user?._id || conv.lastMessage.sender?._id === user?._id;
      const content = conv.lastMessage.content || '[Hình ảnh]';
      return isMe ? `Bạn: ${content}` : content;
    }
    return 'Chưa có tin nhắn';
  };

  // ============================================
  // UNMATCH HANDLER
  // ============================================
  const handleUnmatch = useCallback(async () => {
    if (!activeConversation?.matchId || unmatching) return;
    setUnmatching(true);
    try {
      await matchService.unmatch(activeConversation.matchId);
      // Remove conversation from list and close chat
      setConversations(prev => prev.filter(c => c.matchId !== activeConversation.matchId));
      setSelectedConversationId(null);
      setMessages([]);
    } catch (err) {
      setError('Không thể hủy tương hợp. Vui lòng thử lại.');
    } finally {
      setUnmatching(false);
      setShowUnmatchConfirm(false);
    }
  }, [activeConversation, unmatching]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="h-[100vh] w-screen bg-white overflow-x-hidden overflow-y-hidden flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative w-full md:mt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <SidebarMenu />

        {/* [FIX]: Sửa w-full thay vì để trống/co lại 
          Bỏ các class giới hạn chiều rộng để nó full width
        */}
        <main className="flex-1 overflow-hidden flex flex-row relative w-full h-full bg-white">
          <div className="flex flex-row h-full w-full flex-1">

            {/* ========== LEFT: Conversations List ========== */}
            <section
              className={`w-full md:w-[340px] lg:w-[360px] shrink-0 border-r border-gray-200 bg-white ${selectedConversationId ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden`}
            >
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="shrink-0 px-4 pt-0 md:pt-2 pb-2 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">Tin nhắn</h1>
                    {conversations.length > 0 && (
                      <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                        {conversations.length}
                      </span>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 pointer-events-none" aria-hidden="true">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                    </span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm kiếm..."
                      aria-label="Tìm kiếm cuộc trò chuyện"
                      className="w-full h-9 pl-10 pr-3 rounded-full bg-rose-50 text-sm text-gray-700 placeholder-gray-400 border border-rose-100 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all"
                    />
                  </div>

                  <div className="mt-2 md:mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeFilter === 'all' ? 'text-rose-600 border-rose-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('unread')}
                      className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeFilter === 'unread' ? 'text-rose-600 border-rose-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                      Chưa đọc
                    </button>
                  </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                  {loadingConversations ? (
                    <div className="py-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-rose-500 mx-auto"></div>
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">
                      {search ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện'}
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const otherUser = conv.userId;
                      const isActive = conv.matchId === selectedConversationId;

                      return (
                        <button
                          key={conv.matchId}
                          onClick={() => setSelectedConversationId(conv.matchId)}
                          className={`relative w-full flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors duration-200 ${isActive ? 'bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'
                            }`}
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-rose-100">
                              {otherUser?.avatar ? (
                                <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                  {(otherUser?.fullName || otherUser?.username || '?').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {otherUser?.isOnline && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500"></span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {otherUser?.fullName || otherUser?.username || 'Unknown'}
                              </p>
                              <span className="text-[11px] text-gray-400 shrink-0">
                                {formatConversationTime(conv.lastActivity)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{getLastMessage(conv)}</p>
                          </div>

                          {/* Unread */}
                          {conv.unreadCount > 0 && (
                            <span className="absolute top-2 right-2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* ========== RIGHT: Chat Area ========== */}
            {/* [FIX]: Bỏ giới hạn width (max-w) để nó tự động giãn full bề ngang phần còn lại */}
            <section
              className={`flex-1 min-w-0 w-full h-full bg-white ${selectedConversationId ? 'block' : 'hidden md:block'} md:flex`}
            >
              <div className="h-full w-full flex flex-col overflow-hidden">

                {/* Chat Header */}
                {activeConversation ? (
                  <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedConversationId(null)}
                        className="md:hidden h-9 w-9 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50"
                        aria-label="Quay lại danh sách cuộc trò chuyện"
                        title="Quay lại"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-rose-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const partnerId = activeConversation.userId?._id;
                          console.log('[Messages] Viewing partner profile:', partnerId);
                          if (partnerId) navigate(`/profile/${partnerId}`);
                        }}
                      >
                        {activeConversation.userId?.avatar ? (
                          <img src={activeConversation.userId.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold">
                            {(activeConversation.userId?.fullName || activeConversation.userId?.username || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          const partnerId = activeConversation.userId?._id;
                          if (partnerId) navigate(`/profile/${partnerId}`);
                        }}
                        title="Xem hồ sơ"
                      >
                        <p className="font-semibold text-gray-900 text-sm hover:text-pink-600 transition-colors">
                          {activeConversation.userId?.fullName || activeConversation.userId?.username || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          {activeConversation.userId?.isOnline ? (
                            <>
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                              Đang hoạt động
                            </>
                          ) : 'Offline'}
                        </p>
                      </div>
                    </div>

                    {/* Video call button */}
                    <div className="relative flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSafetyMenu((prev) => !prev)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        title="More"
                        aria-label="Tùy chọn cuộc trò chuyện"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      <Link
                        to={`/video-call/${activeConversation.matchId}`}
                        state={{ autoCall: true }}
                        className="p-2 text-pink-500 hover:text-pink-600 hover:scale-110 hover:bg-rose-50 rounded-full transition-transform duration-200"
                        title="Gọi video"
                        aria-label="Gọi video"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Link>

                      {showSafetyMenu && (
                        <div className="absolute right-0 top-12 z-20 min-w-[160px] rounded-xl border border-gray-200 bg-white shadow-xl p-1 animate-fade-in">
                          <button
                            type="button"
                            onClick={() => {
                              setShowSafetyMenu(false);
                              setShowUnmatchConfirm(true);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Hủy tương hợp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Report User clicked', activeConversation?.userId?._id);
                              setShowSafetyMenu(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                            Báo cáo người dùng
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white hidden md:block">
                    <p className="text-sm text-gray-500">Chọn cuộc trò chuyện để bắt đầu</p>
                  </div>
                )}

                {/* Messages Area */}
                <div
                  ref={messagesStartRef}
                  onScroll={handleMessagesScroll}
                  className="relative flex-1 overflow-y-auto px-3 md:px-4 py-1 md:py-3 bg-gradient-to-b from-white to-rose-50/20 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                >
                  {/* Load more indicator */}
                  {loadingMore && (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-rose-500"></div>
                    </div>
                  )}

                  {/* Load older button */}
                  {hasMoreMessages && !loadingMore && messages.length > 0 && (
                    <div className="flex justify-center pb-2">
                      <button
                        onClick={loadMoreMessages}
                        className="text-xs text-rose-500 hover:text-rose-600 px-3 py-1 bg-rose-50 rounded-full"
                      >
                        Tải tin nhắn cũ hơn
                      </button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-500"></div>
                    </div>
                  ) : !activeConversation ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <svg className="w-16 h-16 mb-3 text-rose-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm">Chọn một cuộc trò chuyện</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="text-sm">Bắt đầu cuộc trò chuyện</p>
                      <p className="text-xs mt-1">Gửi tin nhắn đầu tiên!</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm">
                        {ICEBREAKERS.map((icebreaker) => (
                          <button
                            key={icebreaker}
                            type="button"
                            onClick={() => setNewMessage(icebreaker)}
                            className="px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs text-rose-600 hover:bg-rose-100 transition-colors"
                          >
                            {icebreaker}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-1">
                      {messages.map((msg, idx) => {
                        const senderData = msg.sender?._id ? msg.sender :
                          (msg.senderId?._id ? msg.senderId : null);
                        const isOwn = senderData?._id === user?._id || msg.sender === user?._id;
                        const senderName = senderData?.fullName || senderData?.username || 'Unknown';
                        const senderAvatar = senderData?.avatar;
                        const isFailed = failedMessages.has(msg._tempId || msg._id);
                        const showDateDivider = idx === 0 || getDateLabel(messages[idx - 1]?.createdAt) !== getDateLabel(msg?.createdAt);

                        return (
                          <div key={msg._id || msg._tempId || idx}>
                            {showDateDivider && (
                              <div className="sticky top-2 z-10 flex justify-center py-1">
                                <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-semibold text-gray-500 border border-rose-100 shadow-sm">
                                  {getDateLabel(msg?.createdAt)}
                                </span>
                              </div>
                            )}

                            <div className={`flex animate-slide-up gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {/* Avatar - clickable to view profile */}
                              <div
                                className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  const isMessageFromMe = senderData?._id === user?._id || msg.sender === user?._id;
                                  const targetId = isMessageFromMe
                                    ? activeConversation.userId?._id  // My message → show partner's profile
                                    : senderData?._id;               // Their message → show sender's profile
                                  console.log('[Messages] Avatar clicked:', {
                                    targetId,
                                    isMessageFromMe,
                                    senderId: senderData?._id,
                                    partnerId: activeConversation.userId?._id
                                  });
                                  if (targetId) navigate(`/profile/${targetId}`);
                                }}
                              >
                                {(isOwn || !senderAvatar) ? (
                                  <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">
                                      {senderName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                ) : (
                                  <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>

                              <div className={`max-w-[82%] sm:max-w-[75%] ${isOwn ? 'text-right' : 'text-left'}`}>
                                {/* Sender name */}
                                {!isOwn && (
                                  <p className="text-[10px] font-semibold text-rose-500 mb-0.5">
                                    {senderName}
                                  </p>
                                )}

                                {/* Message bubble */}
                                <div className={`relative inline-block rounded-2xl px-3.5 py-2.5 shadow-sm ${isOwn
                                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-br-sm'
                                  : 'bg-pink-50 text-gray-900 rounded-bl-sm border border-rose-100'
                                  } ${isFailed ? 'ring-2 ring-red-400' : ''}`}>
                                  {/* Text content */}
                                  {msg.content && (
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                  )}

                                  {/* Image content */}
                                  {(msg.image || msg.mediaUrl) && (
                                    <img
                                      src={msg.image || msg.mediaUrl}
                                      alt=""
                                      className="mt-1.5 max-w-[200px] sm:max-w-[240px] rounded-lg cursor-pointer hover:opacity-90"
                                      onClick={() => setLightboxImage(msg.image || msg.mediaUrl)}
                                    />
                                  )}
                                </div>

                                {/* Time + Status + Retry */}
                                <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                                  {isFailed ? (
                                    <button
                                      onClick={() => retryMessage(msg._tempId, failedMessages.get(msg._tempId))}
                                      className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Gửi lại
                                    </button>
                                  ) : (
                                    <>
                                      <span className="text-[10px] text-gray-500">
                                        {formatTime(msg.createdAt)}
                                      </span>
                                      {isOwn && (
                                        <span className="inline-flex items-center gap-0.5">
                                          {(msg?.status === 'seen' || msg?.status === 'delivered') && (
                                            <svg className={`w-3.5 h-3.5 ${msg?.status === 'seen' ? 'text-pink-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                          <svg
                                            className={`w-3.5 h-3.5 ${msg?.status === 'seen' ? 'text-pink-500' : msg?.status === 'sending' ? 'text-gray-300' : 'text-gray-400'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {failedMessages.size > 0 && (
                        <div className="flex flex-col items-end gap-2">
                          {Array.from(failedMessages.entries()).map(([tempId, content]) => (
                            <div key={tempId} className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px]" title="Retry">!</span>
                              <button
                                type="button"
                                onClick={() => retryMessage(tempId, content)}
                                className="text-[10px] text-red-500 hover:text-red-600 underline"
                                title="Retry"
                              >
                                Retry
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  )}

                  {showScrollButton && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom('smooth', true)}
                      className="absolute bottom-24 right-1/2 translate-x-1/2 w-10 h-10 bg-white rounded-full border border-gray-300 shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-50"
                      title="Scroll to bottom"
                      aria-label="Scroll to bottom"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 10l5 5 5-5" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* ========== Input Area ========== */}
                {activeConversation && (
                  <div className="shrink-0 bg-white relative">
                    {/* Send error */}
                    {sendError && (
                      <div className="mx-3 md:mx-4 mt-2 mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center justify-between">
                        <span>{sendError}</span>
                        <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600" aria-label="Ẩn lỗi gửi tin nhắn">✕</button>
                      </div>
                    )}

                    {/* Emoji picker */}
                    {showEmojiPicker && (
                      <div className="mx-3 md:mx-4 mb-2 rounded-2xl border border-rose-100/80 bg-rose-50/70 px-2.5 py-2 flex items-center gap-1.5 overflow-x-auto">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewMessage(prev => `${prev}${emoji}`)}
                            className="w-9 h-9 shrink-0 rounded-xl border border-rose-100 bg-white/80 hover:bg-white text-[18px] leading-none flex items-center justify-center transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {pendingImagePreview && (
                      <div className="mx-3 md:mx-4 mb-2 flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-2.5">
                        <img src={pendingImagePreview} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-rose-200" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600 truncate">{pendingImageName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={clearPendingImage}
                          className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-700 border border-rose-100 flex items-center justify-center"
                          title="Cancel"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={sendPendingImage}
                          disabled={uploadingMedia}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-semibold hover:from-rose-600 hover:to-pink-600 disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    )}

                    {showComposerMenu && (
                      <div className="mx-3 md:mx-4 mb-2 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-2 overflow-x-auto">
                        <button type="button" onClick={() => setShowEmojiPicker((prev) => !prev)} className="w-9 h-9 text-pink-500 hover:bg-white rounded-xl shrink-0 border border-rose-100 bg-white/70 flex items-center justify-center" title="Smile" aria-label="Mở biểu tượng cảm xúc">
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-9 h-9 text-pink-500 hover:bg-white rounded-xl shrink-0 border border-rose-100 bg-white/70 flex items-center justify-center" title="Image" aria-label="Chọn ảnh">
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button type="button" onClick={() => fileAttachmentInputRef.current?.click()} className="w-9 h-9 text-pink-500 hover:bg-white rounded-xl shrink-0 border border-rose-100 bg-white/70 flex items-center justify-center" title="Paperclip" aria-label="Đính kèm tệp">
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656L5.757 10.757a6 6 0 108.486 8.486L20 13" /></svg>
                        </button>
                      </div>
                    )}

                    {/* Input row */}
                    <div className="flex flex-row items-end justify-between gap-2 md:gap-3 px-3 md:px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200 bg-white" onClick={() => showComposerMenu && setShowEmojiPicker(false)}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowComposerMenu((prev) => {
                            const newState = !prev;
                            // Close emoji picker when closing the menu
                            if (!newState) setShowEmojiPicker(false);
                            return newState;
                          });
                        }}
                        className="w-10 h-10 shrink-0 flex items-center justify-center text-pink-500 hover:text-pink-600 hover:bg-pink-50 rounded-full border border-rose-100 bg-rose-50/60 transition-colors"
                        title="More"
                        aria-label="Mở thêm tùy chọn soạn tin"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaSelect}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                      />

                      <input
                        type="file"
                        ref={fileAttachmentInputRef}
                        className="hidden"
                        onChange={() => {
                          if (fileAttachmentInputRef.current) fileAttachmentInputRef.current.value = '';
                        }}
                      />

                      {/* Text input */}
                      <div className="flex-1 relative min-w-0">
                        <textarea
                          value={newMessage}
                          onChange={handleTyping}
                          onKeyDown={handleKeyDown}
                          rows={1}
                          placeholder="Nhập tin nhắn…"
                          maxLength={MAX_MESSAGE_LENGTH}
                          className="w-full flex-1 px-4 py-3 bg-pink-50 rounded-2xl text-sm text-gray-700 text-left placeholder:text-left placeholder-gray-400 border border-rose-100 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                          style={{ minHeight: '44px', maxHeight: '108px' }}
                        />
                        {/* Character count */}
                        {newMessage.length > 900 && (
                          <span className={`absolute bottom-1.5 right-3 text-[10px] ${newMessage.length >= MAX_MESSAGE_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
                            {MAX_MESSAGE_LENGTH - newMessage.length}
                          </span>
                        )}
                      </div>

                      {/* Send button */}
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="h-11 w-11 shrink-0 flex items-center justify-center bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_6px_14px_rgba(244,63,94,0.28)]"
                        aria-label="Gửi tin nhắn"
                      >
                        {sending ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12h14m0 0l-4-4m4 4l-4 4" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Connection status */}
                    {!isConnected && (
                      <p className="text-[10px] text-yellow-500 px-3 md:px-4 pb-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                        Đang kết nối lại...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-4 right-3 md:right-4 left-3 md:left-auto bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50 flex items-center justify-between gap-2">
          {error}
          <button onClick={() => setError('')} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* ========== Unmatch Confirm Modal ========== */}
      {showUnmatchConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => !unmatching && setShowUnmatchConfirm(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'fadeScaleIn 0.2s ease' }}
          >
            {/* Red top bar */}
            <div className="h-1.5 bg-gradient-to-r from-rose-500 to-pink-500" />

            <div className="px-6 pt-6 pb-5">
              {/* Icon */}
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-center text-lg font-bold text-gray-900 mb-1">Hủy tương hợp?</h2>

              {/* Warning message */}
              <p className="text-center text-sm text-gray-500 mb-5 leading-relaxed">
                Bạn có chắc chắn? Thao tác này{' '}
                <span className="font-semibold text-red-500">không thể hoàn tác</span>{' '}
                và toàn bộ tin nhắn sẽ bị xóa vĩnh viễn.
              </p>

              {/* Partner info */}
              {activeConversation && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 mb-5">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-rose-100 shrink-0">
                    {activeConversation.userId?.avatar ? (
                      <img src={activeConversation.userId.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {(activeConversation.userId?.fullName || activeConversation.userId?.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">
                      {activeConversation.userId?.fullName || activeConversation.userId?.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">Sẽ bị xóa khỏi danh sách</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnmatchConfirm(false)}
                  disabled={unmatching}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleUnmatch}
                  disabled={unmatching}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold hover:from-rose-600 hover:to-pink-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(244,63,94,0.3)]"
                >
                  {unmatching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Đang xử lý…
                    </>
                  ) : 'Đồng ý'}
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fadeScaleIn {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}

      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Messages;