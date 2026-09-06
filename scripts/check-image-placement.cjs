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
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?image-placement-check=1");
    await page.waitForSelector("#canvasBoard");
    await page.locator("#imageInput").setInputFiles({ name: "placement-source.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");

    await page.locator('[data-pattern="stars"]').click();
    const stars = await page.locator("#scenePattern .pattern-motif--star").count();
    assert.ok(stars >= 30, `star pattern should contain at least 30 motifs, found ${stars}`);
    const starWidths = await page.locator("#scenePattern .pattern-motif--star").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
    assert.ok(Math.max(...starWidths) >= 30, `star motifs should be visibly larger: ${JSON.stringify(starWidths)}`);

    await page.locator("#openImageEditorButton").click();
    await page.waitForFunction(() => document.body.classList.contains("image-placement-mode"));
    await page.waitForFunction(() => document.activeElement?.classList.contains("character-figure"));
    assert.equal(await page.locator("#imageEditorDialog").getAttribute("hidden"), null);
    assert.equal(await page.locator("#imageEditorDialog").getAttribute("role"), "region");
    assert.equal(await page.locator("#imageEditorPreview").count(), 0, "placement mode should not render a duplicate preview");
    assert.equal(await page.locator("#canvasBoard").isVisible(), true);
    assert.equal(await page.locator(".inspector").isVisible(), false);
    assert.equal(await page.locator(".character-figure.is-selected").count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("character-figure")), true, "opening should focus the selected card figure");

    assert.equal(await page.locator("#zoomRange").inputValue(), "100");
    await page.locator("#zoomRange").fill("140");
    assert.equal(await page.locator("#zoomReadout").textContent(), "140%");
    assert.equal(await page.locator("#zoomRange").getAttribute("aria-valuetext"), "140%");
    assert.match(await page.locator("#portraitWrap img").first().getAttribute("style"), /scale\(1\.4\)/);

    await page.locator(".image-editor-precision summary").click();
    await page.locator("#panXRange").fill("80");
    await page.locator("#panYRange").fill("-50");
    assert.equal(await page.locator("#panXReadout").textContent(), "+80 px");
    assert.equal(await page.locator("#panYReadout").textContent(), "−50 px");
    assert.match(await page.locator("#portraitWrap img").first().getAttribute("style"), /translate\(80px, -50px\)/);

    const selectedFigure = await page.locator(".character-figure.is-selected").boundingBox();
    assert.ok(selectedFigure && selectedFigure.width > 0, "selected card figure is not a usable drag target");
    const beforeDrag = await page.locator("#panXRange").inputValue();
    const dock = await page.locator("#imageEditorDialog").boundingBox();
    const dragX = selectedFigure.x + selectedFigure.width / 2;
    const dragY = Math.min(selectedFigure.y + selectedFigure.height * 0.22, (dock?.y ?? 900) - 24);
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX + 40, dragY - 25, { steps: 4 });
    await page.mouse.up();
    const afterDrag = await page.locator("#panXRange").inputValue();
    assert.notEqual(afterDrag, beforeDrag, "dragging the live card figure should change its position");

    await page.locator(".character-figure.is-selected").press("ArrowLeft");
    assert.ok(Number(await page.locator("#panXRange").inputValue()) < Number(afterDrag), "keyboard nudge should move the live card figure");
    await page.locator("#centerImageButton").click();
    assert.equal(await page.locator("#panXReadout").textContent(), "0 px");
    assert.equal(await page.locator("#panYReadout").textContent(), "0 px");
    assert.match(await page.locator("#portraitWrap img").first().getAttribute("style"), /translate\(0px, 0px\)/);
    await page.screenshot({ path: "artifacts/ui-image-placement-mode-after.png", fullPage: false });

    await page.locator("#applyImageEditorButton").click();
    await page.waitForFunction(() => !document.body.classList.contains("image-placement-mode"));
    assert.equal(await page.locator("#imageEditorDialog").getAttribute("hidden"), "");
    assert.equal(await page.locator("#imagePlacementSummary").textContent(), "140% · 기본 위치");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "openImageEditorButton");

    await page.locator("#openImageEditorButton").click();
    await page.locator("#zoomRange").fill("80");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.body.classList.contains("image-placement-mode"));
    assert.equal(await page.locator("#imagePlacementSummary").textContent(), "140% · 기본 위치", "Escape should cancel the pending edit");

    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator("#openImageEditorButton").click();
    await page.waitForFunction(() => document.body.classList.contains("image-placement-mode"));
    const mobile = await page.evaluate(() => {
      const modebar = document.querySelector("#imageEditorDialog").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        modebarWithinViewport: modebar.left >= 0 && modebar.right <= window.innerWidth,
        rangeNames: ["zoomRange", "panXRange", "panYRange"].map((id) => document.getElementById(id)?.getAttribute("aria-label")),
      };
    });
    assert.equal(mobile.overflow, false, "image placement controls overflow at 320px");
    assert.equal(mobile.modebarWithinViewport, true, "image placement bar escapes the mobile viewport");
    assert.deepEqual(mobile.rangeNames, ["선택한 이미지 크기", "이미지 가로 위치", "이미지 세로 위치"]);
    await page.screenshot({ path: "artifacts/ui-image-placement-mode-mobile.png", fullPage: false });
    await page.locator("#cancelImageEditorButton").click();

    console.log(JSON.stringify({ status: "PASS", stars, maxStarWidth: Math.max(...starWidths), mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
