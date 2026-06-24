# SynapTalk True End-to-End Encryption Protocol

This document defines the strict protocol for End-to-End Encryption (E2EE) within SynapTalk. The protocol leverages native browser WebCrypto API (`P-256`, `AES-GCM`) combined with IndexedDB for non-extractable Keyring persistence, ensuring zero-knowledge routing on the Node.js backend.

## 1. Sequence Diagrams

### 1.1 Registration / Key Generation
```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (WebCrypto)
    participant IDB as IndexedDB
    participant B as Backend
    
    U->>F: Sign up / Log in
    F->>F: Generate 16-byte Entropy
    F->>U: Display BIP39 12-word Mnemonic
    F->>F: PBKDF2 Mnemonic -> 32-byte Seed (d)
    F->>F: Calculate x, y coordinates from d
    F->>F: Format JWK & crypto.subtle.importKey(extractable: false)
    F->>IDB: Save CryptoKey (private) & Public Key bytes
    F->>B: POST /api/keys/upload { publicKeyBase64 }
    B-->>F: 200 OK
```

### 1.2 Message Send (1:1)
```mermaid
sequenceDiagram
    participant S as Sender (Alice)
    participant B as Backend
    participant R as Receiver (Bob)
    
    S->>B: Fetch Bob's Public Key
    B-->>S: Bob's Public Key (P-256)
    S->>S: Generate AES-GCM Session Key (256-bit)
    S->>S: Encrypt Plaintext -> Ciphertext + AuthTag
    S->>S: Generate Ephemeral P-256 Keypair
    S->>S: ECDH(Ephemeral Private, Bob Public) -> Shared Secret
    S->>S: Wrap Session Key with Shared Secret
    S->>B: POST /api/messages/send { ciphertext, wrappedKey, ephemeralPub }
    B->>B: Validate schema, append timestamp, save to DB
    B->>R: Emit via Socket (Ciphertext payload ONLY)
```

### 1.3 Message Receive
```mermaid
sequenceDiagram
    participant R as Receiver (Bob)
    participant IDB as IndexedDB
    
    R->>R: Receive Ciphertext Payload (Socket or REST)
    R->>IDB: Get Private Key (extractable: false)
    R->>R: Import Sender's Ephemeral Public Key
    R->>R: ECDH(Bob Private, Ephemeral Public) -> Shared Secret
    R->>R: Unwrap Session Key
    R->>R: Decrypt AES-GCM Ciphertext -> Plaintext
    R->>R: Render in UI (Plaintext never leaves JS memory)
```

### 1.4 Legacy Migration (secp256k1)
```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant IDB as IndexedDB
    
    F->>IDB: Check for keys
    IDB-->>F: No keys found
    F->>B: GET /api/keys/export-legacy
    B-->>F: secp256k1 Private Key (PEM/DER)
    F->>IDB: Store legacy key in Keyring
    F->>B: POST /api/keys/migration-success
    B->>B: Flag user migrated=true
    note over B: Backend retains key for Rollback only
```

### 1.5 Safety Number Verification (MITM Prevention)
```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    
    A->>A: SHA256(Alice Public + Bob Public) -> Numeric Hash A
    B->>B: SHA256(Alice Public + Bob Public) -> Numeric Hash B
    A->>B: Read numbers over Phone / Scan QR Code
    note over A,B: If Hash A == Hash B, no MITM exists.
```

## 2. Payload Specifications

**Message Database Schema (`Message.js`)**:
```javascript
{
  senderId: ObjectId, 
  receiverId: ObjectId,
  cryptoVersion: { type: Number, default: 2 }, // 1 = secp256k1, 2 = P-256 WebCrypto
  senderKeyId: { type: String }, // SHA256 of Sender's active static public key
  receiverKeyId: { type: String }, // SHA256 of Receiver's active static public key
  ephemeralPublicKey: { type: String }, // Base64 SPKI
  wrappedAESKey: { type: String }, // Base64 wrapped session key
  iv: { type: String }, // 12-byte initialization vector for AES-GCM
  encryptedMessage: { type: String } // Base64 AES-GCM ciphertext (auth tag appended)
}
```

*Note: Group messaging protocols are out of scope for Phase 1 and will remain on their current SSE/Plaintext pathways until Phase 2.*
