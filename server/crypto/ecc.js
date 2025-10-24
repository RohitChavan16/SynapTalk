import crypto from 'crypto';

/**
 * Normalize input that might be PEM, base64-encoded PEM, or base64-encoded DER.
 */
function toPem(maybePemOrB64) {
  if (!maybePemOrB64) {
    throw new Error('Key input is null or undefined');
  }
  
  if (typeof maybePemOrB64 !== 'string') {
    throw new TypeError('Key must be a string (PEM or base64-encoded PEM)');
  }
  
  // Already PEM format
  if (maybePemOrB64.includes('-----BEGIN')) return maybePemOrB64;
  
  try {
    // Try base64 -> utf8 PEM
    const decoded = Buffer.from(maybePemOrB64, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) return decoded;
  } catch (e) {
    console.error('Failed to decode base64 to PEM:', e);
  }
  
  throw new Error('Provided key is neither PEM nor base64-encoded PEM');
}

/**
 * Get the curve name from a KeyObject (ensures we match curves).
 */
function getCurveName(keyObj) {
  const namedCurve = keyObj.asymmetricKeyDetails?.namedCurve;
  return namedCurve || 'secp256k1';
}

export const ecc = {
  // Generate ECC key pair (PEM), default curve secp256k1
  generateKeyPair: (curve = 'secp256k1') => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: curve,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  },

  /**
   * Encrypt (wrap) a session key for a recipient using their EC public key.
   * Returns: { encryptedKey, ephemeralPublicKey, iv }
   */
  encryptKey: (sessionKey, recipientPublicKeyInput) => {
    try {
      // sessionKey may be Buffer or base64 string
      const sessionKeyBuf =
        typeof sessionKey === 'string' ? Buffer.from(sessionKey, 'base64') : sessionKey;

      // Normalize recipient public key to PEM and KeyObject
      const recipientPublicPem = toPem(recipientPublicKeyInput);
      const recipientPubKeyObj = crypto.createPublicKey({
        key: recipientPublicPem,
        format: 'pem',
        type: 'spki',
      });

      // Match recipient's curve for ephemeral keys
      const curve = getCurveName(recipientPubKeyObj);

      // Ephemeral EC keypair
      const { publicKey: ephPubPem, privateKey: ephPrivPem } = crypto.generateKeyPairSync('ec', {
        namedCurve: curve,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // ECDH: shared secret (ephemeral private, recipient public)
      const sharedSecret = crypto.diffieHellman({
        privateKey: crypto.createPrivateKey(ephPrivPem),
        publicKey: recipientPubKeyObj,
      });

      // Derive 32-byte AES key
      const aesKey = crypto.pbkdf2Sync(sharedSecret, 'salt', 10000, 32, 'sha256');

      // AES-256-CBC with random IV
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      const encrypted = Buffer.concat([cipher.update(sessionKeyBuf), cipher.final()]);

      return {
        encryptedKey: encrypted.toString('base64'),
        ephemeralPublicKey: ephPubPem,
        iv: iv.toString('base64'),
      };
    } catch (err) {
      console.error('ECC encryptKey error:', err);
      throw new Error('Failed to encrypt (wrap) session key');
    }
  },

  /**
   * Decrypt (unwrap) a session key with your EC private key.
   * Returns: Buffer (original session key bytes)
   */
  decryptKey: (encryptedKeyData, recipientPrivateKeyInput) => {
  try {
    // Input validation with detailed logging
    if (!encryptedKeyData) {
      throw new Error('Encrypted key data is null or undefined');
    }
    
    if (!recipientPrivateKeyInput) {
      throw new Error('Recipient private key is null or undefined');
    }

    // Safe logging with null checks
    
    if (recipientPrivateKeyInput && typeof recipientPrivateKeyInput === 'string') {
      // console.log("Recipient Private Key (first 100 chars):", recipientPrivateKeyInput.slice(0, 100));
    }

    const payload =
      typeof encryptedKeyData === 'string' ? JSON.parse(encryptedKeyData) : encryptedKeyData;

    const { encryptedKey, ephemeralPublicKey, iv } = payload;

    if (!encryptedKey || !ephemeralPublicKey || !iv) {
      throw new Error('Missing required encryption payload fields');
    }


    // Normalize keys to PEM + KeyObjects with better error handling
    let recipientPrivKeyObj;
    let recipientPrivPem;
    
    try {
      recipientPrivPem = toPem(recipientPrivateKeyInput);
      
      
      recipientPrivKeyObj = crypto.createPrivateKey({
        key: recipientPrivPem,
        format: 'pem',
        type: 'pkcs8',
      });
    } catch (e) {
      
      // Fallback: try raw DER (base64-encoded)
      try {
        
        recipientPrivKeyObj = crypto.createPrivateKey({
          key: Buffer.from(recipientPrivateKeyInput, 'base64'),
          format: 'der',
          type: 'pkcs8',
        });
        
      } catch (e2) {
        
        throw new Error('Invalid private key format');
      }
    }

    let ephPubKeyObj;
    try {
      ephPubKeyObj = crypto.createPublicKey({
        key: toPem(ephemeralPublicKey),
        format: 'pem',
        type: 'spki',
      });
      
    } catch (e) {
      console.error('Failed to parse ephemeral public key:', e);
      throw new Error('Invalid ephemeral public key format');
    }

    // Ensure curves match
    const curveA = getCurveName(recipientPrivKeyObj);
    const curveB = getCurveName(ephPubKeyObj);
    
    if (curveA !== curveB) {
      throw new Error(`Curve mismatch: private key is ${curveA}, ephemeral public key is ${curveB}`);
    }

    // ECDH: shared secret (recipient private, ephemeral public)
   
    const sharedSecret = crypto.diffieHellman({
      privateKey: recipientPrivKeyObj,
      publicKey: ephPubKeyObj,
    });
    

    // Derive AES key exactly as in encryptKey
    
    const aesKey = crypto.pbkdf2Sync(sharedSecret, 'salt', 10000, 32, 'sha256');
       // Decrypt AES-256-CBC
   
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      aesKey,
      Buffer.from(iv, 'base64')
    );
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'base64')),
      decipher.final(),
    ]);

    
    return decrypted; // Buffer of original session key
    
  } catch (err) {
    
    throw new Error(`Failed to decrypt (unwrap) session key: ${err.message}`);
  }
},
};

// For backward compatibility
export const generateKeyPair = ecc.generateKeyPair;