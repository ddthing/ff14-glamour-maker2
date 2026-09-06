const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    let releaseSearch;
    const searchHeld = new Promise((resolve) => { releaseSearch = resolve; });
    let requestSeenResolve;
    const requestSeen = new Promise((resolve) => { requestSeenResolve = resolve; });
    await page.route("**/api/items/search**", async (route) => {
      requestSeenResolve();
      await searchHeld;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [{ id: "900001", slot: "head", names: { ko: "테스트 모자", en: "Test Hat" }, meta: { ko: "장비", en: "Gear" } }] }),
      });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");

    await page.evaluate(() => {
      const look = getSelectedLook();
      look.outfits[0].head = "900001";
      ensureLookOutfits(look);
      itemRecordCache.set("900001", { id: "900001", slot: "head", names: { ko: "테스트 모자" }, meta: { ko: "장비" } });
      void hydrateCurrentLookEnglishNames();
    });
    await requestSeen;

    await page.locator("#resetButton").click();
    await page.locator("#resetWorkspaceButton").click();
    await page.locator("#confirmWorkspaceDelete").click();
    await page.waitForFunction(() => document.querySelectorAll(".look-list-item").length === 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("glamour-atelier-draft-v3")), null);

    releaseSearch();
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("glamour-atelier-draft-v3")),
      null,
      "a late item-name hydration must not recreate a draft after permanent deletion",
    );
    console.log("PASS: late item-name hydration cannot resurrect the deleted workspace draft.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
