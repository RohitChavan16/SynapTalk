import express from 'express';

export const newGroup = async () => {
       try {
    const { name, description, privacy, members, groupPic } = req.body;

    if (!name || !members || members.length === 0) {
      return res.status(400).json({ success: false, message: "Group name and members are required" });
    }

    const group = new Group({
      name,
      description,
      privacy,
      members,
      groupPic, // optional: can be base64 or a URL
      admin: req.user._id, // if you want creator as admin
    });

    const savedGroup = await group.save();

    res.status(201).json({success: true, message: "New Group Created Successfully"});
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({success: false, message: "Server Error" });
  }
}