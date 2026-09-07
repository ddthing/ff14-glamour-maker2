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

    await page.locator("#cardTitleInput").fill("카드 제목 정렬 검증");
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
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element.parentElement).textAlign), "center");
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).textAlign), "center");
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("glamour-atelier-draft-v3"))).looks[0].titleAlign, "center");

    await page.locator("#styleAdvancedToggle").click();
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

    await page.locator("#titleOutlineRange").fill("2");
    await setColor(page, "#titleOutlineColorInput", "#ff00aa");
    const titleStyle = await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element).webkitTextStroke);
    assert.match(titleStyle, /rgb\(255, 0, 170\)/, `custom title outline color did not reach the card: ${titleStyle}`);

    await page.locator("#cardSubtitleInput").fill("선택 설명");
    await setColor(page, "#subtitleColorInput", "#123456");
    const subtitleStyle = await page.locator("#boardSubtitle").evaluate((element) => ({ color: getComputedStyle(element).color, opacity: getComputedStyle(element).opacity }));
    assert.equal(subtitleStyle.color, "rgb(18, 52, 86)");
    assert.equal(subtitleStyle.opacity, "1");

    await page.locator("#subtitleColorAutoButton").click();
    const autoSubtitle = await page.locator("#boardSubtitle").evaluate((element) => ({ color: getComputedStyle(element).color, opacity: getComputedStyle(element).opacity }));
    assert.equal(autoSubtitle.color, "rgb(38, 50, 56)");
    assert.equal(autoSubtitle.opacity, "0.68");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#titleAlignmentControls");
    assert.equal(await page.locator('[data-title-align="center"]').getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#titleOutlineColorInput").inputValue(), "#ff00aa");
    assert.equal(await page.locator("#subtitleColorAutoButton").isDisabled(), true);
    console.log("PASS: title alignment, direct title outline color, optional subtitle, and subtitle color persistence.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
