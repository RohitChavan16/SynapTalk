import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/mongodb.js";
import userRouter from "./routes/userRoutes.js";
import uploadRouter from "./routes/uploadRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { cleanupAttachments } from "./jobs/attachmentCron.js";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import session from "express-session";
import passport from "./lib/passport.js";
import groupRouter from "./routes/groupRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import otpRouter from "./routes/otpRoutes.js";
import healthRouter from "./routes/healthRoutes.js";
import { logger } from "./lib/logger.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import pinoHttp from "pino-http";
import crypto from "crypto";
import mongoose from "mongoose";
import { globalRateLimitMiddleware } from "./middleware/rateLimiter.js";
import { redisPublisher, redisSubscriber } from "./lib/redis.js";
import { markUserOnline, markUserOffline, getOnlineUsers, handleHeartbeat } from "./lib/presence.js";
import { startMessageConsumer, initializeMessageBus } from "./lib/messageBus.js";
import * as callRoomManager from "./lib/callRoomManager.js";
import Message from "./models/Message.js";

const app = express();
const server = http.createServer(app);


export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL, 
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.adapter(createAdapter(redisPublisher, redisSubscriber));

// Start the message consumer on this instance
initializeMessageBus().then(() => {
    startMessageConsumer(io);
});

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    customProps: (req, res) => {
      return {
        userId: req.user?._id || 'unauthenticated',
      };
    },
  })
);

app.use((req, res, next) => {
  req.io = io; 
  next();
});

app.use(globalRateLimitMiddleware);

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  logger.info("User Connected", { userId });

  if (userId) {
    socket.userId = userId;
    const personalRoom = `user_${userId}`;
    socket.join(personalRoom);
    await markUserOnline(userId);
  }

  const onlineUsers = await getOnlineUsers();
  io.emit("getOnlineUsers", onlineUsers);
  
  if (userId) {
      try {
          const missedMessages = await Message.find({ receiverId: userId, status: 'SENT' })
              .populate('senderId', 'fullName profilePic')
              .populate('receiverId', 'fullName profilePic')
              .lean();
          logger.info(`Found ${missedMessages.length} missed messages for user ${userId}`);
          if (missedMessages.length > 0) {
              missedMessages.forEach(msg => {
                  socket.emit("newMessage", { ...msg, isRealTime: false });
              });
          }
      } catch (err) {
          logger.error("Error fetching missed messages:", err);
      }
  }

  socket.on("message_ack", async (messageId) => {
      try {
          console.log(`[SOCKET] message_ack received for messageId: ${messageId}`);
          const msg = await Message.findByIdAndUpdate(messageId, { status: 'DELIVERED' }, { new: true });
          if (msg) {
              io.to(`user_${msg.senderId}`).emit("messageDelivered", { 
                  messageId: msg._id, 
                  receiverId: msg.receiverId.toString() 
              });
          }
      } catch (err) {
          logger.error("Error updating message status to DELIVERED:", err);
      }
  });

  socket.on("joinMultipleGroups", (groupIds) => {
    if (!Array.isArray(groupIds)) return;
    groupIds.forEach((groupId) => socket.join(groupId));
  });

  socket.on("leaveMultipleGroups", (groupIds) => {
    if (!Array.isArray(groupIds)) return;
    groupIds.forEach((groupId) => socket.leave(groupId));
  });

  socket.on("joinPersonalRoom", (uid) => {
    socket.join(`user_${uid}`);
  });

  socket.on("leavePersonalRoom", (uid) => {
    socket.leave(`user_${uid}`);
  });

  socket.on("typing", ({ receiverId, groupId, senderName, senderId }) => {
    if (groupId) {
      socket.to(groupId).emit("userTyping", { senderId, senderName: senderName || "Someone", groupId });
    } else if (receiverId) {
      io.to(`user_${receiverId}`).emit("userTyping", { senderId, senderName: senderName || "Someone" });
    }
  });

  socket.on("stopTyping", ({ receiverId, groupId, senderId }) => {
    if (groupId) {
      socket.to(groupId).emit("userStopTyping", { senderId, groupId });
    } else if (receiverId) {
      io.to(`user_${receiverId}`).emit("userStopTyping", { senderId });
    }
  });

  // VIDEO CALLING FUNCTIONALITY via callRoomManager
  socket.on("join-call-room", async (data) => {
    const { roomId, userInfo = {} } = data;
    let room = await callRoomManager.getRoomInfo(roomId);
    if (!room) {
      room = await callRoomManager.createRoom(roomId, {
        maxParticipants: 10,
        allowRecording: true,
        allowScreenShare: true
      });
    }

    const joinRes = await callRoomManager.joinRoom(roomId, userId);
    if (joinRes.error) {
      socket.emit("call-error", { type: joinRes.error, message: "Cannot join call room" });
      return;
    }

    socket.join(roomId);

    socket.to(roomId).emit("user-joined-call", {
      userId,
      userInfo: { timestamp: Date.now(), ...userInfo }
    });

    const updatedRoom = await callRoomManager.getRoomInfo(roomId);
    socket.emit("call-participants", {
      roomId,
      participants: updatedRoom.participants.filter(p => p.userId !== userId),
      roomSettings: updatedRoom.settings
    });
  });

  socket.on("leave-call-room", async (data) => {
    const { roomId, reason = "user_left" } = data;
    await callRoomManager.leaveRoom(roomId, userId);
    socket.to(roomId).emit("user-left-call", { userId, reason, timestamp: Date.now() });
    socket.leave(roomId);
  });

  ['webrtc-offer', 'webrtc-answer', 'webrtc-ice-candidate'].forEach(event => {
      socket.on(event, (data) => {
          const { roomId, targetUserId, offer, answer, candidate } = data;
          io.to(`user_${targetUserId}`).emit(event, {
              fromUserId: userId,
              roomId,
              offer, answer, candidate,
              timestamp: Date.now()
          });
      });
  });

  socket.on("call-status-update", (data) => {
    socket.to(data.roomId).emit("participant-status-update", {
      userId,
      status: { ...data.status, timestamp: Date.now() }
    });
  });

  socket.on("end-call", async (data) => {
    const { roomId, reason = "host_ended" } = data;
    io.to(roomId).emit("call-ended", { endedBy: userId, reason, timestamp: Date.now() });
    await callRoomManager.deleteRoom(roomId);
  });

  ['screen-share-started', 'screen-share-stopped', 'recording-started', 'recording-stopped'].forEach(action => {
      socket.on(action, async (data) => {
          const isStartShare = action === 'screen-share-started';
          const isStopShare = action === 'screen-share-stopped';
          
          if (isStartShare) await callRoomManager.setScreenSharer(data.roomId, userId);
          if (isStopShare) await callRoomManager.clearScreenSharer(data.roomId, userId);

          io.to(data.roomId).emit(action.includes('screen') ? "participant-screen-share" : "call-recording", {
              userId,
              action: action.includes('started') ? 'started' : 'stopped',
              hasAudio: data.hasAudio || false,
              timestamp: Date.now()
          });
      });
  });

  socket.on("network-quality", (data) => {
    socket.to(data.roomId).emit("participant-network-quality", { userId, quality: data.quality, timestamp: Date.now() });
  });

  socket.on("call-chat-message", (data) => {
    socket.to(data.roomId).emit("call-chat-message", { fromUserId: userId, message: data.message, timestamp: Date.now() });
  });

  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
    if (userId) handleHeartbeat(userId);
  });

  socket.on("get-room-info", async (data) => {
    const room = await callRoomManager.getRoomInfo(data.roomId);
    if (room) {
        socket.emit("room-info", room);
    } else {
        socket.emit("call-error", { type: "room_not_found", message: "Call room not found" });
    }
  });

  socket.on("call-request", (data) => {
      const { to, from, fromName, roomId } = data;
      io.to(`user_${to}`).emit("call-request", { from, fromName, roomId, timestamp: Date.now() });
  });

  socket.on("call-accepted", (data) => {
      io.to(`user_${data.to}`).emit("call-accepted", { from: data.from, roomId: data.roomId, timestamp: Date.now() });
  });

  socket.on("call-rejected", (data) => {
      io.to(`user_${data.to}`).emit("call-rejected", { from: data.from, roomId: data.roomId, timestamp: Date.now() });
  });

  socket.on("disconnect", async (reason) => {
    if (userId) {
      await markUserOffline(userId);
    }
    const onlineUsers = await getOnlineUsers();
    io.emit("getOnlineUsers", onlineUsers);
  });

  socket.on("error", (error) => {
    console.error(`Socket error for user ${userId}:`, error);
  });
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL, // frontend URL
    credentials: true,
  })
);

// Sessions (must come before passport middlewares)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecret",
    resave: false,
    saveUninitialized: false,
  })
);






app.use(passport.initialize());
app.use(passport.session());






//Main Routes
app.use("/api/auth", userRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/messages", messageRouter);
app.use("/api/group", groupRouter);
app.use("/api/ai", aiRouter);
app.use("/api/otp", otpRouter);






// Video calling related API endpoints
app.get("/api/call/rooms", async (req, res) => {
  const rooms = await callRoomManager.getAllRooms();
  res.json({ rooms });
});

app.get("/api/call/room/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const room = await callRoomManager.getRoomInfo(roomId);
  if (room) {
    res.json(room);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

app.post("/api/call/create-room", async (req, res) => {
  const { settings = {} } = req.body;
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const room = await callRoomManager.createRoom(roomId, settings);
  res.json(room);
});

app.delete("/api/call/room/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const room = await callRoomManager.getRoomInfo(roomId);
  if (room) {
    io.to(roomId).emit("call-ended", { reason: "room_deleted", timestamp: Date.now() });
    await callRoomManager.deleteRoom(roomId);
    res.json({ message: "Room deleted successfully" });
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Get call statistics
app.get("/api/call/stats", async (req, res) => {
  const rooms = await callRoomManager.getAllRooms();
  res.json({
    totalRooms: rooms.length,
    roomDetails: rooms
  });
});

app.use("/api/healthz", healthRouter);

// Start cron jobs
setInterval(() => {
  cleanupAttachments();
}, 60 * 60 * 1000); // Run every hour


app.get("/", (req, res) => {
  res.send("API is working with Video Calling Support 🚀📹");
});


// Run cleanup every 30 minutes
setInterval(async () => {
    try {
        const rooms = await callRoomManager.getAllRooms();
        const now = Date.now();
        const inactiveTimeout = 3600000;
        for (const room of rooms) {
            if (room.participantCount === 0 && (now - room.createdAt) > inactiveTimeout) {
                await callRoomManager.deleteRoom(room.roomId);
                logger.info(`Cleaned up inactive room: ${room.roomId}`);
            }
        }
    } catch (err) {
        logger.error("Error cleaning up inactive rooms:", err);
    }
}, 30 * 60 * 1000);


// Global Error Handler
app.use(globalErrorHandler);

await connectDB();

const PORT = process.env.PORT || 5001;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server with Video Calling is running on port ${PORT} 🚀📹`);
  logger.info(`WebSocket signaling server ready for video calls`);
});

// Graceful Shutdown
const gracefulShutdown = () => {
  logger.info("Received shutdown signal, shutting down gracefully...");

  // Notify clients
  if (io) {
    io.emit("server_shutdown", { message: "Server is shutting down for maintenance" });
  }

  server.close(async () => {
    logger.info("Closed out remaining HTTP connections.");
    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
      process.exit(0);
    } catch (err) {
      logger.error(err, "Error during MongoDB disconnection");
      process.exit(1);
    }
  });

  // Force close after 10s
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);