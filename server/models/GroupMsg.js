import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    image: { type: String },
  },
  { timestamps: true }
);

// Performance Indexes
groupMessageSchema.index({ groupId: 1, createdAt: -1 });

export const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
