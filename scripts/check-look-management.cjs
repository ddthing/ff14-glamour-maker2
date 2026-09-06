const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    await page.waitForFunction(() => document.querySelector('#canvasBoard').dataset.cast === '1');
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 120;
      canvas.getContext('2d').fillRect(0, 0, 80, 120);
      return canvas.toDataURL().split(',')[1];
    }), 'base64');
    const upload = async name => {
      await page.locator('#imageInput').setInputFiles({ name, mimeType: 'image/png', buffer: png });
      await page.waitForFunction(name => document.querySelector('#sourceFileName').textContent === name, name);
      await page.waitForFunction(() => pendingAssetWrites.size === 0);
    };
    const loaded = () => page.waitForFunction(() => document.querySelector('#portraitWrap img')?.naturalWidth > 0);
    const manage = () => page.locator('#manageLookButton').click();
    await upload('original.png'); await loaded();
    await page.locator('#libraryToggleButton').click();
    await manage();
    await page.locator('#lookNameInput').fill('원본 룩');
    await page.locator('#renameLookForm button').click();
    assert.equal(await page.locator('#boardTitle').textContent(), '원본 룩');
    await page.locator('#undoButton').click();
    assert.equal(await page.locator('#boardTitle').textContent(), '새로운 룩');
    await page.locator('#redoButton').click();
    const originalKey = await page.evaluate(() => state.characters[0].assetKey);
    await manage(); await page.locator('#duplicateLookButton').click();
    await page.waitForFunction(() => looks.length === 2 && !lookCopyInProgress);
    const duplicateId = await page.evaluate(() => state.selectedLookId);
    const copyKey = await page.evaluate(() => state.characters[0].assetKey);
    assert.notEqual(copyKey, originalKey, 'Duplicate shares mutable image storage with source');
    assert.equal(await page.locator('#boardTitle').textContent(), '원본 룩 복사본');
    assert.equal(await page.evaluate(() => state.history.length), 0, 'Duplicate inherited source undo history');
    await page.evaluate(async key => {
      await characterAssetVault.update(key, { cutoutBlob: new Blob(['separate-result'], { type: 'image/png' }) });
    }, copyKey);
    assert.equal(await page.evaluate(async key => (await characterAssetVault.read(key)).cutoutBlob, originalKey), null);
    await upload('replacement.png');
    await page.locator('[data-look-id="look-1"]').click(); await loaded();
    assert.equal(await page.locator('#sourceFileName').textContent(), 'original.png');
    await manage(); await page.locator('#deleteLookButton').click();
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => looks.length), 1);
    await page.locator('#restoreDeletedLookButton').click();
    await page.locator('#closeLookManager').click(); await loaded();
    assert.equal(await page.locator('#sourceFileName').textContent(), 'original.png');
    assert.equal(await page.evaluate(() => state.characters[0].assetKey), originalKey);
    await page.reload(); await loaded();
    assert.equal(await page.locator('#boardTitle').textContent(), '원본 룩');
    await page.locator(`[data-look-id="${duplicateId}"]`).click(); await loaded();
    assert.equal(await page.locator('#sourceFileName').textContent(), 'replacement.png');

    await page.setViewportSize({ width: 320, height: 800 });
    await manage();
    await page.screenshot({ path: 'artifacts/look-management-mobile.png' });
    const box = await page.locator('#lookManagerDialog').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 320);
    assert.equal(await page.evaluate(() => document.querySelector('#lookManagerDialog').scrollWidth > document.querySelector('#lookManagerDialog').clientWidth), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#manageLookButton').evaluate(el => el === document.activeElement), true);
    await page.screenshot({ path: 'artifacts/look-library-mobile.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await manage();
    await page.evaluate(() => { window.realRead = characterAssetVault.read; characterAssetVault.read = async () => null; });
    await page.locator('#duplicateLookButton').click();
    await page.waitForFunction(() => !lookCopyInProgress);
    assert.equal(await page.evaluate(() => looks.length), 2);
    assert.match(await page.locator('#lookManagerStatus').textContent(), /사진 원본/);
    await page.evaluate(() => { characterAssetVault.read = window.realRead; });
    await page.locator('#deleteLookButton').click();
    await page.locator('#deleteLookButton').click();
    assert.equal(await page.evaluate(() => looks.length), 1);
    assert.equal(await page.locator('#portraitWrap img').count(), 0);
    await page.locator('#restoreDeletedLookButton').click();
    await page.evaluate(() => {
      characterAssetVault.read = key => new Promise(resolve => { window.releaseCopyRead = resolve; }).then(() => window.realRead(key));
    });
    await page.locator('#duplicateLookButton').click();
    await page.waitForFunction(() => typeof window.releaseCopyRead === 'function');
    await page.locator('#closeLookManager').click();
    await page.locator('#resetButton').click(); await page.locator('#resetWorkspaceButton').click();
    await page.locator('#confirmWorkspaceDelete').click();
    await page.waitForFunction(() => !document.querySelector('#deleteWorkspaceDialog').open);
    await page.evaluate(() => window.releaseCopyRead());
    await page.waitForFunction(() => !lookCopyInProgress);
    assert.equal(await page.evaluate(() => looks.length), 1, 'Late duplication recreated a deleted look');
    assert.equal(await page.evaluate(() => deletedLooks.length), 0);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#canvasBoard').dataset.cast === '1');
    assert.equal(await page.locator('#portraitWrap img').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: rename undo, independent duplicate assets, delete/restore after cleanup, reload, empty workspace, copy failure, mobile dialog and focus.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
