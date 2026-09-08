const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const uiPreferencesStorageKey = "tuyeong-set-maker2-ui-v2";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173", { waitUntil: "networkidle" });
    await page.waitForSelector("#canvasBoard");
    await page.waitForSelector("#canvasViewZoomRange");

    const canvasIcons = await page.locator("#canvasViewBar .ui-icon").evaluateAll((icons) => icons.map((icon) => ({
      symbol: icon.querySelector("use")?.getAttribute("href") || "",
      hidden: icon.getAttribute("aria-hidden"),
      focusable: icon.getAttribute("focusable"),
    })));
    assert.deepEqual(canvasIcons.map(({ symbol }) => symbol), [
      "assets/icons/ui.svg#canvas-view",
      "assets/icons/ui.svg#minus",
      "assets/icons/ui.svg#plus",
      "assets/icons/ui.svg#pages",
      "assets/icons/ui.svg#fit",
      "assets/icons/ui.svg#expand",
    ], "canvas controls must use the shared UI icon sprite in reading order");
    assert.ok(canvasIcons.every(({ hidden, focusable }) => hidden === "true" && focusable === "false"), "decorative canvas icons must stay out of the accessibility tree");

    const range = page.locator("#canvasViewZoomRange");
    const stage = page.locator(".stage-composition");
    assert.equal(await range.inputValue(), "100", "card view zoom should start at 100%");
    assert.equal(await page.locator("#canvasViewZoomReadout").textContent(), "100%");
    assert.equal(await stage.getAttribute("data-view-zoom"), "100");

    await range.fill("125");
    assert.equal(await page.locator("#canvasViewZoomReadout").textContent(), "125%");
    assert.equal(await stage.getAttribute("data-view-zoom"), "125");
    assert.equal(await stage.evaluate((element) => element.style.zoom), "1.25");
    assert.equal(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), uiPreferencesStorageKey)).canvasViewZoom, 125);

    await page.locator("#canvasViewZoomOut").click();
    assert.equal(await range.inputValue(), "120");
    await page.locator("#canvasViewZoomIn").click();
    assert.equal(await range.inputValue(), "125");
    await page.locator("#canvasViewFitButton").click();
    assert.equal(await range.inputValue(), "100", "fit control should restore the neutral card view");

    await page.locator("#canvasViewFocusButton").click();
    assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("canvas-focus-mode")), true);
    assert.equal(await page.locator("#canvasViewFocusButton").getAttribute("aria-pressed"), "true");
    await page.locator("#canvasViewFocusButton").click();
    assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("canvas-focus-mode")), false);
    assert.equal(await page.locator("#canvasViewFocusButton").getAttribute("aria-pressed"), "false");

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `canvas view bar overflows at ${width}px`);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await range.fill("115");
    await page.screenshot({ path: "artifacts/ui-canvas-view-after.png", fullPage: false });
    console.log("PASS: card view zoom, fit reset, focus mode sync, persistence, and narrow reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
