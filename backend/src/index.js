import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import cookieSession from 'cookie-session';

import config from './config/index.js';
import passport from './config/passport.js';
import { authRoutes, userRoutes, matchRoutes, messageRoutes, adminRoutes, discoveryRoutes, interestRoutes, safetyRoutes } from './routes/index.js';
import userProfileRoutes from './routes/userProfile.routes.js';
import profileRoutes from './routes/profileRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { initializeSocket } from './socket/index.js';

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

const io = new Server(httpServer, {
  cors: corsOptions
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

app.use(notFound);
app.use(errorHandler);

initializeSocket(io);
app.set('io', io);

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================
const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);

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

    server = httpServer.listen(config.port, () => {
      isServerRunning = true;
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Allowed Origins: ${config.allowedOrigins.join(', ')}`);
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
