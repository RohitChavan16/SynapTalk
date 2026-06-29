import { v4 as uuidv4 } from "uuid";
import { StorageService } from "../lib/StorageService.js";
import Attachment from "../models/Attachment.js";
import { catchAsync } from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Generates a pre-signed URL for direct-to-S3/R2 uploads
export const getUploadSignature = catchAsync(async (req, res, next) => {
  const { size, attachmentId } = req.body;
  
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (size && size > MAX_SIZE) {
    return next(new AppError("File size exceeds 50MB limit", 400));
  }

  let r2Key;
  let attachment;

  // Idempotency: reuse existing UPLOADING attachment if provided
  if (attachmentId) {
    attachment = await Attachment.findOne({ _id: attachmentId, userId: req.user._id, status: "UPLOADING" });
  }

  if (attachment) {
    r2Key = attachment.r2Key;
  } else {
    r2Key = uuidv4();
    attachment = await Attachment.create({
      r2Key,
      userId: req.user._id,
      groupId: req.body.groupId || null,
      status: "UPLOADING",
      size
    });
  }

  // Generate signature using abstract StorageService
  const { uploadUrl, downloadUrl } = await StorageService.generateUploadSignature(r2Key);

  res.status(200).json({
    status: "success",
    uploadUrl,
    downloadUrl,
    r2Key,
    attachmentId: attachment._id
  });
});

// Update attachment status when upload completes
export const markUploadComplete = catchAsync(async (req, res, next) => {
  const { attachmentId } = req.body;

  const attachment = await Attachment.findOne({ _id: attachmentId, userId: req.user._id });
  
  if (!attachment) {
    return next(new AppError("Attachment not found", 404));
  }

  attachment.status = "UPLOADED";
  await attachment.save();

  res.status(200).json({
    status: "success",
    attachment
  });
});
