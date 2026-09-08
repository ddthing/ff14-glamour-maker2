const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?title-outline-check=1");
    await page.waitForSelector("#canvasBoard");

    const initial = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const header = document.querySelector(".board-editorial-header");
      const titleBlock = document.querySelector(".board-title-block");
      const title = document.querySelector("#boardTitle");
      return {
        headerBackground: getComputedStyle(header).backgroundColor,
        headerPseudo: getComputedStyle(header, "::before").display,
        titleBlockBackground: getComputedStyle(titleBlock).backgroundColor,
        titleShadow: getComputedStyle(title).textShadow,
        stroke: getComputedStyle(title).webkitTextStroke,
        boardHaloToken: board.style.getPropertyValue("--title-halo"),
      };
    });
    assert.equal(initial.headerBackground, "rgba(0, 0, 0, 0)", "title header still paints a background layer");
    assert.equal(initial.headerPseudo, "none", "legacy white title halo pseudo-element is still visible");
    assert.equal(initial.titleBlockBackground, "rgba(0, 0, 0, 0)", "title block still paints a white panel");
    assert.equal(initial.titleShadow, "none", "title still relies on a shadow halo");
    assert.match(initial.stroke, /0px/, `default title outline should be disabled: ${initial.stroke}`);
    assert.equal(initial.boardHaloToken, "", "legacy title halo token leaked into the card");

    assert.equal(await page.locator("#copyEditorSection .copy-editor-toolbar").isVisible(), false, "duplicate right-side text formatting controls should be hidden");
    assert.equal(await page.locator("#copyEditorAdvanced").isVisible(), false, "legacy title outline controls should not clutter the copy inspector");
    assert.match(initial.stroke, /0px/, `default title outline should remain disabled: ${initial.stroke}`);
    await page.screenshot({ path: "artifacts/ui-title-outline-after.png", fullPage: false });
    console.log("PASS: title halo is removed and outline-only legacy controls stay out of the copy inspector.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
