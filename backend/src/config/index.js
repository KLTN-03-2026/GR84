import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// ===========================================
// CLOUDINARY CONFIG - Read early for conditional logic
// ===========================================
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

// Check if Cloudinary is configured
const hasCloudinary = !!(
  cloudinaryConfig.cloud_name &&
  cloudinaryConfig.api_key &&
  cloudinaryConfig.api_secret
);

console.log('[Config] Cloudinary configured:', hasCloudinary ? 'YES' : 'NO');
console.log('[Config] Cloud name:', cloudinaryConfig.cloud_name ? '***' + cloudinaryConfig.cloud_name.slice(-4) : 'NOT SET');

// ===========================================
// FRONTEND URLS - Hỗ trợ nhiều origins
// ===========================================
const getAllowedOrigins = () => {
  const origins = new Set(); // Dùng Set để tránh duplicate

  // Development origins
  if (!isProduction) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  // Production origins từ biến môi trường ALLOWED_ORIGINS
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(o => o);
    envOrigins.forEach(o => origins.add(o));
    console.log('[Config] ALLOWED_ORIGINS from env:', envOrigins);
  }

  // Fallback to FRONTEND_URL (nếu có và chưa tồn tại)
  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL.trim();
    if (frontendUrl && !origins.has(frontendUrl)) {
      origins.add(frontendUrl);
    }
  }

  const result = Array.from(origins);
  console.log('[Config] Final allowed origins:', result);
  return result;
};

const ALLOWED_ORIGINS = getAllowedOrigins();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ===========================================
// COOKIE CONFIG - Tự động secure khi production
// ===========================================
const getCookieConfig = () => ({
  name: 'dating-session',
  keys: [process.env.JWT_SECRET || 'dev-secret-key'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: isProduction,          // Chỉ bật secure khi production (HTTPS)
  sameSite: isProduction ? 'none' : 'lax', // 'none' cần secure=true, 'lax' cho dev
  httpOnly: true,
  domain: isProduction ? undefined : undefined // Để mặc định cho local
});

export default {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dating-app',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  jwtExpire: process.env.JWT_EXPIRE || '7d',

  // URLs
  frontendUrl: FRONTEND_URL,
  allowedOrigins: ALLOWED_ORIGINS,

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
  uploadPath: process.env.UPLOAD_PATH || './uploads',

  // Cookie
  cookie: getCookieConfig(),

  // Google OAuth
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    profileFields: ['id', 'displayName', 'emails', 'photos']
  },

  // Facebook OAuth
  facebook: {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails', 'photos']
  },

  // Cloudinary
  cloudinary: cloudinaryConfig,
  hasCloudinary
};
