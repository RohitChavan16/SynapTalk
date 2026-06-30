const DB_NAME = 'SynapTalk_Crypto_v1';
const DB_VERSION = 4;
const STORE_NAME = 'Keyring';
const GROUP_SENDER_KEYS_STORE_NAME = 'group_sender_keys';
const GROUP_SKIPPED_KEYS_STORE_NAME = 'group_skipped_keys';
const GROUP_SECURITY_POLICIES_STORE_NAME = 'group_security_policies';

let dbInstance = null;
let activeKeyCache = null;

export const IndexedDBService = {
  async initDB() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'keyId' });
        }
        if (!db.objectStoreNames.contains(GROUP_SENDER_KEYS_STORE_NAME)) {
          db.createObjectStore(GROUP_SENDER_KEYS_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(GROUP_SKIPPED_KEYS_STORE_NAME)) {
          db.createObjectStore(GROUP_SKIPPED_KEYS_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(GROUP_SECURITY_POLICIES_STORE_NAME)) {
          db.createObjectStore(GROUP_SECURITY_POLICIES_STORE_NAME, { keyPath: 'groupId' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async saveKey(keyId, privateKey, type = 'v2', mnemonic = null, publicKeyBase64 = null, signaturePrivateKey = null, signaturePublicKeyBase64 = null) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const data = {
        keyId,
        privateKey, 
        type,
        mnemonic, 
        publicKeyBase64,
        signaturePrivateKey,
        signaturePublicKeyBase64,
        createdAt: new Date().toISOString()
      };
      
      const request = store.put(data);
      request.onsuccess = () => {
        if (type === 'v2') {
          activeKeyCache = data;
        }
        resolve();
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getKey(keyId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(keyId);
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getLegacyKey() {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const keys = event.target.result;
        const legacyKey = keys.find(k => k.type === 'v1');
        resolve(legacyKey ? legacyKey.privateKey : null);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getActiveKey() {
    if (activeKeyCache) return activeKeyCache;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const keys = event.target.result;
        // Find the most recently created v2 key
        const v2Keys = keys.filter(k => k.type === 'v2');
        if (v2Keys.length > 0) {
          v2Keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const activeKey = v2Keys[0];
          activeKeyCache = activeKey;
          resolve(activeKey);
        } else {
          resolve(null);
        }
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  async clearKeyring() {
    activeKeyCache = null;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async saveGroupSenderKey(data) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SENDER_KEYS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getGroupSenderKey(id) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SENDER_KEYS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getAllGroupSenderKeys(groupId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SENDER_KEYS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const keys = event.target.result;
        resolve(keys.filter(k => k.groupId === groupId));
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async deleteGroupSenderKey(id) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SENDER_KEYS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  async clearGroupSenderKeys(groupId) {
    const keys = await this.getAllGroupSenderKeys(groupId);
    for (const key of keys) {
      await this.deleteGroupSenderKey(key.id);
    }
  },

  async saveSkippedKey(epoch, index, messageKeyBase64) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SKIPPED_KEYS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GROUP_SKIPPED_KEYS_STORE_NAME);
      const request = store.put({ id: `${epoch}_${index}`, epoch, index, messageKeyBase64, createdAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getSkippedKey(epoch, index) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SKIPPED_KEYS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(GROUP_SKIPPED_KEYS_STORE_NAME);
      const request = store.get(`${epoch}_${index}`);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async deleteSkippedKey(epoch, index) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SKIPPED_KEYS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GROUP_SKIPPED_KEYS_STORE_NAME);
      const request = store.delete(`${epoch}_${index}`);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async serializeAll() {
    const db = await this.initDB();
    const backup = {
      keyring: [],
      groupSenderKeys: [],
      groupSkippedKeys: [],
      groupSecurityPolicies: []
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, GROUP_SENDER_KEYS_STORE_NAME, GROUP_SKIPPED_KEYS_STORE_NAME, GROUP_SECURITY_POLICIES_STORE_NAME], 'readonly');
      
      const req0 = transaction.objectStore(STORE_NAME).getAll();
      req0.onsuccess = () => { backup.keyring = req0.result; };

      const req1 = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME).getAll();
      req1.onsuccess = () => { backup.groupSenderKeys = req1.result; };
      
      const req2 = transaction.objectStore(GROUP_SKIPPED_KEYS_STORE_NAME).getAll();
      req2.onsuccess = () => { backup.groupSkippedKeys = req2.result; };

      const req3 = transaction.objectStore(GROUP_SECURITY_POLICIES_STORE_NAME).getAll();
      req3.onsuccess = () => { backup.groupSecurityPolicies = req3.result; };

      transaction.oncomplete = () => resolve(JSON.stringify(backup));
      transaction.onerror = (e) => reject(e.target.error);
    });
  },

  async getGroupSecurityPolicy(groupId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SECURITY_POLICIES_STORE_NAME], 'readonly');
      const store = transaction.objectStore(GROUP_SECURITY_POLICIES_STORE_NAME);
      const request = store.get(groupId);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async saveGroupSecurityPolicy(policy) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([GROUP_SECURITY_POLICIES_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GROUP_SECURITY_POLICIES_STORE_NAME);
      const request = store.put(policy);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async restoreAll(jsonString) {
    const db = await this.initDB();
    const backup = JSON.parse(jsonString);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, GROUP_SENDER_KEYS_STORE_NAME, GROUP_SKIPPED_KEYS_STORE_NAME, GROUP_SECURITY_POLICIES_STORE_NAME], 'readwrite');
      
      if (backup.keyring) {
        const store0 = transaction.objectStore(STORE_NAME);
        store0.clear();
        backup.keyring.forEach(item => store0.put(item));
      }

      if (backup.groupSenderKeys) {
        const store1 = transaction.objectStore(GROUP_SENDER_KEYS_STORE_NAME);
        store1.clear();
        backup.groupSenderKeys.forEach(item => store1.put(item));
      }
      
      if (backup.groupSkippedKeys) {
        const store2 = transaction.objectStore(GROUP_SKIPPED_KEYS_STORE_NAME);
        store2.clear();
        backup.groupSkippedKeys.forEach(item => store2.put(item));
      }

      if (backup.groupSecurityPolicies) {
        const store3 = transaction.objectStore(GROUP_SECURITY_POLICIES_STORE_NAME);
        store3.clear();
        backup.groupSecurityPolicies.forEach(item => store3.put(item));
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
  }
};
