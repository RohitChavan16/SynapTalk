import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import {io, userSocketMap} from "../server.js";
import { aes, ecc, hmac } from "../crypto/crypto.js"; 

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    // Include publicKey when fetching users
    const filteredUsers = await User.find(
      { _id: { $ne: userId } },
      "fullName email publicKey profilePic"
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

    const messages = await Message.find({
      $or: [
        {senderId: myId, receiverId: selectedUserId},
        {senderId: selectedUserId, receiverId: myId},
      ]
    });

    await Message.updateMany({senderId: selectedUserId, receiverId: myId}, {seen: true});

    const decryptedMessages = messages.map((msg, index) => {
      try {
        console.log(`\n--- Processing Message ${index + 1}/${messages.length} ---`);
        console.log(`Message ID: ${msg._id}`);
        console.log(`Sender: ${msg.senderId}`);
        console.log(`Receiver: ${msg.receiverId}`);
        
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

        console.log('Encrypted message length:', msg.encryptedMessage.length);
        console.log('Encrypted key length:', msg.encryptedKey.length);
        console.log('Has HMAC:', !!msg.hmac);

        // Split encrypted data and IV
        const [encryptedData, iv] = msg.encryptedMessage.split(":");
        
        if (!encryptedData || !iv) {
          console.log('Invalid encrypted message format');
          return {
            ...msg._doc,
            text: '[Invalid encrypted message format]',
          };
        }

        console.log('Encrypted data length:', encryptedData.length);
        console.log('IV length:', iv.length);

        // Parse the stored JSON payload for session key decryption
        let keyPayload;
        try {
          keyPayload = JSON.parse(msg.encryptedKey);
          console.log('Key payload parsed successfully');
          console.log('Key payload keys:', Object.keys(keyPayload));
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

        console.log('Attempting to decrypt session key...');
        console.log('Current user ID:', currentUserId);
        console.log('Message sender ID:', messageSenderId);
        console.log('Message receiver ID:', messageReceiverId);

        try {
          // Try to decrypt with the appropriate key based on user role
          if (currentUserId === messageSenderId) {
            // I'm the sender, try sender key first
            console.log('Trying sender key...');
            if (keyPayload.senderKey) {
              sessionKey = ecc.decryptKey(keyPayload.senderKey, req.body.privateKey);
              console.log('Successfully decrypted with sender key');
            } else {
              throw new Error('Sender key not available in payload');
            }
          } else if (currentUserId === messageReceiverId) {
            // I'm the receiver, try receiver key first  
            console.log('Trying receiver key...');
            if (keyPayload.receiverKey) {
              sessionKey = ecc.decryptKey(keyPayload.receiverKey, req.body.privateKey);
              console.log('Successfully decrypted with receiver key');
            } else {
              throw new Error('Receiver key not available in payload');
            }
          } else {
            throw new Error('User is neither sender nor receiver of this message');
          }
        } catch (primaryError) {
          console.log('Primary key failed, trying fallback...');
          
          // Fallback: try the other key or legacy format
          try {
            if (keyPayload.encryptedKey) {
              // Legacy format fallback
              console.log('Trying legacy format...');
              sessionKey = ecc.decryptKey(keyPayload, req.body.privateKey);
              console.log('Successfully decrypted with legacy format');
            } else if (currentUserId === messageSenderId && keyPayload.receiverKey) {
              // Try receiver key as fallback
              console.log('Trying receiver key as fallback...');
              sessionKey = ecc.decryptKey(keyPayload.receiverKey, req.body.privateKey);
              console.log('Successfully decrypted with receiver key fallback');
            } else if (currentUserId === messageReceiverId && keyPayload.senderKey) {
              // Try sender key as fallback
              console.log('Trying sender key as fallback...');
              sessionKey = ecc.decryptKey(keyPayload.senderKey, req.body.privateKey);
              console.log('Successfully decrypted with sender key fallback');
            } else {
              throw primaryError;
            }
          } catch (fallbackError) {
            console.error('All decryption attempts failed');
            throw primaryError; // Throw the original error
          }
        }

        console.log('Session key decrypted successfully, length:', sessionKey.length);

        // Verify HMAC integrity
        console.log('Verifying message integrity...');
        if (!hmac.verifyHMAC(encryptedData, sessionKey, msg.hmac)) {
          console.log('HMAC verification failed');
          return {
            ...msg._doc,
            text: '[Message integrity verification failed]',
          };
        }
        console.log('HMAC verification successful');

        // Decrypt the actual message text using AES
        console.log('Decrypting message content...');
        const decryptedText = aes.decrypt(encryptedData, sessionKey, iv);
        console.log('Message decrypted successfully');

        return { 
          ...msg._doc, 
          text: decryptedText,
          decryptionStatus: 'success'
        };

      } catch (err) {
        console.error(`Message decryption error for ${msg._id}:`, err);
        console.error('Error stack:', err.stack);
        
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
    console.log(`\n=== Decryption Summary ===`);
    console.log(`Successfully decrypted: ${successCount}/${totalCount} messages`);

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
      text: text && !encryptedMessage ? text : undefined, // Only store plaintext if not encrypted
      image: imageUrl,
      encryptedMessage,
      encryptedKey,
      hmac: messageHMAC
    });

    // Send to receiver via socket with decrypted text for real-time display
    const receiverSocketId = userSocketMap[receiverId];
    if(receiverSocketId){
      // Create a version with decrypted text for real-time display
      const socketMessage = {
        ...newMessage._doc,
        text: text || newMessage.text, // Send original text for real-time display
        isRealTime: true // Flag to indicate this is a real-time message
      };
      
      io.to(receiverSocketId).emit("newMessage", socketMessage);
    }

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
          console.error('Bulk decrypt error:', error);
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