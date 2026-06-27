import Redis from 'ioredis';
import logger from './logger.js';
import "dotenv/config";

const redisUrl = process.env.REDIS_URI || 'redis://localhost:6379';

const createRedisClient = (name) => {
    const client = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required for some advanced streaming features
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    client.on('connect', () => {
        logger.info(`Redis ${name} connected`);
    });

    client.on('error', (err) => {
        logger.error(`Redis ${name} error:`, err);
    });

    return client;
};

// Main client for caching, presence, data storage
export const redisClient = createRedisClient('Main');

// Publisher client for Pub/Sub (Socket.IO Adapter)
export const redisPublisher = createRedisClient('Publisher');

// Subscriber client for Pub/Sub (Socket.IO Adapter) - Must be dedicated
export const redisSubscriber = createRedisClient('Subscriber');
