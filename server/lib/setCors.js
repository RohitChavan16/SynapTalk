import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import s3Client, { bucketName } from "./s3.js";

async function setCors() {
  const corsRules = {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        AllowedOrigins: ["*"],
        ExposeHeaders: ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
        MaxAgeSeconds: 3000
      }
    ]
  };

  const command = new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: corsRules
  });

  try {
    const response = await s3Client.send(command);
    console.log("CORS configuration successfully set for bucket:", bucketName);
  } catch (err) {
    console.error("Error setting CORS configuration:", err);
  }
}

setCors();
