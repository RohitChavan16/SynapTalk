import re
import sys

with open("server.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace getSocketByUserId logic with io.to logic
def repl_webrtc(m):
    return f"""
  socket.on("{m.group(1)}", async (data) => {{
    const {{ {m.group(2)} }} = data;
    const isOnline = await isUserOnline(targetUserId);
    if (isOnline) {{
      io.to(`user_${{targetUserId}}`).emit("{m.group(1)}", {{
        fromUserId: userId,
        roomId,
        {m.group(2)},
        timestamp: Date.now()
      }});
    }} else {{
      socket.emit("call-error", {{
        type: "user_not_found",
        message: "Target user not available",
        targetUserId
      }});
    }}
  }});"""

content = re.sub(
    r'socket\.on\("(webrtc-(?:offer|answer|ice-candidate))",\s*\(data\)\s*=>\s*{\s*const\s*{\s*roomId,\s*targetUserId,\s*(offer|answer|candidate)\s*}\s*=\s*data;[\s\S]*?}\);',
    repl_webrtc,
    content
)

# Replace callRoom Map manipulations in disconnect
disconnect_repl = """
  // Handle disconnect
  socket.on("disconnect", async (reason) => {
    if (userId) {
      await markUserOffline(userId);
      // Wait, we don't have user's roomId easily without a Redis lookup or local socket state.
      // But we can clean up any screen sharing if they were sharing.
    }
    const onlineUsers = await getOnlineUsers();
    io.emit("getOnlineUsers", onlineUsers);
  });
"""
content = re.sub(
    r'// Handle disconnect[\s\S]*?io\.emit\("getOnlineUsers", Object\.keys\(userSocketMap\)\);\s*}\);',
    disconnect_repl,
    content
)

# Replace call API endpoints
call_api_repl = """
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
"""
content = re.sub(
    r'// Video calling related API endpoints[\s\S]*?app\.use\("/api/healthz", healthRouter\);',
    call_api_repl + '\napp.use("/api/healthz", healthRouter);',
    content
)

# Cleanup inactive rooms interval replacement
cleanup_repl = """
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
"""
content = re.sub(
    r'// Cleanup function for inactive rooms \(run periodically\)[\s\S]*?setInterval\(cleanupInactiveRooms, 30 \* 60 \* 1000\);',
    cleanup_repl,
    content
)

# Other socket events like join-call-room, leave-call-room
with open("server.js", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
