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
      if (sessionStorage.getItem("__floating_copy_style_test__")) return;
      localStorage.clear();
      sessionStorage.setItem("__floating_copy_style_test__", "1");
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?copy-style-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#textEditorDock");

    assert.equal(await page.locator("#cardSubtitleInput").getAttribute("required"), null, "description must remain optional");
    assert.equal(await page.locator(".field-optional").textContent(), "선택 입력");
    assert.equal(await page.locator("#copyEditorSection .copy-editor-toolbar").isVisible(), false, "inspector still exposes duplicate formatting controls");
    assert.equal(await page.locator("#copyEditorAdvanced").isVisible(), false, "inspector still exposes advanced text formatting");
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

    await page.locator("#cardTitleInput").fill("short title");
    const cardAlignment = async (alignment) => {
      await page.locator(`[data-floating-align="${alignment}"]`).click();
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

    await page.locator('[data-floating-align="center"]').click();
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).textAlign), "center");
    const capturedCenter = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const title = document.querySelector("#boardTitle").getBoundingClientRect();
      const copy = captureExportCopy().find((entry) => entry.lines.some((line) => line.text === "short title"));
      const expected = ((title.left + title.right) / 2 - board.left) * getExportDimensions().layoutWidth / board.width;
      return { textAlign: copy?.textAlign, lineX: copy?.lines[0]?.x, expected };
    });
    assert.equal(capturedCenter.textAlign, "center", `PNG copy lost title alignment: ${JSON.stringify(capturedCenter)}`);
    assert.ok(Math.abs(capturedCenter.lineX - capturedCenter.expected) < 3, `PNG copy anchor drifted from centered title: ${JSON.stringify(capturedCenter)}`);

    await page.locator("#cardSubtitleInput").fill("선택 설명");
    await page.locator("#focusCardTitleButton").click();
    await setColor(page, "#textEditorColorInput", "#123456");
    await page.locator("#textEditorItalicButton").click();
    await page.locator("#textEditorUnderlineButton").click();
    await page.locator("#textEditorUppercaseButton").click();
    const titleStyle = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, opacity: style.opacity, fontStyle: style.fontStyle, decoration: style.textDecorationLine, transform: style.textTransform };
    });
    assert.equal(titleStyle.color, "rgb(18, 52, 86)");
    assert.equal(titleStyle.opacity, "1");
    assert.equal(titleStyle.fontStyle, "italic");
    assert.match(titleStyle.decoration, /underline/);
    assert.equal(titleStyle.transform, "uppercase");
    const exportStyle = await page.evaluate(() => {
      const title = captureExportCopy().find((entry) => entry.lines.length);
      return { text: title?.lines[0]?.text, fontStyle: title?.fontStyle, textDecoration: title?.textDecoration };
    });
    assert.equal(exportStyle.text, "SHORT TITLE", `uppercase was not included in PNG copy layout: ${JSON.stringify(exportStyle)}`);
    assert.equal(exportStyle.fontStyle, "italic");
    assert.equal(exportStyle.textDecoration, "underline");

    const subtitleStyle = await page.locator("#boardSubtitle").evaluate((element) => ({
      color: getComputedStyle(element).color,
      opacity: getComputedStyle(element).opacity,
      display: getComputedStyle(element).display,
      textAlign: getComputedStyle(element).textAlign,
      fontStyle: getComputedStyle(element).fontStyle,
      transform: getComputedStyle(element).textTransform,
    }));
    assert.notEqual(subtitleStyle.color, titleStyle.color, "title color control leaked into the description");
    assert.equal(subtitleStyle.opacity, "0.68");
    assert.notEqual(subtitleStyle.display, "none");
    assert.equal(subtitleStyle.textAlign, "center", "description did not follow the title alignment");
    assert.equal(subtitleStyle.fontStyle, "normal", "title italic leaked into the description");
    assert.equal(subtitleStyle.transform, "none", "title uppercase leaked into the description");

    await page.locator("#textEditorColorAutoButton").click();
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
    await page.waitForSelector("#textEditorDock");
    assert.equal(await page.locator('[data-floating-align="center"]').getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#textEditorItalicButton").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#textEditorUnderlineButton").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#textEditorUppercaseButton").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#textEditorColorAutoButton").isDisabled(), true);
    console.log("PASS: title alignment, floating color and inline formatting, optional subtitle, export parity, and persistence.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
