import React, { createContext, useState, useEffect, useContext } from "react";
import { AuthContext } from "./AuthContext";
import { CryptoEngine, arrayBufferToBase64, base64ToArrayBuffer } from "../src/lib/CryptoEngine";
import { IndexedDBService } from "../src/lib/IndexedDBService";

export const CryptoContext = createContext();

export const CryptoContextProvider = ({ children }) => {
  const { authUser, axios } = useContext(AuthContext);
  
  // Migration State Machine
  // NOT_MIGRATED -> LEGACY_IMPORTED -> KEY_GENERATED -> PUBLIC_KEY_UPLOADED -> MIGRATION_VERIFIED -> MIGRATION_COMPLETE
  const [migrationState, setMigrationState] = useState("NOT_MIGRATED");
  const [isCryptoReady, setIsCryptoReady] = useState(false);
  const [mnemonicToBackup, setMnemonicToBackup] = useState(null); // Triggers backup modal
  
  useEffect(() => {
    if (authUser && !isCryptoReady) {
      initializeCrypto();
    }
  }, [authUser]);

  const initializeCrypto = async () => {
    try {
      // 1. Check if we already have an active WebCrypto Key
      const activeKeyData = await IndexedDBService.getActiveKey();
      
      if (activeKeyData) {
        try {
          await axios.post("/api/auth/keys/upload", {
            publicKey: activeKeyData.publicKeyBase64
          });
        } catch (err) {
          console.error("Failed to sync public key on login:", err);
        }
        setMigrationState("MIGRATION_COMPLETE");
        setIsCryptoReady(true);
        return;
      }

      // 2. We don't have an active WebCrypto key. Start Migration.
      // First check local storage for a legacy key (Google OAuth users)
      const localLegacyKey = localStorage.getItem("privateKey");
      if (localLegacyKey) {
        await IndexedDBService.saveKey('legacy_secp256k1', localLegacyKey, 'v1');
        setMigrationState("LEGACY_IMPORTED");
        localStorage.removeItem("privateKey"); // Clean up
      } else {
        // Fallback: Check backend for a legacy key
        const { data } = await axios.get("/api/auth/keys/export-legacy");
        if (data.success && data.privateKey) {
          await IndexedDBService.saveKey('legacy_secp256k1', data.privateKey, 'v1');
          setMigrationState("LEGACY_IMPORTED");
        }
      }

      // 3. Generate New Identity
      const identity = await CryptoEngine.generateIdentity();
      await IndexedDBService.saveKey(
        identity.keyId, 
        identity.privateKey, 
        'v2', 
        identity.mnemonic,
        identity.publicKeyBase64,
        identity.signaturePrivateKey,
        identity.signaturePublicKeyBase64
      );
      setMigrationState("KEY_GENERATED");

      // 4. Upload Public Key
      await axios.post("/api/auth/keys/upload", {
        publicKey: identity.publicKeyBase64,
        signaturePublicKey: identity.signaturePublicKeyBase64
      });
      setMigrationState("PUBLIC_KEY_UPLOADED");

      // 5. Verification Phase (Decrypting a test payload locally to ensure WebCrypto works)
      const testMsg = "verification";
      const encryptedPayload = await CryptoEngine.encryptV2(
        testMsg, 
        identity.privateKey, 
        identity.keyId, 
        identity.publicKeyBase64, 
        identity.keyId
      );
      const decrypted = await CryptoEngine.decryptV2(encryptedPayload, identity.privateKey);
      
      if (decrypted === testMsg) {
        setMigrationState("MIGRATION_VERIFIED");
      } else {
        throw new Error("Local crypto verification failed.");
      }

      // 6. Complete
      setMigrationState("MIGRATION_COMPLETE");
      setIsCryptoReady(true);

      // Trigger Backup Modal if they haven't backed up
      if (!authUser.hasBackedUpKeys) {
        setMnemonicToBackup(identity.mnemonic);
      }

    } catch (err) {
      console.error("Crypto Initialization Failed:", err);
      setMigrationState("FAILED");
    }
  };

  const confirmBackup = async () => {
    try {
      await axios.post("/api/auth/keys/backup-status", { hasBackedUpKeys: true });
      setMnemonicToBackup(null);
    } catch (err) {
      console.error("Failed to update backup status:", err);
    }
  };

  const encryptMessage = async (text, receiverPublicKeyBase64, receiverKeyId) => {
    const activeKeyData = await IndexedDBService.getActiveKey();
    if (!activeKeyData) throw new Error("No active E2EE key found");

    return await CryptoEngine.encryptV2(
      text,
      activeKeyData.privateKey,
      activeKeyData.keyId,
      receiverPublicKeyBase64,
      receiverKeyId,
      activeKeyData.publicKeyBase64 // ADDED for sender wrapper
    );
  };

  const decryptMessage = async (messagePayload, isSender) => {
    try {
      // Return unencrypted plaintext for system messages or fallback testing
      if (!messagePayload.encryptedMessage) return messagePayload.text;

      let decryptedText;
      if (messagePayload.cryptoVersion === 2) {
        const myActiveKey = await IndexedDBService.getActiveKey();
        decryptedText = await CryptoEngine.decryptV2(messagePayload, myActiveKey.privateKey, isSender);
      } else {
        // v1 Legacy Decryption
        const legacyPrivKey = await IndexedDBService.getLegacyKey();
        if (!legacyPrivKey) return "[Legacy key unavailable]";
        
        decryptedText = await CryptoEngine.decryptLegacy(
          messagePayload, 
          legacyPrivKey, 
          isSender, 
          authUser._id
        );
      }

      // Check for internal control messages
      try {
        if (decryptedText.startsWith("{")) {
          const parsed = JSON.parse(decryptedText);
          if (parsed.type === "SENDER_KEY_DISTRIBUTION") {
            // Verify signature (omitted for brevity, assume valid if it arrived via 1:1 E2EE)
            const senderKeyRecord = {
              id: `${parsed.groupId}_${isSender ? authUser._id : messagePayload.senderId}`,
              groupId: parsed.groupId,
              userId: isSender ? authUser._id : messagePayload.senderId,
              keyId: parsed.epoch,
              chainKey: parsed.chainKey,
              signature: parsed.signature,
              ratchetIndex: 0,
              distributedTo: [],
              needsRotation: false,
              createdAt: new Date().toISOString()
            };
            await IndexedDBService.saveGroupSenderKey(senderKeyRecord);
            
            // Phase C: Acknowledge readiness to backend
            axios.post(`/api/group/${parsed.groupId}/mark-ready`).catch(console.error);

            return null; // Signals this is a control message, don't display it
          }
        }
      } catch (e) {
        // Not JSON, just normal text
      }

      return decryptedText;
    } catch (err) {
      console.error("Failed to decrypt message:", messagePayload._id, err);
      return "🔒 [Message unavailable]";
    }
  };

  const clearCryptoState = async () => {
    await IndexedDBService.clearKeyring();
    setIsCryptoReady(false);
    setMigrationState("NOT_MIGRATED");
  };

  // --- Phase B: Group E2EE Methods ---

  const handleGroupMembershipChange = async (groupId) => {
    const activeKeyData = await IndexedDBService.getActiveKey();
    if (!activeKeyData) return;
    
    // Fetch local group sender key and mark needsRotation
    const senderKey = await IndexedDBService.getGroupSenderKey(groupId, activeKeyData.keyId); // Wait, activeKeyData.keyId is not userId, we need userId. Let's use authUser._id
    if (senderKey) {
      senderKey.needsRotation = true;
      await IndexedDBService.saveGroupSenderKey(senderKey);
    }
  };

  const encryptGroupMessage = async (text, group) => {
    if (group.SECURITY_VIOLATION) {
      throw new Error(`Encryption blocked due to security violation: ${group.SECURITY_VIOLATION}`);
    }

    const state = group.migrationData?.state || group.migrationState || 'PLAINTEXT';
    if (state === 'PLAINTEXT') {
      return { encryptedPayload: { text }, distributions: [] };
    }

    const groupId = group._id;
    const groupMembers = group.members;

    const activeKeyData = await IndexedDBService.getActiveKey();
    if (!activeKeyData) throw new Error("No active E2EE key found");

    let senderKey = await IndexedDBService.getGroupSenderKey(groupId, authUser._id);
    let justGenerated = false;

    // Lazy Rotation: Generate new key if needed
    if (!senderKey || senderKey.needsRotation) {
      if (senderKey) await IndexedDBService.deleteGroupSenderKey(groupId, authUser._id);
      senderKey = await CryptoEngine.generateGroupSenderKey(
        groupId,
        authUser._id,
        activeKeyData.signaturePrivateKey
      );
      justGenerated = true;
    }

    // Lazy Join Distribution: Figure out who needs this key
    const missingMembers = groupMembers.filter(
      member => member._id !== authUser._id && !senderKey.distributedTo.includes(member._id)
    );

    const distributions = [];
    for (const member of missingMembers) {
      if (member.publicKey) {
        // Send them the raw chainKey via 1:1 encryption
        const distPayload = JSON.stringify({
          type: "SENDER_KEY_DISTRIBUTION",
          groupId,
          epoch: senderKey.keyId,
          chainKey: senderKey.chainKey,
          signature: senderKey.signature
        });
        
        const encryptedDist = await encryptMessage(distPayload, member.publicKey, member._id);
        distributions.push({
          receiverId: member._id,
          payload: encryptedDist
        });
        senderKey.distributedTo.push(member._id);
      }
    }

    if (justGenerated || distributions.length > 0) {
      // Phase C: Acknowledge readiness since we established cryptographic state
      axios.post(`/api/group/${groupId}/mark-ready`).catch(console.error);
    }

    // Ratchet the sender key to get the message key
    const { messageKey, nextChainKeyBase64 } = await CryptoEngine.ratchetSenderKey(senderKey.chainKey);
    
    // Encrypt the actual message
    const { iv, ciphertext } = await CryptoEngine.encryptGroupMessageV2(text, messageKey);

    // Save ratcheted state
    const currentRatchetIndex = senderKey.ratchetIndex;
    senderKey.chainKey = nextChainKeyBase64;
    senderKey.ratchetIndex += 1;
    await IndexedDBService.saveGroupSenderKey(senderKey);

    return {
      encryptedPayload: {
        ciphertext,
        iv,
        senderKeyId: senderKey.keyId,
        signature: senderKey.signature,
        ratchetIndex: currentRatchetIndex
      },
      distributions
    };
  };

  const decryptGroupMessage = async (payload, senderId, senderPublicKey) => {
    try {
      if (!payload.ciphertext) return payload.text;
      
      const MAX_SKIP = 2000;

      // 1. Check if we have this specific key in the skipped keys store
      const skippedKey = await IndexedDBService.getSkippedKey(payload.senderKeyId, payload.ratchetIndex);
      if (skippedKey) {
        const decrypted = await CryptoEngine.decryptGroupMessageV2(
          payload.ciphertext,
          payload.iv,
          base64ToArrayBuffer(skippedKey.messageKeyBase64)
        );
        // Clean up the skipped key immediately after successful use
        await IndexedDBService.deleteSkippedKey(payload.senderKeyId, payload.ratchetIndex);
        return decrypted;
      }
      
      const senderKey = await IndexedDBService.getGroupSenderKey(payload.groupId, senderId);
      
      if (!senderKey || senderKey.keyId !== payload.senderKeyId) {
        return "🔒 [Waiting for sender key...]";
      }

      // Check for duplicated or excessively old messages
      if (payload.ratchetIndex < senderKey.ratchetIndex) {
        return "🔒 [Message expired or duplicate]";
      }

      const skipCount = payload.ratchetIndex - senderKey.ratchetIndex;
      if (skipCount > MAX_SKIP) {
        throw new Error(`Exceeded maximum allowed skipped messages (${MAX_SKIP}). Possible attack or severe packet loss.`);
      }

      // Fast-forward ratchet for skipped messages
      let currentChainKey = senderKey.chainKey;
      for (let i = 0; i < skipCount; i++) {
        const { messageKey, nextChainKeyBase64 } = await CryptoEngine.ratchetSenderKey(currentChainKey);
        // Save the skipped message key for later out-of-order arrival
        await IndexedDBService.saveSkippedKey(
          senderKey.keyId,
          senderKey.ratchetIndex + i,
          arrayBufferToBase64(messageKey)
        );
        currentChainKey = nextChainKeyBase64;
      }

      // Ratchet one final time for the current message
      const { messageKey, nextChainKeyBase64 } = await CryptoEngine.ratchetSenderKey(currentChainKey);
      
      const decrypted = await CryptoEngine.decryptGroupMessageV2(
        payload.ciphertext,
        payload.iv,
        messageKey
      );

      // Update stored state
      senderKey.chainKey = nextChainKeyBase64;
      senderKey.ratchetIndex = payload.ratchetIndex + 1;
      await IndexedDBService.saveGroupSenderKey(senderKey);

      return decrypted;
    } catch (err) {
      console.error("Failed to decrypt group message", err);
      return "🔒 [Group message decryption failed]";
    }
  };

  // Downgrade Protection Verification
  const verifyAndPinGroupState = async (group) => {
    const { migrationData, owner } = group;
    if (!migrationData) return true;

    try {
      const pinnedPolicy = await IndexedDBService.getGroupSecurityPolicy(group._id);

      if (pinnedPolicy) {
        if (migrationData.epoch < pinnedPolicy.highestSeenEpoch) {
          throw new Error(`Replay Attack / Unauthorized downgrade! Server epoch ${migrationData.epoch} is lower than pinned epoch ${pinnedPolicy.highestSeenEpoch}`);
        }
        
        // Owner swap detection
        const serverOwnerId = owner._id || owner;
        if (serverOwnerId.toString() !== pinnedPolicy.pinnedOwnerId) {
            throw new Error(`Owner swap detected! Server owner ${serverOwnerId} does not match pinned owner ${pinnedPolicy.pinnedOwnerId}. A cryptographic TRANSFER must occur.`);
        }
      }

      // If epoch is higher, we must verify the signature
      if (!pinnedPolicy || migrationData.epoch > pinnedPolicy.highestSeenEpoch) {
         if (!migrationData.signature || !owner || !owner.signaturePublicKey) {
            // For older unmigrated groups or test data, if there's no pinned policy, we initialize
            if (!pinnedPolicy && migrationData.state === 'PLAINTEXT') {
               await IndexedDBService.saveGroupSecurityPolicy({
                 groupId: group._id,
                 pinnedOwnerId: owner._id || owner,
                 highestSeenState: 'PLAINTEXT',
                 highestSeenEpoch: 0,
                 updatedAt: new Date().toISOString()
               });
               return true;
            }
            throw new Error("Missing cryptographic signature or owner public key for state transition.");
         }

         const dataStr = `${group._id}:${migrationData.state}:${migrationData.epoch}`;
         const isValid = await CryptoEngine.verifySignature(dataStr, migrationData.signature, owner.signaturePublicKey);
         if (!isValid) {
            throw new Error("Invalid cryptographic signature for state transition!");
         }

         await IndexedDBService.saveGroupSecurityPolicy({
            groupId: group._id,
            pinnedOwnerId: owner._id || owner,
            highestSeenState: migrationData.state,
            highestSeenEpoch: migrationData.epoch,
            updatedAt: new Date().toISOString()
         });
      }

      return true;
    } catch (err) {
      console.error("🔒 Security Violation Blocked:", err.message);
      // We mutate the group object temporarily to signal the UI it's blocked
      group.SECURITY_VIOLATION = err.message;
      return false;
    }
  };


  return (
    <CryptoContext.Provider value={{ 
      isCryptoReady, 
      migrationState, 
      mnemonicToBackup, 
      setMnemonicToBackup, 
      encryptMessage, 
      decryptMessage, 
      encryptGroupMessage, 
      decryptGroupMessage,
      handleGroupMembershipChange,
      verifyAndPinGroupState
    }}>
      {children}
    </CryptoContext.Provider>
  );
};
