import { redisClient } from './redis.js';
import logger from './logger.js';

const ONLINE_USERS_KEY = 'presence:online_users';
const PRESENCE_TTL_MS = 60000; // 60 seconds

export const markUserOnline = async (userId) => {
    try {
        const now = Date.now();
        // Update their score to the current timestamp
        await redisClient.zadd(ONLINE_USERS_KEY, now, userId);
        // We can also store individual presence key if needed elsewhere
        await redisClient.setex(`presence:user:${userId}`, 60, 'online');
    } catch (err) {
        logger.error(`Error marking user ${userId} online:`, err);
    }
};

export const markUserOffline = async (userId) => {
    try {
        await redisClient.zrem(ONLINE_USERS_KEY, userId);
        await redisClient.del(`presence:user:${userId}`);
    } catch (err) {
        logger.error(`Error marking user ${userId} offline:`, err);
    }
};

export const isUserOnline = async (userId) => {
    try {
        // First clean up stale entries (older than 60 seconds ago)
        const cutoff = Date.now() - PRESENCE_TTL_MS;
        await redisClient.zremrangebyscore(ONLINE_USERS_KEY, '-inf', cutoff);
        
        const score = await redisClient.zscore(ONLINE_USERS_KEY, userId);
        return score !== null;
    } catch (err) {
        logger.error(`Error checking if user ${userId} is online:`, err);
        return false;
    }
};

export const getOnlineUsers = async () => {
    try {
        const cutoff = Date.now() - PRESENCE_TTL_MS;
        // Clean up stale users
        await redisClient.zremrangebyscore(ONLINE_USERS_KEY, '-inf', cutoff);
        // Return remaining active users
        return await redisClient.zrange(ONLINE_USERS_KEY, 0, -1);
    } catch (err) {
        logger.error('Error fetching online users:', err);
        return [];
    }
};

// Heartbeat function to be called every 20s by connected clients
export const handleHeartbeat = async (userId) => {
    await markUserOnline(userId);
};
