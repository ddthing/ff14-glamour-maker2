const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["ko-KR"] });
      Object.defineProperty(navigator, "language", { configurable: true, get: () => "ko-KR" });
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?header-check=1", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#languageSelect");

    assert.equal(await page.locator("#shareButton").count(), 0, "share action should not be present");
    assert.equal(await page.locator("#languageSelect").getAttribute("aria-label"), "페이지와 아이템 언어");
    assert.deepEqual(await page.locator("#languageSelect option").evaluateAll((options) => options.map((option) => option.value)), ["ko", "en", "ja"]);
    assert.equal(await page.locator("#languageSelect").inputValue(), "ko");
    assert.ok(await page.locator("#exportButton").isVisible(), "export should remain the primary header action");

    await page.locator("#languageSelect").selectOption("en");
    assert.equal(await page.locator("#languageSelect").inputValue(), "en");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#languageSelect").inputValue(), "en", "language choice should persist");
    await page.screenshot({ path: "artifacts/ui-header-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const header = document.querySelector(".topbar").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        headerHeight: header.height,
        languageWidth: document.querySelector("#languageSelect").getBoundingClientRect().width,
        exportWidth: document.querySelector("#exportButton").getBoundingClientRect().width,
      };
    });
    assert.equal(mobile.overflow, false, "header should not overflow at 320px");
    assert.ok(mobile.languageWidth >= 96, `language control is too narrow: ${mobile.languageWidth}`);
    assert.ok(mobile.exportWidth >= 90, `export action is too narrow: ${mobile.exportWidth}`);
    await page.screenshot({ path: "artifacts/ui-header-mobile-after.png", fullPage: false });

    console.log(JSON.stringify({ status: "PASS", mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
