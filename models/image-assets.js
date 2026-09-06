/* IndexedDB ownership lives here; callers deal only with image records.
   Writes resolve on commit, and failed connections can be retried. */
const ImageAssets = (() => {
  function create({ indexedDB, databaseName = "glamour-atelier-assets-v1" }) {
    const storeName = "character-assets";
    let connection;
    function open() {
      if (connection) return connection;
      if (!indexedDB) return Promise.reject(new Error("이 브라우저에서는 이미지 저장을 지원하지 않습니다."));
      const attempt = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "assetKey" });
        request.onsuccess = () => {
          const database = request.result;
          const disconnected = () => { if (connection === attempt) connection = null; };
          database.onversionchange = () => { database.close(); disconnected(); };
          database.onclose = disconnected;
          resolve(database);
        };
        request.onerror = () => reject(request.error || new Error("이미지 저장소를 열지 못했습니다."));
      });
      connection = attempt;
      attempt.catch(() => { if (connection === attempt) connection = null; });
      return attempt;
    }
    async function transact(mode, action) {
      const database = await open();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error("이미지 저장소 작업에 실패했습니다."));
        transaction.onabort = () => reject(transaction.error || new Error("이미지 저장소 작업이 중단되었습니다."));
        action(transaction.objectStore(storeName), value => { result = value; });
      });
    }
    function read(key) {
      if (!key) return Promise.resolve(null);
      return transact("readonly", (store, done) => {
        const request = store.get(key);
        request.onsuccess = () => done(request.result || null);
      });
    }
    function update(key, patch) {
      if (!key) return Promise.resolve();
      return transact("readwrite", store => {
        const request = store.get(key);
        request.onsuccess = () => {
          try { store.put({ ...(request.result || {}), ...patch, assetKey: key, updatedAt: Date.now() }); }
          catch { store.transaction.abort(); }
        };
      });
    }
    function clear() { return transact("readwrite", store => { store.clear(); }); }
    function prune(liveKeys) {
      return transact("readwrite", store => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (!liveKeys.has(cursor.key)) cursor.delete();
          cursor.continue();
        };
      });
    }
    return { read, update, clear, prune };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = ImageAssets;
