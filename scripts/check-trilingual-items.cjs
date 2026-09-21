const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const CardGearCopy = require("../models/card-gear-copy.js");

const slots = ["head", "body", "hands", "legs", "feet"];
const items = slots.map((slot, index) => ({
  id: String(980001 + index), slot,
  names: {
    ko: ["송아지 가죽 라이더 모자", "송아지 가죽 라이더 재킷", "송아지 가죽 라이더 장갑", "송아지 가죽 라이더 바지", "송아지 가죽 라이더 장화"][index],
    en: ["Calfskin Rider's Cap", "Calfskin Rider's Jacket", "Calfskin Rider's Gloves", "Calfskin Rider's Bottoms", "Calfskin Rider's Shoes"][index],
    ja: ["カーフスキン・ライダースキャップ", "カーフスキン・ライダースジャケット", "カーフスキン・ライダースグローブ", "カーフスキン・ライダースボトム", "カーフスキン・ライダースシューズ"][index],
  },
}));

(async () => {
  assert.deepEqual(CardGearCopy.localizedNames({ names: { ko: "동일", en: "동일", ja: "" } }).map(x => x.text), ["동일"]);
  assert.deepEqual(CardGearCopy.wrapText("First name\n日本語", s => s.length, 30), ["First name", "日本語"]);
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let active = 0, maximum = 0, requests = 0;
    await page.route("**/api/items/search**", async route => {
      active += 1; maximum = Math.max(maximum, active); requests += 1;
      const params = new URL(route.request().url()).searchParams;
      const item = items.find(item => item.id === params.get("q"));
      const language = params.get("language");
      await new Promise(resolve => setTimeout(resolve, 30));
      await route.fulfill({ json: { results: item ? [{ ...item, names: { [language]: item.names[language] } }] : [] } });
      active -= 1;
    });
    await page.goto(process.env.TEST_BASE_URL || "http://127.0.0.1:4173", { waitUntil: "networkidle" });
    const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
    await page.locator('#imageInput').setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `fixture-${i}.png`, mimeType: 'image/png', buffer: pixel })));
    await page.waitForFunction(() => state.characterCount === 5 && state.characters.slice(0, 5).every(c => resolveCharacterAsset(c, 'hero')));
    await page.evaluate(fixtures => {
      const look = getSelectedLook();
      ensureLookOutfits(look);
      fixtures.forEach(item => itemRecordCache.set(item.id, { ...item, names: { ko: item.names.ko } }));
      look.outfits.forEach(outfit => fixtures.forEach(item => outfit[item.slot] = item.id));
      renderAll();
    }, items);
    await page.waitForFunction(() => getItem("980005")?.names?.ja && getItem("980005")?.names?.en);
    assert.ok(maximum <= 4, `unbounded requests: ${maximum}`);
    assert.equal(requests, 10, "only missing translations should be fetched once");

    for (const count of [1, 2, 5]) {
      for (const language of ["ko", "en", "ja"]) {
        await page.evaluate(({ count, language }) => {
          state.characterCount = count; state.language = language; state.multiInfoEnabled = true;
          state.selectedCharacter = 0;
          renderAll();
        }, { count, language });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const selector = count <= 2 ? ".gear-tile-copy" : ".multi-info-item";
        const blocks = await page.locator(selector).evaluateAll(nodes => nodes.map(node => ({
          text: node.textContent,
          translations: [...node.querySelectorAll('.gear-name-translation')].map(span => ({ text: span.textContent, lang: span.lang, height: span.getBoundingClientRect().height })),
        })));
        assert.equal(blocks.length, count * 5);
        for (const [index, block] of blocks.entries()) {
          const item = items[index % 5];
          for (const name of Object.values(item.names)) assert.ok(block.text.includes(name), `${count}/${language}: missing ${name}`);
          assert.equal(block.translations.length, 2);
          assert.ok(block.translations.every(line => line.height > 0 && line.lang !== language));
        }
        const exportNames = await page.evaluate(() => {
          const layout = getCardLayout(state);
          const gear = state.characters.map((_, index) => getCharacterItemIds(index).map(getItem).map(item => ({ name: getItemName(item), secondaryName: getSecondaryItemName(item), slot: item.slot })));
          const captured = captureExportGearInfo(gear, state, layout.dimensions).slice(0, state.characterCount).flat();
          return captured.map(item => (item.preview?.secondaryCopy?.lines || []).map(line => line.text).join(''));
        });
        assert.ok(exportNames.every(text => text.length > 0), `PNG capture must include translated lines: ${JSON.stringify(exportNames)}`);
        for (const [index, text] of exportNames.entries()) {
          for (const entry of CardGearCopy.localizedNames(items[index % 5], language).slice(1)) {
            assert.ok(text.replace(/\s/g, '').includes(entry.text.replace(/\s/g, '')), `PNG lost ${entry.language}: ${text}`);
          }
        }
      }
      await page.screenshot({ path: `artifacts/trilingual-${count}.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `artifacts/trilingual-${count}-mobile.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.evaluate(() => saveState({ immediate: true }));
    await page.reload({ waitUntil: "networkidle" });
    assert.deepEqual(await page.evaluate(() => getItem("980001").names), items[0].names);
    assert.equal(requests, 10, "refresh must reuse persisted translations");
    await page.evaluate(() => ensureItemLanguageName({ id: "989999", slot: "head", names: { ko: "미등록 장비" } }, "ja"));
    const failedRequests = requests;
    await page.evaluate(() => Promise.all(Array.from({ length: 20 }, () => ensureItemLanguageName({ id: "989999", slot: "head", names: { ko: "미등록 장비" } }, "ja"))));
    assert.equal(requests, failedRequests, "a missing translation must not trigger a request on every render");
    console.log("PASS: three official names, locale ordering, bounded hydration, PNG capture, and refresh persistence.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
