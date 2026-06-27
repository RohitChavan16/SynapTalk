import { redisClient } from './redis.js';
import logger from './logger.js';
import { isUserOnline } from './presence.js';

const ROOM_INFO_PREFIX = 'call_room:info:';
const ROOM_PARTICIPANTS_PREFIX = 'call_room:participants:';
const ACTIVE_ROOMS_KEY = 'active_call_rooms';

export const createRoom = async (roomId, settings = {}) => {
    try {
        const defaultSettings = {
            maxParticipants: 10,
            allowRecording: true,
            allowScreenShare: true,
            isPrivate: false,
            requirePassword: false
        };
        const finalSettings = { ...defaultSettings, ...settings };
        
        const pipeline = redisClient.pipeline();
        pipeline.hset(`${ROOM_INFO_PREFIX}${roomId}`, {
            createdAt: Date.now().toString(),
            settings: JSON.stringify(finalSettings),
            screenSharingUserId: ''
        });
        pipeline.sadd(ACTIVE_ROOMS_KEY, roomId);
        await pipeline.exec();
        
        return {
            roomId,
            settings: finalSettings,
            createdAt: Date.now()
        };
    } catch (err) {
        logger.error(`Error creating room ${roomId}:`, err);
        throw err;
    }
};

export const joinRoom = async (roomId, userId) => {
    try {
        const exists = await redisClient.sismember(ACTIVE_ROOMS_KEY, roomId);
        if (!exists) return { error: "room_not_found" };

        const info = await redisClient.hgetall(`${ROOM_INFO_PREFIX}${roomId}`);
        const settings = info.settings ? JSON.parse(info.settings) : {};
        
        const participantCount = await redisClient.scard(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        if (settings.maxParticipants && participantCount >= settings.maxParticipants) {
            return { error: "room_full" };
        }

        await redisClient.sadd(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`, userId);
        return { success: true, settings, info };
    } catch (err) {
        logger.error(`Error joining room ${roomId}:`, err);
        return { error: "internal_error" };
    }
};

export const leaveRoom = async (roomId, userId) => {
    try {
        await redisClient.srem(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`, userId);
        
        // Clear screen sharing if this user was sharing
        const screenSharer = await redisClient.hget(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId');
        if (screenSharer === userId) {
            await redisClient.hset(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId', '');
        }

        const remaining = await redisClient.scard(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        if (remaining === 0) {
            await deleteRoom(roomId);
            return { deleted: true };
        }
        return { deleted: false };
    } catch (err) {
        logger.error(`Error leaving room ${roomId}:`, err);
    }
};

export const deleteRoom = async (roomId) => {
    try {
        const pipeline = redisClient.pipeline();
        pipeline.del(`${ROOM_INFO_PREFIX}${roomId}`);
        pipeline.del(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        pipeline.srem(ACTIVE_ROOMS_KEY, roomId);
        await pipeline.exec();
    } catch (err) {
        logger.error(`Error deleting room ${roomId}:`, err);
    }
};

export const getRoomInfo = async (roomId) => {
    try {
        const exists = await redisClient.sismember(ACTIVE_ROOMS_KEY, roomId);
        if (!exists) return null;

        const info = await redisClient.hgetall(`${ROOM_INFO_PREFIX}${roomId}`);
        const participants = await redisClient.smembers(`${ROOM_PARTICIPANTS_PREFIX}${roomId}`);
        
        // Resolve online status for participants
        const participantsWithStatus = await Promise.all(participants.map(async (userId) => {
            return {
                userId,
                status: 'in-call',
                online: await isUserOnline(userId)
            };
        }));

        return {
            roomId,
            participantCount: participants.length,
            participants: participantsWithStatus,
            createdAt: parseInt(info.createdAt) || Date.now(),
            settings: info.settings ? JSON.parse(info.settings) : {},
            screenSharingUserId: info.screenSharingUserId || null
        };
    } catch (err) {
        logger.error(`Error getting room info ${roomId}:`, err);
        return null;
    }
};

export const getAllRooms = async () => {
    try {
        const roomIds = await redisClient.smembers(ACTIVE_ROOMS_KEY);
        const rooms = await Promise.all(roomIds.map(id => getRoomInfo(id)));
        return rooms.filter(r => r !== null);
    } catch (err) {
        logger.error("Error getting all rooms:", err);
        return [];
    }
};

export const setScreenSharer = async (roomId, userId) => {
    try {
        const current = await redisClient.hget(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId');
        if (current && current !== userId) {
            return { error: 'screen_share_conflict' };
        }
        await redisClient.hset(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId', userId);
        return { success: true };
    } catch (err) {
        logger.error(`Error setting screen sharer in ${roomId}:`, err);
        return { error: 'internal_error' };
    }
};

export const clearScreenSharer = async (roomId, userId) => {
    try {
        const current = await redisClient.hget(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId');
        if (current === userId) {
            await redisClient.hset(`${ROOM_INFO_PREFIX}${roomId}`, 'screenSharingUserId', '');
        }
    } catch (err) {
        logger.error(`Error clearing screen sharer in ${roomId}:`, err);
    }
};
