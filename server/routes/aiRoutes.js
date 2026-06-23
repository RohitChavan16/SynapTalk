import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { handleAIMessage } from "../controllers/aiController.js";
import { aiRateLimitMiddleware } from "../middleware/rateLimiter.js";

const aiRouter = express.Router();

aiRouter.post("/message", protectRoute, aiRateLimitMiddleware, handleAIMessage);

export default aiRouter;