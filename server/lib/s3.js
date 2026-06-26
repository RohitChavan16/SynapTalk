import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

// Create an S3 client.
// This works for AWS S3 or Cloudflare R2 if endpoint is provided.
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT || undefined, // For R2, e.g., https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy",
  },
  forcePathStyle: true, // often required for local minio or some S3 compatible services
});

export const bucketName = process.env.AWS_S3_BUCKET || "synaptalk-media";
export default s3Client;
