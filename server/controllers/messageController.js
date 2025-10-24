import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import {io, userSocketMap} from "../server.js";
import { aes, ecc, hmac } from "../crypto/crypto.js"; 
import mongoose from "mongoose";

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    // Include publicKey when fetching users
    const filteredUsers = await User.find(
      { _id: { $ne: userId } },
      "fullName email publicKey profilePic bio"
    );

    const unseenMessages = {};
    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });

      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });

    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const {id: selectedUserId} = req.params;
    const myId = req.user._id;
     if (!selectedUserId || !mongoose.Types.ObjectId.isValid(selectedUserId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid user ID: ${selectedUserId}`
      });
    }
    const selectedUserObjectId = new mongoose.Types.ObjectId(selectedUserId);
    const myObjectId = new mongoose.Types.ObjectId(myId);
    const messages = await Message.find({
      $or: [
        {senderId: myObjectId, receiverId: selectedUserObjectId},
        {senderId: selectedUserObjectId, receiverId: myObjectId},
      ]
    });

    await Message.updateMany({senderId: selectedUserId, receiverId: myId}, {seen: true});

    const decryptedMessages = messages.map((msg, index) => {
      try {
       
        
        // Check if message has encrypted content
        if (!msg.encryptedMessage || !msg.encryptedKey || !msg.hmac) {
          console.log('Message not encrypted, returning as-is');
          return msg; // Return original message if not encrypted
        }

        // Check if we have private key for decryption
        if (!req.body.privateKey) {
          console.log('Private key not provided');
          return {
            ...msg._doc,
            text: '[Private key not provided for decryption]',
          };
        }

       

        // Split encrypted data and IV
        const [encryptedData, iv] = msg.encryptedMessage.split(":");
        
        if (!encryptedData || !iv) {
          console.log('Invalid encrypted message format');
          return {
            ...msg._doc,
            text: '[Invalid encrypted message format]',
          };
        }

       

        // Parse the stored JSON payload for session key decryption
        let keyPayload;
        try {
          keyPayload = JSON.parse(msg.encryptedKey);
         
        } catch (parseError) {
          console.error('Failed to parse key payload:', parseError);
          return {
            ...msg._doc,
            text: '[Invalid encryption key format]',
          };
        }

        // NEW: Determine which encrypted key to use based on sender/receiver
        let sessionKey;
        const currentUserId = myId.toString();
        const messageSenderId = msg.senderId.toString();
        const messageReceiverId = msg.receiverId.toString();

        

        try {
          
          if (currentUserId === messageSenderId) {
            
            if (keyPayload.senderKey) {
              sessionKey = ecc.decryptKey(keyPayload.senderKey, req.body.privateKey);
            } else {
              throw new Error('Sender key not available in payload');
            }
          } else if (currentUserId === messageReceiverId) {
            // I'm the receiver, try receiver key first  
            
            if (keyPayload.receiverKey) {
              sessionKey = ecc.decryptKey(keyPayload.receiverKey, req.body.privateKey);
              
            } else {
              throw new Error('Receiver key not available in payload');
            }
          } else {
            throw new Error('User is neither sender nor receiver of this message');
          }
        } catch (primaryError) {
          
          
          // Fallback: try the other key or legacy format
          try {
            if (keyPayload.encryptedKey) {
              // Legacy format fallback
              
              sessionKey = ecc.decryptKey(keyPayload, req.body.privateKey);
              
            } else if (currentUserId === messageSenderId && keyPayload.receiverKey) {
              // Try receiver key as fallback
              
              sessionKey = ecc.decryptKey(keyPayload.receiverKey, req.body.privateKey);
              
            } else if (currentUserId === messageReceiverId && keyPayload.senderKey) {
              // Try sender key as fallback
              
              sessionKey = ecc.decryptKey(keyPayload.senderKey, req.body.privateKey);
              
            } else {
              throw primaryError;
            }
          } catch (fallbackError) {
            console.error('All decryption attempts failed');
            throw primaryError; // Throw the original error
          }
        }

        

        // Verify HMAC integrity
        if (!hmac.verifyHMAC(encryptedData, sessionKey, msg.hmac)) {
         
          return {
            ...msg._doc,
            text: '[Message integrity verification failed]',
          };
        }
       

        // Decrypt the actual message text using AES
       
        const decryptedText = aes.decrypt(encryptedData, sessionKey, iv);
        console.log("12345");
        return { 
          ...msg._doc, 
          text: decryptedText,
          decryptionStatus: 'success'
        };

      } catch (err) {
        
        
        // Return message with error indicator
        return {
          ...msg._doc,
          text: `[Unable to decrypt: ${err.message}]`,
          decryptionStatus: 'failed'
        };
      }
    });

    // Count successful vs failed decryptions
    const successCount = decryptedMessages.filter(msg => msg.decryptionStatus === 'success').length;
    const totalCount = decryptedMessages.length;
    
    res.json({success: true, messages: decryptedMessages});
    
  } catch(error) {
    console.error('getMessages error:', error);
    res.json({success: false, message: error.message});
  }
}











export const markMessageSeen = async (req, res) => {
  try{
    const {id} = req.params;
    await Message.findByIdAndUpdate(id, {seen: true});
    res.json({success: true});
  } catch(error) {
    console.log(error.message);
    res.json({success: false, message: error.message});
  }
} 









export const sendMessage = async (req, res) => {
  try {
    const {text, image, receiverPublicKey} = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;
    
    let imageUrl;
    if(image) {
      const uploadResponse = await cloudinary.uploader.upload(image)
      imageUrl = uploadResponse.secure_url;
    }

    let encryptedMessage, encryptedKey, messageHMAC;
    
    if (text && receiverPublicKey) {
      // Generate a session key for this message
      const sessionKey = aes.generateKey();
      
      // Encrypt the message with the session key
      const { encryptedData, iv } = aes.encryptWithIV(text, sessionKey);
      encryptedMessage = `${encryptedData}:${iv}`;
      
      // NEW: Get sender's public key for dual encryption
      const senderUser = await User.findById(senderId, 'publicKey');
      
      if (!senderUser || !senderUser.publicKey) {
        throw new Error('Sender public key not found');
      }

      // Encrypt the session key for BOTH sender and receiver
      const senderKeyData = ecc.encryptKey(sessionKey, senderUser.publicKey);
      const receiverKeyData = ecc.encryptKey(sessionKey, receiverPublicKey);
      
      // Store both encrypted keys
      encryptedKey = JSON.stringify({
        senderKey: senderKeyData,
        receiverKey: receiverKeyData
      });
      
      // Generate HMAC for integrity check
      messageHMAC = hmac.generateHMAC(encryptedData, sessionKey);
    }
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text && !encryptedMessage ? text : undefined, // Only store plaintext if not encrypted for testing purpose only
      image: imageUrl,
      encryptedMessage,
      encryptedKey,
      hmac: messageHMAC
    });


    
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic");
    // Send to receiver via socket with decrypted text for real-time display
     const receiverRoom = `user_${receiverId}`;
   
   
      // Create a version with decrypted text for real-time display
      const socketMessage = {
        ...populatedMessage._doc,
        text: text || newMessage.text, // Send original text for real-time display
        senderId: populatedMessage.senderId,
        receiverId: populatedMessage.receiverId,
        isRealTime: true // Flag to indicate this is a real-time message
      };
      
      req.io.to(receiverRoom).emit("newMessage", socketMessage);
    
    
   
    res.json({success: true, newMessage});
  } catch(error) {
    console.log(error.message);
    res.json({success: false, message: error.message});
  }
}










export const decryptMessage = async (req, res) => {
  try {
    const { messageId, privateKey } = req.body;
    
    if (!privateKey) {
      return res.json({ success: false, message: "Private key required for decryption" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.json({ success: false, message: "Message not found" });
    }

    if (!message.encryptedMessage || !message.encryptedKey || !message.hmac) {
      return res.json({ success: false, message: "Message is not encrypted" });
    }

    try {
      const [encryptedData, iv] = message.encryptedMessage.split(':');
      
      // Parse the encrypted key data
      const keyPayload = JSON.parse(message.encryptedKey);
      
      // NEW: Try appropriate key based on user role
      let sessionKey;
      const currentUserId = req.user._id.toString();
      const messageSenderId = message.senderId.toString();
      
      if (currentUserId === messageSenderId && keyPayload.senderKey) {
        // User is sender, use sender key
        sessionKey = ecc.decryptKey(keyPayload.senderKey, privateKey);
      } else if (keyPayload.receiverKey) {
        // User is receiver, use receiver key
        sessionKey = ecc.decryptKey(keyPayload.receiverKey, privateKey);
      } else if (keyPayload.encryptedKey) {
        // Legacy format fallback
        sessionKey = ecc.decryptKey(keyPayload, privateKey);
      } else {
        throw new Error('No suitable encryption key found');
      }
      
      // Verify message integrity
      if (!hmac.verifyHMAC(encryptedData, sessionKey, message.hmac)) {
        return res.json({ success: false, message: "Message integrity check failed" });
      }
      
      // Decrypt the message
      const decryptedText = aes.decrypt(encryptedData, sessionKey, iv);
      
      res.json({ success: true, decryptedText });
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      res.json({ success: false, message: "Failed to decrypt message" });
    }
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};










// Get user's public key (for encryption by others)
export const getUserPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId, 'publicKey');
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    
    res.json({ success: true, publicKey: user.publicKey });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Bulk decrypt messages (for initial message load)
export const bulkDecryptMessages = async (req, res) => {
  try {
    const { messageIds, privateKey } = req.body;
    
    if (!privateKey || !messageIds || !Array.isArray(messageIds)) {
      return res.json({ success: false, message: "Invalid request data" });
    }

    const messages = await Message.find({ _id: { $in: messageIds } });
    const decryptedMessages = [];
    const currentUserId = req.user._id.toString();

    for (const message of messages) {
      if (message.encryptedMessage && message.encryptedKey && message.hmac) {
        try {
          const [encryptedData, iv] = message.encryptedMessage.split(':');

          // Parse encryptedKey first
          const keyPayload = JSON.parse(message.encryptedKey);

          // NEW: Determine correct key to use
          let sessionKey;
          const messageSenderId = message.senderId.toString();
          
          if (currentUserId === messageSenderId && keyPayload.senderKey) {
            // User is sender, use sender key
            sessionKey = ecc.decryptKey(keyPayload.senderKey, privateKey);
          } else if (keyPayload.receiverKey) {
            // User is receiver, use receiver key
            sessionKey = ecc.decryptKey(keyPayload.receiverKey, privateKey);
          } else if (keyPayload.encryptedKey) {
            // Legacy format fallback
            sessionKey = ecc.decryptKey(keyPayload, privateKey);
          } else {
            throw new Error('No suitable encryption key found');
          }

          // Verify HMAC
          if (hmac.verifyHMAC(encryptedData, sessionKey, message.hmac)) {
            const decryptedText = aes.decrypt(encryptedData, sessionKey, iv);
            decryptedMessages.push({
              messageId: message._id,
              decryptedText
            });
          } else {
            decryptedMessages.push({
              messageId: message._id,
              decryptedText: '[Message integrity verification failed]'
            });
          }
        } catch (error) {
          decryptedMessages.push({
            messageId: message._id,
            decryptedText: '[Unable to decrypt message]'
          });
        }
      }
    }

    res.json({ success: true, decryptedMessages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};




export const getLatestMessages = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", userId] },
              "$receiverId",
              "$senderId"
            ]
          },
          latestMessage: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$latestMessage" } },
      {
        $lookup: {
          from: "users",
          localField: "senderId",
          foreignField: "_id",
          as: "senderInfo"
        }
      },
      { $unwind: "$senderInfo" },
      {
        $lookup: {
          from: "users",
          localField: "receiverId",
          foreignField: "_id",
          as: "receiverInfo"
        }
      },
      { $unwind: { path: "$receiverInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: { $toString: "$_id" },
          text: 1,
          encryptedMessage: 1,
          encryptedKey: 1,
          image: 1,
          seen: 1,
          createdAt: 1,
          sender: "$senderInfo",
          receiver: "$receiverInfo",
          isSender: { $eq: ["$senderId", userId] }
        }
      }
    ]);

    res.json({ success: true, messages });
  } catch (error) {
    console.error("getLatestMessages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
