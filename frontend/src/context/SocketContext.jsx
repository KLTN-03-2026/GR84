import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SocketContext = createContext(null);

// Get socket URL from environment - uses VITE_SOCKET_URL for both local and production
const getSocketUrl = () => {
  // Production: MUST use VITE_SOCKET_URL from env
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Development: use VITE_SOCKET_URL or fallback to localhost
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, user } = useAuthStore();

  const connectSocket = useCallback(() => {
    if (!token || !user) return null;

    const socketUrl = getSocketUrl();
    console.log('[Socket] Connecting to:', socketUrl);

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true, // Important for cross-origin cookies
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    return newSocket;
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        console.log('[Socket] No auth, closing socket');
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = connectSocket();
    if (newSocket) {
      setSocket(newSocket);
    }

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [token, user, connectSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
