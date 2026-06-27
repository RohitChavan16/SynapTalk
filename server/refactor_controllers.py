import re

# Refactor messageController.js
with open("controllers/messageController.js", "r", encoding="utf-8") as f:
    content = f.read()

# Add publishMessageEvent import
content = content.replace(
    'import {io, userSocketMap} from "../server.js";',
    'import {io} from "../server.js";\nimport { publishMessageEvent } from "../lib/messageBus.js";'
)

# Refactor sendMessage
def replace_send_message(m):
    return """export const sendMessage = catchAsync(async (req, res, next) => {
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
});"""

content = re.sub(r'export const sendMessage = catchAsync\(async \(req, res, next\) => \{[\s\S]*?res\.json\(\{success: true, newMessage\}\);\n\}\);', replace_send_message, content)

with open("controllers/messageController.js", "w", encoding="utf-8") as f:
    f.write(content)

# Refactor groupController.js
with open("controllers/groupController.js", "r", encoding="utf-8") as f:
    grp_content = f.read()

grp_content = grp_content.replace(
    "import { io, userSocketMap } from '../server.js';",
    "import { io } from '../server.js';\nimport { publishMessageEvent } from '../lib/messageBus.js';"
)

def replace_send_grp_msg(m):
    return """export const sendGrpMsg = catchAsync(async (req, res, next) => {
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
});"""

grp_content = re.sub(r'export const sendGrpMsg = catchAsync\(async \(req, res, next\) => \{[\s\S]*?res\.status\(201\)\.json\(populatedMsg\);\n\}\);', replace_send_grp_msg, grp_content)

with open("controllers/groupController.js", "w", encoding="utf-8") as f:
    f.write(grp_content)

print("done")
