import "dotenv/config";
import { StorageService } from "./lib/StorageService.js";
import crypto from "crypto";

// Mock implementation of MediaCryptoService logic using node's crypto.webcrypto
const webcrypto = crypto.webcrypto;

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64ToArrayBuffer(base64) {
  return Buffer.from(base64, 'base64').buffer;
}

async function testFullFlow() {
  try {
    const textData = "This is a test image content";
    const dataBuffer = new TextEncoder().encode(textData).buffer;
    
    // 1. Encrypt
    const key = await webcrypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer
    );
    const hashBuffer = await webcrypto.subtle.digest("SHA-256", encryptedBuffer);
    const rawKey = await webcrypto.subtle.exportKey("raw", key);
    
    const payload = {
      aesKey: arrayBufferToBase64(rawKey),
      iv: arrayBufferToBase64(iv),
      sha256: arrayBufferToBase64(hashBuffer),
      mimeType: "text/plain",
      size: dataBuffer.byteLength
    };

    // 2. Get Upload Signature
    const r2Key = crypto.randomUUID();
    const sigData = await StorageService.generateUploadSignature(r2Key);
    
    // 3. Upload
    console.log("Uploading...");
    const uploadRes = await fetch(sigData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: Buffer.from(encryptedBuffer)
    });
    if (!uploadRes.ok) throw new Error("Upload failed: " + await uploadRes.text());

    // 4. Download
    console.log("Downloading from:", sigData.downloadUrl);
    const downloadRes = await fetch(sigData.downloadUrl);
    if (!downloadRes.ok) throw new Error("Download failed: " + await downloadRes.text());
    
    const downloadedBuffer = await downloadRes.arrayBuffer();
    
    console.log(`Original encrypted size: ${encryptedBuffer.byteLength}, Downloaded size: ${downloadedBuffer.byteLength}`);
    
    // 5. Decrypt
    const downloadedHashBuffer = await webcrypto.subtle.digest("SHA-256", downloadedBuffer);
    const downloadedHash = arrayBufferToBase64(downloadedHashBuffer);
    
    if (downloadedHash !== payload.sha256) {
      console.error("HASH MISMATCH!");
      console.error("Expected:", payload.sha256);
      console.error("Got:", downloadedHash);
    } else {
      console.log("Hashes match!");
    }
    
  } catch (err) {
    console.error("Error:", err);
  }
}

testFullFlow();
