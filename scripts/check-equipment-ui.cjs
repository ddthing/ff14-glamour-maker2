const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.locator('[data-cast-count="3"]').click();
    await page.locator("#itemsTab").click();
    await page.waitForSelector("#itemsPanel");

    const initial = await page.evaluate(() => {
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      const characters = [...document.querySelectorAll(".item-character-button")].map((element) => ({
        box: box(element),
        pressed: element.getAttribute("aria-pressed"),
      }));
      const rows = [...document.querySelectorAll(".equipment-row")].map((element) => ({
        box: box(element),
        pressed: element.getAttribute("aria-pressed"),
        action: box(element.querySelector(".equipment-check")),
        actionRadius: getComputedStyle(element.querySelector(".equipment-check")).borderRadius,
      }));
      return {
        characters,
        rows,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });

    assert.equal(initial.characters.length, 3, "character selector should expose all active characters");
    assert.ok(initial.characters.every(({ box }) => box.height >= 44), `character target rhythm drifted: ${JSON.stringify(initial.characters)}`);
    assert.equal(initial.characters.filter(({ pressed }) => pressed === "true").length, 1, "character selection is ambiguous");
    assert.equal(initial.rows.length, 5, "equipment list should expose all five outfit slots");
    assert.ok(initial.rows.every(({ box }) => box.height >= 52), `equipment row rhythm drifted: ${JSON.stringify(initial.rows)}`);
    assert.ok(initial.rows.every(({ action }) => action.height >= 26 && action.width >= 27), `equipment action pill is too small: ${JSON.stringify(initial.rows)}`);
    assert.ok(initial.rows.every(({ actionRadius }) => actionRadius === "999px"), "equipment action should use the shared compact pill shape");
    assert.equal(initial.rows.filter(({ pressed }) => pressed === "true").length, 1, "slot selection is ambiguous");
    assert.equal(initial.overflow, false, "equipment panel introduces horizontal overflow");

    const fulfillIcon = (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: fixturePng,
    });
    await page.route("https://xivapi.com/i/**", fulfillIcon);
    await page.route("https://v2.xivapi.com/api/asset**", fulfillIcon);

    let releaseSearch;
    const searchPending = new Promise((resolve) => { releaseSearch = resolve; });
    await page.route("**/api/items/search*", async (route) => {
      await searchPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: Array.from({ length: 250 }, (_, index) => index === 0
            ? { id: "9000001", slot: "head", iconUrl: "https://xivapi.com/i/900000/900001.png", names: { ko: "검증용 장비", en: "UI check item" }, meta: { ko: "머리 · 검증" } }
            : { id: String(9000001 + index), slot: "head", names: { ko: `검증용 장비 ${index}` }, meta: { ko: "머리 · 검증" } }),
        }),
      });
    });

    await page.locator("#itemSearch").fill("검증");
    await page.waitForSelector(".catalog-progress");
    const loading = await page.evaluate(() => ({
      animation: getComputedStyle(document.querySelector(".catalog-progress")).animationName,
      busy: document.querySelector("#catalogResults").getAttribute("aria-busy"),
    }));
    assert.equal(loading.animation, "catalog-progress", "catalog loading state has no visible progress motion");
    assert.equal(loading.busy, "true", "catalog loading state lost aria-busy");

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".catalog-progress").evaluate((element) => getComputedStyle(element).animationName), "none", "catalog motion ignores reduced-motion");
    releaseSearch();
    await page.waitForSelector('.catalog-result[data-item-id="9000001"]');
    const boundedCatalog = await page.evaluate(() => ({
      renderedCount: document.querySelectorAll(".catalog-result").length,
      status: document.querySelector("#catalogStatus")?.textContent || "",
    }));
    assert.ok(boundedCatalog.renderedCount <= 24, `catalog DOM should stay bounded for oversized responses: ${JSON.stringify(boundedCatalog)}`);
    assert.match(boundedCatalog.status, /250|24/, "bounded catalog should expose its result window to assistive technology");
    await page.waitForFunction(() => document.querySelector('.catalog-result[data-item-id="9000001"] .item-image')?.naturalWidth > 0);
    const catalogImage = await page.locator('.catalog-result[data-item-id="9000001"] .item-image').evaluate((image) => ({
      src: image.getAttribute("src"),
      loading: image.getAttribute("loading"),
      naturalWidth: image.naturalWidth,
      fallback: image.closest(".catalog-result-icon")?.classList.contains("is-image-fallback"),
    }));
    assert.equal(catalogImage.src, "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F900000%2F900001.tex&format=png", "catalog results should use the current item asset when one is available");
    assert.equal(catalogImage.loading, "eager", "visible catalog item images must not be deferred behind the scroll container");
    assert.ok(catalogImage.naturalWidth > 0, `catalog item image did not load: ${JSON.stringify(catalogImage)}`);
    assert.equal(catalogImage.fallback, false, "a loaded item image must not expose the slot glyph fallback");

    const loadingModes = await page.evaluate(() => {
      const results = Array.from({ length: 10 }, (_, index) => ({
        id: index === 0 ? "9000001" : String(9000100 + index),
        slot: "head",
        iconUrl: `https://xivapi.com/i/900000/${String(index === 0 ? 900001 : 900010 + index).padStart(6, "0")}.png`,
        names: { ko: `지연 로드 검증 ${index}` },
        meta: { ko: "머리 · 검증" },
      }));
      renderCatalogResults(results);
      return [...document.querySelectorAll(".catalog-result .item-image")].map((image) => image.loading);
    });
    assert.deepEqual(loadingModes.slice(0, 8), Array(8).fill("eager"), "the first catalog viewport should load item icons immediately");
    assert.deepEqual(loadingModes.slice(8), ["lazy", "lazy"], "catalog icons past the first viewport should be deferred");
    await page.unroute("**/api/items/search*");

    await page.locator('.catalog-result[data-item-id="9000001"]').click();
    const savedCatalogSize = await page.evaluate(() => {
      const snapshot = JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3"));
      return snapshot.catalogItems.length;
    });
    assert.equal(savedCatalogSize, 1, "localStorage should retain only catalog records referenced by outfits");

    await page.waitForFunction(() => document.querySelector('.equipment-row[data-slot="head"] .item-image')?.naturalWidth > 0);
    const linked = await page.evaluate(() => {
      const row = document.querySelector('.equipment-row[data-slot="head"]');
      const image = row?.querySelector(".item-image");
      return {
        image: image?.getAttribute("src") || "",
        naturalWidth: image?.naturalWidth || 0,
        fallback: row?.querySelector(".equipment-icon")?.classList.contains("is-image-fallback") || false,
        removeCount: document.querySelectorAll('.equipment-remove[data-remove-slot="head"]').length,
        removeLabel: document.querySelector('.equipment-remove[data-remove-slot="head"]')?.getAttribute("aria-label") || "",
        cardItemImages: document.querySelectorAll('#canvasBoard img[src*="xivapi.com"]').length,
      };
    });
    assert.equal(linked.image, "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F900000%2F900001.tex&format=png", "assigned equipment should show the current item asset");
    assert.ok(linked.naturalWidth > 0, `assigned equipment image did not load: ${JSON.stringify(linked)}`);
    assert.equal(linked.fallback, false, "assigned equipment should not show the slot glyph when its image loaded");
    assert.equal(linked.removeCount, 1, "assigned equipment should expose a remove button");
    assert.match(linked.removeLabel, /제거/, "remove button should describe the destructive action");
    assert.equal(linked.cardItemImages, 0, "item images must stay out of the composition card");

    await page.screenshot({ path: "artifacts/ui-equipment-panel-item-image.png", fullPage: true });
    await page.locator('.equipment-remove[data-remove-slot="head"]').click();
    await page.waitForFunction(() => document.querySelector('.equipment-row[data-slot="head"]')?.classList.contains("is-empty"));
    const removed = await page.evaluate(() => {
      const snapshot = JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3"));
      const row = document.querySelector('.equipment-row[data-slot="head"]');
      return {
        empty: row?.classList.contains("is-empty"),
        image: row?.querySelector(".item-image")?.getAttribute("src") || "",
        removeCount: document.querySelectorAll('.equipment-remove[data-remove-slot="head"]').length,
        outfitValue: snapshot?.looks?.[0]?.outfits?.[0]?.head ?? null,
        savedCatalogSize: snapshot?.catalogItems?.length ?? -1,
      };
    });
    assert.equal(removed.empty, true, "remove should clear the assigned equipment row");
    assert.equal(removed.image, "", "removed equipment should no longer render its item image");
    assert.equal(removed.removeCount, 0, "remove action should disappear after clearing the slot");
    assert.equal(removed.outfitValue, null, "remove should persist an empty outfit slot");
    assert.equal(removed.savedCatalogSize, 0, "unreferenced item records should be dropped after removal");

    await page.setViewportSize({ width: 320, height: 800 });
    const mobileCatalogFlow = await page.locator("#catalogResults").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
    assert.equal(mobileCatalogFlow.maxHeight, "none", `mobile catalog must not be capped: ${JSON.stringify(mobileCatalogFlow)}`);
    assert.equal(mobileCatalogFlow.overflowY, "visible", `mobile catalog must stay in document flow: ${JSON.stringify(mobileCatalogFlow)}`);
    assert.equal(mobileCatalogFlow.scrollHeight, mobileCatalogFlow.clientHeight, `mobile catalog created a nested scroll surface: ${JSON.stringify(mobileCatalogFlow)}`);
    await page.evaluate(() => window.scrollTo(0, Math.max(0, document.querySelector("#catalogResults").offsetTop - 72)));
    await page.screenshot({ path: "artifacts/ui-equipment-panel-mobile-flow.png", fullPage: false });

    const result = await page.evaluate(() => {
      const action = document.querySelector(".catalog-result-action");
      const rect = action.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        radius: getComputedStyle(action).borderRadius,
        hidden: action.getAttribute("aria-hidden"),
      };
    });
    assert.ok(result.width >= 32 && result.height >= 32, `catalog action target is too small: ${JSON.stringify(result)}`);
    assert.equal(result.radius, "999px", "catalog action should share the compact pill shape");
    assert.equal(result.hidden, "true", "catalog action glyph should stay decorative in the accessibility tree");

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "equipment panel overflows at 320px");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "artifacts/ui-equipment-panel-after.png", fullPage: true });
    console.log("PASS: equipment selection rhythm, item images, remove action, catalog progress motion, reduced-motion fallback, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
