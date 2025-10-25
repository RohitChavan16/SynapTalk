import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { handleAIMessage } from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.post("/message", protectRoute, handleAIMessage);

export default aiRouter;