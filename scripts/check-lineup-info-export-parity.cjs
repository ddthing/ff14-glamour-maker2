const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const fixtureItems = [
  { id: "990001", slot: "head", names: { ko: "미리보기 머리", en: "Preview Head", ja: "プレビュー頭" }, meta: { ko: "머리" } },
  { id: "990002", slot: "body", names: { ko: "미리보기 몸", en: "Preview Body", ja: "プレビュー胴" }, meta: { ko: "몸" } },
  { id: "990003", slot: "hands", names: { ko: "미리보기 손", en: "Preview Hands", ja: "プレビュー手" }, meta: { ko: "손" } },
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
      state.characters.slice(0, 3).forEach((character) => { character.cutout = true; });
      look.cardComposition = { ...look.cardComposition, protectText: true };
      look.outfits.slice(0, 3).forEach((outfit) => {
        outfit.head = items[0].id;
        outfit.body = items[1].id;
        outfit.hands = items[2].id;
      });
      items.forEach((item) => itemRecordCache.set(item.id, item));
      renderAll();
    }, fixtureItems);
    await page.waitForFunction(() => {
      const board = document.querySelector("#canvasBoard");
      return board?.dataset.compositionCustom === "true"
        && board.dataset.gearCopyRendered === "true"
        && document.querySelectorAll("#boardGearList .board-gear-item[data-card-slot] .gear-tile-copy > strong").length === 9;
    });
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
      return [...board.querySelectorAll("#boardGearList .board-gear-item[data-card-slot] .gear-tile-copy > strong")].map((element) => {
        const button = element.closest(".board-gear-item");
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return {
          text: element.textContent.trim(),
          characterIndex: Number(button.dataset.characterIndex),
          gearIndex: Number(button.dataset.gearIndex),
          x: ((rect.left - boardRect.left) * 1200) / boardRect.width,
          y: ((rect.top - boardRect.top) * 675) / boardRect.height,
        };
      });
    });
    assert.equal(preview.length, 9, "custom footer must expose all three names for each character");
    assert.deepEqual(
      [0, 1, 2].map((characterIndex) => preview.filter((entry) => entry.characterIndex === characterIndex).length),
      [3, 3, 3],
      "custom footer copy must remain attached to all three characters",
    );
    assert.deepEqual(preview.map(({ text }) => text).sort(), Array(3).fill(fixtureItems.map(({ names }) => names.ko)).flat().sort(), "custom footer keeps the complete expected item names");

    await page.evaluate((names) => {
      window.__lineupInfoExportCalls = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.__lineupInfoOriginalFillText = original;
      CanvasRenderingContext2D.prototype.fillText = function captureLineupInfo(text, x, y, ...args) {
        if (names.includes(String(text))) {
          window.__lineupInfoExportCalls.push({
            text: String(text),
            x,
            y,
            textBaseline: this.textBaseline,
            canvasId: this.canvas?.id || "",
          });
        }
        return original.call(this, text, x, y, ...args);
      };
    }, fixtureItems.map(({ names }) => names.ko));
    await page.evaluate(() => renderCardCopyPreview());
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
    const capturedCalls = await page.evaluate(() => window.__lineupInfoExportCalls);
    const previewCalls = capturedCalls.filter(({ canvasId }) => canvasId === "boardCopyCanvas");
    const exportCalls = capturedCalls.filter(({ canvasId }) => canvasId !== "boardCopyCanvas");
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.fillText = window.__lineupInfoOriginalFillText;
    });

    assert.equal(exportCalls.length, 9, `PNG should paint exactly one primary info line for each item: ${JSON.stringify(exportCalls)}`);
    const previewAnchors = new Map();
    previewCalls.forEach((call) => {
      const key = `${call.text}|${Math.round(call.x)}|${Math.round(call.y)}`;
      if (!previewAnchors.has(key)) previewAnchors.set(key, call);
    });
    assert.equal(previewAnchors.size, 9, `custom preview should eventually paint every per-character item anchor despite repeated redraws: ${JSON.stringify(previewCalls)}`);
    assert.ok(exportCalls.every(({ textBaseline }) => textBaseline === "alphabetic"), `custom PNG copies should preserve the measured DOM text baseline: ${JSON.stringify(exportCalls)}`);
    const unmatchedExport = exportCalls.filter((call) => !preview.some((point) => (
      point.text === call.text
      && Math.abs(point.x - call.x) <= 24
      && Math.abs(point.y - call.y) <= 24
    )));
    assert.equal(unmatchedExport.length, 0, `lineup copy positions drifted between custom preview and PNG: ${JSON.stringify({ preview, exportCalls, unmatchedExport })}`);
    console.log("PASS: custom lineup footer keeps all per-character names and matches the measured preview anchors in PNG.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
