import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client, { bucketName } from "./s3.js";
import dotenv from "dotenv";

dotenv.config();

export class StorageService {
  /**
   * Generates a pre-signed URL for client-side uploads.
   * @param {string} key - The unique storage key (e.g., UUID)
   * @returns {Promise<{uploadUrl: string, downloadUrl: string, key: string}>}
   */
  static async generateUploadSignature(key) {
    // We enforce 'application/octet-stream' to preserve zero-knowledge of the actual MIME type.
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: "application/octet-stream",
    });

    // URL expires in 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    
    let downloadUrl;
    
    // Support private buckets that require presigned GET URLs (e.g., private S3/R2)
    if (process.env.AWS_S3_PRIVATE_DOWNLOADS === 'true') {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      // Generate a long-lived presigned URL (e.g. 7 days max for standard AWS, can be configured)
      // Note: If indefinite access is needed, private presigned URLs are not ideal. 
      // But for the scope of this migration, we implement it as requested.
      downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); 
    } else {
      // Construct the canonical download URL if a public domain is configured
      const publicDomain = process.env.AWS_ENDPOINT_PUBLIC || process.env.R2_PUBLIC_DOMAIN || "";
      downloadUrl = publicDomain ? `${publicDomain.replace(/\/$/, '')}/${key}` : `/${key}`;
    }

    return {
      uploadUrl,
      downloadUrl,
      key
    };
  }

  /**
   * Deletes an object from storage.
   * @param {string} key - The unique storage key
   */
  static async deleteAttachment(key) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    await s3Client.send(command);
  }
}
