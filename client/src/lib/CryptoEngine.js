import * as bip39 from 'bip39';
import { ec as EC } from 'elliptic';
import { Buffer } from 'buffer';

const p256 = new EC('p256');
const secp256k1 = new EC('secp256k1');

// Browser compatibility for Buffer
window.Buffer = window.Buffer || Buffer;

/**
 * ArrayBuffer <-> Base64 Utilities
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  if (typeof base64 !== 'string') {
    return new ArrayBuffer(0);
  }
  let normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  while (normalizedBase64.length % 4) {
    normalizedBase64 += '=';
  }
  try {
    const binary_string = window.atob(normalizedBase64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("Failed to decode base64:", base64);
    throw error;
  }
}

export const CryptoEngine = {
  /**
   * Generates a new identity: Mnemonic, Seed, and WebCrypto P-256 Keypair.
   * Returns: { mnemonic, cryptoKey, publicKeyBase64, keyId }
   */
  async generateIdentity() {
    // 1. Generate 16 bytes of entropy
    const entropy = crypto.getRandomValues(new Uint8Array(16));
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy).toString('hex'));
    
    return this.restoreIdentity(mnemonic);
  },

  /**
   * Restores a WebCrypto Keypair deterministically from a 12-word mnemonic.
   */
  async restoreIdentity(mnemonic) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid recovery phrase");
    }

    const entropyHex = bip39.mnemonicToEntropy(mnemonic);
    const entropyBuffer = Buffer.from(entropyHex, 'hex');

    // Deterministically expand 16 bytes to 32 bytes using native WebCrypto HKDF
    const baseKey = await crypto.subtle.importKey(
      "raw", entropyBuffer, { name: "HKDF" }, false, ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: new TextEncoder().encode("SynapTalk E2EE Key Derivation v1")
      },
      baseKey,
      256 // 32 bytes
    );

    // Get the private scalar 'd'
    const dArray = new Uint8Array(derivedBits);
    
    // We MUST use elliptic to calculate x and y coordinates for WebCrypto JWK import
    const keyPair = p256.keyFromPrivate(dArray);
    const pubPoint = keyPair.getPublic();
    
    const toBase64Url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const xBase64url = toBase64Url(Buffer.from(pubPoint.getX().toArray('be', 32)));
    const yBase64url = toBase64Url(Buffer.from(pubPoint.getY().toArray('be', 32)));
    const dBase64url = toBase64Url(Buffer.from(dArray));

    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: xBase64url,
      y: yBase64url,
      d: dBase64url,
      ext: true
    };

    // Import into WebCrypto as NON-EXTRACTABLE
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDH", namedCurve: "P-256" },
      false, // EXTRACTABLE: FALSE (Prevents XSS theft)
      ["deriveKey", "deriveBits"]
    );

    // Import Public Key separately for export
    const jwkPub = { kty: "EC", crv: "P-256", x: xBase64url, y: yBase64url, ext: true };
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwkPub,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );

    // Export SPKI Base64 for the server
    const spki = await crypto.subtle.exportKey("spki", publicKey);
    const publicKeyBase64 = arrayBufferToBase64(spki);

    // Fingerprint KeyId (SHA-256 of SPKI)
    const hashBuffer = await crypto.subtle.digest("SHA-256", spki);
    const keyId = arrayBufferToBase64(hashBuffer);

    return { mnemonic, privateKey, publicKey, publicKeyBase64, keyId };
  },

  /**
   * Encrypts plaintext for a receiver using WebCrypto (v2).
   */
  async encryptV2(text, senderPrivateKey, senderKeyId, receiverPublicKeyBase64, receiverKeyId, senderPublicKeyBase64) {
    // 1. Convert Public Keys -> CryptoKey
    const receiverSpki = base64ToArrayBuffer(receiverPublicKeyBase64);
    const receiverPubKey = await crypto.subtle.importKey(
      "spki", receiverSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
    );

    const senderSpki = base64ToArrayBuffer(senderPublicKeyBase64);
    const senderPubKey = await crypto.subtle.importKey(
      "spki", senderSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
    );

    // 2. Generate Ephemeral Keypair
    const ephemeralPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
    );
    const ephemeralSpki = await crypto.subtle.exportKey("spki", ephemeralPair.publicKey);

    // 3. Generate AES-GCM Session Key
    const sessionKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
    const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);

    // 4. Encrypt Text
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv }, sessionKey, encodedText
    );

    // 5. Wrap Session Key for Receiver
    const sharedSecretReceiver = await crypto.subtle.deriveBits(
      { name: "ECDH", public: receiverPubKey }, ephemeralPair.privateKey, 256
    );
    const wrapperKeyReceiver = await crypto.subtle.importKey(
      "raw", sharedSecretReceiver, { name: "AES-CBC" }, false, ["encrypt"]
    );
    const wrapIvReceiver = crypto.getRandomValues(new Uint8Array(16));
    const wrappedSessionKeyReceiver = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: wrapIvReceiver }, wrapperKeyReceiver, rawSessionKey
    );
    const wrappedStrReceiver = arrayBufferToBase64(wrapIvReceiver) + ":" + arrayBufferToBase64(wrappedSessionKeyReceiver);

    // 6. Wrap Session Key for Sender
    const sharedSecretSender = await crypto.subtle.deriveBits(
      { name: "ECDH", public: senderPubKey }, ephemeralPair.privateKey, 256
    );
    const wrapperKeySender = await crypto.subtle.importKey(
      "raw", sharedSecretSender, { name: "AES-CBC" }, false, ["encrypt"]
    );
    const wrapIvSender = crypto.getRandomValues(new Uint8Array(16));
    const wrappedSessionKeySender = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: wrapIvSender }, wrapperKeySender, rawSessionKey
    );
    const wrappedStrSender = arrayBufferToBase64(wrapIvSender) + ":" + arrayBufferToBase64(wrappedSessionKeySender);

    const wrappedAESKeyJSON = JSON.stringify({
      receiver: wrappedStrReceiver,
      sender: wrappedStrSender
    });

    return {
      cryptoVersion: 2,
      senderKeyId,
      receiverKeyId,
      ephemeralPublicKey: arrayBufferToBase64(ephemeralSpki),
      wrappedAESKey: wrappedAESKeyJSON,
      iv: arrayBufferToBase64(iv),
      encryptedMessage: arrayBufferToBase64(ciphertextBuf)
    };
  },

  /**
   * Decrypts v2 Ciphertext using WebCrypto.
   */
  async decryptV2(payload, receiverPrivateKey, isSender) {
    const { ephemeralPublicKey, wrappedAESKey, iv, encryptedMessage } = payload;

    // 1. Import Ephemeral Public Key
    const ephemeralSpki = base64ToArrayBuffer(ephemeralPublicKey);
    const ephemeralPubKey = await crypto.subtle.importKey(
      "spki", ephemeralSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
    );

    // 2. ECDH to unwrap session key
    const sharedSecretBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: ephemeralPubKey }, receiverPrivateKey, 256
    );

    let wrappedAESKeyString;
    try {
      const parsed = JSON.parse(wrappedAESKey);
      wrappedAESKeyString = isSender ? parsed.sender : parsed.receiver;
    } catch (e) {
      wrappedAESKeyString = wrappedAESKey;
    }

    if (!wrappedAESKeyString) {
      throw new Error("Missing wrapped AES key for this recipient");
    }

    const [wrapIvB64, wrappedKeyB64] = wrappedAESKeyString.split(":");
    const wrapperKey = await crypto.subtle.importKey(
      "raw", sharedSecretBits, { name: "AES-CBC" }, false, ["decrypt"]
    );
    
    const rawSessionKey = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: base64ToArrayBuffer(wrapIvB64) },
      wrapperKey,
      base64ToArrayBuffer(wrappedKeyB64)
    );

    // 3. Decrypt Ciphertext
    const sessionKey = await crypto.subtle.importKey(
      "raw", rawSessionKey, { name: "AES-GCM" }, false, ["decrypt"]
    );
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
      sessionKey,
      base64ToArrayBuffer(encryptedMessage)
    );

    return new TextDecoder().decode(plaintextBuf);
  },

  /**
   * Decrypts legacy v1 messages utilizing elliptic secp256k1 for ECDH 
   * and WebCrypto for AES-CBC decryption.
   */
  async decryptLegacy(payload, legacyPrivateKeyPem, isSender, userIdStr) {
    try {
      const { encryptedMessage, encryptedKey, hmac } = payload;
      const [encryptedDataB64, ivB64] = encryptedMessage.split(":");
      const keyData = JSON.parse(encryptedKey);

      // Extract the correct encrypted session key string
      let targetWrappedStr;
      if (isSender) {
        targetWrappedStr = keyData.senderKey || keyData.encryptedKey;
      } else {
        targetWrappedStr = keyData.receiverKey || keyData.encryptedKey;
      }

      if (!targetWrappedStr) {
        throw new Error("Missing target key in payload");
      }

      let parsedWrapped;
      try {
        parsedWrapped = JSON.parse(targetWrappedStr);
      } catch(e) {
        parsedWrapped = targetWrappedStr;
      }

      // Legacy Node crypto ecc encrypts as JSON { encryptedKey, ephemeralPublicKey, iv }
      // Or base64 of it?
      let eKey, ePub, eIv;
      if (typeof parsedWrapped === 'string') {
        try {
          const safeBase64 = parsedWrapped.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '');
          const decoded = atob(safeBase64);
          const obj = JSON.parse(decoded);
          eKey = obj.encryptedKey; ePub = obj.ephemeralPublicKey; eIv = obj.iv;
        } catch(err) {
          eKey = null; ePub = null; eIv = null;
        }
      } else {
        eKey = parsedWrapped.encryptedKey; ePub = parsedWrapped.ephemeralPublicKey; eIv = parsedWrapped.iv;
      }

      // 1. Perform ECDH using secp256k1
      // Parse legacy private key (PEM -> Hex)
      let privHex;
      if (legacyPrivateKeyPem.includes("-----BEGIN")) {
        const b64 = legacyPrivateKeyPem.replace(/-----BEGIN.*?-----/g, '').replace(/-----END.*?-----/g, '').replace(/\s/g, '');
        privHex = Buffer.from(b64, 'base64').toString('hex');
        // Simple extraction for PKCS8 secp256k1 (often last 32 bytes)
        privHex = privHex.slice(-64);
      } else {
        privHex = Buffer.from(legacyPrivateKeyPem, 'base64').toString('hex');
      }

      const privKeyObj = secp256k1.keyFromPrivate(privHex, 'hex');

      // Parse ephemeral public key
      let pubHex;
      if (ePub.includes("-----BEGIN")) {
        const b64 = ePub.replace(/-----BEGIN.*?-----/g, '').replace(/-----END.*?-----/g, '').replace(/\s/g, '');
        pubHex = Buffer.from(b64, 'base64').toString('hex');
        pubHex = pubHex.slice(-130); // SPKI extraction of uncompressed point
      } else {
        pubHex = Buffer.from(ePub, 'base64').toString('hex');
      }
      const pubKeyObj = secp256k1.keyFromPublic(pubHex, 'hex');

      // Shared secret
      const sharedSecret = privKeyObj.derive(pubKeyObj.getPublic());
      const sharedSecretHex = sharedSecret.toString(16).padStart(64, '0');

      // Native WebCrypto PBKDF2 for AES key
      const baseSecret = await crypto.subtle.importKey(
        "raw", Buffer.from(sharedSecretHex, 'hex'), { name: "PBKDF2" }, false, ["deriveKey"]
      );

      const aesWrapperKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: new TextEncoder().encode("salt"), // Legacy node used 'salt' string
          iterations: 10000,
          hash: "SHA-256"
        },
        baseSecret,
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"]
      );

      // Unwrap Session Key
      const rawSessionKey = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: Buffer.from(eIv, 'base64') },
        aesWrapperKey,
        Buffer.from(eKey, 'base64')
      );

      // Decrypt Payload
      const sessionKey = await crypto.subtle.importKey(
        "raw", rawSessionKey, { name: "AES-CBC" }, false, ["decrypt"]
      );

      const plaintextBuf = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: Buffer.from(ivB64, 'base64') },
        sessionKey,
        Buffer.from(encryptedDataB64, 'base64')
      );

      return new TextDecoder().decode(plaintextBuf);
    } catch (e) {
      console.error("Legacy Decryption Failed:", e);
      return "[Message unavailable: Legacy decryption failed]";
    }
  }
};
