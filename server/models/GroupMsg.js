import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    image: { type: String },
    
    // E2EE Payload
    ciphertext: { type: String },
    iv: { type: String },
    senderKeyId: { type: String },
    signature: { type: String },
    ratchetIndex: { type: Number },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true }
);

// Performance Indexes
groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ senderId: 1, groupId: 1, idempotencyKey: 1 }, { unique: true });

export const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
