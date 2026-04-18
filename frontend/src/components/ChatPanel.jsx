/**
 * ChatPanel Component - Chat interface for a single conversation
 * Extracted from Chat.jsx to be used within Messages page
 *
 * Features:
 * - Message display with sender info
 * - Real-time messaging via Socket.IO
 * - Media upload (images)
 * - Video call initiation
 * - Read receipts
 * - Pagination (load more)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../context/SocketContext';
import { messageService } from '../services/api';

const MAX_MESSAGE_LENGTH = 1000;

const ChatPanel = ({ matchId, messages: initialMessages, onSendMessage, onMessagesUpdate }) => {
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // State
  const [messages, setMessages] = useState(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [failedMessages, setFailedMessages] = useState(new Map());
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesStartRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Format time helper
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ============================================
  // FETCH MESSAGES (with pagination)
  // ============================================
  const fetchMessages = useCallback(async (matchIdParam, pageNum = 1, append = false) => {
    if (!matchIdParam) return;
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await messageService.getMessages(matchIdParam, pageNum, 50);
      const msgs = response?.messages || response?.data?.messages || response?.data || [];

      // Check pagination
      const pagination = response?.pagination || response?.data?.pagination || {};
      setHasMore(pagination.hasMore !== false && pagination.pages >= pageNum);

      if (append) {
        // Prepend older messages
        setMessages(prev => [...msgs, ...prev]);
      } else {
        setMessages(Array.isArray(msgs) ? msgs : []);
        setPage(1);
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to fetch messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load more messages
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMessages(matchId, nextPage, true);
  }, [page, matchId, fetchMessages, loadingMore, hasMore]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior = 'smooth', force = false) => {
    if (!force && !shouldAutoScrollRef.current) return;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  }, []);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    if (matchId) {
      fetchMessages(matchId);
      socket?.emit('join_room', { matchId });
      shouldAutoScrollRef.current = true;
      prevMessageCountRef.current = 0;
    }
    return () => {
      if (matchId) {
        socket?.emit('leave_room', { matchId });
      }
    };
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    if (loadingMore) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom('smooth');
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, matchId, loadingMore, scrollToBottom]);

  // ============================================
  // SOCKET LISTENERS
  // ============================================
  useEffect(() => {
    if (!socket || !matchId) return;

    const handleNewMessage = (message) => {
      if (message.matchId === matchId || message.conversationId === matchId) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom('smooth');
        messageService.markAsRead(matchId).catch(() => {});
      }
      // Notify parent to update conversation list
      if (onMessagesUpdate) onMessagesUpdate();
    };

    const handleMessagesRead = ({ readAt }) => {
      setMessages(prev => prev.map(msg => ({
        ...msg,
        status: msg.status !== 'seen' && msg.sender?._id !== user?._id ? msg.status : 'seen'
      })));
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [socket, matchId, user?._id, scrollToBottom, onMessagesUpdate]);

  // ============================================
  // SEND MESSAGE
  // ============================================
  const handleSend = async (e) => {
    e?.preventDefault();
    const content = newMessage.trim();

    if (!content || !matchId || sending) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Tin nhắn không quá ${MAX_MESSAGE_LENGTH} ký tự`);
      return;
    }

    setSending(true);
    setSendError(null);

    const tempId = `temp-${Date.now()}`;

    try {
      const response = await messageService.sendMessage(matchId, {
        content,
        type: 'text'
      });

      if (response.success) {
        setMessages(prev => [...prev.filter(m => m._tempId !== tempId), response.data].filter(Boolean));
        setNewMessage('');
        socket?.emit('stop_typing', { matchId });
        scrollToBottom();
        if (onMessagesUpdate) onMessagesUpdate();
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      let errorMsg = 'Không thể gửi tin nhắn';
      if (err.response?.status === 429) {
        errorMsg = 'Gửi tin nhắn quá nhanh. Vui lòng chờ.';
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
  // TYPING
  // ============================================
  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!typingTimeoutRef.current) {
      socket?.emit('typing', { matchId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('stop_typing', { matchId });
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

    setUploadingMedia(true);
    setSendError(null);

    try {
      const response = await messageService.uploadMedia(matchId, file);
      if (response?.success) {
        await messageService.sendMessage(matchId, {
          content: '',
          image: response.mediaUrl,
          messageType: 'image'
        });
        fetchMessages(matchId);
        if (onMessagesUpdate) onMessagesUpdate();
      }
    } catch {
      setSendError('Không thể gửi ảnh');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ============================================
  // VIDEO CALL
  // ============================================
  const startVideoCall = async () => {
    // This will be implemented with the video call system
    // For now, emit event to notify parent or open video call modal
    console.log('Video call initiated for match:', matchId);
    // TODO: Integrate video call logic
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      )}

      {/* Messages */}
      {!loading && (
        <>
          <div
            ref={messagesStartRef}
            className="flex-1 overflow-y-auto px-4 py-3 bg-gradient-to-b from-white to-rose-50/20"
          >
            {/* Load more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-pink-500"></div>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <svg className="w-16 h-16 mb-3 text-rose-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">Bắt đầu cuộc trò chuyện</p>
                <p className="text-xs mt-1">Gửi tin nhắn đầu tiên!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => {
                  const senderData = msg.sender || null;
                  const isOwn = senderData?._id?.toString() === user?._id?.toString();
                  const senderName = senderData?.username || senderData?.fullName || 'Unknown';
                  const senderAvatar = senderData?.avatar;
                  const isFailed = failedMessages.has(msg._tempId || msg._id);

                  return (
                    <div key={msg._id || msg._tempId || idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {!isOwn && (
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mr-2">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold">
                                {senderName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`max-w-[70%] ${isOwn ? 'text-right' : 'text-left'}`}>
                        {!isOwn && (
                          <p className="text-[10px] font-semibold text-rose-500 mb-0.5">
                            {senderName}
                          </p>
                        )}

                        <div className={`relative inline-block rounded-2xl px-3 py-2 ${
                          isOwn ? 'bg-pink-500 text-white rounded-br-sm' : 'bg-pink-100 text-gray-900 rounded-bl-sm'
                        } ${isFailed ? 'ring-2 ring-red-400' : ''}`}>
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          )}

                          {(msg.image || msg.mediaUrl) && (
                            <img
                              src={msg.image || msg.mediaUrl}
                              alt=""
                              className="mt-1 max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                              onClick={() => window.open(msg.image || msg.mediaUrl, '_blank')}
                            />
                          )}
                        </div>

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
                                    <svg className={`w-3 h-3 ${msg?.status === 'seen' ? 'text-pink-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <svg
                                    className={`w-3 h-3 ${msg?.status === 'seen' ? 'text-pink-500' : msg?.status === 'sending' ? 'text-gray-300' : 'text-gray-400'}`}
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
                  );
                })}

                {failedMessages.size > 0 && (
                  <div className="flex flex-col items-end gap-2">
                    {Array.from(failedMessages.entries()).map(([tempId, content]) => (
                      <div key={tempId} className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px]">!</span>
                        <button
                          onClick={() => retryMessage(tempId, content)}
                          className="text-[10px] text-red-500 hover:text-red-600 underline"
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
          </div>

          {/* Input Area */}
          <div className="shrink-0 bg-white border-t border-gray-300 p-3">
            {sendError && (
              <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center justify-between">
                <span>{sendError}</span>
                <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-end gap-2">
              {/* Media upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="p-2 text-gray-500 hover:text-pink-500 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
              >
                {uploadingMedia ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-pink-500"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaSelect}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
              />

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={1}
                  className="w-full px-3 py-2 bg-rose-50 text-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 placeholder-gray-400"
                  style={{ minHeight: '40px', maxHeight: '100px' }}
                />
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={!newMessage.trim() || sending || !isConnected}
                className="p-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12h14m0 0l-4-4m4 4l-4 4" />
                  </svg>
                )}
              </button>
            </form>

            {/* Connection status */}
            {!isConnected && (
              <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                Đang kết nối lại...
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
