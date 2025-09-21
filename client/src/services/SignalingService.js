// services/SignalingService.js
export class SignalingService {
  constructor(serverUrl = 'ws://localhost:8080') {
    this.serverUrl = serverUrl;
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.messageQueue = [];
    this.listeners = new Map();
    
    // Callbacks
    this.onMessage = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  /**
   * Connect to signaling server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to signaling server:', this.serverUrl);
        
        this.websocket = new WebSocket(this.serverUrl);
        
        this.websocket.onopen = () => {
          console.log('Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Send queued messages
          this.flushMessageQueue();
          
          if (this.onConnected) {
            this.onConnected();
          }
          
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onclose = (event) => {
          console.log('Disconnected from signaling server:', event.code, event.reason);
          this.isConnected = false;
          
          if (this.onDisconnected) {
            this.onDisconnected(event);
          }
          
          // Attempt to reconnect unless it was a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.websocket.onerror = (error) => {
          console.error('Signaling server error:', error);
          
          if (this.onError) {
            this.onError(error);
          }
          
          if (!this.isConnected) {
            reject(new Error('Failed to connect to signaling server'));
          }
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from signaling server
   */
  disconnect() {
    console.log('Disconnecting from signaling server');
    
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    
    this.isConnected = false;
    this.messageQueue = [];
  }

  /**
   * Send message to signaling server
   */
  send(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    if (this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
      console.log('Sending message:', message);
      this.websocket.send(messageStr);
    } else {
      console.log('Queueing message (not connected):', message);
      this.messageQueue.push(messageStr);
      
      // Try to reconnect if not connected
      if (!this.isConnected) {
        this.attemptReconnect();
      }
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);
      
      // Emit to specific listeners first
      if (message.type && this.listeners.has(message.type)) {
        const listener = this.listeners.get(message.type);
        listener(message);
      }
      
      // Then call the general message handler
      if (this.onMessage) {
        this.onMessage(message);
      }
      
    } catch (error) {
      console.error('Error parsing message:', error, data);
    }
  }

  /**
   * Add listener for specific message types
   */
  on(messageType, callback) {
    this.listeners.set(messageType, callback);
  }

  /**
   * Remove listener for specific message types
   */
  off(messageType) {
    this.listeners.delete(messageType);
  }

  /**
   * Attempt to reconnect to signaling server
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Send queued messages after connection is established
   */
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`Sending ${this.messageQueue.length} queued messages`);
      
      this.messageQueue.forEach(message => {
        this.websocket.send(message);
      });
      
      this.messageQueue = [];
    }
  }

  /**
   * Join a specific room
   */
  joinRoom(roomId, userId, userInfo = {}) {
    this.send({
      type: 'join-room',
      roomId,
      userId,
      userInfo: {
        timestamp: Date.now(),
        ...userInfo
      }
    });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId, userId) {
    this.send({
      type: 'leave-room',
      roomId,
      userId,
      timestamp: Date.now()
    });
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(roomId, userId, offer, targetUserId = null) {
    this.send({
      type: 'offer',
      roomId,
      userId,
      targetUserId,
      offer,
      timestamp: Date.now()
    });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(roomId, userId, answer, targetUserId) {
    this.send({
      type: 'answer',
      roomId,
      userId,
      targetUserId,
      answer,
      timestamp: Date.now()
    });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(roomId, userId, candidate, targetUserId = null) {
    this.send({
      type: 'ice-candidate',
      roomId,
      userId,
      targetUserId,
      candidate,
      timestamp: Date.now()
    });
  }

  /**
   * Send call end signal
   */
  endCall(roomId, userId, reason = 'user_hangup') {
    this.send({
      type: 'end-call',
      roomId,
      userId,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Send call status update (mute, video off, etc.)
   */
  sendCallStatus(roomId, userId, status) {
    this.send({
      type: 'call-status',
      roomId,
      userId,
      status: {
        ...status,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(roomId, userId, isTyping = true) {
    this.send({
      type: 'typing',
      roomId,
      userId,
      isTyping,
      timestamp: Date.now()
    });
  }

  /**
   * Send chat message during call
   */
  sendChatMessage(roomId, userId, message) {
    this.send({
      type: 'chat-message',
      roomId,
      userId,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Request room participants list
   */
  getParticipants(roomId) {
    this.send({
      type: 'get-participants',
      roomId,
      timestamp: Date.now()
    });
  }

  /**
   * Send heartbeat/ping to keep connection alive
   */
  sendHeartbeat() {
    this.send({
      type: 'ping',
      timestamp: Date.now()
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      readyState: this.websocket ? this.websocket.readyState : null
    };
  }
}

/**
 * Signaling Server Implementation (Node.js)
 * This would run on your backend server
 */
export class SignalingServer {
  constructor(port = 8080) {
    this.port = port;
    this.rooms = new Map(); // roomId -> Set of users
    this.users = new Map(); // userId -> { ws, roomId, userInfo }
    this.server = null;
  }

  /**
   * Start the signaling server
   */
  start() {
    // This is a conceptual implementation
    // In practice, you'd use ws library or socket.io
    
    console.log(`Signaling server would start on port ${this.port}`);
    
    // Example using ws library:
    /*
    const WebSocket = require('ws');
    
    this.server = new WebSocket.Server({ port: this.port });
    
    this.server.on('connection', (ws) => {
      console.log('New client connected');
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });
      
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
    */
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);
      
      switch (message.type) {
        case 'join-room':
          this.handleJoinRoom(ws, message);
          break;
        case 'leave-room':
          this.handleLeaveRoom(ws, message);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          this.relayMessage(message);
          break;
        case 'end-call':
          this.handleEndCall(message);
          break;
        case 'call-status':
          this.relayCallStatus(message);
          break;
        case 'chat-message':
          this.relayChatMessage(message);
          break;
        case 'get-participants':
          this.sendParticipants(ws, message.roomId);
          break;
        case 'ping':
          this.sendPong(ws);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Handle user joining a room
   */
  handleJoinRoom(ws, message) {
    const { roomId, userId, userInfo } = message;
    
    // Add user to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);
    
    // Store user connection
    this.users.set(userId, { ws, roomId, userInfo });
    
    // Notify other users in the room
    this.broadcastToRoom(roomId, {
      type: 'user-joined',
      roomId,
      userId,
      userInfo,
      timestamp: Date.now()
    }, userId);
    
    // Send current participants to the new user
    this.sendParticipants(ws, roomId);
    
    console.log(`User ${userId} joined room ${roomId}`);
  }

  /**
   * Handle user leaving a room
   */
  handleLeaveRoom(ws, message) {
    const { roomId, userId } = message;
    this.removeUserFromRoom(userId, roomId);
  }

  /**
   * Remove user from room and notify others
   */
  removeUserFromRoom(userId, roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      
      // Remove empty rooms
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    this.users.delete(userId);
    
    // Notify other users
    this.broadcastToRoom(roomId, {
      type: 'user-left',
      roomId,
      userId,
      timestamp: Date.now()
    });
    
    console.log(`User ${userId} left room ${roomId}`);
  }

  /**
   * Relay message to specific user or all users in room
   */
  relayMessage(message) {
    const { roomId, targetUserId } = message;
    
    if (targetUserId) {
      // Send to specific user
      const user = this.users.get(targetUserId);
      if (user && user.ws.readyState === 1) { // WebSocket.OPEN
        user.ws.send(JSON.stringify(message));
      }
    } else {
      // Broadcast to all users in room except sender
      this.broadcastToRoom(roomId, message, message.userId);
    }
  }

  /**
   * Handle call end
   */
  handleEndCall(message) {
    const { roomId } = message;
    
    // Notify all users in the room
    this.broadcastToRoom(roomId, {
      type: 'call-ended',
      roomId,
      endedBy: message.userId,
      reason: message.reason,
      timestamp: Date.now()
    });
  }

  /**
   * Relay call status updates
   */
  relayCallStatus(message) {
    this.broadcastToRoom(message.roomId, message, message.userId);
  }

  /**
   * Relay chat messages
   */
  relayChatMessage(message) {
    this.broadcastToRoom(message.roomId, message, message.userId);
  }

  /**
   * Send participants list to user
   */
  sendParticipants(ws, roomId) {
    const participants = [];
    
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).forEach(userId => {
        const user = this.users.get(userId);
        if (user) {
          participants.push({
            userId,
            userInfo: user.userInfo,
            connected: user.ws.readyState === 1
          });
        }
      });
    }
    
    ws.send(JSON.stringify({
      type: 'participants',
      roomId,
      participants,
      timestamp: Date.now()
    }));
  }

  /**
   * Send pong response to ping
   */
  sendPong(ws) {
    ws.send(JSON.stringify({
      type: 'pong',
      timestamp: Date.now()
    }));
  }

  /**
   * Broadcast message to all users in a room
   */
  broadcastToRoom(roomId, message, excludeUserId = null) {
    if (!this.rooms.has(roomId)) return;
    
    this.rooms.get(roomId).forEach(userId => {
      if (userId !== excludeUserId) {
        const user = this.users.get(userId);
        if (user && user.ws.readyState === 1) { // WebSocket.OPEN
          user.ws.send(JSON.stringify(message));
        }
      }
    });
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(ws) {
    // Find and remove the disconnected user
    for (const [userId, user] of this.users.entries()) {
      if (user.ws === ws) {
        this.removeUserFromRoom(userId, user.roomId);
        break;
      }
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.users.size,
      roomDetails: Array.from(this.rooms.entries()).map(([roomId, users]) => ({
        roomId,
        userCount: users.size,
        users: Array.from(users)
      }))
    };
  }

  /**
   * Stop the signaling server
   */
  stop() {
    if (this.server) {
      console.log('Stopping signaling server...');
      
      // Close all client connections
      this.users.forEach((user) => {
        if (user.ws.readyState === 1) {
          user.ws.close(1001, 'Server shutdown');
        }
      });
      
      // Clear data structures
      this.rooms.clear();
      this.users.clear();
      
      // Close server
      this.server.close(() => {
        console.log('Signaling server stopped');
      });
    }
  }

  /**
   * Cleanup inactive connections
   */
  cleanupConnections() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds timeout
    
    for (const [userId, user] of this.users.entries()) {
      if (user.ws.readyState !== 1 || (now - user.lastPing > timeout)) {
        console.log(`Cleaning up inactive user: ${userId}`);
        this.removeUserFromRoom(userId, user.roomId);
      }
    }
  }
}

/**
 * Room Management Utilities
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.roomSettings = new Map();
  }

  /**
   * Create a new room with specific settings
   */
  createRoom(roomId, settings = {}) {
    const defaultSettings = {
      maxParticipants: 10,
      isPrivate: false,
      requirePassword: false,
      password: null,
      allowRecording: true,
      allowScreenShare: true,
      autoEndAfter: null, // minutes
      createdAt: Date.now(),
      createdBy: null
    };

    this.roomSettings.set(roomId, { ...defaultSettings, ...settings });
    this.rooms.set(roomId, {
      participants: new Set(),
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    console.log(`Room ${roomId} created with settings:`, this.roomSettings.get(roomId));
    return true;
  }

  /**
   * Validate room access
   */
  validateRoomAccess(roomId, userId, password = null) {
    const settings = this.roomSettings.get(roomId);
    const room = this.rooms.get(roomId);

    if (!settings || !room) {
      return { valid: false, reason: 'Room not found' };
    }

    // Check max participants
    if (room.participants.size >= settings.maxParticipants) {
      return { valid: false, reason: 'Room is full' };
    }

    // Check password if required
    if (settings.requirePassword && settings.password !== password) {
      return { valid: false, reason: 'Invalid password' };
    }

    return { valid: true };
  }

  /**
   * Add participant to room
   */
  addParticipant(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants.add(userId);
      room.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Remove participant from room
   */
  removeParticipant(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants.delete(userId);
      room.lastActivity = Date.now();
      
      // Auto-delete empty rooms
      if (room.participants.size === 0) {
        this.deleteRoom(roomId);
      }
      return true;
    }
    return false;
  }

  /**
   * Delete room
   */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
    this.roomSettings.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  }

  /**
   * Get room info
   */
  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    const settings = this.roomSettings.get(roomId);
    
    if (!room || !settings) return null;

    return {
      roomId,
      participantCount: room.participants.size,
      maxParticipants: settings.maxParticipants,
      isPrivate: settings.isPrivate,
      allowRecording: settings.allowRecording,
      allowScreenShare: settings.allowScreenShare,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    };
  }

  /**
   * Cleanup inactive rooms
   */
  cleanupInactiveRooms(inactiveTimeout = 3600000) { // 1 hour default
    const now = Date.now();
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > inactiveTimeout && room.participants.size === 0) {
        this.deleteRoom(roomId);
      }
    }
  }
}

/**
 * Call Statistics and Analytics
 */
export class CallAnalytics {
  constructor() {
    this.callSessions = new Map();
    this.statistics = {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      peakConcurrentCalls: 0,
      currentConcurrentCalls: 0
    };
  }

  /**
   * Start tracking a call session
   */
  startCallSession(roomId, userId, metadata = {}) {
    const sessionId = `${roomId}-${userId}-${Date.now()}`;
    
    this.callSessions.set(sessionId, {
      roomId,
      userId,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      quality: {
        averageBitrate: 0,
        averageLatency: 0,
        packetLoss: 0,
        connectionDrops: 0
      },
      events: [],
      metadata
    });

    this.statistics.totalCalls++;
    this.statistics.currentConcurrentCalls++;
    
    if (this.statistics.currentConcurrentCalls > this.statistics.peakConcurrentCalls) {
      this.statistics.peakConcurrentCalls = this.statistics.currentConcurrentCalls;
    }

    return sessionId;
  }

  /**
   * End call session tracking
   */
  endCallSession(sessionId, reason = 'normal') {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.endReason = reason;

    this.statistics.totalDuration += session.duration;
    this.statistics.averageDuration = this.statistics.totalDuration / this.statistics.totalCalls;
    this.statistics.currentConcurrentCalls = Math.max(0, this.statistics.currentConcurrentCalls - 1);

    console.log(`Call session ${sessionId} ended:`, {
      duration: session.duration,
      reason: reason
    });
  }

  /**
   * Record call event
   */
  recordCallEvent(sessionId, eventType, eventData = {}) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    session.events.push({
      type: eventType,
      timestamp: Date.now(),
      data: eventData
    });
  }

  /**
   * Update call quality metrics
   */
  updateQualityMetrics(sessionId, qualityData) {
    const session = this.callSessions.get(sessionId);
    if (!session) return;

    // Simple averaging - in production you'd want more sophisticated metrics
    const quality = session.quality;
    const eventCount = session.events.filter(e => e.type === 'quality_update').length + 1;

    quality.averageBitrate = ((quality.averageBitrate * (eventCount - 1)) + qualityData.bitrate) / eventCount;
    quality.averageLatency = ((quality.averageLatency * (eventCount - 1)) + qualityData.latency) / eventCount;
    quality.packetLoss = Math.max(quality.packetLoss, qualityData.packetLoss);

    this.recordCallEvent(sessionId, 'quality_update', qualityData);
  }

  /**
   * Get call statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeSessions: this.callSessions.size,
      timestamp: Date.now()
    };
  }

  /**
   * Get session details
   */
  getSessionDetails(sessionId) {
    return this.callSessions.get(sessionId);
  }

  /**
   * Export call data for analysis
   */
  exportCallData(startDate = null, endDate = null) {
    const sessions = Array.from(this.callSessions.values());
    
    let filteredSessions = sessions;
    if (startDate || endDate) {
      filteredSessions = sessions.filter(session => {
        if (startDate && session.startTime < startDate) return false;
        if (endDate && session.startTime > endDate) return false;
        return true;
      });
    }

    return {
      sessions: filteredSessions,
      summary: {
        totalSessions: filteredSessions.length,
        totalDuration: filteredSessions.reduce((sum, s) => sum + s.duration, 0),
        averageDuration: filteredSessions.length > 0 
          ? filteredSessions.reduce((sum, s) => sum + s.duration, 0) / filteredSessions.length 
          : 0
      },
      exportedAt: Date.now()
    };
  }
}

// Export utility functions
export const SignalingUtils = {
  /**
   * Generate unique room ID
   */
  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate unique user ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Validate message format
   */
  validateMessage(message) {
    const requiredFields = ['type', 'timestamp'];
    const typeSpecificFields = {
      'join-room': ['roomId', 'userId'],
      'leave-room': ['roomId', 'userId'],
      'offer': ['roomId', 'userId', 'offer'],
      'answer': ['roomId', 'userId', 'answer'],
      'ice-candidate': ['roomId', 'userId', 'candidate']
    };

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in message)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Check type-specific fields
    if (message.type in typeSpecificFields) {
      for (const field of typeSpecificFields[message.type]) {
        if (!(field in message)) {
          return { valid: false, error: `Missing field for ${message.type}: ${field}` };
        }
      }
    }

    return { valid: true };
  },

  /**
   * Sanitize message data
   */
  sanitizeMessage(message) {
    // Remove potentially harmful fields
    const sanitized = { ...message };
    delete sanitized.__proto__;
    delete sanitized.constructor;
    
    // Ensure timestamp is a number
    if (sanitized.timestamp) {
      sanitized.timestamp = Number(sanitized.timestamp);
    }

    return sanitized;
  }
};