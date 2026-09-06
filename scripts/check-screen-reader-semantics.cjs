const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#castSelector button");

    assert.equal(await page.getByRole("main").count(), 1);
    assert.equal(await page.getByRole("tab", { name: "꾸미기" }).getAttribute("aria-controls"), "stylePanel");
    assert.equal(await page.getByRole("tab", { name: "장비" }).getAttribute("aria-controls"), "itemsPanel");
    assert.equal(await page.locator("#stylePanel").getAttribute("aria-labelledby"), "styleTab");
    assert.equal(await page.locator("#itemsPanel").isHidden(), true);

    assert.equal(await page.getByRole("group", { name: "캐릭터 배치 영역" }).count(), 1);
    assert.equal(await page.getByRole("group", { name: "편집할 캐릭터" }).count(), 1);
    await page.locator('[data-cast-count="3"]').click();
    await page.waitForSelector('[data-character-select="2"]');
    const advancedControls = (await page.locator("#styleAdvancedToggle").getAttribute("aria-controls")).split(/\s+/).filter(Boolean);
    assert.deepEqual(advancedControls, ["outlineAdvancedSection", "shadowAdvancedSection"]);
    assert.equal(await page.locator("#styleAdvancedToggle").evaluate((element, ids) => ids.every((id) => document.getElementById(id)), advancedControls), true);
    await page.locator("#styleAdvancedToggle").click();
    assert.equal(await page.getByRole("group", { name: "그림자 방향" }).count(), 1);
    assert.equal(await page.locator("#zoomReadout").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator("#catalogStatus").getAttribute("role"), "status");

    await page.getByRole("tab", { name: "장비" }).click();
    assert.equal(await page.locator("#itemsPanel").isVisible(), true);
    assert.equal(await page.locator("#stylePanel").isHidden(), true);
    assert.equal(await page.getByRole("group", { name: "장비를 편집할 캐릭터" }).count(), 1);
    await page.locator('[data-item-character="1"]').click();
    assert.equal(await page.locator("#itemsSummaryTitle").textContent(), "캐릭터 02");
    assert.equal(await page.locator("#itemsSummaryTitle").getAttribute("aria-live"), "polite");

    await page.getByRole("tab", { name: "꾸미기" }).click();
    await page.locator('[data-character-select="2"]').click();
    assert.equal(await page.locator("#imageState").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator("#sourceFileName").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator("#sourceFileMeta").getAttribute("aria-live"), "polite");
    console.log("PASS: landmarks, tab/panel relationships, named editor groups, and live state semantics.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
