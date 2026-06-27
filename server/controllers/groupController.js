import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { GroupMessage } from '../models/GroupMsg.js';
import { io } from '../server.js';
import { publishMessageEvent } from '../lib/messageBus.js';
import cloudinary from "../lib/cloudinary.js";
import AppError from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import logger from "../lib/logger.js";
import mongoose from "mongoose";
import crypto from "crypto";

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
      owner: req.user._id,
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
      .select("name description privacy groupPic admins members owner migrationData e2eeMemberStatus")
      .populate("admins", "fullName email profilePic")
      .populate("members", "fullName email profilePic publicKey"); // added publicKey for members

     // Fallback for existing groups without an owner
     for (let grp of groups) {
       if (!grp.owner && grp.admins && grp.admins.length > 0) {
         grp.owner = grp.admins[0]._id;
         await Group.updateOne({ _id: grp._id }, { owner: grp.owner });
       }
     }

     res.json({ success: true, groups });
});

export const sendGrpMsg = catchAsync(async (req, res, next) => {
    const { groupId, text, image, ciphertext, iv, senderKeyId, signature, ratchetIndex, idempotencyKey } = req.body;

    if (!groupId || (!text && !image && !ciphertext) || !idempotencyKey) {
      return next(new AppError("groupId, message, and idempotencyKey required", 400));
    }

    const group = await Group.findById(groupId).populate("members", "_id");
    if (!group) return next(new AppError("Group not found", 404));

    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return next(new AppError("You are not a member of this group", 403));
    }

    if (group.migrationData?.state === 'E2EE_ACTIVE' && !ciphertext) {
      return next(new AppError("End-to-End Encryption is strictly enforced. Plaintext messages are rejected.", 400));
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

    let message;
    try {
        message = await GroupMessage.create({
          senderId: req.user._id,
          groupId,
          text,
          image: imageUrl,
          ciphertext,
          iv,
          senderKeyId,
          signature,
          ratchetIndex,
          idempotencyKey
        });
    } catch (err) {
        if (err.code === 11000) {
            message = await GroupMessage.findOne({ senderId: req.user._id, groupId, idempotencyKey });
        } else {
            throw err;
        }
    }

    const populatedMsg = await message.populate("senderId", "fullName profilePic");
   
    await publishMessageEvent('group', message._id, groupId);
   
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

// --- Phase C: Migration State Machine ---

const verifyMigrationSignature = async (groupId, targetState, epoch, signatureBase64, publicKeyBase64) => {
    if (!signatureBase64 || !publicKeyBase64) return false;
    try {
        const signature = Buffer.from(signatureBase64, 'base64');
        const spki = Buffer.from(publicKeyBase64, 'base64');
        const publicKey = await crypto.webcrypto.subtle.importKey(
            "spki",
            spki,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"]
        );
        const data = new TextEncoder().encode(`${groupId}:${targetState}:${epoch}`);
        return await crypto.webcrypto.subtle.verify(
            { name: "ECDSA", hash: { name: "SHA-256" } },
            publicKey,
            signature,
            data
        );
    } catch (err) {
        logger.error("Signature verification error:", err);
        return false;
    }
};

const handleStateTransition = async (req, res, next, targetState) => {
    const { id } = req.params;
    const { epoch, signature } = req.body;
    
    if (epoch === undefined || !signature) {
        return next(new AppError("epoch and signature are required for state transitions", 400));
    }

    const group = await Group.findById(id).populate("owner", "signaturePublicKey");
    if (!group) return next(new AppError("Group not found", 404));
    
    if (!group.owner) {
        return next(new AppError("Group has no owner assigned. Cannot perform cryptographic transitions.", 400));
    }

    if (group.owner._id.toString() !== req.user._id.toString()) {
        return next(new AppError("Only the group owner can authorize security state transitions", 403));
    }

    if (!group.owner.signaturePublicKey) {
         return next(new AppError("Owner has not uploaded a signature public key. Cannot verify transition.", 400));
    }

    if (epoch <= group.migrationData.epoch) {
         return next(new AppError("New epoch must be strictly greater than current epoch to prevent replay attacks.", 400));
    }

    const isValid = await verifyMigrationSignature(id.toString(), targetState, epoch, signature, group.owner.signaturePublicKey);
    
    if (!isValid) {
        return next(new AppError("Invalid cryptographic signature. State transition rejected.", 400));
    }

    group.migrationData = {
        state: targetState,
        epoch: epoch,
        signature: signature,
        signedBy: group.owner._id
    };

    if (targetState === 'UPGRADING') {
        group.e2eeMemberStatus = group.members.map(memberId => ({
            userId: memberId,
            status: 'PENDING'
        }));
    }

    await group.save();
    
    io.to(id.toString()).emit("migrationStateChanged", { 
        groupId: id, 
        migrationData: group.migrationData 
    });
    
    res.status(200).json({ success: true, group });
};

export const startMigration = catchAsync(async (req, res, next) => {
  return handleStateTransition(req, res, next, 'UPGRADING');
});

export const markReady = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const group = await Group.findById(id);
  if (!group) return next(new AppError("Group not found", 404));
  
  const memberIndex = group.e2eeMemberStatus.findIndex(m => m.userId.toString() === req.user._id.toString());
  if (memberIndex !== -1) {
      group.e2eeMemberStatus[memberIndex].status = 'READY';
  } else {
      group.e2eeMemberStatus.push({ userId: req.user._id, status: 'READY' });
  }
  
  await group.save();
  res.status(200).json({ success: true, e2eeMemberStatus: group.e2eeMemberStatus });
});

export const verifyMigration = catchAsync(async (req, res, next) => {
  return handleStateTransition(req, res, next, 'READY');
});

export const activateE2EE = catchAsync(async (req, res, next) => {
  return handleStateTransition(req, res, next, 'E2EE_ACTIVE');
});

export const rollbackE2EE = catchAsync(async (req, res, next) => {
  return handleStateTransition(req, res, next, 'READY');
});

export const forcePlaintext = catchAsync(async (req, res, next) => {
  return handleStateTransition(req, res, next, 'UPGRADING');
});

// --- Ownership Transfer ---
export const transferOwnership = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { newOwnerId, epoch, signature } = req.body;

    if (!newOwnerId || epoch === undefined || !signature) {
        return next(new AppError("newOwnerId, epoch, and signature are required", 400));
    }

    const group = await Group.findById(id).populate("owner", "signaturePublicKey");
    if (!group) return next(new AppError("Group not found", 404));

    if (!group.owner) return next(new AppError("Group has no current owner", 400));

    if (group.owner._id.toString() !== req.user._id.toString()) {
        return next(new AppError("Only the current group owner can authorize an ownership transfer", 403));
    }

    if (epoch <= group.migrationData.epoch) {
         return next(new AppError("New epoch must be strictly greater than current epoch to prevent replay attacks.", 400));
    }

    const isValid = await verifyMigrationSignature(id.toString(), `TRANSFER:${newOwnerId}`, epoch, signature, group.owner.signaturePublicKey);
    
    if (!isValid) {
        return next(new AppError("Invalid cryptographic signature. Ownership transfer rejected.", 400));
    }

    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) return next(new AppError("New owner not found", 404));

    group.owner = newOwnerId;
    group.migrationData.epoch = epoch;
    
    await group.save();

    io.to(id.toString()).emit("migrationStateChanged", { 
        groupId: id, 
        owner: newOwnerId,
        migrationData: group.migrationData 
    });

    res.status(200).json({ success: true, group });
});