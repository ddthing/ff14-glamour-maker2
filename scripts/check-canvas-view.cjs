const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const uiPreferencesStorageKey = "tuyeong-set-maker2-ui-v2";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173", { waitUntil: "networkidle" });
    await page.waitForSelector("#canvasBoard");
    await page.waitForSelector("#canvasViewZoomRange");

    const canvasIcons = await page.locator("#canvasViewBar .ui-icon").evaluateAll((icons) => icons.map((icon) => ({
      symbol: icon.querySelector("use")?.getAttribute("href") || "",
      hidden: icon.getAttribute("aria-hidden"),
      focusable: icon.getAttribute("focusable"),
    })));
    assert.deepEqual(canvasIcons.map(({ symbol }) => symbol), [
      "assets/icons/ui.svg#canvas-view",
      "assets/icons/ui.svg#minus",
      "assets/icons/ui.svg#plus",
      "assets/icons/ui.svg#pages",
      "assets/icons/ui.svg#fit",
      "assets/icons/ui.svg#expand",
    ], "canvas controls must use the shared UI icon sprite in reading order");
    assert.ok(canvasIcons.every(({ hidden, focusable }) => hidden === "true" && focusable === "false"), "decorative canvas icons must stay out of the accessibility tree");

    const range = page.locator("#canvasViewZoomRange");
    const stage = page.locator(".stage-composition");
    assert.equal(await range.inputValue(), "100", "card view zoom should start at 100%");
    assert.equal(await page.locator("#canvasViewZoomReadout").textContent(), "100%");
    assert.equal(await stage.getAttribute("data-view-zoom"), "100");

    const cardLayoutAt100 = await page.locator("#canvasBoard").evaluate((board) => {
      const title = document.querySelector("#boardTitle");
      const boardRect = board.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      return {
        fontSize: getComputedStyle(title).fontSize,
        relativeLeft: (titleRect.left - boardRect.left) / boardRect.width,
        relativeTop: (titleRect.top - boardRect.top) / boardRect.height,
        relativeWidth: titleRect.width / boardRect.width,
      };
    });
    const exportCopyAt100 = await page.evaluate(() => captureExportCopy().map((copy) => ({
      textAlign: copy.textAlign,
      font: copy.font,
      lines: copy.lines.map((line) => ({
        text: line.text,
        x: Number(line.x.toFixed(4)),
        y: Number(line.y.toFixed(4)),
        height: Number(line.height.toFixed(4)),
      })),
    })));

    await range.fill("125");
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#canvasViewZoomReadout").textContent(), "125%");
    assert.equal(await stage.getAttribute("data-view-zoom"), "125");
    assert.equal(await stage.evaluate((element) => element.style.transform), "scale(1.25)");
    const cardLayoutAt125 = await page.locator("#canvasBoard").evaluate((board) => {
      const title = document.querySelector("#boardTitle");
      const boardRect = board.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      return {
        fontSize: getComputedStyle(title).fontSize,
        relativeLeft: (titleRect.left - boardRect.left) / boardRect.width,
        relativeTop: (titleRect.top - boardRect.top) / boardRect.height,
        relativeWidth: titleRect.width / boardRect.width,
      };
    });
    assert.equal(cardLayoutAt125.fontSize, cardLayoutAt100.fontSize, `view zoom changed title size: ${JSON.stringify({ cardLayoutAt100, cardLayoutAt125 })}`);
    for (const key of ["relativeLeft", "relativeTop", "relativeWidth"]) {
      assert.ok(Math.abs(cardLayoutAt125[key] - cardLayoutAt100[key]) <= 0.002, `view zoom changed title layout ${key}: ${JSON.stringify({ cardLayoutAt100, cardLayoutAt125 })}`);
    }
    const exportCopyAt125 = await page.evaluate(() => captureExportCopy().map((copy) => ({
      textAlign: copy.textAlign,
      font: copy.font,
      lines: copy.lines.map((line) => ({
        text: line.text,
        x: Number(line.x.toFixed(4)),
        y: Number(line.y.toFixed(4)),
        height: Number(line.height.toFixed(4)),
      })),
    })));
    assert.deepEqual(exportCopyAt125, exportCopyAt100, `view zoom leaked into the export copy layout: ${JSON.stringify({ exportCopyAt100, exportCopyAt125 })}`);
    const cardAndBarAt125 = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const bar = document.querySelector("#canvasViewBar").getBoundingClientRect();
      return { boardBottom: board.bottom, barTop: bar.top };
    });
    assert.ok(cardAndBarAt125.barTop >= cardAndBarAt125.boardBottom - 1, `view zoom made the control bar overlap the card: ${JSON.stringify(cardAndBarAt125)}`);
    for (const edgeZoom of [150, 50]) {
      await range.fill(String(edgeZoom));
      await page.waitForTimeout(80);
      const edgeLayout = await page.locator("#canvasBoard").evaluate((board) => {
        const title = document.querySelector("#boardTitle");
        const boardRect = board.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        return {
          fontSize: getComputedStyle(title).fontSize,
          relativeLeft: (titleRect.left - boardRect.left) / boardRect.width,
          relativeTop: (titleRect.top - boardRect.top) / boardRect.height,
          relativeWidth: titleRect.width / boardRect.width,
        };
      });
      assert.equal(edgeLayout.fontSize, cardLayoutAt100.fontSize, `edge view zoom changed title size at ${edgeZoom}%: ${JSON.stringify({ cardLayoutAt100, edgeLayout })}`);
      for (const key of ["relativeLeft", "relativeTop", "relativeWidth"]) {
        assert.ok(Math.abs(edgeLayout[key] - cardLayoutAt100[key]) <= 0.002, `edge view zoom changed title layout ${key} at ${edgeZoom}%: ${JSON.stringify({ cardLayoutAt100, edgeLayout })}`);
      }
      const edgeCardAndBar = await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard").getBoundingClientRect();
        const bar = document.querySelector("#canvasViewBar").getBoundingClientRect();
        return { boardBottom: board.bottom, barTop: bar.top };
      });
      assert.ok(edgeCardAndBar.barTop >= edgeCardAndBar.boardBottom - 1, `edge view zoom made the control bar overlap the card at ${edgeZoom}%: ${JSON.stringify(edgeCardAndBar)}`);
    }
    await range.fill("125");
    await page.waitForTimeout(80);
    assert.equal(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), uiPreferencesStorageKey)).canvasViewZoom, 125);

    await page.locator("#canvasViewZoomOut").click();
    assert.equal(await range.inputValue(), "120");
    await page.locator("#canvasViewZoomIn").click();
    assert.equal(await range.inputValue(), "125");
    await page.locator("#canvasViewFitButton").click();
    assert.equal(await range.inputValue(), "100", "fit control should restore the neutral card view");

    await page.locator("#canvasViewFocusButton").click();
    assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("canvas-focus-mode")), true);
    assert.equal(await page.locator("#canvasViewFocusButton").getAttribute("aria-pressed"), "true");
    await page.locator("#canvasViewFocusButton").click();
    assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("canvas-focus-mode")), false);
    assert.equal(await page.locator("#canvasViewFocusButton").getAttribute("aria-pressed"), "false");

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `canvas view bar overflows at ${width}px`);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await range.fill("115");
    await page.screenshot({ path: "artifacts/ui-canvas-view-after.png", fullPage: false });
    console.log("PASS: card view zoom, fit reset, focus mode sync, persistence, and narrow reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
