const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const legacyKeys = [
  "glamour-atelier-draft-v1",
  "glamour-atelier-draft-v2",
  "glamour-atelier-ui-v1",
  "glamour-atelier-background-presets-v1",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((keys) => {
      localStorage.clear();
      keys.forEach((key) => localStorage.setItem(key, "legacy-test-data"));
    }, legacyKeys);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");

    assert.equal(await page.locator("#libraryToggleButton").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#libraryToggleButton").getAttribute("aria-label"), "LOOK BOOK 펼치기");
    assert.equal(await page.locator(".look-list-item").count(), 1);
    assert.equal(await page.locator(".look-list-item strong").textContent(), "새로운 룩");
    assert.equal(await page.locator("#castSelector button").count(), 1);
    assert.equal(await page.locator("#imageState").getAttribute("data-state"), "empty");
    assert.equal(await page.locator("#sourceThumb").getAttribute("src"), null);
    assert.equal(await page.locator("#exportButton").getAttribute("aria-disabled"), "true");
    assert.equal(await page.locator("#exportButton").evaluate((element) => element.disabled), false, "blank export should remain keyboard discoverable");

    const slots = await page.locator(".equipment-row").evaluateAll((rows) => rows.map((row) => ({
      label: row.querySelector(".equipment-icon")?.textContent.trim(),
      name: row.getAttribute("aria-label") || "",
    })));
    assert.deepEqual(slots.map(({ label }) => label), ["머리", "몸", "손", "다리", "발"]);
    assert.ok(slots.every(({ name }) => /슬롯/.test(name)), "equipment labels should retain slot context for assistive tech");

    const visual = await page.evaluate(() => {
      const header = document.querySelector(".board-editorial-header");
      const titleBlock = document.querySelector(".board-title-block");
      const title = document.querySelector("#boardTitle");
      return {
        headerBackground: getComputedStyle(header).backgroundColor,
        blockBackground: getComputedStyle(titleBlock).backgroundColor,
        pseudo: getComputedStyle(header, "::before").display,
        shadow: getComputedStyle(title).textShadow,
      };
    });
    assert.equal(visual.headerBackground, "rgba(0, 0, 0, 0)");
    assert.equal(visual.blockBackground, "rgba(0, 0, 0, 0)");
    assert.equal(visual.pseudo, "none");
    assert.equal(visual.shadow, "none");

    const storage = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), legacyKeys);
    assert.ok(Object.values(storage).every((value) => value === null), "legacy demo storage keys were not purged");

    const source = ["app.js", "index.html"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
    for (const forbidden of ["Moonlit Passage", "Velvet Comet", "Lunaris Circlet", "Ivory Veil", "Quiet-Ice Coat"]) {
      assert.equal(source.includes(forbidden), false, `production source still contains demo data: ${forbidden}`);
    }
    assert.equal(fs.existsSync(path.join(root, "assets", "screenshots")), false, "demo screenshot asset directory still ships");
    console.log("PASS: first render is blank and collapsed, intuitive slots are exposed, legacy data is purged, and demo assets are absent.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
