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
      const toolbar = document.querySelector(".canvas-toolbar");
      const box = toolbar.getBoundingClientRect();
      const style = getComputedStyle(toolbar);
      return { flexDirection: style.flexDirection, width: box.width, height: box.height };
    });
    assert.equal(desktop.flexDirection, "row", "canvas actions should read as one command row");
    assert.ok(desktop.height <= 40, `canvas toolbar is too tall: ${desktop.height}`);
    await page.screenshot({ path: "artifacts/ui-canvas-toolbar-desktop-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const toolbar = document.querySelector(".canvas-toolbar").getBoundingClientRect();
      const controls = [...document.querySelectorAll(".canvas-toolbar button")].map((button) => {
        const box = button.getBoundingClientRect();
        return { id: button.id, left: box.left, right: box.right, width: box.width };
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, toolbar, controls };
    });
    assert.equal(mobile.overflow, false, "canvas toolbar should not overflow at 320px");
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
