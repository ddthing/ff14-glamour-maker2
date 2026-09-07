const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?inspector-ia-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#castSelectionSummary");

    const initialSummary = await page.locator("#castSelectionSummary").textContent();
    assert.equal(initialSummary, "캐릭터 01 · 1인", "inspector should identify the initial target");
    assert.equal(await page.locator("#castSelectionSummary").getAttribute("aria-live"), "polite");

    const order = await page.locator("#imageSection > *").evaluateAll((children) => children.map((element) => {
      if (element.id === "portraitSourceCard") return "source";
      if (element.id) return element.id;
      if (element.classList.contains("portrait-source-card")) return "source";
      if (element.classList.contains("image-fit-row")) return "fit";
      if (element.classList.contains("image-placement-launch-row")) return "placement";
      if (element.classList.contains("cutout-action")) return "cutout";
      if (element.classList.contains("image-placement-tip-row")) return "tip";
      return element.className || element.tagName.toLowerCase();
    }));
    assert.deepEqual(order.slice(0, 7), ["panel-section-head", "source", "imageDropZone", "fit", "placement", "cutoutButton", "tip"], "image controls should follow the task order");

    await page.locator('[data-cast-count="3"]').click();
    await page.locator('#castSelector button[data-character-select="2"]').click();
    assert.equal(await page.locator("#castSelectionSummary").textContent(), "캐릭터 03 · 3인", "selection context should follow the selected character");
    assert.equal(await page.locator('#castSelector button[data-character-select="2"]').getAttribute("aria-pressed"), "true");

    const desktop = await page.evaluate(() => {
      const inspector = document.querySelector(".inspector").getBoundingClientRect();
      const summary = document.querySelector("#castSelectionSummary").getBoundingClientRect();
      const dropZone = document.querySelector("#imageDropZone").getBoundingClientRect();
      const controls = [...document.querySelectorAll("#imageSection button")].map((button) => Math.round(button.getBoundingClientRect().height));
      return {
        inspectorWidth: Math.round(inspector.width),
        summaryWidth: Math.round(summary.width),
        dropZoneHeight: Math.round(dropZone.height),
        controls,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.ok(desktop.summaryWidth >= 80, `selection summary is too narrow: ${desktop.summaryWidth}`);
    assert.ok(desktop.dropZoneHeight >= 52, `image add target is too short: ${desktop.dropZoneHeight}`);
    assert.ok(desktop.controls.every((height) => height >= 32), `image control below 32px: ${desktop.controls}`);
    assert.equal(desktop.overflow, false, "inspector should not introduce horizontal overflow");
    await page.screenshot({ path: "artifacts/ui-inspector-ia-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const summary = document.querySelector("#castSelectionSummary").getBoundingClientRect();
      const inspector = document.querySelector(".inspector").getBoundingClientRect();
      return {
        summaryWidth: Math.round(summary.width),
        inspectorWidth: Math.round(inspector.width),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.ok(mobile.summaryWidth >= 70, `mobile selection summary is too narrow: ${mobile.summaryWidth}`);
    assert.equal(mobile.overflow, false, "mobile inspector should not overflow horizontally");
    await page.screenshot({ path: "artifacts/ui-inspector-ia-mobile-after.png", fullPage: false });

    console.log(JSON.stringify({ status: "PASS", desktop, mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
