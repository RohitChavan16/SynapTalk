import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  r2Key: { type: String, required: true, unique: true }, // The S3/R2 UUID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  status: { 
    type: String, 
    enum: ["UPLOADING", "UPLOADED", "ATTACHED", "ORPHANED", "DELETED"],
    default: "UPLOADING"
  },
  size: { type: Number },
  mimeType: { type: String }
}, { timestamps: true });

// Index for garbage collection of orphaned uploads
attachmentSchema.index({ status: 1, createdAt: 1 });
// Index for finding attachments by message
attachmentSchema.index({ messageId: 1 });
attachmentSchema.index({ groupId: 1 });

const Attachment = mongoose.model("Attachment", attachmentSchema);

export default Attachment;
