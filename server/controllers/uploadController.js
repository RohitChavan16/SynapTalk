import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import s3Client, { bucketName } from "../lib/s3.js";
import Attachment from "../models/Attachment.js";
import { catchAsync } from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

// Generates a pre-signed URL for direct-to-S3/R2 uploads
export const getUploadSignature = catchAsync(async (req, res, next) => {
  const { mimeType, size } = req.body;
  
  if (!mimeType) {
    return next(new AppError("mimeType is required", 400));
  }
  
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (size && size > MAX_SIZE) {
    return next(new AppError("File size exceeds 50MB limit", 400));
  }

  const r2Key = uuidv4();
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: r2Key,
    ContentType: mimeType,
  });

  // URL expires in 15 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  const attachment = await Attachment.create({
    r2Key,
    userId: req.user._id,
    groupId: req.body.groupId || null,
    status: "UPLOADING",
    size,
    mimeType
  });

  res.status(200).json({
    status: "success",
    uploadUrl,
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
