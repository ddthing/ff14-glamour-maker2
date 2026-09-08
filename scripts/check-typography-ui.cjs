const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#titleWeightOptions");

    assert.equal(await page.locator("#copyEditorSection #titleFontSelect").count(), 1, "title typography is separated from card copy editing");
    assert.equal(await page.locator("#multiCardControls #titleFontSelect, .card-style-section #titleFontSelect").count(), 0, "title typography remains buried in card settings");
    assert.equal(await page.locator("#copyEditorContextbar").count(), 1, "card-first copy toolbar is missing");
    assert.equal(await page.locator("#copyEditorContextbar [role=toolbar]").count(), 1, "copy toolbar semantics are missing");
    assert.equal(await page.locator("#copyEditorAdvanced").getAttribute("open"), null, "fine styling should start collapsed");
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
      const select = document.querySelector("#titleFontSelect");
      const options = [...document.querySelectorAll("#titleWeightOptions [role=radio]")];
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      return {
        select: box(select),
        selectRadius: getComputedStyle(select).borderRadius,
        options: options.map((option) => ({
          box: box(option),
          radius: getComputedStyle(option).borderRadius,
          selected: option.getAttribute("aria-checked") === "true",
          tabbable: option.tabIndex === 0,
          border: getComputedStyle(option).borderColor,
          transition: getComputedStyle(option).transitionDuration,
        })),
      };
    });
    assert.ok(initial.select.height >= 36, `font select target is too short: ${JSON.stringify(initial.select)}`);
    assert.ok(initial.options.length >= 2, "title weight choices are missing");
    assert.equal(new Set(initial.options.map(({ box }) => box.height)).size, 1, "title weight cards have mismatched heights");
    assert.ok(initial.options.every(({ box }) => box.height >= 52), "title weight cards are too short for the glyph preview");
    assert.equal(new Set(initial.options.map(({ radius }) => radius)).size, 1, "title weight cards have mismatched radii");
    assert.equal(initial.options.filter(({ selected }) => selected).length, 1, "title weight selection is ambiguous");
    assert.equal(initial.options.filter(({ tabbable }) => tabbable).length, 1, "title weight roving tabindex is missing");
    assert.ok(initial.options.every(({ transition }) => parseFloat(transition) > 0), "title weight feedback transition is missing");

    const selectedIndex = initial.options.findIndex(({ selected }) => selected);
    const nextIndex = (selectedIndex + 1) % initial.options.length;
    await page.locator("#titleWeightOptions [role=radio]").nth(selectedIndex).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#titleWeightOptions [role=radio]").nth(nextIndex).getAttribute("aria-checked"), "true", "title weight arrow navigation lost selection");
    assert.equal(await page.locator(":focus").getAttribute("data-title-weight"), await page.locator("#titleWeightOptions [role=radio]").nth(nextIndex).getAttribute("data-title-weight"), "title weight focus did not follow selection");

    await page.locator("#styleAdvancedToggle").click();
    assert.equal(await page.locator("#styleAdvancedToggle").getAttribute("aria-expanded"), "true", "advanced style toggle did not open");
    assert.ok(await page.locator("[data-style-advanced]").evaluateAll((sections) => sections.every((section) => !section.hidden)), "advanced style sections stayed hidden");
    assert.ok(await page.locator("#styleAdvancedToggle").evaluate((element) => element.getBoundingClientRect().height >= 36), "advanced style trigger is too short");

    await page.locator("#saveBackgroundPresetButton").click();
    await page.waitForFunction(() => document.activeElement?.id === "backgroundPresetName");
    assert.equal(await page.locator("#backgroundPresetName").evaluate((element) => document.activeElement === element), true, "preset form did not return focus to its name field");
    await page.locator("#backgroundPresetName").fill("Neutral 카드");
    await page.locator("#backgroundPresetForm button[type=submit]").click();
    await page.waitForSelector(".background-preset-item");
    const preset = await page.evaluate(() => {
      const apply = document.querySelector(".background-preset-apply");
      const remove = document.querySelector(".background-preset-delete");
      const applyBox = apply.getBoundingClientRect();
      const removeBox = remove.getBoundingClientRect();
      return { applyHeight: Math.round(applyBox.height), removeWidth: Math.round(removeBox.width), removeHeight: Math.round(removeBox.height) };
    });
    assert.ok(preset.applyHeight >= 44, `saved preset target is too short: ${JSON.stringify(preset)}`);
    assert.ok(preset.removeWidth >= 30 && preset.removeHeight >= 30, `preset delete target is too small: ${JSON.stringify(preset)}`);

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(await page.locator(".title-weight-option").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "title weight cards ignore reduced-motion");
    assert.ok(await page.locator("#styleAdvancedToggle").evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "advanced style trigger ignores reduced-motion");
    await page.waitForFunction(() => !document.querySelector("#toast")?.classList.contains("is-visible"), null, { timeout: 4000 });
    await page.locator("#titleWeightOptions").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/ui-typography-panel-after.png", fullPage: false });
    await page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "typography controls overflow at 320px");
    console.log("PASS: title font and weight rhythm, radio focus, advanced style disclosure, preset focus/targets, reduced-motion, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
