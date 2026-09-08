const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const item = {
  id: "900001",
  slot: "head",
  names: { ko: "한국어 장비 테스트" },
  meta: { ko: "머리" },
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.route("**/api/items/search**", async (route) => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get("q") !== item.id) {
        await route.fulfill({ json: { results: [] } });
        return;
      }
      const language = params.get("language");
      await route.fulfill({
        json: {
          results: [{
            ...item,
            names: language === "en" ? { en: "English Gear Test" } : { ko: item.names.ko },
          }],
        },
      });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");

    const cases = [
      { count: 1, width: 1280, selector: ".board-gear-item .gear-item-secondary" },
      { count: 2, width: 1280, selector: ".board-gear-item .gear-item-secondary" },
      { count: 3, width: 390, selector: ".multi-info-item > small" },
      { count: 5, width: 390, selector: ".multi-info-item > small" },
    ];

    for (const testCase of cases) {
      await page.setViewportSize({ width: testCase.width, height: 900 });
      await page.locator(`[data-cast-count="${testCase.count}"]`).click();
      await page.waitForFunction((count) => document.querySelector("#canvasBoard")?.dataset.cast === String(count), testCase.count);
      await page.evaluate(({ count, fixture }) => {
        const look = getSelectedLook();
        ensureLookOutfits(look);
        state.language = "ko";
        state.selectedCharacter = 0;
        state.multiInfoEnabled = true;
        look.outfits.forEach((outfit) => { outfit.head = null; });
        look.outfits.slice(0, count).forEach((outfit) => { outfit.head = fixture.id; });
        itemRecordCache.set(fixture.id, fixture);
        renderAll();
      }, { count: testCase.count, fixture: item });
      await page.waitForFunction(({ selector, count }) => {
        const visible = [...document.querySelectorAll(selector)].filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
        return visible.length === count && visible.every((element) => element.textContent.trim() === "English Gear Test");
      }, { selector: testCase.selector, count: testCase.count });

      const snapshot = await page.evaluate(({ selector }) => {
        const lines = [...document.querySelectorAll(selector)];
        return {
          text: lines.map((line) => line.textContent.trim()),
          display: lines.map((line) => getComputedStyle(line).display),
          boxes: lines.map((line) => {
            const rect = line.getBoundingClientRect();
            return { width: Math.round(rect.width), height: Math.round(rect.height) };
          }),
          typography: lines.map((line) => {
            const primary = line.matches(".multi-info-item > small")
              ? line.parentElement?.querySelector(":scope > span")
              : line.parentElement?.querySelector(":scope > strong");
            const primaryRect = primary?.getBoundingClientRect();
            const secondaryRect = line.getBoundingClientRect();
            return {
              primaryBottom: primaryRect?.bottom || 0,
              secondaryTop: secondaryRect.top,
              primarySize: primary ? Number.parseFloat(getComputedStyle(primary).fontSize) : 0,
              secondarySize: Number.parseFloat(getComputedStyle(line).fontSize),
            };
          }),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      }, { selector: testCase.selector });
      assert.deepEqual(snapshot.text, Array(testCase.count).fill("English Gear Test"), `English card names missing for ${testCase.count}-person ${testCase.width}px card`);
      assert.ok(snapshot.display.every((value) => value !== "none"), `English card names are hidden for ${testCase.count}-person ${testCase.width}px card`);
      assert.ok(snapshot.boxes.every(({ width, height }) => width > 0 && height > 0), `English card names have no layout box for ${testCase.count}-person ${testCase.width}px card`);
      assert.ok(snapshot.typography.every(({ primaryBottom, secondaryTop, primarySize, secondarySize }) => secondaryTop >= primaryBottom - 1 && secondarySize < primarySize), `English card names collide with or overpower Korean names for ${testCase.count}-person ${testCase.width}px card`);
      assert.equal(snapshot.overflow, false, `English card names cause viewport overflow for ${testCase.count}-person ${testCase.width}px card`);
    }

    console.log("PASS: Korean card item names retain visible English secondary names across cast counts and mobile width.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
