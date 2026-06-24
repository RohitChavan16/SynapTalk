import express from "express"
import { protectRoute } from "../middleware/auth.js";
import { getLatestMessages, getMessages, getUserPublicKey, getUsersForSidebar, markMessageSeen, sendMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/latest-msg", protectRoute, getLatestMessages);
messageRouter.post("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage);

// Deprecated decryption routes (Return 410 Gone)
messageRouter.post("/decrypt", protectRoute, (req, res) => res.status(410).json({ error: "Server-side decryption disabled for E2EE" }));
messageRouter.post("/bulk-decrypt", protectRoute, (req, res) => res.status(410).json({ error: "Server-side decryption disabled for E2EE" }));

export default messageRouter;