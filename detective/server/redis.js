const { createClient } = require('redis');
const { getRedisConfig } = require('./config');

// In-memory fallback when Redis is unavailable
const memStore = new Map();
let redisClient = null;

async function initRedis() {
  const cfg = getRedisConfig();
  if (!cfg) {
    console.log('[Redis] No config found, using in-memory store');
    return;
  }
  try {
    redisClient = createClient({
      socket: { host: cfg.host, port: cfg.port },
      password: cfg.password
    });
    redisClient.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      redisClient = null;
    });
    await redisClient.connect();
    console.log('[Redis] Connected');
  } catch (err) {
    console.error('[Redis] Connection failed, using in-memory store:', err.message);
    redisClient = null;
  }
}

async function set(key, value, ttlSeconds) {
  const json = JSON.stringify(value);
  if (redisClient) {
    await redisClient.set(key, json, { EX: ttlSeconds || 14400 });
  } else {
    memStore.set(key, { data: json, expires: Date.now() + (ttlSeconds || 14400) * 1000 });
  }
}

async function get(key) {
  if (redisClient) {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { memStore.delete(key); return null; }
  return JSON.parse(entry.data);
}

async function del(key) {
  if (redisClient) {
    await redisClient.del(key);
  } else {
    memStore.delete(key);
  }
}

module.exports = { initRedis, set, get, del };
