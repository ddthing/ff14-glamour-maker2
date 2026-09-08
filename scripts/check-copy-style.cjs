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
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?copy-style-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#titleAlignmentControls");

    assert.equal(await page.locator("#cardSubtitleInput").getAttribute("required"), null, "description must remain optional");
    assert.equal(await page.locator(".field-optional").textContent(), "선택 입력");
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element.parentElement).textAlign), "left");
    const emptySubtitle = await page.locator("#boardSubtitle").evaluate((element) => ({
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      clipPath: getComputedStyle(element).clipPath,
      beforeContent: getComputedStyle(element, "::before").content,
    }));
    assert.equal(emptySubtitle.display, "block", `empty description should remain in the accessibility tree: ${JSON.stringify(emptySubtitle)}`);
    assert.equal(emptySubtitle.position, "absolute", `empty description should not participate in card layout: ${JSON.stringify(emptySubtitle)}`);
    assert.ok(emptySubtitle.width <= 1 && emptySubtitle.height <= 1, `empty description should have no visible footprint: ${JSON.stringify(emptySubtitle)}`);
    assert.notEqual(emptySubtitle.clipPath, "none", `empty description should be visually clipped: ${JSON.stringify(emptySubtitle)}`);
    assert.equal(emptySubtitle.beforeContent, "none", `empty description still exposes a placeholder: ${JSON.stringify(emptySubtitle)}`);

    await page.locator("#cardTitleInput").fill("짧은 제목");
    const cardAlignment = async (alignment) => {
      await page.locator(`[data-title-align="${alignment}"]`).click();
      return page.locator("#boardTitle").evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const block = element.getBoundingClientRect();
        return {
          blockTextAlign: getComputedStyle(element).textAlign,
          blockWidth: block.width,
          textCenter: text.left + text.width / 2,
          blockCenter: block.left + block.width / 2,
          textLeft: text.left,
          blockLeft: block.left,
          textRight: text.right,
          blockRight: block.right,
        };
      });
    };
    const leftAlignment = await cardAlignment("left");
    const centerAlignment = await cardAlignment("center");
    const rightAlignment = await cardAlignment("right");
    assert.equal(leftAlignment.blockTextAlign, "left", "left alignment did not reach the card title layer");
    assert.equal(centerAlignment.blockTextAlign, "center", "center alignment did not reach the card title layer");
    assert.equal(rightAlignment.blockTextAlign, "right", "right alignment did not reach the card title layer");
    assert.ok(leftAlignment.textLeft - leftAlignment.blockLeft < 5, `left alignment still follows the textarea: ${JSON.stringify(leftAlignment)}`);
    assert.ok(Math.abs(centerAlignment.textCenter - centerAlignment.blockCenter) < 5, `center alignment is not centered in the card: ${JSON.stringify(centerAlignment)}`);
    assert.ok(rightAlignment.blockRight - rightAlignment.textRight < 5, `right alignment still follows the textarea: ${JSON.stringify(rightAlignment)}`);
    assert.ok(new Set([leftAlignment.blockWidth, centerAlignment.blockWidth, rightAlignment.blockWidth]).size === 1, "alignment changed the card text box width instead of its text position");

    await page.locator('[data-title-align="center"]').click();
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element.parentElement).textAlign), "left", "title alignment should not move the subtitle container");
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).textAlign), "center");
    const capturedCenter = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const title = document.querySelector("#boardTitle").getBoundingClientRect();
      const copy = captureExportCopy().find((entry) => entry.lines.some((line) => line.text === "짧은 제목"));
      const expected = ((title.left + title.right) / 2 - board.left) * getExportDimensions().layoutWidth / board.width;
      return { textAlign: copy?.textAlign, lineX: copy?.lines[0]?.x, expected };
    });
    assert.equal(capturedCenter.textAlign, "center", `PNG copy lost title alignment: ${JSON.stringify(capturedCenter)}`);
    assert.ok(Math.abs(capturedCenter.lineX - capturedCenter.expected) < 3, `PNG copy anchor drifted from centered title: ${JSON.stringify(capturedCenter)}`);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tuyeong-set-maker2-draft-v3"))).looks[0].titleAlign, "center");

    const styleAdvancedToggle = page.locator("#styleAdvancedToggle");
    if (await styleAdvancedToggle.getAttribute("aria-expanded") !== "true") await styleAdvancedToggle.click();
    const copyEditorAdvanced = page.locator("#copyEditorAdvanced");
    if (await copyEditorAdvanced.getAttribute("open") === null) await copyEditorAdvanced.locator("summary").click();
    const controlShape = await page.evaluate(() => ({
      directPickerRadius: getComputedStyle(document.querySelector("#titleOutlineColorInput").closest("label")).borderRadius,
      directSwatchRadius: getComputedStyle(document.querySelector("#titleOutlineColorInput")).borderRadius,
      outlineRangeHeight: Math.round(document.querySelector("#titleOutlineRange").getBoundingClientRect().height),
      rangeHeight: Math.round(document.querySelector("#outlineRange").getBoundingClientRect().height),
      scrollbarWidth: getComputedStyle(document.querySelector(".inspector")).scrollbarWidth,
      webkitScrollbarWidth: getComputedStyle(document.querySelector(".inspector"), "::-webkit-scrollbar").width,
    }));
    assert.equal(controlShape.directPickerRadius, "999px", `direct color picker is not a shared pill: ${JSON.stringify(controlShape)}`);
    assert.equal(controlShape.directSwatchRadius, "50%", `direct color swatch is not circular: ${JSON.stringify(controlShape)}`);
    assert.equal(controlShape.outlineRangeHeight, controlShape.rangeHeight, `range hit areas drifted: ${JSON.stringify(controlShape)}`);
    assert.equal(controlShape.outlineRangeHeight, 40, `range hit area should be 40px: ${JSON.stringify(controlShape)}`);
    assert.equal(controlShape.scrollbarWidth, "thin", `inspector scrollbar is not thin: ${JSON.stringify(controlShape)}`);
    assert.equal(controlShape.webkitScrollbarWidth, "6px", `WebKit scrollbar remains too wide: ${JSON.stringify(controlShape)}`);

    await page.locator("#titleOutlineRange").scrollIntoViewIfNeeded();
    await page.locator("#titleOutlineRange").fill("2");
    await setColor(page, "#titleOutlineColorInput", "#ff00aa");
    const titleStyle = await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).webkitTextStroke);
    assert.match(titleStyle, /rgb\(255, 0, 170\)/, `custom title outline color did not reach the card: ${titleStyle}`);

    await page.locator("#cardSubtitleInput").fill("선택 설명");
    await setColor(page, "#titleColorInput", "#123456");
    const customTitle = await page.locator("#boardTitle").evaluate((element) => ({
      color: getComputedStyle(element).color,
      opacity: getComputedStyle(element).opacity,
    }));
    assert.equal(customTitle.color, "rgb(18, 52, 86)");
    assert.equal(customTitle.opacity, "1");
    const subtitleStyle = await page.locator("#boardSubtitle").evaluate((element) => ({
      color: getComputedStyle(element).color,
      opacity: getComputedStyle(element).opacity,
      display: getComputedStyle(element).display,
      textAlign: getComputedStyle(element).textAlign,
    }));
    assert.notEqual(subtitleStyle.color, customTitle.color, "title color control leaked into the description");
    assert.equal(subtitleStyle.opacity, "0.68");
    assert.notEqual(subtitleStyle.display, "none");
    assert.equal(subtitleStyle.textAlign, "left", "title alignment control leaked into the description");

    await page.locator("#titleColorAutoButton").click();
    const autoTitle = await page.locator("#boardTitle").evaluate((element) => ({ color: getComputedStyle(element).color, opacity: getComputedStyle(element).opacity }));
    assert.equal(autoTitle.color, "rgb(38, 50, 56)");
    assert.equal(autoTitle.opacity, "1");
    await page.locator("#cardSubtitleInput").fill("");
    const clearedSubtitle = await page.locator("#boardSubtitle").evaluate((element) => ({
      position: getComputedStyle(element).position,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
    assert.equal(clearedSubtitle.position, "absolute");
    assert.ok(clearedSubtitle.width <= 1 && clearedSubtitle.height <= 1, `cleared description became visible again: ${JSON.stringify(clearedSubtitle)}`);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#titleAlignmentControls");
    assert.equal(await page.locator('[data-title-align="center"]').getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#titleOutlineColorInput").inputValue(), "#ff00aa");
    assert.equal(await page.locator("#titleColorAutoButton").isDisabled(), true);
    console.log("PASS: title alignment, title color, title outline, optional subtitle, and title style persistence.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
