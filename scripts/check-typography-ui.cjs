const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#textEditorFontTrigger");

    assert.equal(await page.locator("#textEditorFontTrigger").isVisible(), true, "title typography is not available in the floating toolbar");
    assert.equal(await page.locator("#copyEditorSection #titleFontSelect").isVisible(), false, "duplicate font control remains visible in the inspector");
    assert.equal(await page.locator("#multiCardControls #titleFontSelect, .card-style-section #titleFontSelect").count(), 0, "title typography remains buried in card settings");
    assert.equal(await page.locator("#copyEditorContextbar").count(), 1, "card-first copy toolbar is missing");
    assert.equal(await page.locator("#copyEditorContextbar [role=toolbar]").count(), 1, "copy toolbar semantics are missing");
    assert.equal(await page.locator("#copyEditorContextbar [role=toolbar]").isVisible(), false, "duplicate inspector formatting controls are still visible");
    assert.equal(await page.locator("#copyEditorAdvanced").isVisible(), false, "fine styling should be removed from the inspector surface");
    const copySurface = await page.evaluate(() => {
      const contextbar = document.querySelector("#copyEditorContextbar");
      const section = document.querySelector("#copyEditorSection");
      const contextStyle = getComputedStyle(contextbar);
      const sectionStyle = getComputedStyle(section);
      return {
        contextBackground: contextStyle.backgroundColor,
        contextBorderWidth: contextStyle.borderWidth,
        contextRadius: contextStyle.borderRadius,
        contextShadow: contextStyle.boxShadow,
        sectionBackground: sectionStyle.backgroundColor,
      };
    });
    assert.equal(copySurface.contextBackground, "rgba(0, 0, 0, 0)", `copy tools should share the inspector surface: ${JSON.stringify(copySurface)}`);
    assert.equal(copySurface.contextBorderWidth, "0px", `copy tools should not become a nested card: ${JSON.stringify(copySurface)}`);
    assert.equal(copySurface.contextRadius, "0px", `copy tools should not have a separate card radius: ${JSON.stringify(copySurface)}`);
    assert.equal(copySurface.contextShadow, "none", `copy tools should not cast a separate shadow: ${JSON.stringify(copySurface)}`);
    assert.equal(copySurface.sectionBackground, "rgba(0, 0, 0, 0)", `copy section should not introduce another surface: ${JSON.stringify(copySurface)}`);
    await page.locator("#focusCardTitleButton").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-copy-target"), "title", "card focus action did not select the title");
    assert.equal(await page.locator(":focus").getAttribute("id"), "boardTitle", "card focus action did not move focus to the title");
    const directEditStyle = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
      };
    });
    assert.equal(directEditStyle.backgroundColor, "rgba(0, 0, 0, 0)", `direct card editing should keep the card surface continuous: ${JSON.stringify(directEditStyle)}`);
    assert.equal(directEditStyle.borderRadius, "0px", `direct card editing should not create a rounded text box: ${JSON.stringify(directEditStyle)}`);
    assert.equal(directEditStyle.boxShadow, "none", `direct card editing should not create a shadowed text box: ${JSON.stringify(directEditStyle)}`);

    const initial = await page.evaluate(() => {
      const trigger = document.querySelector("#textEditorFontTrigger");
      const controls = [...document.querySelectorAll("#textEditorBoldButton, #textEditorItalicButton, #textEditorUnderlineButton, #textEditorUppercaseButton, #textEditorColorAutoButton, [data-floating-align]")];
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      return {
        trigger: box(trigger),
        triggerRadius: getComputedStyle(trigger).borderRadius,
        controls: controls.map((control) => ({
          id: control.id || control.dataset.floatingAlign,
          box: box(control),
          radius: getComputedStyle(control).borderRadius,
          transition: getComputedStyle(control).transitionDuration,
        })),
      };
    });
    assert.ok(initial.trigger.height >= 36, `font picker trigger target is too short: ${JSON.stringify(initial.trigger)}`);
    assert.equal(initial.controls.length, 8, `floating formatting controls are incomplete: ${JSON.stringify(initial)}`);
    assert.ok(initial.controls.every(({ box }) => box.height >= 34), `floating controls are too short: ${JSON.stringify(initial)}`);
    assert.equal(new Set(initial.controls.map(({ radius }) => radius)).size > 0, true, "floating controls lost their shape");
    assert.ok(initial.controls.every(({ transition }) => parseFloat(transition) > 0), "floating toolbar feedback transition is missing");

    await page.locator("#styleAdvancedToggle").click();
    assert.equal(await page.locator("#styleAdvancedToggle").getAttribute("aria-expanded"), "true", "advanced style toggle did not open");
    assert.ok(await page.locator("[data-style-advanced]").evaluateAll((sections) => sections.every((section) => !section.hidden)), "advanced style sections stayed hidden");
    assert.ok(await page.locator("#styleAdvancedToggle").evaluate((element) => element.getBoundingClientRect().height >= 36), "advanced style trigger is too short");

    assert.equal(await page.locator("#backgroundPresetPanel").count(), 0, "retired background presets must not return inside the typography flow");

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(await page.locator("#textEditorBoldButton").evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "floating toolbar ignores reduced-motion");
    assert.ok(await page.locator("#styleAdvancedToggle").evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "advanced style trigger ignores reduced-motion");
    await page.waitForFunction(() => !document.querySelector("#toast")?.classList.contains("is-visible"), null, { timeout: 4000 });
    await page.locator("#textEditorDock").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/ui-typography-panel-after.png", fullPage: false });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "typography controls overflow at 320px");
    console.log("PASS: floating typography controls, single formatting entry point, advanced image controls, reduced-motion, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
