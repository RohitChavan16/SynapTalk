import { GoogleGenerativeAI } from "@google/generative-ai";
import { userSocketMap, io } from "../server.js";
import Message from "../models/Message.js";
import { GroupMessage } from "../models/GroupMsg.js";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to get receiver socket ID
const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

export const handleAIMessage = async (req, res) => {
  try {
    const { text, receiverId, groupId } = req.body;
    const senderId = req.user._id;

    console.log("AI Message Request:", { text, receiverId, groupId, senderId });

    // Extract message after @meta
    const aiQuery = text.replace(/@meta\s*/i, "").trim();

    if (!aiQuery) {
      return res.status(400).json({ error: "No message provided for AI" });
    }

    // Get AI response from Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp"
    });
    
    const result = await model.generateContent(aiQuery);
    const aiResponse = result.response.text();

    console.log("AI Response:", aiResponse);

    let savedMessage;

    // Handle Private Chat
    if (receiverId) {
      // Save AI response as a message
      savedMessage = new Message({
        senderId: senderId,
        receiverId: receiverId,
        text: `🤖 Meta AI: ${aiResponse}`,
        seen: false,
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");
      await savedMessage.populate("receiverId", "fullName profilePic");

      console.log("Saved AI message for private chat:", savedMessage);

      // Emit to receiver via socket
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", savedMessage);
        console.log("Emitted to receiver:", receiverId);
      }

      // ✅ Don't emit to sender - frontend adds it locally
      // This prevents duplicate messages
    }
    // Handle Group Chat
    else if (groupId) {
      savedMessage = new GroupMessage({
        groupId: groupId,
        senderId: senderId,
        text: `🤖 Meta AI: ${aiResponse}`,
      });

      await savedMessage.save();
      await savedMessage.populate("senderId", "fullName profilePic");

      console.log("Saved AI message for group chat:", savedMessage);

      // ✅ Emit to all group members EXCEPT sender
      // Sender already has it in their local state
      io.to(groupId.toString()).except(`user_${senderId}`).emit("newGroupMessage", savedMessage);
      console.log("Emitted to group (excluding sender):", groupId);
    }

    // ✅ Return fully populated message to sender
    res.status(200).json(savedMessage);
  } catch (error) {
    console.error("Error in handleAIMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};