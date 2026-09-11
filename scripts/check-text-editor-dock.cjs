const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function setColor(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("__floating_text_toolbar_test__")) return;
      localStorage.clear();
      sessionStorage.setItem("__floating_text_toolbar_test__", "1");
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173", { waitUntil: "networkidle" });
    await page.waitForSelector("#textEditorDock");

    const dock = page.locator("#textEditorDock");
    assert.equal(await dock.isVisible(), true, "floating text toolbar should be visible in the style panel");
    assert.equal(await dock.locator("[role=toolbar]").count(), 1, "floating text toolbar is missing toolbar semantics");
    assert.equal(await page.locator("#textEditorFontTrigger").isVisible(), true, "font picker trigger is not in the floating toolbar");
    assert.equal(await page.locator("#textEditorFontMenu").isHidden(), true, "font picker list should start closed");
    assert.equal(await page.locator(".text-editor-dock-size").count(), 0, "title font size controls should be removed from the floating toolbar");
    assert.equal(await page.locator("#textEditorFontSizeUp").count(), 0, "floating toolbar should not expose a font size increase button");
    assert.equal(await page.locator("#textEditorFontSizeDown").count(), 0, "floating toolbar should not expose a font size decrease button");
    assert.equal(await page.locator("#copyEditorSection .copy-editor-toolbar").isVisible(), false, "right-side formatting toolbar is still visible");
    assert.equal(await page.locator("#copyEditorAdvanced").isVisible(), false, "right-side advanced text formatting is still visible");
    assert.equal(await page.locator("#textEditorMoreButton").isVisible(), true, "title outline control is missing from the floating toolbar");
    assert.equal(await page.locator("#textEditorMoreButton").isDisabled(), false, "title outline control should be enabled for the title target");
    assert.equal(await page.locator("#textEditorMoreMenu").isHidden(), true, "title outline popover should start closed");

    await page.locator("#textEditorMoreButton").click();
    assert.equal(await page.locator("#textEditorMoreMenu").isVisible(), true, "title outline popover did not open");
    assert.equal(await page.locator("#textEditorOutlineRange").inputValue(), "0", "title outline should start disabled");
    assert.equal((await page.locator("#textEditorOutlineValue").textContent()).trim(), "없음", "title outline status should show disabled state");
    await setColor(page, "#textEditorOutlineColorInput", "#b9d4d5");
    await page.locator("#textEditorOutlineRange").fill("3");
    await page.waitForTimeout(80);
    const titleOutline = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      const board = document.querySelector("#canvasBoard");
      return {
        stroke: style.webkitTextStrokeWidth,
        color: style.webkitTextStrokeColor,
        boardColor: getComputedStyle(board).getPropertyValue("--title-outline-color").trim(),
        boardWidth: getComputedStyle(board).getPropertyValue("--title-outline-width").trim(),
      };
    });
    assert.equal(titleOutline.stroke, "3px", `title outline width did not reach the card: ${JSON.stringify(titleOutline)}`);
    assert.match(titleOutline.color, /rgb\(185, 212, 213\)/, `title outline color did not reach the card: ${JSON.stringify(titleOutline)}`);
    assert.equal(titleOutline.boardColor, "#b9d4d5", `title outline color token did not update: ${JSON.stringify(titleOutline)}`);
    assert.equal(titleOutline.boardWidth, "3px", `title outline width token did not update: ${JSON.stringify(titleOutline)}`);
    assert.equal((await page.locator("#textEditorOutlineValue").textContent()).trim(), "3 px", "title outline width output did not update");
    assert.equal(await page.locator("#textEditorOutlineColorValue").textContent(), "#B9D4D5", "title outline color output did not update");
    await page.screenshot({ path: "artifacts/ui-text-editor-dock-outline-open.png", fullPage: false });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#textEditorMoreMenu").isHidden(), true, "Escape did not close the title outline popover");

    const initialBold = await page.locator("#textEditorBoldButton").getAttribute("aria-pressed");
    await page.locator("#textEditorBoldButton").click();
    assert.notEqual(await page.locator("#textEditorBoldButton").getAttribute("aria-pressed"), initialBold, "bold toggle did not update");
    await page.locator("#textEditorItalicButton").click();
    await page.locator("#textEditorUnderlineButton").click();
    await page.locator("#textEditorUppercaseButton").click();
    const inlineStyles = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontStyle: style.fontStyle,
        decoration: style.textDecorationLine,
        transform: style.textTransform,
      };
    });
    assert.equal(inlineStyles.fontStyle, "italic", `italic did not reach the card: ${JSON.stringify(inlineStyles)}`);
    assert.match(inlineStyles.decoration, /underline/, `underline did not reach the card: ${JSON.stringify(inlineStyles)}`);
    assert.equal(inlineStyles.transform, "uppercase", `uppercase did not reach the card: ${JSON.stringify(inlineStyles)}`);

    await page.locator('[data-floating-align="center"]').click();
    assert.equal(await page.locator('[data-floating-align="center"]').getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).textAlign), "center");
    await page.locator("#cardSubtitleInput").fill("설명");
    await page.locator("#cardSubtitleInput").blur();
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#boardSubtitle")).textAlign === "center");

    await page.locator("#cardSubtitleInput").focus();
    assert.equal(await dock.isVisible(), true, "floating text toolbar should stay visible for description editing");
    assert.equal(await page.locator("#textEditorDockTargetLabel").textContent(), "룩 설명", "floating toolbar target did not switch to description");
    assert.equal(await page.locator("#textEditorColorInput").getAttribute("aria-label"), "설명 텍스트 색상", "description color control did not switch its label");
    assert.equal(await page.locator("#textEditorMoreButton").isDisabled(), true, "title outline control should be disabled for description editing");
    assert.equal(await page.locator("#textEditorMoreMenu").isHidden(), true, "title outline popover should close for description editing");
    await page.locator("#textEditorBoldButton").click();
    await page.locator("#textEditorItalicButton").click();
    await page.locator("#textEditorUnderlineButton").click();
    await page.locator("#textEditorUppercaseButton").click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#boardSubtitle")).fontStyle === "italic");
    const subtitleInlineStyles = await page.locator("#boardSubtitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return { weight: Number.parseInt(style.fontWeight, 10), decoration: style.textDecorationLine, transform: style.textTransform };
    });
    assert.ok(subtitleInlineStyles.weight >= 700, `description bold did not reach the card: ${JSON.stringify(subtitleInlineStyles)}`);
    assert.match(subtitleInlineStyles.decoration, /underline/, `description underline did not reach the card: ${JSON.stringify(subtitleInlineStyles)}`);
    assert.equal(subtitleInlineStyles.transform, "uppercase", `description uppercase did not reach the card: ${JSON.stringify(subtitleInlineStyles)}`);
    await setColor(page, "#textEditorColorInput", "#654321");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#boardSubtitle")).color === "rgb(101, 67, 33)");
    await page.locator("#boardSubtitle").click();
    assert.equal(await page.locator("#textEditorDockTargetLabel").textContent(), "룩 설명", "direct description editing did not activate the floating toolbar");
    await page.locator("#focusCardTitleButton").click();
    assert.equal(await page.locator("#textEditorDockTargetLabel").textContent(), "카드 제목", "title focus did not restore the floating toolbar target");
    assert.equal(await page.locator("#textEditorMoreButton").isDisabled(), false, "title outline control did not re-enable for the title target");

    await setColor(page, "#textEditorColorInput", "#123456");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#boardTitle")).color === "rgb(18, 52, 86)");
    assert.equal(await page.locator("#textEditorColorAutoButton").isDisabled(), false, "automatic color reset did not become available");
    await page.locator("#textEditorColorAutoButton").click();
    assert.equal(await page.locator("#textEditorColorAutoButton").isDisabled(), true, "automatic color reset did not clear the custom color");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#textEditorFontSelect");
    assert.equal(await page.locator('[data-floating-align="center"]').getAttribute("aria-checked"), "true", "floating alignment did not persist");
    assert.equal(await page.locator("#textEditorItalicButton").getAttribute("aria-pressed"), "true", "italic did not persist");
    assert.equal(await page.locator("#textEditorUnderlineButton").getAttribute("aria-pressed"), "true", "underline did not persist");
    assert.equal(await page.locator("#textEditorUppercaseButton").getAttribute("aria-pressed"), "true", "uppercase did not persist");
    assert.equal(await page.locator("#textEditorOutlineRange").inputValue(), "3", "title outline width did not persist");
    assert.equal(await page.locator("#textEditorOutlineColorInput").inputValue(), "#b9d4d5", "title outline color did not persist");

    await page.locator("#itemsTab").click();
    assert.equal(await dock.isHidden(), true, "text toolbar should hide outside the style panel");
    await page.locator("#styleTab").click();
    assert.equal(await dock.isVisible(), true, "text toolbar did not return with the style panel");

    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `text toolbar overflows the page at ${width}px`);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "artifacts/ui-text-editor-dock-after.png", fullPage: false });
    console.log("PASS: floating text formatting toolbar, single formatting entry point, persistence, panel visibility, and narrow reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
