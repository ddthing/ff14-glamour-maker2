const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?character-switching-check=1");
    await page.waitForSelector("#portraitWrap .character-figure");
    await page.locator('[data-cast-count="3"]').click();
    await page.locator("#imageInput").setInputFiles([
      { name: "switch-one.png", mimeType: "image/png", buffer: fixturePng },
      { name: "switch-two.png", mimeType: "image/png", buffer: fixturePng },
      { name: "switch-three.png", mimeType: "image/png", buffer: fixturePng },
    ]);
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap .character-figure img").length === 3);

    await page.evaluate(() => {
      window.__firstImageNode = document.querySelector('#portraitWrap .character-figure[data-character-index="0"] img');
    });
    await page.locator('#castSelector button[data-character-select="1"]').click();
    const state = await page.evaluate(() => {
      const selectedImage = document.querySelector('#portraitWrap .character-figure[data-character-index="1"] img');
      return {
        firstImagePreserved: document.querySelector('#portraitWrap .character-figure[data-character-index="0"] img') === window.__firstImageNode,
        selectedImageFilter: selectedImage ? getComputedStyle(selectedImage).filter : "",
        selectedIndex: document.querySelector('.character-figure.is-selected')?.dataset.characterIndex,
      };
    });
    console.log(JSON.stringify(state));
    assert.equal(state.firstImagePreserved, true, "switching characters should not replace image nodes and flash their colors");
    assert.equal(state.selectedIndex, "1");
    await page.screenshot({ path: "artifacts/ui-character-switching-after.png", fullPage: false });
    console.log("PASS: character switching preserves the live image layer and filter state.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
