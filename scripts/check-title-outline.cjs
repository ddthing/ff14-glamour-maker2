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

    await page.locator('[data-title-outline-color="#263238"]').click();
    await page.locator("#titleOutlineRange").fill("3");
    const applied = await page.evaluate(() => ({
      stroke: getComputedStyle(document.querySelector("#boardTitle")).webkitTextStroke,
      value: document.querySelector("#titleOutlineValue").textContent,
      saved: JSON.parse(localStorage.getItem("glamour-atelier-draft-v3"))?.titleOutline,
    }));
    assert.match(applied.stroke, /3px/, `title outline width did not reach the preview: ${applied.stroke}`);
    assert.equal(applied.value, "3 px");
    assert.deepEqual(applied.saved, { color: "#263238", width: 3 });

    await page.locator("#libraryToggleButton").click();
    await page.locator("#addLookButton").click();
    assert.equal(await page.locator("#titleOutlineRange").inputValue(), "0", "a new LOOK BOOK card should start without the previous card's outline");
    await page.locator('[data-look-id="look-1"]').click();
    assert.equal(await page.locator("#titleOutlineRange").inputValue(), "3", "LOOK BOOK switching should restore each card's title outline");
    await page.locator('[data-look-id^="look-"]').filter({ hasText: "새로운 룩" }).last().click();
    assert.equal(await page.locator("#titleOutlineRange").inputValue(), "0", "switching back should restore the blank card outline");
    await page.screenshot({ path: "artifacts/ui-title-outline-after.png", fullPage: false });
    console.log("PASS: title halo is removed and the configurable glyph outline reaches preview and persistence.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
