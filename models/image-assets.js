/* IndexedDB ownership lives here; callers deal only with image records.
   Writes resolve on commit, failed connections can be retried, and renamed
   databases are read through once so existing projects keep their images. */
const ImageAssets = (() => {
  const defaultDatabaseName = "tuyeong-set-maker2-assets-v1";

  function create({ indexedDB, databaseName = defaultDatabaseName, legacyDatabaseNames = [] } = {}) {
    const storeName = "character-assets";
    const databaseNames = [databaseName, ...legacyDatabaseNames]
      .filter((name, index, names) => typeof name === "string" && name && names.indexOf(name) === index);
    const connections = new Map();

    function openNamed(name) {
      if (connections.has(name)) return connections.get(name);
      if (!indexedDB) return Promise.reject(new Error("이 브라우저에서는 이미지 저장을 지원하지 않습니다."));

      const attempt = new Promise((resolve, reject) => {
        let request;
        try {
          request = indexedDB.open(name, 1);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = () => {
          const database = request.result;
          const hasStore = typeof database.objectStoreNames?.contains === "function"
            ? database.objectStoreNames.contains(storeName)
            : false;
          if (!hasStore) database.createObjectStore(storeName, { keyPath: "assetKey" });
        };
        request.onsuccess = () => {
          const database = request.result;
          const disconnected = () => {
            if (connections.get(name) === attempt) connections.delete(name);
          };
          database.onversionchange = () => { database.close(); disconnected(); };
          database.onclose = disconnected;
          resolve(database);
        };
        request.onerror = () => reject(request.error || new Error("이미지 저장소를 열지 못했습니다."));
      });
      connections.set(name, attempt);
      attempt.catch(() => {
        if (connections.get(name) === attempt) connections.delete(name);
      });
      return attempt;
    }

    function transactNamed(name, mode, action) {
      return openNamed(name).then((database) => new Promise((resolve, reject) => {
        let transaction;
        try {
          transaction = database.transaction(storeName, mode);
        } catch (error) {
          reject(error);
          return;
        }
        let result;
        let settled = false;
        const rejectOnce = (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        transaction.onerror = () => rejectOnce(transaction.error || new Error("이미지 저장소 작업에 실패했습니다."));
        transaction.onabort = () => rejectOnce(transaction.error || new Error("이미지 저장소 작업이 중단되었습니다."));
        try {
          action(transaction.objectStore(storeName), value => { result = value; });
        } catch (error) {
          try { transaction.abort(); } catch { /* The transaction may already be finished. */ }
          rejectOnce(error);
        }
      }));
    }

    function readFrom(name, key) {
      return transactNamed(name, "readonly", (store, done) => {
        const request = store.get(key);
        request.onsuccess = () => done(request.result || null);
      });
    }

    async function findLegacyRecord(key) {
      for (const name of databaseNames.slice(1)) {
        try {
          const record = await readFrom(name, key);
          if (record) return { databaseName: name, record };
        } catch {
          // A legacy database may be unavailable; the current database remains authoritative.
        }
      }
      return null;
    }

    async function promoteLegacyRecord(record) {
      try {
        await transactNamed(databaseName, "readwrite", store => { store.put(record); });
      } catch {
        // Returning the legacy record still keeps the current edit usable when promotion fails.
      }
    }

    async function read(key) {
      if (!key) return null;
      let currentError;
      try {
        const current = await readFrom(databaseName, key);
        if (current) return current;
      } catch (error) {
        currentError = error;
      }
      const legacy = await findLegacyRecord(key);
      if (legacy?.record) {
        await promoteLegacyRecord(legacy.record);
        return legacy.record;
      }
      if (currentError) throw currentError;
      return null;
    }

    function persist(name, key, patch, existing) {
      return transactNamed(name, "readwrite", store => {
        try {
          store.put({ ...(existing || {}), ...patch, assetKey: key, updatedAt: Date.now() });
        } catch {
          store.transaction.abort();
        }
      });
    }

    async function update(key, patch) {
      if (!key) return;
      let current;
      let currentError;
      try {
        current = await readFrom(databaseName, key);
      } catch (error) {
        currentError = error;
      }
      const legacy = current ? null : await findLegacyRecord(key);
      if (!currentError) return persist(databaseName, key, patch, current || legacy?.record);
      if (legacy?.record) {
        try {
          return await persist(databaseName, key, patch, legacy.record);
        } catch {
          return persist(legacy.databaseName, key, patch, legacy.record);
        }
      }
      return persist(databaseName, key, patch, null);
    }

    async function runOnAllDatabases(action) {
      let firstError;
      for (const name of databaseNames) {
        try {
          await transactNamed(name, "readwrite", action);
        } catch (error) {
          firstError ||= error;
        }
      }
      if (firstError) throw firstError;
    }

    function clear() {
      return runOnAllDatabases(store => { store.clear(); });
    }

    function prune(liveKeys) {
      return runOnAllDatabases(store => {
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
