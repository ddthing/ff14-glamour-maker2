const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const CardPng = require("../models/card-png.js");

const slotLabels = ["머리", "몸", "손", "다리", "발"];
const patterns = ["collage", "scrapbook"];

function overlaps(left, right) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?pattern-rail-overlap=1");
    await page.waitForSelector("#canvasBoard");
    await page.locator('[data-cast-count="2"]').click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "2");
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.ratio === "landscape");

    const snapshots = {};
    for (const pattern of patterns) {
      await page.locator(`#backgroundArtPanel button[data-pattern="${pattern}"]`).click();
      await page.waitForFunction((expected) => document.querySelector("#canvasBoard")?.dataset.backgroundPattern === expected, pattern);
      await page.evaluate((labels) => {
        document.querySelectorAll(".board-gear-rail").forEach((rail, railIndex) => {
          rail.querySelector(".board-gear-rail-items").innerHTML = labels.map((label, index) => `
            <button class="board-gear-item" type="button">
              <span class="gear-note-surface" aria-hidden="true"></span>
              <span class="gear-tile-tape" aria-hidden="true"></span>
              <span class="gear-note-stamp" aria-hidden="true"></span>
              <div class="gear-tile-copy"><span>${label}</span><strong>${railIndex ? "오른쪽" : "왼쪽"} 장비 이름</strong><small class="gear-item-secondary">보조 정보</small></div>
            </button>`).join("");
        });
      }, slotLabels);
      await page.waitForTimeout(50);
      snapshots[pattern] = await page.evaluate(() => {
        const overlaps = (left, right) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
        const rectData = (element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        return [...document.querySelectorAll(".board-gear-rail")].map((rail) => ({
          stampDisplays: [...rail.querySelectorAll(".gear-note-stamp")].map((stamp) => getComputedStyle(stamp).display),
          stampCopyOverlaps: [...rail.querySelectorAll(".board-gear-item")].map((item) => {
            const stamp = item.querySelector(".gear-note-stamp");
            const stampRect = rectData(stamp);
            const textRects = [...item.querySelectorAll(".gear-tile-copy > *")].map(rectData);
            return {
              stamp: stampRect,
              text: textRects,
              overlaps: textRects.map((textRect) => overlaps(stampRect, textRect)),
              scrapbookBefore: getComputedStyle(stamp, "::before").content,
              scrapbookAfter: getComputedStyle(stamp, "::after").content,
            };
          }),
        }));
      });
      await page.locator("#canvasBoard").screenshot({ path: `artifacts/pattern-rail-${pattern}.png` });
    }

    for (const pattern of patterns) {
      const rails = snapshots[pattern];
      assert.ok(rails.length === 2, `${pattern}: expected two information rails`);
      assert.ok(rails.every((rail) => rail.stampDisplays.every((display) => display === "none")), `${pattern}: landscape two-person rail stamps must not render over copy: ${JSON.stringify(rails)}`);
      assert.ok(rails.every((rail) => rail.stampCopyOverlaps.every(({ overlaps: itemOverlaps }) => itemOverlaps.every((value) => value === false))), `${pattern}: rail decoration overlaps copy: ${JSON.stringify(rails)}`);
      assert.equal(CardPng.shouldDrawPatternStamp(pattern, false), false, `${pattern}: landscape PNG export must suppress the stamp layer too`);
    }
    console.log(JSON.stringify({
      status: "PASS",
      patterns: Object.fromEntries(patterns.map((pattern) => [pattern, snapshots[pattern].map((rail) => rail.stampDisplays)])),
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
