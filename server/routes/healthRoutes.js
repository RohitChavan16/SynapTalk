import express from 'express';
import mongoose from 'mongoose';
import { io } from '../server.js';

const healthRouter = express.Router();

healthRouter.get('/', (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const clientsCount = io ? io.engine.clientsCount : 0;

  res.status(200).json({
    status: isMongoConnected ? 'ok' : 'degraded',
    api: 'healthy',
    mongo: isMongoConnected ? 'connected' : 'disconnected',
    socket: 'active',
    activeConnections: clientsCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default healthRouter;
