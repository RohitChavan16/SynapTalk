const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const startIndex = content.indexOf('io.on("connection"');
const endIndex = content.indexOf('app.use(express.json');

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

const replacement = `io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  logger.info("User Connected", { userId });

  if (userId) {
    socket.userId = userId;
    const personalRoom = \`user_\${userId}\`;
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
          await Message.findByIdAndUpdate(messageId, { status: 'DELIVERED' });
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
    socket.join(\`user_\${uid}\`);
  });

  socket.on("leavePersonalRoom", (uid) => {
    socket.leave(\`user_\${uid}\`);
  });

  socket.on("typing", ({ receiverId, groupId, senderName, senderId }) => {
    if (groupId) {
      socket.to(groupId).emit("userTyping", { senderId, senderName: senderName || "Someone", groupId });
    } else if (receiverId) {
      io.to(\`user_\${receiverId}\`).emit("userTyping", { senderId, senderName: senderName || "Someone" });
    }
  });

  socket.on("stopTyping", ({ receiverId, groupId, senderId }) => {
    if (groupId) {
      socket.to(groupId).emit("userStopTyping", { senderId, groupId });
    } else if (receiverId) {
      io.to(\`user_\${receiverId}\`).emit("userStopTyping", { senderId });
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
          io.to(\`user_\${targetUserId}\`).emit(event, {
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
      io.to(\`user_\${to}\`).emit("call-request", { from, fromName, roomId, timestamp: Date.now() });
  });

  socket.on("call-accepted", (data) => {
      io.to(\`user_\${data.to}\`).emit("call-accepted", { from: data.from, roomId: data.roomId, timestamp: Date.now() });
  });

  socket.on("call-rejected", (data) => {
      io.to(\`user_\${data.to}\`).emit("call-rejected", { from: data.from, roomId: data.roomId, timestamp: Date.now() });
  });

  socket.on("disconnect", async (reason) => {
    if (userId) {
      await markUserOffline(userId);
    }
    const onlineUsers = await getOnlineUsers();
    io.emit("getOnlineUsers", onlineUsers);
  });

  socket.on("error", (error) => {
    console.error(\`Socket error for user \${userId}:\`, error);
  });
});

// Middleware
`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('server.js', newContent, 'utf8');
console.log("Replaced successfully");
