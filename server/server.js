import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/mongodb.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
import session from "express-session";
import passport from "./lib/passport.js";
import groupRouter from "./routes/groupRoutes.js";

const app = express();
const server = http.createServer(app);

// Initialize Socket.io server with enhanced configuration for video calling
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // your frontend URL
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use((req, res, next) => {
  req.io = io; // attach socket.io to every request
  next();
});

// Store online users and call rooms
export const userSocketMap = {};
export const callRooms = new Map(); // roomId -> { participants: Set, createdAt, settings }
export const activeConnections = new Map(); // userId -> { socketId, roomId, status }

// Helper function to get socket by user ID
const getSocketByUserId = (userId) => {
  const socketId = userSocketMap[userId];
  return socketId ? io.sockets.sockets.get(socketId) : null;
};

// Helper function to broadcast to room
const broadcastToRoom = (roomId, event, data, excludeUserId = null) => {
  const room = callRooms.get(roomId);
  if (!room) return;

  room.participants.forEach(userId => {
    if (userId !== excludeUserId) {
      const socket = getSocketByUserId(userId);
      if (socket) {
        socket.emit(event, data);
      }
    }
  });
};

// Socket.io connection handler
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User Connected", userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
     socket.userId = userId;
    activeConnections.set(userId, {
      socketId: socket.id,
      roomId: null,
      status: 'online'
    });
  }

  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // 🔹 Regular Chat Group Room Management
  socket.on("joinGroup", (groupId) => {
    console.log(`User ${userId} joined chat group ${groupId}`);
    socket.join(groupId);
  });

  socket.on("leaveGroup", (groupId) => {
    console.log(`User ${userId} left chat group ${groupId}`);
    socket.leave(groupId);
  });

  
socket.on("typing", ({ receiverId, groupId, senderName, senderId }) => {
  console.log("\n⌨️ === TYPING EVENT RECEIVED ===");
  console.log("From User ID:", senderId);
  console.log("Receiver ID:", receiverId);
  console.log("Group ID:", groupId);
  console.log("Current userSocketMap:", Object.keys(userSocketMap));
  
  if (groupId) {
    console.log("📤 Broadcasting to GROUP:", groupId);
    const roomSockets = io.sockets.adapter.rooms.get(groupId);
    console.log("Room exists?", !!roomSockets);
    console.log("Room members:", roomSockets ? Array.from(roomSockets) : 'none');
    
    socket.to(groupId).emit("userTyping", { 
      senderId: senderId, 
      senderName: senderName || "Someone",
      groupId 
    });
    console.log("✅ Group typing event sent");
  } else if (receiverId) {
    console.log("📤 Sending to INDIVIDUAL USER:", receiverId);
    const receiverSocketId = userSocketMap[receiverId];
    console.log("Receiver socket ID:", receiverSocketId);
    console.log("Receiver socket exists?", !!receiverSocketId);
    
    if (receiverSocketId) {
      const targetSocket = io.sockets.sockets.get(receiverSocketId);
      console.log("Target socket object exists?", !!targetSocket);
      console.log("Target socket connected?", targetSocket?.connected);
      
      io.to(receiverSocketId).emit("userTyping", { 
        senderId: senderId, senderName : senderName
      });
      console.log("✅ Individual typing event sent to socket:", receiverSocketId);
      console.log("Event payload:", { senderId: socket.userId });
    } else {
      console.log("❌ Receiver not found in userSocketMap");
    }
  }
  console.log("=== END TYPING EVENT ===\n");
});

socket.on("stopTyping", ({ receiverId, groupId, senderId }) => {
  console.log("\n⏹️ === STOP TYPING EVENT RECEIVED ===");
  console.log("From User ID:", socket.userId);
  console.log("Receiver ID:", receiverId);
  console.log("Group ID:", groupId);
  
  if (groupId) {
    console.log("📤 Broadcasting stop typing to GROUP:", groupId);
    socket.to(groupId).emit("userStopTyping", { 
      senderId, 
      groupId 
    });
    console.log("✅ Group stop typing event sent");
  } else if (receiverId) {
    console.log("📤 Sending stop typing to INDIVIDUAL USER:", receiverId);
    const receiverSocketId = userSocketMap[receiverId];
    console.log("Receiver socket ID:", receiverSocketId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStopTyping", { 
        senderId
      });
      console.log("✅ Individual stop typing event sent to socket:", receiverSocketId);
      console.log("Event payload:", { senderId: socket.userId });
    } else {
      console.log("❌ Receiver not found");
    }
  }
  console.log("=== END STOP TYPING EVENT ===\n");
});


  // 🔹 VIDEO CALLING FUNCTIONALITY

  // Join video call room
  socket.on("join-call-room", (data) => {
    const { roomId, userInfo = {} } = data;
    console.log(`User ${userId} joining call room ${roomId}`);

    // Create room if it doesn't exist
    if (!callRooms.has(roomId)) {
      callRooms.set(roomId, {
        participants: new Set(),
        createdAt: Date.now(),
        settings: {
          maxParticipants: 10,
          allowRecording: true,
          allowScreenShare: true
        }
      });
    }

    const room = callRooms.get(roomId);
    
    // Check if room is full
    if (room.participants.size >= room.settings.maxParticipants) {
      socket.emit("call-error", {
        type: "room_full",
        message: "Call room is full"
      });
      return;
    }

    // Join the room
    socket.join(roomId);
    room.participants.add(userId);
    
    // Update user connection info
    const userConnection = activeConnections.get(userId);
    if (userConnection) {
      userConnection.roomId = roomId;
      userConnection.status = 'in-call';
    }

    // Notify existing participants about new user
    socket.to(roomId).emit("user-joined-call", {
      userId,
      userInfo: {
        timestamp: Date.now(),
        ...userInfo
      }
    });

    // Send current participants to the new user
    const participants = Array.from(room.participants)
      .filter(id => id !== userId)
      .map(id => ({
        userId: id,
        status: activeConnections.get(id)?.status || 'unknown'
      }));

    socket.emit("call-participants", {
      roomId,
      participants,
      roomSettings: room.settings
    });

    console.log(`User ${userId} joined call room ${roomId}. Total participants: ${room.participants.size}`);
  });

  // Leave video call room
  socket.on("leave-call-room", (data) => {
    const { roomId, reason = "user_left" } = data;
    console.log(`User ${userId} leaving call room ${roomId}`);

    if (callRooms.has(roomId)) {
      const room = callRooms.get(roomId);
      room.participants.delete(userId);

      // Update user connection info
      const userConnection = activeConnections.get(userId);
      if (userConnection) {
        userConnection.roomId = null;
        userConnection.status = 'online';
      }

      // Notify other participants
      socket.to(roomId).emit("user-left-call", {
        userId,
        reason,
        timestamp: Date.now()
      });


      socket.leave(roomId);

      // Clean up empty rooms
      if (room.participants.size === 0) {
        callRooms.delete(roomId);
        console.log(`Call room ${roomId} deleted (empty)`);
      }
    }
  });

  // WebRTC Signaling - Offer
  socket.on("webrtc-offer", (data) => {
    const { roomId, targetUserId, offer } = data;
    console.log(`WebRTC offer from ${userId} to ${targetUserId} in room ${roomId}`);

    const targetSocket = getSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit("webrtc-offer", {
        fromUserId: userId,
        roomId,
        offer,
        timestamp: Date.now()
      });
    } else {
      socket.emit("call-error", {
        type: "user_not_found",
        message: "Target user not available",
        targetUserId
      });
    }
  });

  // WebRTC Signaling - Answer
  socket.on("webrtc-answer", (data) => {
    const { roomId, targetUserId, answer } = data;
    console.log(`WebRTC answer from ${userId} to ${targetUserId} in room ${roomId}`);

    const targetSocket = getSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit("webrtc-answer", {
        fromUserId: userId,
        roomId,
        answer,
        timestamp: Date.now()
      });
    }
  });

  // WebRTC Signaling - ICE Candidate
  socket.on("webrtc-ice-candidate", (data) => {
    const { roomId, targetUserId, candidate } = data;
    console.log(`ICE candidate from ${userId} to ${targetUserId}`);

    const targetSocket = getSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit("webrtc-ice-candidate", {
        fromUserId: userId,
        roomId,
        candidate,
        timestamp: Date.now()
      });
    }
  });

  // Call status updates (mute, video off, etc.)
  socket.on("call-status-update", (data) => {
    const { roomId, status } = data;
    console.log(`Call status update from ${userId}:`, status);

    // Broadcast status update to other participants in the room
    socket.to(roomId).emit("participant-status-update", {
      userId,
      status: {
        ...status,
        timestamp: Date.now()
      }
    });
  });

  // End call for entire room
  socket.on("end-call", (data) => {
    const { roomId, reason = "host_ended" } = data;
    console.log(`Call ended by ${userId} in room ${roomId}`);

    if (callRooms.has(roomId)) {
      // Notify all participants
      io.to(roomId).emit("call-ended", {
        endedBy: userId,
        reason,
        timestamp: Date.now()
      });

      // Update all participants' status
      const room = callRooms.get(roomId);
      room.participants.forEach(participantId => {
        const connection = activeConnections.get(participantId);
        if (connection) {
          connection.roomId = null;
          connection.status = 'online';
        }
      });

      // Clean up room
      callRooms.delete(roomId);
    }
  });

  // Screen sharing events
  socket.on("screen-share-started", (data) => {
    const { roomId } = data;
    console.log(`Screen sharing started by ${userId} in room ${roomId}`);
    
    socket.to(roomId).emit("participant-screen-share", {
      userId,
      action: "started",
      timestamp: Date.now()
    });
  });

  socket.on("screen-share-stopped", (data) => {
    const { roomId } = data;
    console.log(`Screen sharing stopped by ${userId} in room ${roomId}`);
    
    socket.to(roomId).emit("participant-screen-share", {
      userId,
      action: "stopped",
      timestamp: Date.now()
    });
  });

  // Call recording events
  socket.on("recording-started", (data) => {
    const { roomId } = data;
    console.log(`Recording started by ${userId} in room ${roomId}`);
    
    socket.to(roomId).emit("call-recording", {
      userId,
      action: "started",
      timestamp: Date.now()
    });
  });

  socket.on("recording-stopped", (data) => {
    const { roomId } = data;
    console.log(`Recording stopped by ${userId} in room ${roomId}`);
    
    socket.to(roomId).emit("call-recording", {
      userId,
      action: "stopped",
      timestamp: Date.now()
    });
  });

  // Network quality updates
  socket.on("network-quality", (data) => {
    const { roomId, quality } = data;
    
    // You might want to store this for analytics or broadcast to admins
    socket.to(roomId).emit("participant-network-quality", {
      userId,
      quality,
      timestamp: Date.now()
    });
  });

  // Chat messages during call
  socket.on("call-chat-message", (data) => {
    const { roomId, message } = data;
    console.log(`Call chat message from ${userId} in room ${roomId}`);
    
    socket.to(roomId).emit("call-chat-message", {
      fromUserId: userId,
      message,
      timestamp: Date.now()
    });
  });

  // Heartbeat/Ping for keeping connections alive
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });

  // Get call room info
  socket.on("get-room-info", (data) => {
    const { roomId } = data;
    
    if (callRooms.has(roomId)) {
      const room = callRooms.get(roomId);
      const participants = Array.from(room.participants).map(id => ({
        userId: id,
        status: activeConnections.get(id)?.status || 'unknown',
        socketConnected: !!getSocketByUserId(id)
      }));

      socket.emit("room-info", {
        roomId,
        participantCount: room.participants.size,
        participants,
        settings: room.settings,
        createdAt: room.createdAt
      });
    } else {
      socket.emit("call-error", {
        type: "room_not_found",
        message: "Call room not found",
        roomId
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log("User Disconnected", userId, "Reason:", reason);
    
    // Clean up user from all rooms
    if (userId) {
      const userConnection = activeConnections.get(userId);
      
      if (userConnection && userConnection.roomId) {
        const roomId = userConnection.roomId;
        
        // Remove from call room
        if (callRooms.has(roomId)) {
          const room = callRooms.get(roomId);
          room.participants.delete(userId);
          
          // Notify other participants
          socket.to(roomId).emit("user-left-call", {
            userId,
            reason: "disconnected",
            timestamp: Date.now()
          });
          
          // Clean up empty room
          if (room.participants.size === 0) {
            callRooms.delete(roomId);
          }
        }
      }
      
      // Clean up tracking
      delete userSocketMap[userId];
      activeConnections.delete(userId);
    }
    
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`Socket error for user ${userId}:`, error);
  });


  socket.on("call-request", (data) => {
  const { to, from, fromName, roomId } = data;
  console.log(`Call request from ${from} (${fromName}) to ${to}`);
  
  const targetSocket = getSocketByUserId(to);
  if (targetSocket) {
    // Send call request to target user
    targetSocket.emit("call-request", {
      from,
      fromName,
      roomId,
      timestamp: Date.now()
    });
    
    // Optionally, you can set a timeout for the call request
    setTimeout(() => {
      // Check if call was accepted/rejected, if not, auto-reject
      const callerSocket = getSocketByUserId(from);
      if (callerSocket) {
        callerSocket.emit("call-timeout", {
          to,
          message: "Call request timed out"
        });
      }
    }, 30000); // 30 second timeout
    
  } else {
    // Target user is not online
    socket.emit("call-error", {
      type: "user_offline",
      message: "User is not available",
      targetUserId: to
    });
  }
});

// Handle call acceptance
// Handle call requests
// In your server.js, add these debug logs to existing handlers:
socket.on("call-request", (data) => {
  console.log("📞 SERVER: Call request received:", data);
  const { to, from, fromName, roomId } = data;
  
  const targetSocket = getSocketByUserId(to);
  console.log("🔍 SERVER: Target user socket found:", !!targetSocket);
  console.log("🔍 SERVER: Target user ID:", to);
  console.log("🔍 SERVER: Online users:", Object.keys(userSocketMap));
  
  if (targetSocket) {
    console.log("📡 SERVER: Sending call request to target user");
    targetSocket.emit("call-request", {
      from,
      fromName,
      roomId,
      timestamp: Date.now()
    });
  } else {
    console.log("❌ SERVER: Target user not found or offline");
    socket.emit("call-error", {
      type: "user_offline",
      message: "User is not available",
      targetUserId: to
    });
  }
});

// Handle call acceptance
socket.on("call-accepted", (data) => {
  const { to, from, roomId } = data;
  console.log(`Call accepted by ${from} for caller ${to}`);
  
  const callerSocket = getSocketByUserId(to);
  if (callerSocket) {
    callerSocket.emit("call-accepted", {
      from,
      roomId,
      timestamp: Date.now()
    });
  }
});

// Handle call rejection
socket.on("call-rejected", (data) => {
  const { to, from, roomId } = data;
  console.log(`Call rejected by ${from} for caller ${to}`);
  
  const callerSocket = getSocketByUserId(to);
  if (callerSocket) {
    callerSocket.emit("call-rejected", {
      from,
      roomId,
      timestamp: Date.now()
    });
  }
});

});



// Middleware
app.use(express.json({ limit: "4mb" }));
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
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

// Routes
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/group", groupRouter);

// Video calling related API endpoints
app.get("/api/call/rooms", (req, res) => {
  const rooms = Array.from(callRooms.entries()).map(([roomId, room]) => ({
    roomId,
    participantCount: room.participants.size,
    createdAt: room.createdAt,
    settings: room.settings
  }));
  
  res.json({ rooms });
});

app.get("/api/call/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  
  if (callRooms.has(roomId)) {
    const room = callRooms.get(roomId);
    const participants = Array.from(room.participants).map(userId => ({
      userId,
      status: activeConnections.get(userId)?.status || 'unknown',
      online: !!userSocketMap[userId]
    }));
    
    res.json({
      roomId,
      participantCount: room.participants.size,
      participants,
      settings: room.settings,
      createdAt: room.createdAt
    });
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

app.post("/api/call/create-room", (req, res) => {
  const { settings = {} } = req.body;
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const defaultSettings = {
    maxParticipants: 10,
    allowRecording: true,
    allowScreenShare: true,
    isPrivate: false,
    requirePassword: false,
    autoEndAfter: null
  };
  
  callRooms.set(roomId, {
    participants: new Set(),
    createdAt: Date.now(),
    settings: { ...defaultSettings, ...settings }
  });
  
  res.json({
    roomId,
    settings: { ...defaultSettings, ...settings },
    createdAt: Date.now()
  });
});

app.delete("/api/call/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  
  if (callRooms.has(roomId)) {
    // Notify all participants
    io.to(roomId).emit("call-ended", {
      reason: "room_deleted",
      timestamp: Date.now()
    });
    
    // Clean up participant statuses
    const room = callRooms.get(roomId);
    room.participants.forEach(userId => {
      const connection = activeConnections.get(userId);
      if (connection) {
        connection.roomId = null;
        connection.status = 'online';
      }
    });
    
    callRooms.delete(roomId);
    res.json({ message: "Room deleted successfully" });
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Get call statistics
app.get("/api/call/stats", (req, res) => {
  const stats = {
    totalRooms: callRooms.size,
    totalActiveParticipants: Array.from(activeConnections.values())
      .filter(conn => conn.status === 'in-call').length,
    totalOnlineUsers: Object.keys(userSocketMap).length,
    roomDetails: Array.from(callRooms.entries()).map(([roomId, room]) => ({
      roomId,
      participantCount: room.participants.size,
      createdAt: room.createdAt,
      duration: Date.now() - room.createdAt
    }))
  };
  
  res.json(stats);
});

// Default route
app.get("/", (req, res) => {
  res.send("API is working with Video Calling Support 🚀📹");
});

// Cleanup function for inactive rooms (run periodically)
const cleanupInactiveRooms = () => {
  const now = Date.now();
  const inactiveTimeout = 3600000; // 1 hour

  for (const [roomId, room] of callRooms.entries()) {
    if (room.participants.size === 0 && (now - room.createdAt) > inactiveTimeout) {
      callRooms.delete(roomId);
      console.log(`Cleaned up inactive room: ${roomId}`);
    }
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupInactiveRooms, 30 * 60 * 1000);

// DB Connection
await connectDB();

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server with Video Calling is running on port ${PORT} 🚀📹`);
  console.log(`WebSocket signaling server ready for video calls`);
});