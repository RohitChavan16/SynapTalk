import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import Attachment from "../models/Attachment.js";
import s3Client, { bucketName } from "../lib/s3.js";

// Garbage collect orphaned or deleted attachments
export const cleanupAttachments = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Find stale uploads (started > 24 hours ago but never attached)
    const orphanedUploads = await Attachment.find({
      status: { $in: ["UPLOADING", "UPLOADED"] },
      createdAt: { $lt: oneDayAgo }
    });

    // 2. Find explicitly deleted or orphaned attachments waiting for cleanup
    const pendingDeletions = await Attachment.find({
      status: "ORPHANED"
    });

    const toDelete = [...orphanedUploads, ...pendingDeletions];

    for (const attachment of toDelete) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: attachment.r2Key
        }));
        
        attachment.status = "DELETED";
        await attachment.save();
        console.log(`[Cron] Deleted attachment ${attachment.r2Key}`);
      } catch (err) {
        console.error(`[Cron] Failed to delete attachment ${attachment.r2Key}`, err);
      }
    }
  } catch (err) {
    console.error("[Cron] Error running attachment cleanup", err);
  }
};
