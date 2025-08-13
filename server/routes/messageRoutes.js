import express from "express"
import { protectRoute } from "../middleware/auth.js";
import { getMessages, getUsersForSidebar, markMessageSeen, sendMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage);

export default messageRouter;