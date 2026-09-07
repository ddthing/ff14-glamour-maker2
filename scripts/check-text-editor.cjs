const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const title = "아주 긴 제목입니다. Moonlit Passage in the Snowfield";
const subtitle = "설원에서 포착한 파란빛 겨울 산책입니다. This description keeps going so the editor should reveal the complete sentence without clipping.";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("http://localhost:4173/?text-editor-check=1");
    await page.waitForSelector("#cardTitleInput");

    assert.equal(await page.locator("#cardTitleInput").inputValue(), "새로운 룩");
    assert.equal(await page.locator("#cardSubtitleInput").inputValue(), "");
    assert.equal(await page.locator("#cardTitleCount").textContent(), "5 / 64");

    await page.locator("#cardTitleInput").fill(title);
    assert.equal(await page.locator("#boardTitle").textContent(), title);
    assert.equal(await page.locator("#cardTitleCount").textContent(), `${Array.from(title).length} / 64`);
    await page.locator("#cardTitleInput").press("Enter");
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("glamour-atelier-draft-v3")).title)), title);
    const savedTitleMetrics = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return { overflow: style.overflow, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow };
    });
    assert.equal(savedTitleMetrics.overflow, "visible");
    assert.equal(savedTitleMetrics.whiteSpace, "nowrap");
    assert.equal(savedTitleMetrics.textOverflow, "clip");

    await page.locator("#cardSubtitleInput").fill(subtitle);
    assert.equal(await page.locator("#boardSubtitle").textContent(), subtitle);
    const subtitleMetrics = await page.locator("#cardSubtitleInput").evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      value: element.value,
    }));
    assert.equal(subtitleMetrics.value, subtitle);
    assert.ok(subtitleMetrics.height >= 68);
    assert.ok(subtitleMetrics.scrollHeight <= 180);
    await page.locator("#cardSubtitleInput").press("Escape");
    assert.equal(await page.locator("#cardSubtitleInput").inputValue(), "");

    await page.locator("#boardTitle").fill(title);
    const directMetrics = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflow: style.overflow,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        blockHeight: element.parentElement.getBoundingClientRect().height,
      };
    });
    assert.equal(directMetrics.overflow, "visible");
    assert.equal(directMetrics.whiteSpace, "normal");
    assert.equal(directMetrics.textOverflow, "clip");
    assert.ok(directMetrics.blockHeight >= 50, `direct title editor collapsed too far: ${JSON.stringify(directMetrics)}`);
    await page.locator("#boardTitle").press("Enter");

    await page.locator("#boardSubtitle").fill(subtitle);
    const directSubtitleMetrics = await page.locator("#boardSubtitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflow: style.overflow,
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        blockHeight: element.parentElement.getBoundingClientRect().height,
      };
    });
    assert.equal(directSubtitleMetrics.overflow, "visible");
    assert.equal(directSubtitleMetrics.whiteSpace, "normal");
    assert.equal(directSubtitleMetrics.textOverflow, "clip");
    assert.ok(directSubtitleMetrics.blockHeight >= 50, `direct subtitle editor collapsed too far: ${JSON.stringify(directSubtitleMetrics)}`);
    await page.locator("#boardSubtitle").press("Escape");
    assert.equal(await page.locator("#boardSubtitle").textContent(), "");

    await page.screenshot({ path: "artifacts/ui-text-editor-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.reload();
    await page.waitForSelector("#cardTitleInput");
    const narrowMetrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      titleFieldWidth: document.querySelector("#cardTitleInput").getBoundingClientRect().width,
      subtitleFieldWidth: document.querySelector("#cardSubtitleInput").getBoundingClientRect().width,
    }));
    assert.ok(narrowMetrics.documentWidth <= narrowMetrics.viewportWidth, `horizontal overflow at 320px: ${JSON.stringify(narrowMetrics)}`);
    assert.ok(narrowMetrics.titleFieldWidth > 0);
    assert.ok(narrowMetrics.subtitleFieldWidth > 0);
    console.log("PASS: copy fields preserve full drafts, update the preview, support Escape/Enter, direct canvas editing wraps without clipping, and 320px reflow stays usable.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
