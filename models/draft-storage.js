/* Draft persistence keeps the small, compatibility-sensitive path in
   localStorage and moves large snapshots behind an IndexedDB pointer. The
   public interface is intentionally tiny so callers do not need to know
   which storage adapter is active. Writes waiting behind an active write are
   coalesced, so rapid editor input persists only the newest snapshot. */
const DraftStorage = (() => {
  const pointerVersion = 2;
  const defaultDatabaseName = "tuyeong-set-maker2-drafts-v1";

  function create({
    localStorage: storage = globalThis.localStorage,
    indexedDB,
    databaseName = defaultDatabaseName,
    storeName = "drafts",
    largeThresholdBytes = 256 * 1024,
  } = {}) {
    const canUseIndexedDb = Boolean(indexedDB && typeof indexedDB.open === "function");
    let databasePromise = null;
    const operationQueue = [];
    let processingQueue = false;
    let recordSequence = 0;

    function openDatabase() {
      if (!canUseIndexedDb) return Promise.reject(new Error("IndexedDB를 사용할 수 없습니다."));
      if (databasePromise) return databasePromise;

      const attempt = new Promise((resolve, reject) => {
        let request;
        try {
          request = indexedDB.open(databaseName, 1);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = () => {
          const database = request.result;
          const hasStore = typeof database.objectStoreNames?.contains === "function"
            ? database.objectStoreNames.contains(storeName)
            : false;
          if (!hasStore) database.createObjectStore(storeName, { keyPath: "draftKey" });
        };
        request.onsuccess = () => {
          const database = request.result;
          const disconnected = () => {
            if (databasePromise === attempt) databasePromise = null;
          };
          database.onversionchange = () => { database.close(); disconnected(); };
          database.onclose = disconnected;
          resolve(database);
        };
        request.onerror = () => reject(request.error || new Error("초안 저장소를 열지 못했습니다."));
      });
      databasePromise = attempt;
      attempt.catch(() => {
        if (databasePromise === attempt) databasePromise = null;
      });
      return attempt;
    }

    function transact(mode, action) {
      return openDatabase().then((database) => new Promise((resolve, reject) => {
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
        transaction.onerror = () => rejectOnce(transaction.error || new Error("초안 저장소 작업에 실패했습니다."));
        transaction.onabort = () => rejectOnce(transaction.error || new Error("초안 저장소 작업이 중단되었습니다."));
        try {
          action(transaction.objectStore(storeName), value => { result = value; });
        } catch (error) {
          try { transaction.abort(); } catch { /* The transaction may already be finished. */ }
          rejectOnce(error);
        }
      }));
    }

    function readRecord(key) {
      return transact("readonly", (store, done) => {
        const request = store.get(key);
        request.onsuccess = () => done(request.result || null);
      });
    }

    function putRecord(key, payload) {
      return transact("readwrite", store => {
        store.put({ draftKey: key, payload, updatedAt: Date.now() });
      });
    }

    function deleteRecord(key) {
      return transact("readwrite", store => { store.delete(key); });
    }

    function deleteRecords(keys) {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      if (!uniqueKeys.length) return Promise.resolve();
      return transact("readwrite", store => {
        uniqueKeys.forEach(key => store.delete(key));
      });
    }

    function readLocal(key) {
      try { return storage?.getItem(key) ?? null; } catch { return null; }
    }

    function writeLocal(key, value) {
      if (!storage || typeof storage.setItem !== "function") {
        throw new Error("브라우저 저장소를 사용할 수 없습니다.");
      }
      storage.setItem(key, value);
    }

    function removeLocal(key) {
      storage?.removeItem(key);
    }

    function getPointer(raw, key) {
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        const isCurrentPointer = value?.version === pointerVersion
          && value.storage === "indexeddb"
          && value.key === key
          && typeof value.draftKey === "string"
          && value.draftKey.length > 0;
        // Version 1 pointers used the logical key as the IndexedDB key. Keep
        // reading them so an existing browser draft is never stranded by the
        // generation-based commit format.
        const isLegacyPointer = value?.version === 1
          && value.storage === "indexeddb"
          && value.draftKey === key;
        return isCurrentPointer || isLegacyPointer ? value : null;
      } catch {
        return null;
      }
    }

    function pointerRecordKeys(pointer) {
      if (!pointer) return [];
      return [...new Set([pointer.draftKey, pointer.previousDraftKey].filter(Boolean))];
    }

    function createRecordKey(key) {
      const nonce = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${(recordSequence += 1).toString(36)}`;
      return `${key}::${nonce}`;
    }

    function createPointer(key, recordKey, previousPointer, { bytes, payloadType } = {}) {
      const pointer = {
        version: pointerVersion,
        storage: "indexeddb",
        key,
        draftKey: recordKey,
        previousDraftKey: previousPointer?.draftKey || null,
        committedAt: Date.now(),
      };
      if (Number.isFinite(bytes)) pointer.bytes = bytes;
      if (payloadType) pointer.payloadType = payloadType;
      return pointer;
    }

    function restorePreviousPointer(key, previousRaw) {
      try {
        if (previousRaw === null || previousRaw === undefined) removeLocal(key);
        else writeLocal(key, previousRaw);
      } catch {
        // The original error remains the actionable failure. Restoration is
        // best effort because the browser may have exhausted its quota.
      }
    }

    async function writeIndexedDbRecord(key, payload, { bytes, payloadType, previousPointer, previousRaw } = {}) {
      const recordKey = createRecordKey(key);
      let committed = false;
      try {
        await putRecord(recordKey, payload);
        const pointer = createPointer(key, recordKey, previousPointer, { bytes, payloadType });
        try {
          writeLocal(key, JSON.stringify(pointer));
          const committedPointer = getPointer(readLocal(key), key);
          if (!committedPointer || committedPointer.draftKey !== recordKey) {
            throw new Error("초안 포인터를 확인하지 못했습니다.");
          }
        } catch (error) {
          restorePreviousPointer(key, previousRaw);
          throw error;
        }
        committed = true;

        // Keep the previous record for one-generation recovery. Once the new
        // pointer is verified, its grandparent is no longer needed.
        if (previousPointer?.previousDraftKey) {
          try { await deleteRecord(previousPointer.previousDraftKey); } catch { /* Recovery data is still optional cleanup. */ }
        }
        return "indexeddb";
      } finally {
        if (!committed) {
          try { await deleteRecord(recordKey); } catch { /* Avoid masking the original storage failure. */ }
        }
      }
    }

    function getByteLength(value) {
      if (typeof TextEncoder === "function") return new TextEncoder().encode(value).byteLength;
      return value.length;
    }

    function serializeValue(value) {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== "string") throw new Error("초안 값을 직렬화하지 못했습니다.");
      return serialized;
    }

    function parseValue(value) {
      if (typeof value !== "string") return value ?? null;
      try { return JSON.parse(value); } catch { return value; }
    }

    function payloadToText(payload) {
      return typeof payload === "string" ? payload : serializeValue(payload);
    }

    function pumpQueue() {
      if (processingQueue) return;
      processingQueue = true;
      void (async () => {
        while (operationQueue.length) {
          const operation = operationQueue.shift();
          try {
            const result = await operation.run();
            operation.waiters.forEach(({ resolve }) => resolve(result));
          } catch (error) {
            operation.waiters.forEach(({ reject }) => reject(error));
          }
        }
        processingQueue = false;
      })();
    }

    function enqueue(run, coalesceKey = "") {
      const promise = new Promise((resolve, reject) => {
        const previous = operationQueue[operationQueue.length - 1];
        if (coalesceKey && previous?.coalesceKey === coalesceKey) {
          previous.run = run;
          previous.waiters.push({ resolve, reject });
          return;
        }
        operationQueue.push({ coalesceKey, run, waiters: [{ resolve, reject }] });
      });
      pumpQueue();
      return promise;
    }

    async function writeNow(key, payload) {
      if (!key) throw new Error("초안 키가 필요합니다.");
      const value = String(payload ?? "");
      const byteLength = getByteLength(value);
      const previousRaw = readLocal(key);
      const previousPointer = getPointer(previousRaw, key);
      if (canUseIndexedDb && byteLength > largeThresholdBytes) {
        try {
          return await writeIndexedDbRecord(key, value, {
            bytes: byteLength,
            payloadType: "text",
            previousPointer,
            previousRaw,
          });
        } catch (error) {
          // A private browsing mode or quota policy may reject IndexedDB. Keep
          // the old localStorage contract as the last-resort recovery path.
          try {
            writeLocal(key, value);
            await deleteRecords(pointerRecordKeys(previousPointer));
            return "localStorage";
          } catch {
            throw error;
          }
        }
      }

      writeLocal(key, value);
      if (previousPointer && canUseIndexedDb) {
        try { await deleteRecords(pointerRecordKeys(previousPointer)); } catch { /* The local snapshot is authoritative now. */ }
      }
      return "localStorage";
    }

    async function writeValueNow(key, value, { preferIndexedDb = false } = {}) {
      if (!key) throw new Error("초안 키가 필요합니다.");
      const previousRaw = readLocal(key);
      const previousPointer = getPointer(previousRaw, key);
      if (preferIndexedDb && canUseIndexedDb) {
        try {
          // IndexedDB structured cloning keeps the large snapshot out of the
          // main thread's JSON serialization path. The app only passes plain
          // draft data here, so the record remains portable and inspectable.
          return await writeIndexedDbRecord(key, value, {
            payloadType: "structured",
            previousPointer,
            previousRaw,
          });
        } catch (error) {
          // Fall back to the established string format if a browser blocks
          // structured IndexedDB writes (for example private browsing).
          try {
            writeLocal(key, serializeValue(value));
            await deleteRecords(pointerRecordKeys(previousPointer));
            return "localStorage";
          } catch {
            throw error;
          }
        }
      }
      return writeNow(key, serializeValue(value));
    }

    function write(key, payload) {
      return enqueue(() => writeNow(key, payload), key);
    }

    function writeValue(key, value, options) {
      return enqueue(() => writeValueNow(key, value, options), key);
    }

    async function read(key) {
      if (!key) return null;
      const raw = readLocal(key);
      const pointer = getPointer(raw, key);
      if (!pointer) return raw;
      const result = await readRecordWithRecovery(pointer);
      if (!result) return null;
      if (result.key !== pointer.draftKey) repairPointer(key, pointer, result.key);
      return payloadToText(result.record.payload);
    }

    async function readRecordWithRecovery(pointer) {
      for (const recordKey of pointerRecordKeys(pointer)) {
        try {
          const record = await readRecord(recordKey);
          if (record && Object.prototype.hasOwnProperty.call(record, "payload")) {
            return { key: recordKey, record };
          }
        } catch {
          // A missing or temporarily unavailable current record can still be
          // recovered from the previous committed generation.
        }
      }
      return null;
    }

    function repairPointer(key, pointer, recordKey) {
      try {
        writeLocal(key, JSON.stringify({
          ...pointer,
          version: pointerVersion,
          key,
          draftKey: recordKey,
          previousDraftKey: null,
          recoveredAt: Date.now(),
        }));
      } catch {
        // Returning the recovered value is still useful if repair is blocked.
      }
    }

    async function readValue(key) {
      if (!key) return null;
      const raw = readLocal(key);
      const pointer = getPointer(raw, key);
      if (!pointer) return parseValue(raw);
      const result = await readRecordWithRecovery(pointer);
      if (!result) return null;
      if (result.key !== pointer.draftKey) repairPointer(key, pointer, result.key);
      return parseValue(result.record.payload);
    }

    function remove(key) {
      return enqueue(async () => {
        const pointer = getPointer(readLocal(key), key);
        removeLocal(key);
        if (pointer && canUseIndexedDb) await deleteRecords(pointerRecordKeys(pointer));
      });
    }

    return { read, readValue, write, writeValue, remove };
  }

  return { create };
})();

if (typeof module !== "undefined") module.exports = DraftStorage;
