const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?solo-portrait-title-align=1", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.ratio === "portrait");
    const metrics = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const title = document.querySelector("#boardTitle");
      const range = document.createRange();
      range.selectNodeContents(title);
      const text = range.getBoundingClientRect();
      const copy = captureExportCopy().find((entry) => entry.lines.length > 0);
      return {
        boardCenter: (board.left + board.right) / 2,
        textCenter: (text.left + text.right) / 2,
        textAlign: getComputedStyle(title).textAlign,
        copyAnchor: copy?.lines[0]?.x,
        layoutCenter: getExportDimensions().layoutWidth / 2,
      };
    });
    assert.equal(metrics.textAlign, "center", `solo portrait should default to card-centered copy: ${JSON.stringify(metrics)}`);
    assert.ok(Math.abs(metrics.textCenter - metrics.boardCenter) < 4, `solo portrait DOM title is not centered to the card: ${JSON.stringify(metrics)}`);
    assert.ok(Math.abs(metrics.copyAnchor - metrics.layoutCenter) < 4, `solo portrait PNG copy is not centered to the card: ${JSON.stringify(metrics)}`);

    const measureAlignment = () => page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const block = document.querySelector("#boardTitle").getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector("#boardTitle"));
      const text = range.getBoundingClientRect();
      return {
        boardCenter: (board.left + board.right) / 2,
        blockLeft: block.left,
        blockCenter: (block.left + block.right) / 2,
        blockRight: block.right,
        textLeft: text.left,
        textCenter: (text.left + text.right) / 2,
        textRight: text.right,
      };
    });
    await page.locator('[data-floating-align="left"]').click();
    const left = await measureAlignment();
    await page.locator('[data-floating-align="center"]').click();
    const center = await measureAlignment();
    await page.locator('[data-floating-align="right"]').click();
    const right = await measureAlignment();
    assert.ok(Math.abs(left.textLeft - left.blockLeft) < 8, `solo portrait left alignment is not card-relative: ${JSON.stringify(left)}`);
    assert.ok(Math.abs(center.textCenter - center.boardCenter) < 4, `solo portrait center alignment is not card-relative: ${JSON.stringify(center)}`);
    assert.ok(Math.abs(right.textRight - right.blockRight) < 8, `solo portrait right alignment is not card-relative: ${JSON.stringify(right)}`);

    await page.evaluate(() => {
      state.titleAlign = "auto";
      renderStyles({ refreshInfo: false, refreshPattern: false });
    });
    await page.locator('[data-single-ratio="landscape"]').click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.ratio === "landscape");
    const landscape = await page.evaluate(() => {
      const boardElement = document.querySelector("#canvasBoard");
      const header = document.querySelector(".board-editorial-header");
      const block = document.querySelector("#boardTitle").parentElement;
      const board = boardElement.getBoundingClientRect();
      const title = document.querySelector("#boardTitle");
      const subtitle = document.querySelector("#boardSubtitle");
      const titleRange = document.createRange();
      titleRange.selectNodeContents(title);
      const titleText = titleRange.getBoundingClientRect();
      const subtitleStyle = getComputedStyle(subtitle);
      const copy = captureExportCopy().find((entry) => entry.lines.length > 0);
      return {
        boardCenter: (board.left + board.right) / 2,
        blockCenter: (block.getBoundingClientRect().left + block.getBoundingClientRect().right) / 2,
        titleCenter: (titleText.left + titleText.right) / 2,
        copyAnchor: copy?.lines[0]?.x,
        layoutCenter: getExportDimensions().layoutWidth / 2,
        titleAlign: getComputedStyle(title).textAlign,
        subtitleAlign: subtitleStyle.textAlign,
        headerJustify: getComputedStyle(header).justifyContent,
        blockWidthRatio: block.getBoundingClientRect().width / board.width,
      };
    });
    assert.equal(landscape.titleAlign, "center", `solo landscape should default to centered copy: ${JSON.stringify(landscape)}`);
    assert.equal(landscape.subtitleAlign, "center", `solo landscape subtitle should follow title alignment: ${JSON.stringify(landscape)}`);
    assert.equal(landscape.headerJustify, "center", `solo landscape header should use the central editorial gap: ${JSON.stringify(landscape)}`);
    assert.ok(Math.abs(landscape.blockCenter - landscape.boardCenter) < 4, `solo landscape title box is not centered to the card: ${JSON.stringify(landscape)}`);
    assert.ok(Math.abs(landscape.titleCenter - landscape.boardCenter) < 4, `solo landscape title copy is not centered to the card: ${JSON.stringify(landscape)}`);
    assert.ok(Math.abs(landscape.copyAnchor - landscape.layoutCenter) < 4, `solo landscape PNG copy is not centered to the card: ${JSON.stringify(landscape)}`);
    assert.ok(landscape.blockWidthRatio > .4 && landscape.blockWidthRatio < .5, `solo landscape title box is not ratio-sized: ${JSON.stringify(landscape)}`);
    console.log("PASS: solo portrait and landscape title copy use card-relative alignment.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
