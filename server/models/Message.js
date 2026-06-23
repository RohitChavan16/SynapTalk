import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
senderId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
receiverId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
text: {type: String },
encryptedMessage: { type: String }, 
encryptedKey: { type: String },     
hmac: { type: String }, 
image: {type: String },
reactions: [{ emoji: String, reactedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}}],
seen: {type: Boolean, default: false},
seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, {timestamps: true});

// Performance Indexes
messageSchema.index({ senderId: 1, receiverId: 1 }); // Used by getMessages 1:1 fetch
messageSchema.index({ senderId: 1, createdAt: -1 }); // Used by getLatestMessages $or
messageSchema.index({ receiverId: 1, createdAt: -1 }); // Used by getLatestMessages $or
messageSchema.index({ receiverId: 1, seen: 1, senderId: 1 }); // Used by getUsersForSidebar aggregate

const Message = mongoose.model("Message", messageSchema);

export default Message;