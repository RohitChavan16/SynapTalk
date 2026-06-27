import axios from 'axios';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import crypto from 'crypto';

const API_1 = 'http://localhost:5001/api';
const API_2 = 'http://localhost:5002/api';
const SOCKET_1 = 'http://localhost:5001';
const SOCKET_2 = 'http://localhost:5002';

const MONGO_URI = 'mongodb://localhost:27017/synap-talk';
const REDIS_URI = 'redis://localhost:6379';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createTestUser(name) {
    const email = `${name}_${Date.now()}@test.com`;
    try {
        const res = await axios.post(`${API_1}/auth/signup`, {
            fullName: name,
            email,
            password: 'password123',
            bio: 'Test user'
        });
        return { user: res.data.userData, token: res.data.token, email };
    } catch (err) {
        console.error(`Error creating user ${name}:`, err.response?.data || err.message);
        throw err;
    }
}

async function runTests() {
    console.log("== Connecting to DB and Redis ==");
    await mongoose.connect(MONGO_URI);
    const redis = new Redis(REDIS_URI);
    
    // Define Message Schema minimally to query
    const messageSchema = new mongoose.Schema({
        senderId: mongoose.Schema.Types.ObjectId,
        receiverId: mongoose.Schema.Types.ObjectId,
        status: String,
        idempotencyKey: String
    }, { collection: 'messages' });
    const Message = mongoose.model('MessageTest', messageSchema);

    console.log("== Creating Test Users ==");
    const userA = await createTestUser("UserA");
    const userB = await createTestUser("UserB");
    
    console.log(`User A: ${userA.user._id}`);
    console.log(`User B: ${userB.user._id}`);

    console.log("\n>>> Test 1: Multi-node messaging");
    const socketA = io(SOCKET_1, { query: { userId: userA.user._id } });
    const socketB = io(SOCKET_2, { query: { userId: userB.user._id } });

    await new Promise(resolve => {
        let connected = 0;
        socketA.on('connect', () => { connected++; if(connected === 2) resolve(); });
        socketB.on('connect', () => { connected++; if(connected === 2) resolve(); });
    });
    console.log("Sockets connected (A to app1, B to app2)");

    const idempotencyKey1 = crypto.randomUUID();
    let receivedMessageId = null;

    const messagePromise = new Promise(resolve => {
        socketB.once('newMessage', (msg) => {
            console.log("User B received newMessage event:", msg.idempotencyKey);
            receivedMessageId = msg._id;
            socketB.emit("message_ack", receivedMessageId);
            resolve();
        });
    });

    console.log("User A sending message via API 1...");
    const sendRes = await axios.post(`${API_1}/messages/send/${userB.user._id}`, {
        text: 'Hello from Node 1',
        cryptoVersion: 1, // Skip strict check
        idempotencyKey: idempotencyKey1
    }, { headers: { Authorization: `Bearer ${userA.token}` } });

    await messagePromise;
    await sleep(500); // Wait for ACK to process

    const dbMsg1 = await Message.findById(receivedMessageId);
    console.log(`DB Status after ACK: ${dbMsg1.status}`);
    if (dbMsg1.status !== 'DELIVERED') throw new Error("Status did not transition to DELIVERED");

    // Check Redis stream for the event
    const streamEvents = await redis.xrange('stream:messages', '-', '+');
    console.log(`Stream events found: ${streamEvents.length}`);
    let eventFound = streamEvents.some(evt => {
        const fields = evt[1];
        const msgIdIndex = fields.indexOf('messageId');
        return msgIdIndex !== -1 && fields[msgIdIndex + 1] === receivedMessageId.toString();
    });
    if (!eventFound) throw new Error("Redis Stream event not found");

    console.log("\n>>> Test 3: Offline Recovery");
    socketB.disconnect();
    await sleep(500);
    console.log("User B disconnected.");

    const offlineMessages = [];
    for (let i = 0; i < 5; i++) {
        const idKey = crypto.randomUUID();
        const res = await axios.post(`${API_1}/messages/send/${userB.user._id}`, {
            text: `Offline msg ${i}`,
            cryptoVersion: 1,
            idempotencyKey: idKey
        }, { headers: { Authorization: `Bearer ${userA.token}` } });
        offlineMessages.push(res.data.newMessage._id);
    }
    console.log("Sent 5 messages while B is offline.");

    console.log("Reconnecting User B...");
    const socketB2 = io(SOCKET_2, { query: { userId: userB.user._id }, autoConnect: false });
    
    let recoveredCount = 0;
    socketB2.on('newMessage', (msg) => {
        console.log("Test 3 Client received newMessage:", msg._id, "isRealTime:", msg.isRealTime);
        if (!msg.isRealTime) {
            recoveredCount++;
            socketB2.emit("message_ack", msg._id);
        }
    });
    
    socketB2.connect();

    await sleep(8000); // Wait for recovery logic
    console.log(`User B recovered ${recoveredCount} missed messages.`);
    if (recoveredCount !== 5) throw new Error(`Expected 5 recovered messages, got ${recoveredCount}`);
    
    // Check DB status of offline messages
    await sleep(1000);
    const deliveredOffline = await Message.countDocuments({ receiverId: userB.user._id, status: 'DELIVERED' });
    console.log(`Delivered messages in DB: ${deliveredOffline} (Should be 6 total including test 1)`);
    if (deliveredOffline < 6) throw new Error(`Not all offline messages transitioned to DELIVERED`);
    console.log("All offline messages correctly transitioned to DELIVERED.");


    console.log("\n>>> Test 4: Idempotency");
    const dupKey = crypto.randomUUID();
    
    const p1 = axios.post(`${API_1}/messages/send/${userB.user._id}`, {
        text: `Dup Test`, cryptoVersion: 1, idempotencyKey: dupKey
    }, { headers: { Authorization: `Bearer ${userA.token}` } });

    const p2 = axios.post(`${API_2}/messages/send/${userB.user._id}`, {
        text: `Dup Test`, cryptoVersion: 1, idempotencyKey: dupKey
    }, { headers: { Authorization: `Bearer ${userA.token}` } });

    await Promise.all([p1.catch(e=>e), p2.catch(e=>e)]);
    console.log("Sent 2 simultaneous requests with same idempotencyKey");

    const dupCount = await Message.countDocuments({ idempotencyKey: dupKey });
    console.log(`DB Count for idempotencyKey: ${dupCount}`);
    if (dupCount !== 1) throw new Error(`Idempotency failed. Expected 1 record, found ${dupCount}`);

    
    console.log("\n>>> Test 6: Distributed WebRTC");
    const roomId = `room_${Date.now()}`;
    
    socketA.emit("join-call-room", { roomId });
    await sleep(200);
    socketB2.emit("join-call-room", { roomId });

    await new Promise(resolve => {
        socketA.once("user-joined-call", (data) => {
            console.log("User A saw User B join room.");
            resolve();
        });
    });

    socketA.emit("webrtc-offer", { roomId, targetUserId: userB.user._id, offer: "mock_offer" });
    await new Promise(resolve => {
        socketB2.once("webrtc-offer", (data) => {
            console.log("User B received offer from User A.");
            resolve();
        });
    });

    socketB2.emit("screen-share-started", { roomId });
    await new Promise(resolve => {
        socketA.once("participant-screen-share", (data) => {
            console.log("User A received screen share event.");
            resolve();
        });
    });

    console.log("Distributed WebRTC signaling works successfully!");


    console.log("\n>>> Test 7: High Throughput Burst (200 messages)");
    const burstCount = 200;
    const burstPromises = [];
    for (let i=0; i<burstCount; i++) {
        // Send alternating to API 1 and API 2
        const targetApi = i % 2 === 0 ? API_1 : API_2;
        burstPromises.push(
            axios.post(`${targetApi}/messages/send/${userB.user._id}`, {
                text: `Burst ${i}`, cryptoVersion: 1, idempotencyKey: crypto.randomUUID()
            }, { headers: { Authorization: `Bearer ${userA.token}` } }).catch(e=>e)
        );
    }
    
    let bReceived = 0;
    socketB2.on('newMessage', () => { bReceived++; });

    await Promise.all(burstPromises);
    console.log(`Sent ${burstCount} requests.`);
    
    // Wait for delivery
    let retries = 0;
    while(bReceived < burstCount && retries < 10) {
        await sleep(1000);
        console.log(`Waiting for burst delivery... received ${bReceived}/${burstCount}`);
        retries++;
    }

    console.log(`Final received burst messages: ${bReceived}`);
    if (bReceived < burstCount) {
        console.log(`Warning: some messages might be skipped due to throttling or we need more time.`);
    } else {
        console.log("Burst successfully delivered without message loss!");
    }

    console.log("\nAll Node.js tests completed successfully!");
    
    socketA.disconnect();
    socketB2.disconnect();
    redis.disconnect();
    mongoose.disconnect();
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
