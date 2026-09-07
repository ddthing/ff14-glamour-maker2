const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
  'base64',
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/api/items/search?*', route => route.fulfill({ json: {
      source: 'test', results: [{ id: '999999', slot: 'head', names: {
        ko: '아주 긴 아이템 이름을 가진 별빛 여행자의 화려한 머리 장식',
        en: 'ExtraordinarilyLongUnbrokenEquipmentNameForWrappingVerification',
      } }],
    } }));
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    await page.waitForSelector('#castSelector button');
    await page.locator('[data-cast-count="3"]').click();
    await page.locator('#imageInput').setInputFiles([
      { name: 'character-one.png', mimeType: 'image/png', buffer: fixturePng },
      { name: 'character-two.png', mimeType: 'image/png', buffer: fixturePng },
      { name: 'character-three.png', mimeType: 'image/png', buffer: fixturePng },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#portraitWrap .character-figure img').length === 3);
    for (const selector of ['[data-character-select="1"]', '#portraitWrap [data-character-index="2"]']) {
      await page.locator(selector).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(selector).evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator(selector).getAttribute('aria-pressed'), 'true');
    }
    const first = page.locator('#portraitWrap [data-character-index="0"]');
    const third = page.locator('#portraitWrap [data-character-index="2"] img');
    const originalThird = await third.evaluate(el => el.style.transform);
    const originalFirst = await first.locator('img').evaluate(el => el.style.transform);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await first.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await first.locator('img').evaluate(el => el.style.transform), originalFirst);
    assert.equal(await third.evaluate(el => el.style.transform), originalThird);
    assert.equal(await first.evaluate(el => el === document.activeElement), true);
    await page.locator('[data-info-character="1"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-item-character') === '1');
    await page.locator('[data-item-character="2"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-item-character="2"]').evaluate(el => el === document.activeElement), true);
    await page.locator('.equipment-row[data-slot="head"]').click();
    await page.waitForFunction(() => document.activeElement?.id === 'itemSearch');
    assert.equal(await page.locator('.equipment-row[data-slot="head"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#itemSearch').fill('긴 이름');
    await page.waitForSelector('.catalog-result');
    await page.setViewportSize({ width: 320, height: 800 });
    for (const selector of ['.catalog-result-copy strong', '.catalog-result-copy span']) {
      assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    }
    await page.locator('.catalog-result').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'itemSearch');
    for (const selector of ['.equipment-row[data-slot="head"] strong', '.equipment-row[data-slot="head"] .equipment-copy span']) {
      assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
    }
    for (const count of [1, 2, 5]) {
      await page.locator('#styleTab').click();
      await page.locator(`[data-cast-count="${count}"]`).click();
      await page.locator('#itemsTab').click();
      assert.equal(await page.locator('#itemCharacterSelector button').count(), count);
      assert.equal(await page.locator('.equipment-row').count(), 5);
      assert.equal(await page.locator('#itemCharacterSelector').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.screenshot({ path: 'artifacts/accessibility-equipment-320.png', fullPage: true });
    console.log('PASS: character focus, focused-character nudge, card-to-panel navigation, equipment selection, long names, 1/2/5-character mobile layout.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
