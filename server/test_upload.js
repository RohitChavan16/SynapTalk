import "dotenv/config";
import { StorageService } from "./lib/StorageService.js";
import crypto from "crypto";

async function testUpload() {
  try {
    const key = crypto.randomUUID();
    const sigData = await StorageService.generateUploadSignature(key);
    console.log("Generated URL:", sigData.uploadUrl);

    const buffer = Buffer.from("Hello Minio!");
    
    console.log("Uploading with fetch...");
    const response = await fetch(sigData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: buffer
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Upload failed!", response.status, text);
    } else {
      console.log("Upload success!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testUpload();
