const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?inspector-ia-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#castSelectionSummary");

    const initialSummary = await page.locator("#castSelectionSummary").textContent();
    assert.equal(initialSummary, "캐릭터 01 · 1인", "inspector should identify the initial target");
    assert.equal(await page.locator("#castSelectionSummary").getAttribute("aria-live"), "polite");

    const order = await page.locator("#imageSection > *").evaluateAll((children) => children.map((element) => {
      if (element.id) return element.id;
      return element.className || element.tagName.toLowerCase();
    }));
    assert.deepEqual(order.slice(0, 4), ["panel-section-head", "image-workflow-group image-import-group", "image-workflow-group image-placement-group", "image-workflow-group image-treatment-group"], "image workflow groups should follow the task order");
    const imageWorkflow = await page.locator("#imageSection .image-workflow-group").evaluateAll((groups) => groups.map((group) => [
      group.querySelector(".portrait-source-card")?.id,
      group.querySelector(".image-drop-zone")?.id,
      ...[...group.querySelectorAll("[data-image-fit]")].map((element) => element.dataset.imageFit),
      group.querySelector(".image-placement-launch-row")?.className,
      group.querySelector(".cutout-action")?.id,
      group.querySelector(".image-style-toggle")?.id,
      group.querySelector("#outlineAdvancedSection")?.id,
      group.querySelector("#shadowAdvancedSection")?.id,
    ].filter(Boolean)));
    assert.deepEqual(imageWorkflow, [
      ["portraitSourceCard"],
      ["contain", "cover", "image-transform-row image-placement-launch-row"],
      ["cutoutButton", "styleAdvancedToggle", "outlineAdvancedSection", "shadowAdvancedSection"],
    ], "image workflow controls should stay local to their task group");

    await page.locator('[data-cast-count="3"]').click();
    await page.locator('#castSelector button[data-character-select="2"]').click();
    assert.equal(await page.locator("#castSelectionSummary").textContent(), "캐릭터 03 · 3인", "selection context should follow the selected character");
    assert.equal(await page.locator('#castSelector button[data-character-select="2"]').getAttribute("aria-pressed"), "true");

    const desktop = await page.evaluate(() => {
      const inspector = document.querySelector(".inspector").getBoundingClientRect();
      const summary = document.querySelector("#castSelectionSummary").getBoundingClientRect();
      const previewAction = document.querySelector("#portraitWrap .character-figure.is-empty").getBoundingClientRect();
      const controls = [...document.querySelectorAll("#imageSection button")]
        .filter((button) => !button.closest("[hidden]") && getComputedStyle(button).display !== "none")
        .map((button) => Math.round(button.getBoundingClientRect().height));
      return {
        inspectorWidth: Math.round(inspector.width),
        summaryWidth: Math.round(summary.width),
        previewActionWidth: Math.round(previewAction.width),
        previewActionHeight: Math.round(previewAction.height),
        bottomUploadTargetPresent: Boolean(document.querySelector("#imageDropZone")),
        controls,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.ok(desktop.summaryWidth >= 80, `selection summary is too narrow: ${desktop.summaryWidth}`);
    assert.ok(desktop.previewActionWidth >= 160, `preview image add target is too narrow: ${desktop.previewActionWidth}`);
    assert.ok(desktop.previewActionHeight >= 52, `preview image add target is too short: ${desktop.previewActionHeight}`);
    assert.equal(desktop.bottomUploadTargetPresent, false, "photo import should live on the preview, not a duplicate bottom target");
    assert.ok(desktop.controls.every((height) => height >= 32), `image control below 32px: ${desktop.controls}`);
    assert.equal(desktop.overflow, false, "inspector should not introduce horizontal overflow");
    await page.screenshot({ path: "artifacts/ui-inspector-ia-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const summary = document.querySelector("#castSelectionSummary").getBoundingClientRect();
      const inspector = document.querySelector(".inspector").getBoundingClientRect();
      return {
        summaryWidth: Math.round(summary.width),
        inspectorWidth: Math.round(inspector.width),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.ok(mobile.summaryWidth >= 70, `mobile selection summary is too narrow: ${mobile.summaryWidth}`);
    assert.equal(mobile.overflow, false, "mobile inspector should not overflow horizontally");
    await page.screenshot({ path: "artifacts/ui-inspector-ia-mobile-after.png", fullPage: false });

    console.log(JSON.stringify({ status: "PASS", desktop, mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
