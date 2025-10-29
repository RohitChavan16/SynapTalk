import { GoogleGenerativeAI } from "@google/generative-ai";
import { userSocketMap, io } from "../server.js";
import Message from "../models/Message.js";
import { GroupMessage } from "../models/GroupMsg.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

export const handleAIMessage = async (req, res) => {
  try {
    const { text, receiverId, groupId } = req.body;
    const senderId = req.user._id;

    const aiQuery = text.replace(/@saras\s*/i, "").trim();

    if (!aiQuery) {
      return res.status(400).json({ error: "No message provided for AI" });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp"
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
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");
      await savedMessage.populate("receiverId", "fullName profilePic");

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", savedMessage);
       
      }

    }
   
    else if (groupId) {
      savedMessage = new GroupMessage({
        groupId: groupId,
        senderId: senderId,
        text: `🤖 Saras AI: ${aiResponse}`,
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");


      io.to(groupId.toString()).except(`user_${senderId}`).emit("receiveGrpMsg", savedMessage);
      
    }

    res.status(200).json(savedMessage);
  } catch (error) {
    console.error("Error in handleAIMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 
