const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?toolbar-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#canvasBoard");

    assert.equal(await page.locator("#undoButton").textContent(), "되돌리기");
    assert.equal(await page.locator("#redoButton").textContent(), "다시 실행");
    const desktop = await page.evaluate(() => {
      const history = document.querySelector(".topbar-history").getBoundingClientRect();
      const navigation = document.querySelector(".canvas-view-navigation").getBoundingClientRect();
      return {
        legacyToolbar: Boolean(document.querySelector(".canvas-toolbar")),
        historyWidth: history.width,
        historyHeight: history.height,
        navigationWidth: navigation.width,
        navigationHeight: navigation.height,
      };
    });
    assert.equal(desktop.legacyToolbar, false, "the command row above the floating text toolbar should be removed");
    assert.ok(desktop.historyHeight <= 40, `header history controls are too tall: ${desktop.historyHeight}`);
    assert.ok(desktop.navigationHeight <= 40, `look navigation controls are too tall: ${desktop.navigationHeight}`);
    assert.equal(await page.locator("#focusCanvasButton").count(), 0, "duplicate top canvas focus control is still present");
    await page.screenshot({ path: "artifacts/ui-canvas-toolbar-desktop-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const controls = [...document.querySelectorAll(".topbar-history button, .canvas-view-navigation button")].map((button) => {
        const box = button.getBoundingClientRect();
        return { id: button.id, left: box.left, right: box.right, width: box.width };
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, controls };
    });
    assert.equal(mobile.overflow, false, "workspace controls should not overflow at 320px");
    assert.ok(mobile.controls.every(({ left, right }) => left >= 0 && right <= 320), `toolbar control escapes mobile viewport: ${JSON.stringify(mobile.controls)}`);
    await page.screenshot({ path: "artifacts/ui-canvas-toolbar-after.png", fullPage: false });
    console.log(JSON.stringify({ status: "PASS", desktop, mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
