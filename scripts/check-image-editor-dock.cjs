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

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.locator("#imageEditorDialog").boundingBox();
    const mobileRange = await page.locator("#zoomRange").boundingBox();
    const header = await page.locator('.topbar').boundingBox();
    const toolbar = await page.locator('.canvas-heading').boundingBox();
    assert.ok(toolbar.y >= header.y + header.height - 1, 'Mobile header overlaps the canvas toolbar in placement mode');
    const rangeHeights = await page.locator('#imageEditorDialog input[type="range"]').evaluateAll(inputs => inputs.filter(input => input.getClientRects().length).map(input => ({ id: input.id, height: input.getBoundingClientRect().height })));
    for (const range of rangeHeights) assert.ok(range.height >= 40, `${range.id} has a cramped hit area: ${range.height}`);
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
