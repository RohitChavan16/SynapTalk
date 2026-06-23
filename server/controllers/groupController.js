import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { GroupMessage } from '../models/GroupMsg.js';
import { io, userSocketMap } from '../server.js';
import cloudinary from "../lib/cloudinary.js";
import AppError from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import logger from "../lib/logger.js";
import mongoose from "mongoose";

export const newGroup = catchAsync(async (req, res, next) => {
    const { name, description, privacy, members, groupPic } = req.body;

    if (!name || !members || members.length === 0) {
      return next(new AppError("Group name and members are required", 400));
    }

    let uploadedImageURL = null;

    const memberIds = members.map(m => m._id ? m._id : m);
    const allMembers = [...new Set([...memberIds, req.user._id.toString()])];
    if (groupPic) {
    const upload = await cloudinary.uploader.upload(groupPic);
    uploadedImageURL = upload.secure_url;
    }
    const group = new Group({
      name,
      description,
      privacy,
      members: allMembers,
      groupPic: uploadedImageURL, 
      admins: [req.user._id],
    });

    const savedGroup = await group.save();

      await User.updateMany(
      { _id: { $in: allMembers } },
      { $addToSet: { groups: savedGroup._id } } // $addToSet avoids duplicates
    );

    // 🔹 Also add for creator (if not already in members)
    if (!memberIds.includes(req.user._id.toString())) {
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { groups: savedGroup._id },
      });
    }
    

    res.status(201).json({success: true, message: "New Group Created Successfully"});
});

export const getGroups = catchAsync(async(req, res, next) => {
     const userId = req.user._id; 
     const groups = await Group.find({ members: userId })
      .select("name description privacy groupPic admins members")
      .populate("admins", "fullName email profilePic")
      .populate("members", "fullName email profilePic");

     res.json({ success: true, groups });
});

export const sendGrpMsg = catchAsync(async (req, res, next) => {
    const { groupId, text, image } = req.body;

    if (!groupId || (!text && !image)) {
      return next(new AppError("groupId and message required", 400));
    }

    // Ensure user is part of the group
    const group = await Group.findById(groupId).populate("members", "_id");
    if (!group) return next(new AppError("Group not found", 404));

    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return next(new AppError("You are not a member of this group", 403));
    }

    let imageUrl = null;
    if (image) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      } catch (err) {
        logger.error("Cloudinary upload error in sendGrpMsg:", err);
        if (!text) {
          return next(new AppError("Failed to upload image. Upstream service unavailable.", 502));
        }
      }
    }

    // Save plain message
    const message = await GroupMessage.create({
      senderId: req.user._id,
      groupId,
      text,
      image: imageUrl
    });

    const populatedMsg = await message.populate("senderId", "fullName profilePic");
   
    io.to(groupId.toString()).emit("receiveGrpMsg", populatedMsg);
   
    res.status(201).json(populatedMsg);
});






export const getGrpMessages = catchAsync(async (req, res, next) => {
    const { groupId } = req.params;
    const { cursor, limit = 50 } = req.query;

    const query = { groupId };
    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    let messages = await GroupMessage.find(query)
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    messages.reverse();

    res.json({
      success: true,
      messages: messages,
      nextCursor: messages.length === parseInt(limit) ? messages[0]._id : null
    });
});


export const addExtraMem = catchAsync(async (req, res, next) => {
    const {grpId, members} = req.body;
    const userId = req.user._id;

    if (!grpId || !members || !Array.isArray(members) || members.length === 0) {
      return next(new AppError("Invalid request. Group ID and members array required", 400));
    }

    const groupCheck = await Group.findById(grpId).select("admins");

    if(!groupCheck){
      return next(new AppError("Group not found", 404));
    }
    
    const isAdmin = groupCheck.admins.some(admin =>
      admin.toString() === userId.toString()
    );

    if (!isAdmin) return next(new AppError("Only admins can update the group", 403));

    // Atomic update prevents duplicates and handles concurrent updates
    const updatedGroup = await Group.findByIdAndUpdate(
      grpId,
      { $addToSet: { members: { $each: members } } },
      { new: true }
    )
    .populate("members", "_id fullName email profilePic")
    .populate("admins", "_id fullName email profilePic");

    res.status(200).json({success: true, message: "Member added", group: updatedGroup});
});













export const deleteMember = catchAsync(async (req, res, next) => {
     const memberId = req.params.id;
     const userId = req.user._id;
     const { groupId } = req.body;
     const group = await Group.findById(groupId);
    if(!group){
      return next(new AppError("Group not found", 404));
    }

    const isAdmin = group.admins.some(admin =>
      admin._id.toString() === userId.toString()
    );
    if (!isAdmin && memberId.toString() !== userId.toString()) return next(new AppError("Only admins can remove members", 403));
    
    const isTargetAdmin = group.admins.some(admin =>
      admin._id.toString() === memberId.toString()
    );
    
    if (isTargetAdmin && group.admins.length === 1) {
      return next(new AppError("Cannot remove the last admin", 400));
    }

    const member = await User.findById(memberId);

    if(!member){
      return next(new AppError("User not found", 404));
    }

    group.members = group.members.filter(
      member => member._id.toString() !== memberId.toString()
    );
    
    group.admins = group.admins.filter(
      admin => admin._id.toString() !== memberId.toString()
    ); 
    
    await group.save();

    res.status(200).json({success: true, message: "Member Deleted", group})
});













export const updateGrp = catchAsync(async (req, res, next) => {
    const groupId = req.params.id;
    const userId = req.user._id;
    const { name, description, groupPic } = req.body;

    const group = await Group.findById(groupId);
    if(!group){
      return next(new AppError("Group not found", 404));
    }

    const isAdmin = group.admins.some(admin =>
      admin._id.toString() === userId.toString()
    );
    if (!isAdmin) return next(new AppError("Only admins can update the group", 403));
    
    if(groupPic && groupPic.startsWith("data:")) {
    const upload = await cloudinary.uploader.upload(groupPic);
    group.groupPic = upload.secure_url;
    }

    if (name) group.name = name;
    if (description) group.description = description;
    

    await group.save();
    
    res.status(200).json({success: true, message: "Updated successfully", group});
});









export const getLatestGrpMsg = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // Get all groups the user is part of
    const groups = await Group.find({ members: userId });
    
    if (!groups || groups.length === 0) {
      return res.json({ success: true, messages: [] });
    }

    const groupIds = groups.map(g => g._id);

    // Get the latest message for each group
    const latestMessages = await Promise.all(
      groupIds.map(async (groupId) => {
        const latestMsg = await GroupMessage.findOne({ groupId })
          .sort({ createdAt: -1 })
          .populate('senderId', 'fullName profilePic')
          .lean();

        if (!latestMsg) return null;

        return {
          _id: latestMsg._id,
          groupId: groupId,
          text: latestMsg.text,
          image: latestMsg.image,
          createdAt: latestMsg.createdAt,
          sender: latestMsg.senderId,  // ✅ This is correct after populate
          isSender: latestMsg.senderId._id.toString() === userId.toString()
        };
      })
    );

    // Filter out null values (groups with no messages)
    const validMessages = latestMessages.filter(msg => msg !== null);

    return res.json({ success: true, messages: validMessages });
});