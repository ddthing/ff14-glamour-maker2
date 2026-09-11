const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const requestedFonts = [
  "yoon-chorok-child-daehan",
  "yoon-chorok-child-minguk",
  "yoon-chorok-child-manse",
  "nelna-yesam",
  "nelna-lizzy",
  "cafe24-moya-moya-face",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?title-font-menu=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#textEditorFontTrigger");

    const contract = await page.evaluate(() => {
      const menu = document.querySelector("#textEditorFontMenu");
      const trigger = document.querySelector("#textEditorFontTrigger");
      const options = [...(menu?.querySelectorAll('[role="option"]') || [])];
      const style = menu ? getComputedStyle(menu) : null;
      return {
        menuHidden: menu?.hidden,
        menuOverflowY: style?.overflowY,
        menuScrollbarWidth: style?.scrollbarWidth,
        menuScrollbarColor: style?.scrollbarColor,
        triggerControls: trigger?.getAttribute("aria-controls"),
        triggerExpanded: trigger?.getAttribute("aria-expanded"),
        optionValues: options.map((option) => option.dataset.fontKey),
      };
    });
    assert.equal(contract.menuHidden, true, "the floating font list should start closed");
    assert.equal(contract.menuOverflowY, "auto", "the floating font list needs a bounded vertical scroll surface");
    assert.equal(contract.menuScrollbarWidth, "thin", "the floating font list should use the shared thin scrollbar contract");
    assert.notEqual(contract.menuScrollbarColor, "auto", "the floating font list should use a themed scrollbar color");
    assert.equal(contract.triggerControls, "textEditorFontMenu");
    assert.equal(contract.triggerExpanded, "false");
    assert.ok(requestedFonts.every((value) => contract.optionValues.includes(value)), "the custom list must expose every requested font");

    await page.locator("#textEditorFontTrigger").click();
    assert.equal(await page.locator("#textEditorFontMenu").isVisible(), true, "the floating font list should open from its trigger");
    const openMenuProbe = await page.evaluate(() => {
      const menu = document.querySelector("#textEditorFontMenu");
      const rect = menu.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + 12, rect.top + 14);
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        optionHit: Boolean(target?.closest('[role="option"]')),
      };
    });
    assert.ok(openMenuProbe.top >= 0 && openMenuProbe.bottom <= openMenuProbe.viewportHeight, `font list escaped the viewport: ${JSON.stringify(openMenuProbe)}`);
    assert.equal(openMenuProbe.optionHit, true, "the floating font list should not be clipped by the horizontally scrollable dock");
    await page.locator('[role="option"][data-font-key="nelna-lizzy"]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#textEditorFontSelect").inputValue(), "nelna-lizzy", "custom font choices must update the existing select state");
    assert.equal(await page.locator("#textEditorFontMenu").isVisible(), false, "choosing a font should close the list");
    assert.equal(await page.locator("#textEditorFontTrigger").getAttribute("aria-expanded"), "false");

    await page.locator("#textEditorFontTrigger").focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#textEditorFontMenu").isVisible(), true, "ArrowDown should open the floating font list");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "option", "keyboard navigation should enter the listbox options");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#textEditorFontMenu").isVisible(), false, "Escape should close the floating font list");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "textEditorFontTrigger", "Escape should restore focus to the trigger");

    console.log("PASS: floating font list uses the design scrollbar contract and preserves select state with mouse and keyboard input.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
