import Redis from 'ioredis';
import config from '../config/index.js';

const isProduction = config.isProduction;

// Flag for memory fallback in case Redis fails (dev only)
let useMemoryFallback = false;

/**
 * Initialize main Redis client
 */
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  enableOfflineQueue: true
});

// Redis connection events
redis.on('connect', () => {
  console.log('[REDIS] Connected successfully');
  useMemoryFallback = false;
});

redis.on('error', (err) => {
  console.error('[REDIS] Connection error:', err.message);
});

redis.on('close', () => {
  console.log('[REDIS] Connection closed');
});

redis.on('reconnecting', () => {
  console.log('[REDIS] Reconnecting...');
});

/**
 * Helper to get Redis availability
 */
export const isRedisAvailable = () => !useMemoryFallback;

/**
 * Initialize Redis connection (async)
 */
export const initializeRedis = async () => {
  // If already connected, return immediately
  if (redis.status === 'ready') {
    return redis;
  }

  // If already connecting, don't call connect() again to avoid "Connection is closed" error.
  // Instead, wait for the connection to be established.
  if (redis.status === 'connecting') {
    console.log('[REDIS] Connection already in progress, waiting for ready event...');
    return new Promise((resolve, reject) => {
      const onReady = () => {
        redis.off('error', onError);
        resolve(redis);
      };
      const onError = (err) => {
        redis.off('ready', onReady);
        reject(err);
      };
      redis.once('ready', onReady);
      redis.once('error', onError);
      
      // Safety timeout after 10 seconds
      setTimeout(() => {
        redis.off('ready', onReady);
        redis.off('error', onError);
        reject(new Error('Redis connection timeout after 10s'));
      }, 10000);
    });
  }

  try {
    console.log('[REDIS] Initializing connection...');
    
    // For Upstash/Cloud Redis: If connection fails immediately, it's often a TLS requirement.
    // We advise the user to use rediss:// in their environment variable.
    
    await redis.connect();
    console.log('[REDIS] Global connection established');
    return redis;
  } catch (error) {
    console.error('[REDIS] Failed to connect:', error.message);

    if (!isProduction) {
      console.warn('[REDIS] Falling back to in-memory queue (dev only)');
      useMemoryFallback = true;
      return null;
    } else {
      console.error('[REDIS] FATAL: Cannot start without Redis in production!');
      console.error('[REDIS] Tip: If using Upstash, ensure your REDIS_URL starts with rediss:// for TLS.');
      throw error;
    }
  }
};

/**
 * Create adapter clients for multi-instance support (Pub/Sub)
 */
export const createRedisAdapterClients = () => {
  const redisUrl = config.redisUrl || 'redis://localhost:6379';
  
  let options = {
    maxRetriesPerRequest: 3,
    lazyConnect: true
  };

  // Create two separate clients for pub/sub
  const pubClient = new Redis(redisUrl, options);
  const subClient = new Redis(redisUrl, options);

  return { pubClient, subClient };
};

export const getRedisClient = () => redis;

// ===========================================
// QUEUE HELPERS
// ===========================================
const REDIS_QUEUE_KEY = 'random_match:waiting_users';

/**
 * Get a valid partner from Redis queue
 */
export async function getValidPartner(currentUserId, userSocketMap) {
  while (true) {
    // Pop from queue (FIFO)
    const partnerId = await redis.rpop(REDIS_QUEUE_KEY);

    if (!partnerId) {
      return null; // Queue empty
    }

    // Skip self
    if (partnerId === currentUserId) {
      console.log(`[RANDOM][REDIS] Skipped self-match`);
      continue;
    }

    // Skip offline users
    if (!userSocketMap[partnerId]) {
      console.log(`[RANDOM][REDIS] Skipped offline user: ${partnerId}`);
      continue;
    }

    return partnerId;
  }
}

/**
 * Add user to waiting queue
 */
export async function addToWaitingQueue(userId) {
  // First remove any existing entries (prevent duplicates)
  await redis.lrem(REDIS_QUEUE_KEY, 0, userId);
  // Add to queue
  await redis.lpush(REDIS_QUEUE_KEY, userId);
}

/**
 * Remove user from waiting queue
 */
export async function removeFromWaitingQueue(userId) {
  await redis.lrem(REDIS_QUEUE_KEY, 0, userId);
}

/**
 * Get queue size
 */
export async function getQueueSize() {
  return await redis.llen(REDIS_QUEUE_KEY);
}

export default redis;
