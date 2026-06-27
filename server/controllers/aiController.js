import { GoogleGenerativeAI } from "@google/generative-ai";
import { io } from "../server.js";
import Message from "../models/Message.js";
import { GroupMessage } from "../models/GroupMsg.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

import crypto from "crypto";
import { publishMessageEvent } from "../lib/messageBus.js";

export const handleAIMessage = async (req, res) => {
  try {
    const { text, receiverId, groupId } = req.body;
    const senderId = req.user._id;

    const aiQuery = text.replace(/@saras\s*/i, "").trim();

    if (!aiQuery) {
      return res.status(400).json({ error: "No message provided for AI" });
    }

    if (aiQuery.length > 1000) {
      return res.status(400).json({ error: "Message exceeds the maximum limit of 1000 characters." });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite"
    });
    
    const result = await model.generateContent(aiQuery);
    const aiResponse = result.response.text();

    let savedMessage;

    
    if (receiverId) {
      savedMessage = new Message({
        senderId: senderId,
        receiverId: receiverId,
        text: `🤖 Saras AI: ${aiResponse}`,
        seen: false,
        status: 'SENT',
        idempotencyKey: crypto.randomUUID()
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");
      await savedMessage.populate("receiverId", "fullName profilePic");

      await publishMessageEvent('direct', savedMessage._id, receiverId);
    }
   
    else if (groupId) {
      savedMessage = new GroupMessage({
        groupId: groupId,
        senderId: senderId,
        text: `🤖 Saras AI: ${aiResponse}`,
        idempotencyKey: crypto.randomUUID()
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");

      await publishMessageEvent('group', savedMessage._id, groupId);
    }

    res.status(200).json(savedMessage);
  } catch (error) {
    console.error("Error in handleAIMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 
