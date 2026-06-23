import express from "express"
import { protectRoute } from "../middleware/auth.js";
import { bulkDecryptMessages, decryptMessage, getLatestMessages, getMessages, getUserPublicKey, getUsersForSidebar, markMessageSeen, sendMessage } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.post("/decrypt", protectRoute, decryptMessage);
messageRouter.post("/bulk-decrypt", protectRoute, bulkDecryptMessages);
messageRouter.get("/latest-msg", protectRoute, getLatestMessages);
messageRouter.get("/public-key/:userId", protectRoute, getUserPublicKey);

messageRouter.post("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage);

export default messageRouter;