const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const railGap = 8;

function rectFor(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
  });
}

async function assertAboveRail(page, selector, label) {
  const [control, rail] = await Promise.all([
    rectFor(page, selector),
    rectFor(page, ".rail"),
  ]);
  assert.ok(control.height > 0, `${label} is not visible`);
  assert.ok(control.top >= 0, `${label} is above the viewport`);
  assert.ok(control.bottom <= rail.top - railGap, `${label} is covered by the fixed mobile rail: ${JSON.stringify({ control, rail })}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?mobile-rail-check=1");
    await page.waitForSelector("#canvasBoard");

    await page.locator("#itemsTab").click();
    await page.waitForTimeout(250);
    await assertAboveRail(page, "#itemSearch", "item search after opening the equipment panel");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "itemsTab");

    assert.equal(await page.locator("#boardGearList [data-card-slot]").count(), 0, "blank cards must not expose phantom canvas gear shortcuts");
    await page.locator("#itemSearch").focus();
    await page.waitForTimeout(80);
    await assertAboveRail(page, "#itemSearch", "item search after direct focus in the empty equipment panel");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "itemSearch");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(80);
    await assertAboveRail(page, ".equipment-row-shell:last-child .equipment-row", "last equipment row at the bottom of the page");

    const layout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
      inspectorPaddingBottom: getComputedStyle(document.querySelector(".inspector")).paddingBottom,
    }));
    assert.equal(layout.horizontalOverflow, false, "mobile equipment panel has horizontal overflow");
    assert.notEqual(layout.scrollPaddingBottom, "0px", "mobile root does not reserve rail scroll padding");
    assert.notEqual(layout.inspectorPaddingBottom, "0px", "mobile inspector does not reserve rail clearance");

    await page.screenshot({ path: "artifacts/ui-mobile-rail-after.png", fullPage: false });
    console.log(JSON.stringify({ status: "PASS", layout }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
