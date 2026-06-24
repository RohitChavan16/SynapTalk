import React, { createContext, useState, useEffect, useContext } from "react";
import { AuthContext } from "./AuthContext";
import { CryptoEngine } from "../src/lib/CryptoEngine";
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
        identity.publicKeyBase64
      );
      setMigrationState("KEY_GENERATED");

      // 4. Upload Public Key
      await axios.post("/api/auth/keys/upload", {
        publicKey: identity.publicKeyBase64
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

      if (messagePayload.cryptoVersion === 2) {
        const myActiveKey = await IndexedDBService.getActiveKey();
        return await CryptoEngine.decryptV2(messagePayload, myActiveKey.privateKey, isSender);
      } else {
        // v1 Legacy Decryption
        const legacyPrivKey = await IndexedDBService.getLegacyKey();
        if (!legacyPrivKey) return "[Legacy key unavailable]";
        
        return await CryptoEngine.decryptLegacy(
          messagePayload, 
          legacyPrivKey, 
          isSender, 
          authUser._id
        );
      }
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

  return (
    <CryptoContext.Provider value={{ 
      isCryptoReady, 
      migrationState, 
      encryptMessage, 
      decryptMessage, 
      mnemonicToBackup,
      confirmBackup,
      clearCryptoState 
    }}>
      {children}
    </CryptoContext.Provider>
  );
};
