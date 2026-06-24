const DB_NAME = 'SynapTalk_Crypto_v1';
const DB_VERSION = 1;
const STORE_NAME = 'Keyring';

export const IndexedDBService = {
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'keyId' });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async saveKey(keyId, privateKey, type = 'v2', mnemonic = null, publicKeyBase64 = null) {
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
        createdAt: new Date().toISOString()
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
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
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const keys = event.target.result;
        // Find the most recently created v2 key
        const v2Keys = keys.filter(k => k.type === 'v2');
        if (v2Keys.length === 0) return resolve(null);
        
        v2Keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(v2Keys[0]);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  async clearKeyring() {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
};
