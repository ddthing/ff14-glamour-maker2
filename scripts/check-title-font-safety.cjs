const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?title-font-safety=1");
    await page.waitForSelector("#canvasBoard");
    await page.locator("#cardTitleInput").fill("밤하늘을 걷는 모험가의 투영세트메이커2 룩");
    await page.locator("#titleOutlineRange").fill("6");

    const options = await page.locator("#titleFontSelect option").evaluateAll((items) => items.map((item) => ({
      value: item.value,
      label: item.textContent,
    })));
    assert.ok(options.length > 0, "title font registry should expose at least one font");

    for (const option of options) {
      await page.locator("#titleFontSelect").selectOption(option.value);
      await page.waitForTimeout(120);
      const metrics = await page.evaluate(() => {
        const title = document.querySelector("#boardTitle");
        const range = document.createRange();
        range.selectNodeContents(title);
        const titleRect = title.getBoundingClientRect();
        const glyphRect = range.getBoundingClientRect();
        const style = getComputedStyle(title);
        return {
          font: document.querySelector("#titleFontSelect").value,
          overflow: style.overflow,
          outline: style.webkitTextStroke,
          titleTop: titleRect.top,
          titleBottom: titleRect.bottom,
          glyphTop: glyphRect.top,
          glyphBottom: glyphRect.bottom,
        };
      });

      assert.notEqual(
        metrics.overflow,
        "hidden",
        `${option.label} clips glyphs that extend beyond the title text box: ${JSON.stringify(metrics)}`,
      );
      assert.notEqual(
        metrics.overflow,
        "clip",
        `${option.label} clips glyphs that extend beyond the title text box: ${JSON.stringify(metrics)}`,
      );
    }

    console.log(`PASS: ${options.length} title fonts keep glyph outlines visible beyond the line box.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
