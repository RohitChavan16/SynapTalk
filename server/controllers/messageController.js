import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import {io} from "../server.js";
import { publishMessageEvent } from "../lib/messageBus.js";
import logger from "../lib/logger.js";
import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const getUsersForSidebar = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // Include publicKey when fetching users
    const filteredUsers = await User.find(
      { _id: { $ne: userId } },
      "fullName email publicKey profilePic bio"
    );

    // Aggregate unseen messages grouped by senderId
    const unseenCounts = await Message.aggregate([
      { 
        $match: { 
          receiverId: new mongoose.Types.ObjectId(userId), 
          seen: false 
        } 
      },
      { 
        $group: { 
          _id: "$senderId", 
          count: { $sum: 1 } 
        } 
      }
    ]);

    const unseenMessages = {};
    unseenCounts.forEach((item) => {
      unseenMessages[item._id.toString()] = item.count;
    });

    res.json({ success: true, users: filteredUsers, unseenMessages });
});

export const getMessages = catchAsync(async (req, res, next) => {
    const {id: selectedUserId} = req.params;
    const { cursor, limit = 50 } = req.query;
    const myId = req.user._id;
     if (!selectedUserId || !mongoose.Types.ObjectId.isValid(selectedUserId)) {
      return next(new AppError(`Invalid user ID: ${selectedUserId}`, 400));
    }
    const selectedUserObjectId = new mongoose.Types.ObjectId(selectedUserId);
    const myObjectId = new mongoose.Types.ObjectId(myId);
    
    const query = {
      $or: [
        {senderId: myObjectId, receiverId: selectedUserObjectId},
        {senderId: selectedUserObjectId, receiverId: myObjectId},
      ]
    };

    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    let messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    messages.reverse();

    const updateResult = await Message.updateMany(
      {senderId: selectedUserId, receiverId: myId, seen: false}, 
      {seen: true}
    );

    if (updateResult.modifiedCount > 0) {
      const senderRoom = `user_${selectedUserId}`;
      io.to(senderRoom).emit("messagesSeen", { byUserId: myId.toString() });
    }

    // In True E2EE, the server NEVER decrypts messages. 
    // We simply return the raw ciphertext payloads for both v1 and v2.
    // The frontend is responsible for all decryption.
    
    res.json({
      success: true, 
      messages: messages,
      nextCursor: messages.length === parseInt(limit) ? messages[0]._id : null
    });
});











export const markMessageSeen = catchAsync(async (req, res, next) => {
    const {id} = req.params;
    const msg = await Message.findByIdAndUpdate(id, {seen: true});
    
    console.log("markMessageSeen CALLED for msg id:", id, "senderId:", msg?.senderId);
    if (msg && msg.senderId) {
      const senderRoom = `user_${msg.senderId.toString()}`;
      console.log("EMITTING messageSeen and messagesSeen to sender room:", senderRoom);
      io.to(senderRoom).emit("messageSeen", { byUserId: req.user._id.toString(), messageId: id });
      io.to(senderRoom).emit("messagesSeen", { byUserId: req.user._id.toString() });
    }
    
    res.json({success: true});
});









export const sendMessage = catchAsync(async (req, res, next) => {
    const { 
      cryptoVersion,
      senderKeyId,
      receiverKeyId,
      ephemeralPublicKey,
      wrappedAESKey,
      iv,
      encryptedMessage,
      image,
      text,
      idempotencyKey 
    } = req.body;
    
    if (!idempotencyKey) {
        return next(new AppError("idempotencyKey is required", 400));
    }

    if ((cryptoVersion === 2 || !cryptoVersion) && text) {
      return next(new AppError("Plaintext payload forbidden for E2EE messaging", 400));
    }
    
    const receiverId = req.params.id;
    const senderId = req.user._id;
    
    let imageUrl;
    if(image) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      } catch (err) {
        if (!encryptedMessage) {
          return next(new AppError("Failed to upload image. Please try again.", 502));
        }
      }
    }

    let newMessage;
    try {
        newMessage = await Message.create({
          senderId,
          receiverId,
          cryptoVersion: cryptoVersion || 2,
          senderKeyId,
          receiverKeyId,
          ephemeralPublicKey,
          wrappedAESKey,
          iv,
          encryptedMessage,
          image: imageUrl,
          idempotencyKey,
          status: 'SENT'
        });
    } catch (err) {
        if (err.code === 11000) {
            // Idempotency: duplicate message detected, return existing
            newMessage = await Message.findOne({ senderId, receiverId, idempotencyKey });
        } else {
            throw err;
        }
    }

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic");
      
    // Publish to Redis Stream instead of direct Socket.io emit
    await publishMessageEvent('direct', newMessage._id, receiverId);
    
    res.json({success: true, newMessage: populatedMessage});
});










// Get user's public key (for encryption by others)
export const getUserPublicKey = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    
    const user = await User.findById(userId, 'publicKey');
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    
    res.json({ success: true, publicKey: user.publicKey });
});




export const getLatestMessages = catchAsync(async (req, res, next) => {
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
          cryptoVersion: 1,
          senderKeyId: 1,
          receiverKeyId: 1,
          ephemeralPublicKey: 1,
          wrappedAESKey: 1,
          iv: 1,
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
});


