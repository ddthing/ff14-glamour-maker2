const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const slots = ["head", "body", "hands", "legs", "feet"];
const labelsByLanguage = {
  ko: ["머리", "몸", "손", "다리", "발"],
  en: ["Head", "Body", "Hands", "Legs", "Feet"],
  ja: ["頭", "胴", "手", "脚", "足"],
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const searchRequests = [];
    await page.addInitScript(() => localStorage.clear());
    await page.route("**/api/items/search*", async (route) => {
      const url = new URL(route.request().url());
      const slot = url.searchParams.get("slot");
      const query = url.searchParams.get("q");
      searchRequests.push({ slot, query });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{
            id: slot === "head" ? "9900001" : "9900002",
            slot,
            names: { ko: slot === "head" ? "까마귀 머리 장비" : "까마귀 몸 장비" },
            meta: { ko: slot === "head" ? "머리" : "몸" },
          }],
        }),
      });
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?slot-labels=1");
    await page.waitForSelector("#canvasBoard");
    const failures = [];

    await page.evaluate(({ slotNames, slotKeys }) => {
      const items = slotKeys.map((slot, index) => ({
        id: String(9800000 + index),
        slot,
        names: { ko: `${slotNames[index]} 테스트 장비` },
        meta: { ko: slotNames[index] },
      }));
      registerItemRecords(items);
      const look = getSelectedLook();
      look.outfits[0] = Object.fromEntries(items.map((item) => [item.slot, item.id]));
      ensureLookOutfits(look);
      renderAll();
    }, { slotNames: labelsByLanguage.ko, slotKeys: slots });

    await page.locator("#itemsTab").click();
    await page.waitForSelector("#itemsPanel");
    for (const [language, expected] of Object.entries(labelsByLanguage)) {
      await page.evaluate((nextLanguage) => {
        state.language = nextLanguage;
        applyPageLanguage(nextLanguage);
        renderAll();
      }, language);
      const actual = await page.evaluate(() => ({
        card: [...document.querySelectorAll("#boardGearList .gear-slot-label")].map((element) => element.textContent.trim()),
        cardSlotLines: [...document.querySelectorAll("#boardGearList .gear-slot-label")].map((element) => getComputedStyle(element, "::before").display),
        equipment: [...document.querySelectorAll(".equipment-row .equipment-icon > span:not(.item-image-fallback)")].map((element) => element.textContent.trim()),
      }));
      try {
        assert.deepEqual(actual.card, expected, `${language}: card information labels drifted from the official slot names`);
      } catch (error) {
        failures.push(error.message);
      }
      try {
        assert.ok(actual.cardSlotLines.every((display) => display === "none"), `${language}: card information labels must not render a leading line: ${JSON.stringify(actual)}`);
      } catch (error) {
        failures.push(error.message);
      }
      try {
        assert.deepEqual(actual.equipment, expected, `${language}: 02 equipment tab labels drifted from the official slot names`);
      } catch (error) {
        failures.push(error.message);
      }
    }

    await page.evaluate(() => {
      state.language = "ko";
      applyPageLanguage("ko");
      renderAll();
    });
    await page.locator('.equipment-row[data-slot="head"]').click();
    await page.locator("#itemSearch").fill("까마귀");
    await page.waitForSelector('.catalog-result[data-item-id="9900001"]');
    await page.locator('.equipment-row[data-slot="body"]').click();
    await page.waitForTimeout(50);
    const afterSlotChange = await page.evaluate(() => ({
      input: document.querySelector("#itemSearch")?.value || "",
      resultCount: document.querySelectorAll(".catalog-result").length,
      status: document.querySelector("#catalogStatus")?.textContent.trim() || "",
    }));
    try {
      assert.equal(afterSlotChange.input, "", `switching equipment slots must clear the previous query: ${JSON.stringify(afterSlotChange)}`);
    } catch (error) {
      failures.push(error.message);
    }
    try {
      assert.equal(afterSlotChange.resultCount, 0, `switching equipment slots must clear stale catalog results: ${JSON.stringify(afterSlotChange)}`);
    } catch (error) {
      failures.push(error.message);
    }
    try {
      assert.equal(searchRequests.some(({ slot, query }) => slot === "body" && query === "까마귀"), false, `the previous query leaked into the new slot: ${JSON.stringify(searchRequests)}`);
    } catch (error) {
      failures.push(error.message);
    }
    if (failures.length) throw new Error(failures.join("\n"));

    console.log(JSON.stringify({ status: "PASS", labelsByLanguage, searchRequests, afterSlotChange }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
