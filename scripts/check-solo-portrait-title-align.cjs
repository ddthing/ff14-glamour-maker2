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
    console.log("PASS: solo portrait title copy is centered to the card.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
