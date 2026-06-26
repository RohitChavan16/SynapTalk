/**
 * MediaCryptoService.js
 * Handles local Web Crypto API encryption, decryption, and safety validation
 * of media files (Zero-Knowledge Client-Side Encryption).
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'sh', 'apk', 'dmg', 'js', 'cmd', 'ps1', 'vbs'];

/**
 * ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Verify Magic Bytes of a buffer
 */
function validateMagicBytes(buffer, mimeType) {
  const bytes = new Uint8Array(buffer).subarray(0, 4);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  // Block MS-DOS Executables (MZ header)
  if (hex.startsWith('4D5A')) {
    throw new Error('Dangerous executable file disguised as media.');
  }

  // Validate common types if provided
  if (mimeType) {
    if (mimeType.startsWith('image/jpeg') && !hex.startsWith('FFD8FF')) {
      throw new Error('Invalid JPEG signature');
    }
    if (mimeType.startsWith('image/png') && !hex.startsWith('89504E47')) {
      throw new Error('Invalid PNG signature');
    }
    if (mimeType === 'application/pdf' && !hex.startsWith('25504446')) {
      throw new Error('Invalid PDF signature');
    }
    // Note: Video magic bytes (mp4/webm) are complex and not always at byte 0.
    // We primarily enforce blocking executables.
  }
}

export const MediaCryptoService = {
  validatePreUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      throw new Error("This file type is strictly prohibited for security reasons.");
    }

    if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
      throw new Error("Image exceeds 10MB limit.");
    }
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
      throw new Error("Video exceeds 50MB limit.");
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && file.size > MAX_DOCUMENT_SIZE) {
      throw new Error("Document exceeds 25MB limit.");
    }
  },

  async encryptMedia(file) {
    this.validatePreUpload(file);
    
    // Read file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Generate AES-GCM Key (256-bit)
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Generate 12-byte IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the file
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      arrayBuffer
    );

    // Hash the ciphertext with SHA-256
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encryptedBuffer);
    
    // Export key
    const rawKey = await window.crypto.subtle.exportKey("raw", key);

    return {
      encryptedBuffer,
      aesKey: arrayBufferToBase64(rawKey),
      iv: arrayBufferToBase64(iv),
      sha256: arrayBufferToBase64(hashBuffer),
      mimeType: file.type,
      size: file.size,
      name: file.name
    };
  },

  async decryptMedia(encryptedBuffer, base64Key, base64Iv, expectedSha256, expectedMimeType) {
    // 1. Verify Hash
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encryptedBuffer);
    const calculatedHash = arrayBufferToBase64(hashBuffer);
    
    if (calculatedHash !== expectedSha256) {
      throw new Error("Media integrity check failed! The file has been corrupted or modified.");
    }

    // 2. Import Key
    const rawKey = base64ToArrayBuffer(base64Key);
    const key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const iv = base64ToArrayBuffer(base64Iv);

    // 3. Decrypt
    let decryptedBuffer;
    try {
      decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        key,
        encryptedBuffer
      );
    } catch (err) {
      throw new Error("Decryption failed. The AES key or IV is invalid.");
    }

    // 4. Validate Magic Bytes (Malware protection)
    validateMagicBytes(decryptedBuffer, expectedMimeType);

    // 5. Create Object URL
    const blob = new Blob([decryptedBuffer], { type: expectedMimeType });
    return URL.createObjectURL(blob);
  }
};
