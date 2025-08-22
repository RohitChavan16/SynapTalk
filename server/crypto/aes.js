import crypto from 'crypto';

export const aes = {
  // Generate a random AES-256 key
  generateKey: () => {
    return crypto.randomBytes(32); // 256-bit key
  },

  // Generate a random initialization vector
  generateIV: () => {
    return crypto.randomBytes(16); // 128-bit IV for CBC
  },

  // Encrypt data using AES-256-CBC
  encrypt: (text, key, iv = null) => {
    if (!iv) iv = aes.generateIV();
    
    if (typeof key === 'string') {
      key = Buffer.from(key, 'base64'); // allow base64 key input
    }
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('base64'),
    };
  },

  // Decrypt data using AES-256-CBC
  decrypt: (encryptedData, key, iv) => {
    if (typeof key === 'string') key = Buffer.from(key, 'base64');
    if (typeof iv === 'string') iv = Buffer.from(iv, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  // Encrypt with auto-generated IV (convenience method)
  encryptWithIV: (text, key) => {
    const iv = aes.generateIV();
    return aes.encrypt(text, key, iv);
  },
};