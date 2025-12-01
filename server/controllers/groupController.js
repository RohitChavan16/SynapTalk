import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { GroupMessage } from '../models/GroupMsg.js';
import { io, userSocketMap } from '../server.js';
import cloudinary from "../lib/cloudinary.js";


export const newGroup = async (req, res) => {
       try {
    const { name, description, privacy, members, groupPic } = req.body;

    if (!name || !members || members.length === 0) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
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
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({success: false, message: "Server Error" });
  }
}



export const getGroups = async(req, res) => {
    try{
     const userId = req.user._id; 
     const groups = await Group.find({ members: userId })
      .select("name description privacy groupPic admins members")
      .populate("admins", "fullName email profilePic")
      .populate("members", "fullName email profilePic");

     res.json({ success: true, groups });

    } catch(error){
      console.error("Error fetching groups:", error);
      res.status(500).json({ success: false, message: error.message });
    }
}





export const sendGrpMsg = async (req, res) => {
  try {
    const { groupId, text, image } = req.body;

    if (!groupId || (!text && !image)) {
      return res.status(400).json({ error: "groupId and message required" });
    }

    // Ensure user is part of the group
    const group = await Group.findById(groupId).populate("members", "_id");
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Save plain message
    const message = await GroupMessage.create({
      senderId: req.user._id,
      groupId,
      text,
      image
    });

    const populatedMsg = await message.populate("senderId", "fullName profilePic");
   
    io.to(groupId.toString()).emit("receiveGrpMsg", populatedMsg);
   
    res.status(201).json(populatedMsg);
  } catch (err) {
    console.error("Error in sendGrpMsg:", err);
    res.status(500).json({ error: "Failed to send group message" });
  }
};






export const getGrpMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    const messages = await GroupMessage.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group messages" });
  }
};


export const addExtraMem = async (req, res) => {
   try {
    const {grpId, members} = req.body;
    const userId = req.user._id;

    if (!grpId || !members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request. Group ID and members array required" 
      });
    }

    const group = await Group.findById(grpId)
    .populate("members", "_id fullName email profilePic")
    .populate("admins", "_id fullName email profilePic");

    if(!group){
      return res.status(400).json({success: false, message: "Group not found"});
    }
    
    const isAdmin = group.admins.some(admin =>
      admin._id.toString() === userId.toString()
    );

    if (!isAdmin) return res.status(403).json({ success: false, message: "Only admins can update the group" });

    const newMem = [...group.members, ...members];

    group.members = newMem;
 
    await group.save();

    res.status(200).json({success: true, message: "Member added", group});

   } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}













export const deleteMember = async (req, res) => {
   try {
     const memberId = req.params.id;
     const userId = req.user._id;
     const { groupId } = req.body;
     const group = await Group.findById(groupId);
    if(!group){
      return res.status(400).json({success: false, message: "Group not found"});
    }

    const isAdmin = group.admins.some(admin =>
      admin._id.toString() === userId.toString()
    );
    if (!isAdmin && memberId.toString() !== userId.toString()) return res.status(403).json({ success: false, message: "Only admins can remove members" });
    
    const isTargetAdmin = group.admins.some(admin =>
      admin._id.toString() === memberId.toString()
    );
    
    if (isTargetAdmin && group.admins.length === 1) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot remove the last admin" 
      });
    }

    const member = await User.findById(memberId);

    if(!member){
      res.status(400).json({success: false, message: "User not found"});
      return ;
    }

    group.members = group.members.filter(
      member => member._id.toString() !== memberId.toString()
    );
    
    group.admins = group.admins.filter(
      admin => admin._id.toString() !== memberId.toString()
    ); 
    
    await group.save();

    res.status(200).json({success: true, message: "Member Deleted", group})
   } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}













export const updateGrp = async (req, res) => {
    try {
   
    const groupId = req.params.id;
    const userId = req.user._id;
    const { name, description, groupPic } = req.body;

    const group = await Group.findById(groupId);
    if(!group){
      return res.status(400).json({success: false, message: "Group not found"});
    }

    const isAdmin = group.admins.some(admin =>
      admin._id.toString() === userId.toString()
    );
    if (!isAdmin) return res.status(403).json({ success: false, message: "Only admins can update the group" });
    
    if(groupPic && groupPic.startsWith("data:")) {
    const upload = await cloudinary.uploader.upload(groupPic);
    group.groupPic = upload.secure_url;
    }

    if (name) group.name = name;
    if (description) group.description = description;
    

    await group.save();
    
    res.status(200).json({success: true, message: "Updated successfully", group});

   } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}









export const getLatestGrpMsg = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error fetching latest group messages:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};