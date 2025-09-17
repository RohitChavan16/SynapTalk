import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';

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