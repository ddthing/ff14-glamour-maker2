const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    await page.waitForFunction(() => document.querySelector('#canvasBoard').dataset.cast === '1');
    await page.evaluate(() => {
      const update = characterAssetVault.update;
      window.releaseWrites = [];
      characterAssetVault.update = (...args) => new Promise(resolve => releaseWrites.push(resolve)).then(() => update(...args));
      window.fixture = name => new File(['fixture'], name, { type: 'image/png' });
      window.importDone = handleImageFiles([fixture('A.png'), fixture('B.png')]);
    });
    await page.locator('#libraryToggleButton').click();
    await page.locator('#addLookButton').click();
    await page.evaluate(async () => { releaseWrites.splice(0).forEach(resolve => resolve()); await importDone; });
    assert.deepEqual(await page.evaluate(() => state.characters.map(c => c.assetKey).filter(Boolean)), []);
    await page.locator('[data-look-id="look-1"]').click();
    assert.deepEqual(await page.evaluate(() => state.characters.slice(0, 2).map(c => c.fileName)), ['A.png', 'B.png']);

    await page.evaluate(() => {
      window.importDone = handleImageFiles([fixture('C.png'), fixture('D.png')]);
      window.resetDone = resetWorkspace();
    });
    await page.evaluate(async () => { releaseWrites.splice(0).forEach(resolve => resolve()); await Promise.all([importDone, resetDone]); });
    assert.equal(await page.evaluate(() => state.characterCount), 1);
    assert.equal(await page.locator('#portraitWrap img').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('glamour-atelier-draft-v3')), null);
    const count = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      let total = 0;
      for (const entry of databases) {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open(entry.name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        for (const name of db.objectStoreNames) total += await new Promise((resolve, reject) => { const request = db.transaction(name).objectStore(name).count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close();
      }
      return total;
    });
    assert.equal(count, 0, 'Late image writes survived permanent deletion');
    console.log('PASS: delayed multi-image import stays in its look; permanent deletion drains writes and leaves no assets or draft.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
