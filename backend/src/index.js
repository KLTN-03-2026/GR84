import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAdapter } from '@socket.io/redis-adapter';

import cookieSession from 'cookie-session';
import config from './config/index.js';
import passport from './config/passport.js';
import { authRoutes, userRoutes, matchRoutes, messageRoutes, adminRoutes, discoveryRoutes, interestRoutes, safetyRoutes } from './routes/index.js';
import aiRoutes from './routes/ai.routes.js';
import userProfileRoutes from './routes/userProfile.routes.js';
import profileRoutes from './routes/profileRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { initializeSocket, initializeRedis, createRedisAdapterClients } from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ===========================================
// SERVER STATE - Tránh chạy nhiều instance
// ===========================================
let isServerRunning = false;
let server = null;

// ===========================================
// CORS CONFIG - Hỗ trợ nhiều origins
// ===========================================
const corsOptions = {
  origin: (origin, callback) => {
    // Log để debug
    console.log('[CORS] Request origin:', origin);
    console.log('[CORS] Allowed origins:', config.allowedOrigins);

    // Cho phép request không có origin (Postman, curl, browser trực tiếp)
    if (!origin) {
      console.log('[CORS] No origin, allowing request');
      return callback(null, true);
    }

    // Kiểm tra origin có trong danh sách được phép không
    const isAllowed = config.allowedOrigins.some(allowed =>
      origin === allowed ||
      origin.startsWith(allowed + ':') ||
      (allowed.includes('*') && allowed.replace('*', '') === origin.slice(0, allowed.length - 1))
    );

    if (isAllowed) {
      console.log(`[CORS] Origin ${origin} allowed`);
      return callback(null, true);
    }

    // Trong development, cho phép tất cả
    if (!config.isProduction) {
      console.log('[CORS] Development mode, allowing all origins');
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// FIX #7: CORS config for Socket.IO with regex for Vercel domains
const getSocketCors = () => {
  const origins = [];
  
  // Add explicit client URL
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }
  
  // Add Vercel domains regex
  origins.push(/\.vercel\.app$/);
  
  // Add localhost for development
  if (!config.isProduction) {
    origins.push('http://localhost:5173');
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:5173');
    origins.push('http://127.0.0.1:3000');
  }
  
  return {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST']
  };
};

const io = new Server(httpServer, {
  cors: getSocketCors()
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession(config.cookie));
app.use(passport.initialize());
app.use(passport.session());

// Middleware để skip passport session cho non-OAuth routes
// Nhưng vấn đề là passport.session() đã chạy rồi...

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===========================================
// WELCOME ROUTE
// ===========================================
app.get('/', (req, res) => {
  res.json({
    message: 'Dating App API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      match: '/api/match',
      messages: '/api/messages',
      profiles: '/api/v1/profiles',
      admin: '/api/admin',
      discovery: '/api/discovery',
      interests: '/api/interests',
      safety: '/api/safety'
    }
  });
});

// ===========================================
// HEALTH CHECK
// ===========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    serverRunning: isServerRunning
  });
});

// ===========================================
// API ROUTES
// ===========================================
console.log('[Routes] Registering authRoutes at /api/auth');
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', interestRoutes);
app.use('/api', safetyRoutes);
app.use('/api', discoveryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/profile', userProfileRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

initializeSocket(io);
app.set('io', io);

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================
const gracefulShutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Close Redis connections
  try {
    const { pubClient, subClient, getRedisClient } = await import('./socket/index.js');
    const mainClient = getRedisClient();
    
    if (mainClient) {
      await mainClient.quit();
      console.log('[REDIS] Main client closed');
    }
    if (pubClient) {
      await pubClient.quit();
    }
    if (subClient) {
      await subClient.quit();
    }
    console.log('[REDIS] All connections closed');
  } catch (err) {
    console.error('[REDIS] Error closing connections:', err.message);
  }

  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('[MongoDB] Connection closed');
        process.exit(0);
      });
    });
  } else {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  }

  // Force exit sau 10s
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===========================================
// START SERVER
// ===========================================
const startServer = async () => {
  // Ngăn chạy nhiều instance
  if (isServerRunning) {
    console.warn('[Server] Already running, skipping...');
    return;
  }

  try {
    await mongoose.connect(config.mongodbUri);
    console.log(`[${config.nodeEnv}] Connected to MongoDB`);

    // FIX #3 & #6: Initialize Redis globally BEFORE socket
    const redisClient = await initializeRedis();

    // FIX #6: Set up Redis adapter for multi-instance support
    if (redisClient && config.isProduction) {
      try {
        console.log('[SOCKET] Setting up Redis adapter for multi-instance support...');
        const { pubClient, subClient } = createRedisAdapterClients();
        
        await Promise.all([pubClient.connect(), subClient.connect()]);
        
        io.adapter(createAdapter(pubClient, subClient));
        console.log('[SOCKET] Redis adapter enabled - multi-instance support active');
      } catch (adapterError) {
        console.error('[SOCKET] Failed to setup Redis adapter:', adapterError.message);
        console.warn('[SOCKET] Falling back to single-instance mode');
      }
    }

    server = httpServer.listen(config.port, () => {
      isServerRunning = true;
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Allowed Origins: ${config.allowedOrigins.join(', ')}`);
      console.log(`Client URL: ${process.env.CLIENT_URL || config.frontendUrl}`);
    });

    // Xử lý lỗi khi port đã dùng
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use!`);
        console.log('💡 Try:');
        console.log('   1. Check running processes: netstat -ano | findstr :' + config.port);
        console.log('   2. Kill process: npx kill-port ' + config.port);
        console.log('   3. Or change PORT in .env');
        process.exit(1);
      } else {
        console.error('[Server] Error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('[MongoDB] Failed to connect:', error.message);
    process.exit(1);
  }
};

startServer();

export { app, httpServer, io };
