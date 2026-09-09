const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const fixtureItems = [
  { id: "990001", slot: "head", names: { ko: "미리보기 머리", en: "Preview Head" }, meta: { ko: "머리" } },
  { id: "990002", slot: "body", names: { ko: "미리보기 몸", en: "Preview Body" }, meta: { ko: "몸" } },
  { id: "990003", slot: "hands", names: { ko: "미리보기 손", en: "Preview Hands" }, meta: { ko: "손" } },
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");
    await page.locator('[data-cast-count="3"]').click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "3");
    await page.locator("#imageInput").setInputFiles([
      { name: "lineup-one.png", mimeType: "image/png", buffer: fixturePng },
      { name: "lineup-two.png", mimeType: "image/png", buffer: fixturePng },
      { name: "lineup-three.png", mimeType: "image/png", buffer: fixturePng },
    ]);
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap img").length === 3);
    await page.waitForFunction(() => typeof pendingAssetWrites !== "undefined" && pendingAssetWrites.size === 0);
    await page.evaluate((items) => {
      const look = getSelectedLook();
      ensureLookOutfits(look);
      state.language = "ko";
      state.multiInfoEnabled = true;
      state.multiInfoMode = "clear";
      look.outfits.slice(0, 3).forEach((outfit) => {
        outfit.head = items[0].id;
        outfit.body = items[1].id;
        outfit.hands = items[2].id;
      });
      items.forEach((item) => itemRecordCache.set(item.id, item));
      renderAll();
    }, fixtureItems);
    await page.waitForFunction(() => document.querySelectorAll(".multi-info-column .multi-info-item > span").length === 9);
    const assetSnapshot = await page.evaluate(() => state.characters.slice(0, 3).map((character) => ({
      imageSrc: character.imageSrc,
      originalSrc: character.originalSrc,
      assetKey: character.assetKey,
      resolved: Boolean(resolveCharacterAsset(character, "hero")),
    })));
    assert.ok(assetSnapshot.every(({ resolved }) => resolved), `lineup fixture images are not exportable: ${JSON.stringify(assetSnapshot)}`);

    const preview = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const boardRect = board.getBoundingClientRect();
      const scaleX = 1200 / boardRect.width;
      const scaleY = 675 / boardRect.height;
      return [...board.querySelectorAll(".multi-info-column .multi-info-item > span")].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: ((rect.left + rect.width / 2 - boardRect.left) * scaleX),
          y: ((rect.top + rect.height / 2 - boardRect.top) * scaleY),
        };
      });
    });

    await page.evaluate((names) => {
      window.__lineupInfoExportCalls = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.__lineupInfoOriginalFillText = original;
      CanvasRenderingContext2D.prototype.fillText = function captureLineupInfo(text, x, y, ...args) {
        if (names.includes(String(text))) {
          window.__lineupInfoExportCalls.push({ text: String(text), x, y, textBaseline: this.textBaseline });
        }
        return original.call(this, text, x, y, ...args);
      };
    }, fixtureItems.map(({ names }) => names.ko));
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
    await page.locator("#exportButton").click();
    let download;
    try {
      download = await downloadPromise;
    } catch (error) {
      const status = await page.locator("#toast").textContent().catch(() => "");
      throw new Error(`PNG export did not start: ${status.trim() || error.message}`);
    }
    await download.cancel();
    await page.waitForFunction(() => !document.querySelector("#exportButton")?.hasAttribute("aria-busy"));
    const exportCalls = await page.evaluate(() => window.__lineupInfoExportCalls);
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.fillText = window.__lineupInfoOriginalFillText;
    });

    assert.equal(exportCalls.length, 9, `PNG should paint all lineup primary info lines: ${JSON.stringify(exportCalls)}`);
    assert.equal(preview.length, exportCalls.length, "preview and PNG should expose the same number of lineup info lines");
    const sortByPosition = (a, b) => a.x - b.x || a.y - b.y;
    const sortedPreview = [...preview].sort(sortByPosition);
    const sortedExport = [...exportCalls].sort(sortByPosition);
    const drift = sortedPreview.map((point, index) => ({
      x: Math.abs(point.x - sortedExport[index].x),
      y: Math.abs(point.y - sortedExport[index].y),
    }));
    assert.ok(exportCalls.every(({ textBaseline }) => textBaseline === "top"), `PNG info lines need an explicit shared top anchor: ${JSON.stringify({ preview: sortedPreview, export: sortedExport, drift })}`);
    assert.ok(drift.every(({ x, y }) => x <= 24 && y <= 24), `lineup equipment info drifted between preview and PNG: ${JSON.stringify({ preview: sortedPreview, export: sortedExport, drift })}`);
    console.log("PASS: lineup equipment information uses the same preview and PNG anchors.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
