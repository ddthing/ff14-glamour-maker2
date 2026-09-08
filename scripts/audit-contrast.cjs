const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Solid-color UI audit. Export artwork, imagery, opacity and gradients need visual review.
async function measureContrast(page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    function rgba(color) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
    }
    function composite(a, b) {
      return a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3])).concat(1);
    }
    function background(el) {
      return el ? composite(rgba(getComputedStyle(el).backgroundColor), background(el.parentElement)) : [255, 255, 255, 1];
    }
    function luminance(color) {
      return color.slice(0, 3).map(v => {
        v /= 255;
        return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
      }).reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
    }
    function ratio(color, bg) {
      const a = luminance(composite(rgba(color), bg)), b = luminance(bg);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }
    const checks = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('#canvasBoard, .sr-only') || el.matches(':disabled') || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const style = getComputedStyle(el), bg = background(el);
      if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) {
        checks.push({ element: el.id || el.className || el.tagName, kind: 'text', ratio: ratio(style.color, bg), minimum: 4.5 });
      }
      if (el.matches('input[type="search"], input[type="text"], select')) {
        checks.push({ element: el.id, kind: 'boundary', ratio: ratio(style.borderTopColor, bg), minimum: 3 });
        if (el.getAttribute('placeholder')) checks.push({ element: el.id, kind: 'placeholder', ratio: ratio(getComputedStyle(el, '::placeholder').color, bg), minimum: 4.5 });
      }
    }
    return checks;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/api/items/search?*', route => route.fulfill({ json: {
      results: [{ id: '999999', slot: 'head', names: { ko: '접근성 검증용 머리 장식', en: 'Equipment contrast test' } }],
    } }));
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    await page.waitForSelector('#castSelector button');
    assert.equal(await page.locator('#backgroundPresetPanel').count(), 0);
    await page.locator('#styleAdvancedToggle').click();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      for (const panel of ['style', 'items']) {
        await page.locator(`#${panel}Tab`).click();
        if (panel === 'items') {
          await page.locator('#itemSearch').fill('검증');
          await page.waitForSelector('.catalog-result');
        }
        await page.waitForTimeout(350); // Wait for theme and button color transitions. const checks below reads settled colors.
        const checks = await measureContrast(page);
        const failures = checks.filter(c => c.ratio < c.minimum);
        results.push({ theme: dark ? 'dark' : 'light', panel, checked: checks.length, minTextRatio: Math.min(...checks.filter(c => c.kind === 'text').map(c => c.ratio)), failures });
        assert.deepEqual(failures, [], JSON.stringify(failures));
      }
    }
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    for (const width of [640, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const panel of ['style', 'items']) {
        await page.locator(`#${panel}Tab`).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${panel} overflow`);
      }
    }
    await page.locator('#styleTab').click();
    // The lineup switch is only rendered for 3+ character layouts. Set that
    // state before checking its keyboard focus treatment after the mobile
    // reflow pass above.
    await page.locator('[data-cast-count="3"]').click();
    await page.keyboard.press('Tab');
    await page.locator('#multiInfoToggle').focus();
    const focus = await page.locator('#multiInfoToggle + span').evaluate(el => getComputedStyle(el).outlineStyle);
    assert.equal(focus, 'solid');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#multiInfoToggle').isChecked(), false);
    await page.keyboard.press('Space');
    await page.screenshot({ path: 'artifacts/accessibility-320.png', fullPage: true });
    fs.writeFileSync('artifacts/accessibility-contrast.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    console.log('PASS: hidden form, light/dark contrast, 640/320px reflow, switch focus and keyboard.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });


