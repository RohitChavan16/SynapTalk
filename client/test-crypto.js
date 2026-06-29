// using global crypto

// We will copy the encryptV2 and decryptV2 functions directly here to test the math without importing CryptoEngine which has elliptic dependency.

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  let normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  while (normalizedBase64.length % 4) {
    normalizedBase64 += '=';
  }
  const binary_string = atob(normalizedBase64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function encryptV2(text, senderPrivateKey, senderKeyId, receiverPublicKeyBase64, receiverKeyId, senderPublicKeyBase64) {
  const receiverSpki = base64ToArrayBuffer(receiverPublicKeyBase64);
  const receiverPubKey = await crypto.subtle.importKey(
    "spki", receiverSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
  );

  const senderSpki = base64ToArrayBuffer(senderPublicKeyBase64);
  const senderPubKey = await crypto.subtle.importKey(
    "spki", senderSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
  );

  const ephemeralPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
  const ephemeralSpki = await crypto.subtle.exportKey("spki", ephemeralPair.publicKey);

  const sessionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
  const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, sessionKey, encodedText
  );

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
}

async function decryptV2(payload, receiverPrivateKey, isSender) {
  const { ephemeralPublicKey, wrappedAESKey, iv, encryptedMessage } = payload;

  const ephemeralSpki = base64ToArrayBuffer(ephemeralPublicKey);
  const ephemeralPubKey = await crypto.subtle.importKey(
    "spki", ephemeralSpki, { name: "ECDH", namedCurve: "P-256" }, true, []
  );

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

  const sessionKey = await crypto.subtle.importKey(
    "raw", rawSessionKey, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
    sessionKey,
    base64ToArrayBuffer(encryptedMessage)
  );

  return new TextDecoder().decode(plaintextBuf);
}

async function test() {
  try {
    const senderPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
    );
    const senderSpki = await crypto.subtle.exportKey("spki", senderPair.publicKey);
    const senderPublicKeyBase64 = arrayBufferToBase64(senderSpki);

    const receiverPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
    );
    const receiverSpki = await crypto.subtle.exportKey("spki", receiverPair.publicKey);
    const receiverPublicKeyBase64 = arrayBufferToBase64(receiverSpki);

    const payload = await encryptV2(
      "hello world",
      senderPair.privateKey,
      "senderKey",
      receiverPublicKeyBase64,
      "receiverKey",
      senderPublicKeyBase64
    );

    console.log("Encryption success!");

    const decryptedSender = await decryptV2(payload, senderPair.privateKey, true);
    console.log("Decrypted (sender):", decryptedSender);

    const decryptedReceiver = await decryptV2(payload, receiverPair.privateKey, false);
    console.log("Decrypted (receiver):", decryptedReceiver);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
