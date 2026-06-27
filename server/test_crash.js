import axios from 'axios';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { execSync } from 'child_process';
import crypto from 'crypto';

const API_1 = 'http://localhost:5001/api';
const API_2 = 'http://localhost:5002/api';
const SOCKET_2 = 'http://localhost:5002';
const MONGO_URI = 'mongodb://localhost:27017/synap-talk';
const REDIS_URI = 'redis://localhost:6379';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createTestUser(name) {
    const email = `${name}_crash_${Date.now()}@test.com`;
    const res = await axios.post(`${API_2}/auth/signup`, {
        fullName: name,
        email,
        password: 'password123',
        bio: 'Test user'
    });
    return { user: res.data.userData, token: res.data.token, email };
}

async function runTests() {
    console.log("== Connecting to DB and Redis ==");
    await mongoose.connect(MONGO_URI);
    const redis = new Redis(REDIS_URI);
    redis.on('error', () => {});
    
    const messageSchema = new mongoose.Schema({
        senderId: mongoose.Schema.Types.ObjectId,
        receiverId: mongoose.Schema.Types.ObjectId,
        status: String,
        idempotencyKey: String
    }, { collection: 'messages' });
    const Message = mongoose.model('MessageCrashTest', messageSchema);

    console.log("== Creating Test Users ==");
    const userA = await createTestUser("UserA_Crash");
    const userB = await createTestUser("UserB_Crash");

    console.log("\n>>> Test 2: Consumer Crash Recovery");
    const socketB = io(SOCKET_2, { query: { userId: userB.user._id } });

    await new Promise(resolve => socketB.on('connect', resolve));
    console.log("User B connected to app2");

    let bReceived = 0;
    const receivedMsgIds = new Set();
    socketB.on('newMessage', (msg) => {
        bReceived++;
        receivedMsgIds.add(msg._id);
        socketB.emit("message_ack", msg._id);
    });

    console.log("Sending 50 messages to app1 via API...");
    const burstCount = 50;
    const requests = [];
    for (let i=0; i<burstCount; i++) {
        requests.push(axios.post(`${API_1}/messages/send/${userB.user._id}`, {
            text: `Crash Burst ${i}`, cryptoVersion: 1, idempotencyKey: `TEST_CRASH_${crypto.randomUUID()}`
        }, { headers: { Authorization: `Bearer ${userA.token}` } }));
    }
    await Promise.all(requests);

    // Immediately kill app1
    console.log("Killing app1 abruptly to simulate crash mid-processing...");
    execSync('docker kill synaptalk-app1');
    
    // Wait for XAUTOCLAIM on app2 (Note: messageBus.js runs autoclaim every 30s)
    console.log("Waiting for app2 to auto-claim abandoned messages (may take up to 60 seconds)...");
    let maxRetries = 15;
    while(bReceived < burstCount && maxRetries > 0) {
        await sleep(5000);
        console.log(`Received so far: ${bReceived}/${burstCount}`);
        maxRetries--;
    }

    console.log(`Final received after crash recovery: ${bReceived}`);
    if (bReceived >= burstCount) {
        console.log("Crash recovery successful! All messages processed by app2 via XAUTOCLAIM.");
    } else {
        console.log("Crash recovery incomplete. Some messages lost.");
    }

    console.log("\n>>> Test 8: Redis Restart Scenario");
    console.log("Restarting app1...");
    execSync('docker start synaptalk-app1');
    await sleep(5000);
    
    console.log("Stopping Redis container...");
    execSync('docker stop synaptalk-redis');
    console.log("Redis stopped. Waiting 5s...");
    await sleep(5000);
    
    console.log("Starting Redis container...");
    execSync('docker start synaptalk-redis');
    console.log("Redis started. Waiting 5s for apps to reconnect...");
    await sleep(5000);
    
    console.log("Verifying app messaging still works after Redis restart...");
    const p1 = axios.post(`${API_2}/messages/send/${userB.user._id}`, {
        text: `Post Redis Restart`, cryptoVersion: 1, idempotencyKey: crypto.randomUUID()
    }, { headers: { Authorization: `Bearer ${userA.token}` } });
    
    await sleep(2000);
    const initialBReceived = bReceived;
    await p1;
    await sleep(2000);
    
    if (bReceived > initialBReceived) {
        console.log("Messaging successfully resumed after Redis restart!");
    } else {
        console.log("Messaging FAILED after Redis restart!");
    }

    socketB.disconnect();
    redis.disconnect();
    mongoose.disconnect();
}

runTests().catch(err => {
    console.error("Crash Test failed:", err);
    process.exit(1);
});
