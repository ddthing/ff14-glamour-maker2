const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    const result = await page.evaluate(async () => {
      const key = "draft-storage-contract";
      const databaseName = "draft-storage-contract-db";
      const store = DraftStorage.create({
        localStorage,
        indexedDB,
        databaseName,
        largeThresholdBytes: 32,
      });
      localStorage.removeItem(key);

      const first = JSON.stringify({ version: 3, marker: "first", body: "x".repeat(80) });
      const second = JSON.stringify({ version: 3, marker: "second", body: "y".repeat(80) });
      await Promise.all([store.write(key, first), store.write(key, second)]);
      const pointer = JSON.parse(localStorage.getItem(key));
      const largeRead = await store.read(key);

      const small = JSON.stringify({ version: 3, marker: "small" });
      await store.write(key, small);
      const smallRaw = localStorage.getItem(key);
      const smallRead = await store.read(key);

      const structuredKey = "draft-storage-structured";
      const structured = { version: 3, marker: "structured", body: "z".repeat(80) };
      await store.writeValue(structuredKey, structured, { preferIndexedDb: true });
      const structuredPointer = JSON.parse(localStorage.getItem(structuredKey));
      const structuredRead = await store.read(structuredKey);
      const structuredValue = await store.readValue(structuredKey);
      await store.remove(structuredKey);

      const openDatabase = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const listRecordKeys = async () => {
        const database = await openDatabase();
        return await new Promise((resolve, reject) => {
          const transaction = database.transaction("drafts", "readonly");
          const request = transaction.objectStore("drafts").getAllKeys();
          request.onsuccess = () => resolve(request.result.map(String));
          request.onerror = () => reject(request.error);
          transaction.oncomplete = () => database.close();
        });
      };

      const recoveryKey = "draft-storage-recovery";
      const recoveryFirst = { version: 3, marker: "recovery-first", body: "a".repeat(80) };
      const recoverySecond = { version: 3, marker: "recovery-second", body: "b".repeat(80) };
      await store.writeValue(recoveryKey, recoveryFirst, { preferIndexedDb: true });
      await store.writeValue(recoveryKey, recoverySecond, { preferIndexedDb: true });
      const recoveryPointer = JSON.parse(localStorage.getItem(recoveryKey));
      const database = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("drafts", "readwrite");
        transaction.objectStore("drafts").delete(recoveryPointer.draftKey);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      const recoveredValue = await store.readValue(recoveryKey);
      const repairedPointer = JSON.parse(localStorage.getItem(recoveryKey));
      await store.remove(recoveryKey);

      const pointerFailureKey = "draft-storage-pointer-failure";
      const pointerFailure = JSON.stringify({ version: 3, marker: "pointer-failure", body: "c".repeat(80) });
      let failPointerWrite = true;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItemWithOneInjectedFailure(key, value) {
        if (key === pointerFailureKey && failPointerWrite) {
          failPointerWrite = false;
          throw new DOMException("simulated quota", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
      let pointerFailureResult;
      try {
        pointerFailureResult = await store.write(pointerFailureKey, pointerFailure);
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
      const pointerFailureRead = await store.read(pointerFailureKey);
      const pointerFailureKeys = await listRecordKeys();
      await store.remove(pointerFailureKey);

      await store.write(key, second);
      await store.remove(key);
      const removed = { local: localStorage.getItem(key), value: await store.read(key) };

      const fallbackKey = "draft-storage-fallback";
      const fallback = DraftStorage.create({
        localStorage,
        indexedDB: null,
        databaseName: "draft-storage-fallback-db",
        largeThresholdBytes: 1,
      });
      await fallback.write(fallbackKey, first);
      const fallbackResult = {
        raw: localStorage.getItem(fallbackKey),
        value: await fallback.read(fallbackKey),
      };
      await fallback.remove(fallbackKey);

      return {
        pointer,
        largeRead,
        smallRaw,
        smallRead,
        structuredPointer,
        structuredRead,
        structuredValue,
        recoveredValue,
        recoveryPointer,
        repairedPointer,
        pointerFailureResult,
        pointerFailureRead,
        pointerFailureKeys,
        removed,
        fallbackResult,
      };
    });

    assert.equal(result.pointer.storage, "indexeddb");
    assert.equal(result.largeRead, JSON.stringify({ version: 3, marker: "second", body: "y".repeat(80) }));
    assert.equal(result.smallRaw, JSON.stringify({ version: 3, marker: "small" }));
    assert.equal(result.smallRead, result.smallRaw);
    assert.equal(result.structuredPointer.storage, "indexeddb");
    assert.equal(result.structuredRead, JSON.stringify({ version: 3, marker: "structured", body: "z".repeat(80) }));
    assert.deepEqual(result.structuredValue, { version: 3, marker: "structured", body: "z".repeat(80) });
    assert.deepEqual(result.recoveredValue, { version: 3, marker: "recovery-first", body: "a".repeat(80) });
    assert.equal(result.recoveryPointer.storage, "indexeddb");
    assert.equal(result.repairedPointer.draftKey, result.recoveryPointer.previousDraftKey);
    assert.equal(result.repairedPointer.previousDraftKey, null);
    assert.equal(result.pointerFailureResult, "localStorage");
    assert.equal(result.pointerFailureRead, JSON.stringify({ version: 3, marker: "pointer-failure", body: "c".repeat(80) }));
    assert.equal(result.pointerFailureKeys.some((key) => key.includes("draft-storage-pointer-failure::")), false, "a failed pointer commit must not leave an orphaned IndexedDB record");
    assert.deepEqual(result.removed, { local: null, value: null });
    assert.equal(result.fallbackResult.raw, JSON.stringify({ version: 3, marker: "first", body: "x".repeat(80) }));
    assert.equal(result.fallbackResult.value, result.fallbackResult.raw);

    const appIntegration = await page.evaluate(async () => {
      const appKey = "tuyeong-set-maker2-draft-v3";
      await draftStorage.remove(appKey);
      while (looks.length < 250) {
        const index = looks.length + 1;
        looks.push(createBlankLook(index, `draft-storage-look-${index}`));
      }
      await saveState();
      return {
        pointer: JSON.parse(localStorage.getItem(appKey)),
        persistedCount: JSON.parse(await draftStorage.read(appKey)).looks.length,
      };
    });
    await page.reload();
    await page.waitForFunction(() => looks.length === 250);
    const restoredCount = await page.evaluate(() => looks.length);
    assert.equal(appIntegration.pointer.storage, "indexeddb");
    assert.equal(appIntegration.persistedCount, 250);
    assert.equal(restoredCount, 250);
    console.log("PASS: large drafts use ordered IndexedDB writes, small drafts remain compatible, fallback and removal work.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
