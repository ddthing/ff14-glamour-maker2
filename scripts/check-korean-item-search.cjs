const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const searchResponses = [];
    const searchFailures = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/items/search")) searchResponses.push({ status: response.status(), url: response.url() });
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/items/search")) searchFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" });
    });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("tuyeong-set-maker2-language-v1", "en");
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.locator("#itemsTab").click();
    await page.waitForSelector("#itemsPanel");
    await page.locator('.equipment-row[data-slot="body"]').click();
    await page.locator("#itemSearch").fill("아기돼지 의상");
    await page.waitForSelector('.catalog-result[data-item-id="15479"]');

    const result = await page.evaluate(() => ({
      pageLanguage: document.documentElement.lang,
      selectedSlot: document.querySelector('.equipment-row[aria-pressed="true"]')?.dataset.slot || "",
      names: [...document.querySelectorAll(".catalog-result strong")].map((element) => element.textContent.trim()),
      status: document.querySelector("#catalogStatus")?.textContent.trim() || "",
    }));
    assert.equal(result.pageLanguage, "en", "the regression must cover an English UI with a Korean query");
    assert.equal(result.selectedSlot, "body");
    assert.equal(result.names[0], "아기돼지 의상");
    assert.match(result.status, /1|검색|result/i);
    assert.ok(searchResponses.length > 0, "the UI should call the item search endpoint");
    assert.equal(searchFailures.length, 0, `item search request failed: ${JSON.stringify(searchFailures)}`);
    assert.equal(searchResponses.at(-1).status, 200, `item search returned an error: ${JSON.stringify(searchResponses)}`);
    const requestUrl = new URL(searchResponses.at(-1).url);
    assert.equal(requestUrl.searchParams.get("q"), "아기돼지 의상");
    assert.equal(requestUrl.searchParams.get("slot"), "body");
    assert.equal(requestUrl.searchParams.get("language"), "ko", "Hangul queries must use the Korean index");

    await page.locator('.equipment-row[data-slot="feet"]').click();
    await page.locator("#itemSearch").fill("모그리 실내화");
    await page.locator(".catalog-result").filter({ hasText: "모그리 실내화" }).waitFor();
    const shoesResult = await page.locator(".catalog-result").filter({ hasText: "모그리 실내화" }).first().evaluate((element) => ({
      id: element.dataset.itemId,
      image: element.querySelector("img")?.getAttribute("src") || "",
    }));
    assert.equal(shoesResult.id, "15450");
    assert.match(shoesResult.image, /046626/);
    const shoesRequestUrl = new URL(searchResponses.at(-1).url);
    assert.equal(searchResponses.at(-1).status, 200, `shoe item search returned an error: ${JSON.stringify(searchResponses)}`);
    assert.equal(shoesRequestUrl.searchParams.get("q"), "모그리 실내화");
    assert.equal(shoesRequestUrl.searchParams.get("slot"), "feet");
    assert.equal(shoesRequestUrl.searchParams.get("language"), "ko");

    await page.locator('.equipment-row[data-slot="head"]').click();
    await page.locator("#itemSearch").fill("계승자의 두건");
    await page.locator('.catalog-result[data-item-id="52428"]').waitFor();
    const hoodResult = await page.locator('.catalog-result[data-item-id="52428"]').evaluate((element) => ({
      id: element.dataset.itemId,
      image: element.querySelector("img.item-image")?.getAttribute("src") || "",
    }));
    assert.equal(hoodResult.id, "52428");
    assert.equal(
      hoodResult.image,
      "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F056000%2F056956.tex&format=png",
      "new Korean items must render an icon URL that is still served by XIVAPI",
    );
    console.log("PASS: English UI routes Korean body and shoe queries to the Korean index, renders results, and uses item images.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
