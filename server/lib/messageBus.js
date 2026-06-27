import { redisClient } from './redis.js';
import logger from './logger.js';
import Message from '../models/Message.js';
import { GroupMessage } from '../models/GroupMsg.js';
import { isUserOnline } from './presence.js';
import os from 'os';

const STREAM_NAME = 'stream:messages';
const CONSUMER_GROUP = 'group:message_deliverers';
// Create a unique consumer name per instance/process
const CONSUMER_NAME = `consumer:${os.hostname()}:${process.pid}`;

export const initializeMessageBus = async () => {
    try {
        // Create consumer group if it doesn't exist. "0" means start from the beginning of the stream.
        await redisClient.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
        logger.info(`Consumer group ${CONSUMER_GROUP} initialized on ${STREAM_NAME}`);
    } catch (err) {
        if (!err.message.includes('BUSYGROUP')) {
            logger.error('Error creating consumer group:', err);
        }
    }
};

export const publishMessageEvent = async (type, messageId, receiverId) => {
    try {
        // Lightweight routing event
        await redisClient.xadd(
            STREAM_NAME,
            '*',
            'type', type,
            'messageId', messageId.toString(),
            'receiverId', receiverId.toString(),
            'timestamp', Date.now().toString()
        );
    } catch (err) {
        logger.error(`Failed to publish message event ${messageId}:`, err);
        throw err;
    }
};

export const startMessageConsumer = (io) => {
    let isShuttingDown = false;

    const processEvents = async () => {
        if (isShuttingDown) return;

        try {
            // Read 10 events at a time, block for 2000ms if empty
            const results = await redisClient.xreadgroup(
                'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
                'COUNT', 10,
                'BLOCK', 2000,
                'STREAMS', STREAM_NAME, '>'
            );

            if (results && results.length > 0) {
                const stream = results[0];
                const events = stream[1];

                for (const [id, fields] of events) {
                    const eventDict = {};
                    for (let i = 0; i < fields.length; i += 2) {
                        eventDict[fields[i]] = fields[i + 1];
                    }

                    await handleEvent(id, eventDict, io);
                }
            }
        } catch (err) {
            logger.error('Error in stream consumer loop:', err);
            // Delay to prevent tight error loop
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Loop immediately
        setImmediate(processEvents);
    };

    // Auto-claim background job
    const runAutoClaim = async () => {
        if (isShuttingDown) return;
        try {
            // Claim messages pending for > 60000 ms
            const results = await redisClient.xautoclaim(
                STREAM_NAME, CONSUMER_GROUP, CONSUMER_NAME,
                60000, '0', 'COUNT', 10
            );
            
            // results[0] is the next start ID, results[1] are the claimed messages
            const claimedEvents = results[1];
            if (claimedEvents && claimedEvents.length > 0) {
                logger.info(`XAUTOCLAIM recovered ${claimedEvents.length} messages`);
                for (const [id, fields] of claimedEvents) {
                    const eventDict = {};
                    for (let i = 0; i < fields.length; i += 2) {
                        eventDict[fields[i]] = fields[i + 1];
                    }
                    await handleEvent(id, eventDict, io);
                }
            }
        } catch (err) {
            logger.error('Error in XAUTOCLAIM job:', err);
        }

        setTimeout(runAutoClaim, 30000); // Run every 30s
    };

    // Start loops
    processEvents();
    runAutoClaim();

    return () => {
        isShuttingDown = true;
    };
};

const handleEvent = async (eventId, eventData, io) => {
    const { type, messageId, receiverId } = eventData;

    try {
        const isOnline = await isUserOnline(receiverId);

        // We only attempt to fetch the payload and emit if the user is online.
        if (isOnline) {
            let payload = null;
            let emitEvent = "";
            let targetRoom = "";

            if (type === 'direct') {
                const message = await Message.findById(messageId)
                    .populate('senderId', 'fullName profilePic')
                    .populate('receiverId', 'fullName profilePic')
                    .lean();

                if (message) {
                    payload = { ...message, isRealTime: true };
                    emitEvent = "newMessage";
                    targetRoom = `user_${receiverId}`;
                }
            } else if (type === 'group') {
                const message = await GroupMessage.findById(messageId)
                    .populate('senderId', 'fullName profilePic')
                    .lean();

                if (message) {
                    payload = message;
                    emitEvent = "receiveGrpMsg";
                    targetRoom = receiverId; // For groups, receiverId is groupId
                }
            }

            if (payload && targetRoom) {
                // Redis adapter will broadcast this to the node where the user is connected
                io.to(targetRoom).emit(emitEvent, payload);
            }
        }

        // Acknowledge the event regardless of online/offline status.
        // If offline, the message remains safely stored in DB as SENT.
        // If online, we emitted it to the adapter and XACK it. 
        await redisClient.xack(STREAM_NAME, CONSUMER_GROUP, eventId);
        
    } catch (error) {
        logger.error(`Error handling event ${eventId}:`, error);
        // Do NOT XACK. Let XAUTOCLAIM retry it later if it failed due to a transient DB error.
    }
};
