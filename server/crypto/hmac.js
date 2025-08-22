import crypto from 'crypto';

export const hmac = {
  // Generate HMAC for message integrity
  generateHMAC: (data, key) => {
    // Convert key to Buffer if it's a string
    if (typeof key === 'string') {
      key = Buffer.from(key, 'base64');
    }
    
    const hmacGenerator = crypto.createHmac('sha256', key);
    hmacGenerator.update(data, 'utf8');
    return hmacGenerator.digest('base64');
  },

  // Verify HMAC for message integrity
  verifyHMAC: (data, key, receivedHMAC) => {
    try {
      const expectedHMAC = hmac.generateHMAC(data, key);
      return crypto.timingSafeEqual(
        Buffer.from(expectedHMAC, 'base64'),
        Buffer.from(receivedHMAC, 'base64')
      );
    } catch (error) {
      console.error('HMAC verification error:', error);
      return false;
    }
  },

  // Generate HMAC with timestamp for replay attack prevention
  generateTimestampHMAC: (data, key, timestamp = null) => {
    if (!timestamp) {
      timestamp = Date.now().toString();
    }
    
    const dataWithTimestamp = `${data}:${timestamp}`;
    const hmacValue = hmac.generateHMAC(dataWithTimestamp, key);
    
    return {
      hmac: hmacValue,
      timestamp: timestamp
    };
  },

  // Verify HMAC with timestamp (optional timeout check)
  verifyTimestampHMAC: (data, key, receivedHMAC, timestamp, timeoutMs = 300000) => {
    try {
      // Check timestamp validity (5 minutes default)
      const now = Date.now();
      const messageTime = parseInt(timestamp);
      
      if (timeoutMs > 0 && (now - messageTime) > timeoutMs) {
        console.warn('HMAC timestamp expired');
        return false;
      }
      
      const dataWithTimestamp = `${data}:${timestamp}`;
      return hmac.verifyHMAC(dataWithTimestamp, key, receivedHMAC);
    } catch (error) {
      console.error('Timestamp HMAC verification error:', error);
      return false;
    }
  }
};

