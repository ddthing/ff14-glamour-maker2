const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

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

    let releaseSearch;
    const searchPending = new Promise((resolve) => { releaseSearch = resolve; });
    await page.route("**/api/items/search*", async (route) => {
      await searchPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ id: "check-ui-item", slot: "head", names: { ko: "검증용 장비", en: "UI check item" }, meta: { ko: "머리 · 검증" } }],
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
    await page.waitForSelector('.catalog-result[data-item-id="check-ui-item"]');
    await page.unroute("**/api/items/search*");

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

    await page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "equipment panel overflows at 320px");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "artifacts/ui-equipment-panel-after.png", fullPage: true });
    console.log("PASS: equipment selection rhythm, action pills, catalog progress motion, reduced-motion fallback, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
