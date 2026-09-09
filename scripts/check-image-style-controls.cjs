const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function setColor(page, value) {
  await page.locator("#outlineColorInput").evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173", { waitUntil: "networkidle" });
    await page.locator("#styleAdvancedToggle").click();

    assert.equal(await page.locator("#outlineColorInput").isVisible(), true, "image border needs a direct color picker");
    assert.equal(await page.locator("#outlineColorValue").textContent(), "#F1DFBB");
    assert.equal(await page.locator("#outlineSwatches .color-swatch").count(), 4, "border presets should remain available");

    await setColor(page, "#4c7dff");
    await page.waitForTimeout(350);
    const customDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3")));
    assert.equal(customDraft.outline.color, "#4c7dff", "direct border color did not persist");
    assert.equal(await page.locator("#outlineColorValue").textContent(), "#4C7DFF");
    assert.equal(await page.locator("#outlineColorPicker").evaluate((element) => element.classList.contains("is-selected")), true);
    assert.equal(await page.locator("#outlineSwatches .color-swatch.is-selected").count(), 0);

    await page.locator('#outlineSwatches .color-swatch[data-color="#171820"]').click();
    assert.equal(await page.locator("#outlineColorValue").textContent(), "#171820");
    assert.equal(await page.locator("#outlineColorPicker").evaluate((element) => element.classList.contains("is-selected")), false);
    assert.equal(await page.locator('#outlineSwatches .color-swatch[data-color="#171820"]').getAttribute("aria-checked"), "true");

    const typeMetrics = await page.evaluate(() => [
      "#outlineAdvancedSection .image-style-field-head .control-label",
      "#outlineAdvancedSection .range-labels span",
      "#shadowAdvancedSection .image-style-field-head .control-label",
      "#shadowAdvancedSection .range-labels span",
      "#shadowAdvancedSection .shadow-controls .control-label",
    ].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight };
    }));
    assert.equal(new Set(typeMetrics.map((metric) => metric.fontFamily)).size, 1, "image effect labels use different font families");
    assert.equal(new Set(typeMetrics.map((metric) => metric.fontSize)).size, 1, "image effect labels use different font sizes");
    assert.equal(new Set(typeMetrics.map((metric) => metric.lineHeight)).size, 1, "image effect labels use different line heights");

    console.log("PASS: direct border color, preset selection parity, persistence, and shared image-effect typography.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
