const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    const result = await page.evaluate(async () => {
      let attempts = 0;
      const store = ImageAssets.create({ databaseName: 'asset-store-contract', indexedDB: {
        open(...args) {
          if (++attempts > 1) return indexedDB.open(...args);
          const request = { error: new DOMException('Injected opening failure', 'UnknownError') };
          queueMicrotask(() => request.onerror());
          return request;
        },
      } });
      let initialFailure = false;
      try { await store.read('keep'); } catch { initialFailure = true; }
      await store.update('keep', { originalBlob: new Blob(['original']) });
      await store.update('keep', { cutoutBlob: new Blob(['cutout']), assetKey: 'must-not-replace-key' });
      let aborted = false;
      try { await store.update('keep', { originalBlob: new Blob(['wrong']), invalid: () => {} }); }
      catch { aborted = true; }
      const saved = await store.read('keep');
      await store.update('unused', { originalBlob: new Blob(['unused']) });
      await store.prune(new Set(['keep']));
      const removed = await store.read('unused');
      const retained = await store.read('keep');
      await store.clear();
      return { initialFailure, attempts, aborted, original: await saved.originalBlob.text(),
        cutout: await saved.cutoutBlob.text(), key: saved.assetKey, removed, retained: !!retained,
        cleared: await store.read('keep'), missing: await store.read(null) };
    });
    assert.deepEqual(result, { initialFailure: true, attempts: 2, aborted: true, original: 'original',
      cutout: 'cutout', key: 'keep', removed: null, retained: true, cleared: null, missing: null });
    assert.deepEqual(errors, []);
    console.log('PASS: connection retry, committed patches, immutable keys, aborted write rollback, live-asset pruning and clear.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
