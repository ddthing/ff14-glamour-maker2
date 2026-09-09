const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const CardPng = require("../models/card-png.js");

const patterns = ["collage", "scrapbook"];
const fixtureItems = [
  [93001, "head", "계승자의 두건"],
  [93002, "body", "계승자의 튜닉"],
  [93003, "hands", "이발리스 근위기사 장갑"],
  [93004, "legs", "학구자 바지"],
  [93005, "feet", "성부동 장화"],
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?solo-note-decorations=1");
    await page.waitForSelector("#canvasBoard");

    await page.evaluate((items) => {
      items.forEach(([id, slot, name]) => itemRecordCache.set(String(id), {
        id: String(id),
        slot,
        names: { ko: name, en: name, ja: name },
      }));
      const outfit = getSelectedLook().outfits[0];
      items.forEach(([id, slot]) => { outfit[slot] = String(id); });
      state.characterCount = 1;
      state.selectedCharacter = 0;
      state.singleRatio = "portrait";
      renderAll();
    }, fixtureItems);

    for (const pattern of patterns) {
      await page.locator(`#backgroundArtPanel button[data-pattern="${pattern}"]`).click();
      await page.waitForFunction((expected) => document.querySelector("#canvasBoard")?.dataset.backgroundPattern === expected, pattern);
      const notes = await page.evaluate(() => [...document.querySelectorAll("#boardGearList > .board-gear-item")].map((note) => {
        const noteRect = note.getBoundingClientRect();
        const tape = note.querySelector(".gear-tile-tape");
        const tapeRect = tape?.getBoundingClientRect();
        const stamp = note.querySelector(".gear-note-stamp");
        return {
          stampDisplay: stamp ? getComputedStyle(stamp).display : "missing",
          tapeDisplay: tape ? getComputedStyle(tape).display : "missing",
          tapeOverhangs: Boolean(tapeRect && tapeRect.top < noteRect.top && tapeRect.bottom > noteRect.top),
          labelRule: getComputedStyle(note.querySelector(".gear-slot-label"), "::before").display,
          copyRule: getComputedStyle(note.querySelector(".gear-tile-copy"), "::after").content,
        };
      }));

      assert.equal(notes.length, 5, `${pattern}: solo card should keep all five information notes`);
      assert.ok(notes.every(({ stampDisplay }) => stampDisplay === "none"), `${pattern}: solo material stamps must be removed: ${JSON.stringify(notes)}`);
      assert.ok(notes.every(({ tapeDisplay, tapeOverhangs }) => tapeDisplay === "block" && tapeOverhangs), `${pattern}: tape must remain visibly attached to each note: ${JSON.stringify(notes)}`);
      assert.ok(notes.every(({ labelRule, copyRule }) => labelRule === "none" && copyRule === "none"), `${pattern}: meaningless copy rules must stay hidden: ${JSON.stringify(notes)}`);
      assert.equal(CardPng.shouldDrawPatternStamp(pattern, true), false, `${pattern}: solo PNG must not draw a material stamp`);
    }
    console.log("PASS: solo collage and scrapbook notes remove stamp/line residue while retaining overlapping tape in preview and PNG rules.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
