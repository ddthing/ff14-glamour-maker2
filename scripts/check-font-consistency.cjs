const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?font-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector(".inspector");
    await page.evaluate(() => document.fonts?.ready);

    const audit = await page.evaluate(() => {
      const selectors = [
        "body",
        ".wordmark-copy strong",
        ".collection-lockup strong",
        ".look-list-copy strong",
        ".inspector-title-row h1",
        ".panel-section-head h2",
        ".primary-button",
        ".topbar-history-button",
        "#languageSelect",
        "#titleFontSelect",
        "#cardTitleInput",
        "#cardSubtitleInput",
        ".search-field input",
      ];
      const missing = selectors.filter((selector) => !document.querySelector(selector));
      const computed = Object.fromEntries(selectors.filter((selector) => document.querySelector(selector)).map((selector) => [selector, getComputedStyle(document.querySelector(selector)).fontFamily]));
      const root = getComputedStyle(document.documentElement);
      const pretendardLoaded = document.fonts?.check('13px "Pretendard Variable"') ?? false;
      return {
        computed,
        missing,
        displayToken: root.getPropertyValue("--display").trim(),
        sansToken: root.getPropertyValue("--sans").trim(),
        pretendardLoaded,
      };
    });

    assert.match(audit.sansToken, /Pretendard Variable/i, "--sans should lead with Pretendard");
    assert.match(audit.displayToken, /Pretendard Variable/i, "UI display token should resolve to Pretendard");
    assert.doesNotMatch(audit.displayToken, /Bahnschrift|DIN Condensed|Aptos Display/i, "UI display token should not fall back to a condensed desktop font");
    assert.deepEqual(audit.missing, [], `font audit selectors are missing: ${audit.missing.join(", ")}`);
    for (const [selector, family] of Object.entries(audit.computed)) {
      assert.match(family, /Pretendard Variable/i, `${selector} should use Pretendard: ${family}`);
    }
    assert.equal(audit.pretendardLoaded, true, "Pretendard Variable should be available to the browser");

    await page.screenshot({ path: "artifacts/ui-font-consistency-after.png", fullPage: false });
    console.log(JSON.stringify({ status: "PASS", audit }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
