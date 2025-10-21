import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { GroupMessage } from '../models/GroupMsg.js';
import { io, userSocketMap } from '../server.js';

export const newGroup = async (req, res) => {
       try {
    const { name, description, privacy, members, groupPic } = req.body;

    if (!name || !members || members.length === 0) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
    }

    const memberIds = members.map(m => m._id ? m._id : m);
    const allMembers = [...new Set([...memberIds, req.user._id.toString()])];
    
    const group = new Group({
      name,
      description,
      privacy,
      members: allMembers,
      groupPic, 
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

    // Populate sender for frontend display
    const populatedMsg = await message.populate("senderId", "username avatar");
   
    // 🔔 Emit to group socket room
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


export const newMember = async (req, res) => {
   try {
   
   } catch (err) {
    res.status(500).json({ error: "Failed to add new member" });
  }
}

export const deleteMember = async (req, res) => {
   try {
   
   } catch (err) {
    res.status(500).json({ error: "Failed to delete member" });
  }
}