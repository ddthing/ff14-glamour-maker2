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

    await page.locator('[data-title-align="center"]').click();
    assert.equal(await page.locator("#boardTitle").evaluate((element) => getComputedStyle(element.parentElement).textAlign), "center");
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("glamour-atelier-draft-v3"))).looks[0].titleAlign, "center");

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
