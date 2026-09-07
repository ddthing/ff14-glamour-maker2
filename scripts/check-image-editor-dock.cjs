const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 875, height: 797 }, deviceScaleFactor: 1 });
  try {
    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#imageInput").setInputFiles({ name: "dock-source.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");
    await page.locator("#openImageEditorButton").click();
    await page.waitForFunction(() => document.body.classList.contains("image-placement-mode"));
    assert.equal(await page.locator("#fitImageButton").textContent(), "맞춤");
    assert.equal(await page.locator("#fitImageButton").getAttribute("aria-label"), "이미지를 프레임에 맞춤");
    assert.equal(await page.locator("#centerImageButton").textContent(), "중앙");
    assert.equal(await page.locator("#centerImageButton").getAttribute("aria-label"), "이미지를 카드 중앙으로 복원");

    const collapsed = await page.evaluate(() => {
      const dock = document.querySelector("#imageEditorDialog").getBoundingClientRect();
      const card = document.querySelector("#canvasBoard").getBoundingClientRect();
      return { dock, card };
    });
    assert.ok(collapsed.dock.height <= 120, `collapsed dock is too tall: ${collapsed.dock.height}`);
    assert.ok(collapsed.dock.top > collapsed.card.top + 150, "collapsed dock should leave the card visible");
    await page.screenshot({ path: "artifacts/ui-image-editor-dock-875.png", fullPage: false });

    await page.locator(".image-editor-precision summary").click();
    const expanded = await page.locator("#imageEditorDialog").boundingBox();
    assert.ok(expanded.height <= 220, `expanded dock is too tall: ${expanded.height}`);
    const expandedControls = await page.evaluate(() => {
      const nudgeButtons = [...document.querySelectorAll(".image-editor-precision .image-nudge-grid button")].map((button) => button.getBoundingClientRect());
      const footerButtons = [...document.querySelectorAll(".image-editor-dialog-footer button")].map((button) => button.getBoundingClientRect());
      return {
        nudgeMinHeight: Math.min(...nudgeButtons.map(({ height }) => height)),
        footerButtons,
      };
    });
    assert.ok(expandedControls.nudgeMinHeight >= 36, `expanded nudge controls are cramped: ${expandedControls.nudgeMinHeight}`);
    assert.ok(expandedControls.footerButtons.every(({ width, height }) => width >= 68 && height >= 34), `dock actions lost their hit area: ${JSON.stringify(expandedControls.footerButtons)}`);

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.locator("#imageEditorDialog").boundingBox();
    const mobileRange = await page.locator("#zoomRange").boundingBox();
    const header = await page.locator('.topbar').boundingBox();
    const toolbar = await page.locator('.canvas-heading').boundingBox();
    assert.ok(toolbar.y >= header.y + header.height - 1, 'Mobile header overlaps the canvas toolbar in placement mode');
    const rangeHeights = await page.locator('#imageEditorDialog input[type="range"]').evaluateAll(inputs => inputs.filter(input => input.getClientRects().length).map(input => ({ id: input.id, height: input.getBoundingClientRect().height })));
    for (const range of rangeHeights) assert.ok(range.height >= 40, `${range.id} has a cramped hit area: ${range.height}`);
    const mobileAlignment = await page.evaluate(() => {
      const group = document.querySelector(".image-editor-control-group:nth-child(2)");
      const head = group?.querySelector(".image-editor-control-head")?.getBoundingClientRect();
      const center = document.querySelector("#centerImageButton")?.getBoundingClientRect();
      const footerButtons = [...document.querySelectorAll(".image-editor-dialog-footer button")].map((button) => button.getBoundingClientRect());
      return {
        centerInHead: Boolean(head && center && center.top >= head.top - 1 && center.bottom <= head.bottom + 1 && center.right <= head.right + 1),
        footerButtons,
      };
    });
    assert.equal(mobileAlignment.centerInHead, true, "mobile center action should stay in the position heading row");
    assert.ok(mobileAlignment.footerButtons.every(({ width, height }) => width >= 68 && height >= 34), `mobile dock actions lost their hit area: ${JSON.stringify(mobileAlignment.footerButtons)}`);
    assert.ok(mobile.x >= 0 && mobile.x + mobile.width <= 320, "mobile dock escapes viewport");
    assert.ok(mobile.height <= 560, `mobile dock is too tall: ${mobile.height}`);
    assert.ok(mobileRange.width >= 100, `mobile size slider is too narrow: ${mobileRange.width}`);
    await page.screenshot({ path: "artifacts/ui-image-editor-dock-mobile.png", fullPage: false });
    console.log(JSON.stringify({ status: "PASS", collapsedHeight: collapsed.dock.height, expandedHeight: expanded.height, mobileHeight: mobile.height, mobileSliderWidth: mobileRange.width }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
