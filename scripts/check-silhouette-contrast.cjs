const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const expected = {
  paper: { variable: "#111111", color: "rgb(17, 17, 17)" },
  mist: { variable: "#111111", color: "rgb(17, 17, 17)" },
  pearl: { variable: "#111111", color: "rgb(17, 17, 17)" },
  rose: { variable: "#111111", color: "rgb(17, 17, 17)" },
  tide: { variable: "#111111", color: "rgb(17, 17, 17)" },
  dusk: { variable: "#111111", color: "rgb(17, 17, 17)" },
  ink: { variable: "#ffffff", color: "rgb(255, 255, 255)" },
  charcoal: { variable: "#ffffff", color: "rgb(255, 255, 255)" },
};
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

function rgbaChannels(value) {
  const source = String(value || "").trim();
  const hex = source.match(/^#([\da-f]{6})$/iu)?.[1];
  if (hex) return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const rgb = source.match(/^rgba?\((.+)\)$/iu)?.[1];
  if (!rgb) return null;
  const parts = rgb.trim().split(/[\s,/]+/u).filter(Boolean);
  if (parts.length < 3) return null;
  return parts.slice(0, 3).map((part) => {
    const numeric = Number.parseFloat(part);
    return part.endsWith("%") ? Math.round(numeric * 2.55) : Math.round(numeric);
  });
}

function relativeLuminance(value) {
  const channels = rgbaChannels(value);
  if (!channels || channels.some((channel) => !Number.isFinite(channel))) return null;
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) return 0;
  const brightest = Math.max(firstLuminance, secondLuminance);
  const darkest = Math.min(firstLuminance, secondLuminance);
  return (brightest + 0.05) / (darkest + 0.05);
}

function normalizedColor(value) {
  const channels = rgbaChannels(value);
  return channels
    ? channels.join(",")
    : String(value || "").replace(/\s/gu, "").toLowerCase();
}

function customPaletteFor(background) {
  const tone = expected[background].variable === "#ffffff" ? "dark" : "light";
  return tone === "dark"
    ? { tone, ink: "#f7f3ed", surface: "#1d2228" }
    : { tone, ink: "#263238", surface: "#fffaf4" };
}

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
      { name: "silhouette-one.png", mimeType: "image/png", buffer: fixturePng },
      { name: "silhouette-two.png", mimeType: "image/png", buffer: fixturePng },
      { name: "silhouette-three.png", mimeType: "image/png", buffer: fixturePng },
    ]);
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap img").length === 3);
    await page.evaluate(() => {
      state.characters.slice(0, 3).forEach((character) => { character.cutout = true; });
      state.multiInfoEnabled = true;
      state.backgroundPattern = "none";
      state.backgroundTexture = "none";
      getSelectedLook().cardComposition = { ...getSelectedLook().cardComposition, protectText: true };
      itemRecordCache.set("999999", {
        id: "999999",
        slot: "head",
        names: { ko: "대비 테스트 장비", en: "Silhouette Contrast Fixture", ja: "シルエット検証装備" },
      });
      getSelectedLook().outfits.slice(0, 3).forEach((outfit) => { outfit.head = "999999"; });
      state.multiInfoMode = "silhouette";
      renderAll();
    });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.infoMode === "silhouette");

    for (const background of Object.keys(expected)) {
      await page.locator(`#backdropGrid [data-background="${background}"]`).click();
      await page.waitForFunction(() => {
        const board = document.querySelector("#canvasBoard");
        return board?.dataset.compositionCustom === "true"
          && board.dataset.gearCopyRendered === "true"
          && document.querySelector("#boardGearList .board-gear-item[data-character-index='0'] .gear-tile-copy > strong");
      });
      const snapshot = await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard");
        const item = board?.querySelector("#boardGearList .board-gear-item[data-character-index='0'][data-gear-index='0']");
        const primary = item?.querySelector(":scope > .gear-tile-copy > strong");
        const primaryStyle = primary ? getComputedStyle(primary) : null;
        const boardStyle = board ? getComputedStyle(board) : null;
        const copyCanvas = board?.querySelector(".board-copy-canvas");
        const planItem = compositionPlan?.items?.find((entry) => entry.characterIndex === 0 && entry.gearIndex === 0);
        const background = getBackgroundTheme();
        const result = {
          variable: board?.style.getPropertyValue("--silhouette-info-color").trim() || "",
          compositionCustom: board?.dataset.compositionCustom || "",
          backgroundTone: board?.dataset.backgroundTone || "",
          copyCanvasReady: board?.dataset.gearCopyRendered === "true",
          legacyColumnCount: board?.querySelectorAll(".multi-info-column").length || 0,
          gearItemCount: board?.querySelectorAll("#boardGearList .board-gear-item[data-card-slot]").length || 0,
          color: primaryStyle?.color || "",
          protectedInk: boardStyle?.getPropertyValue("--card-copy-protected-ink").trim() || "",
          protectedSurface: boardStyle?.getPropertyValue("--card-copy-protected-surface").trim() || "",
          backgroundSolid: background?.solid || "",
          copyOverlap: item?.dataset.copyOverlap || "",
          copyOcclusionScore: Number.isFinite(planItem?.copyOcclusionScore) ? planItem.copyOcclusionScore : null,
          copyCanvasWidth: copyCanvas?.width || 0,
        };
        return result;
      });
      assert.equal(snapshot.variable, expected[background].variable, `silhouette CSS variable did not follow ${background}`);
      assert.equal(snapshot.compositionCustom, "true", `${background} should exercise the custom silhouette footer path`);
      assert.equal(snapshot.copyCanvasReady, true, `${background} custom copy canvas was not rendered`);
      assert.equal(snapshot.legacyColumnCount, 0, `${background} unexpectedly fell back to legacy lineup columns`);
      assert.equal(snapshot.gearItemCount, 3, `${background} custom footer should contain each character's fixture item`);
      const customPalette = customPaletteFor(background);
      const expectedInk = customPalette.ink === "#f7f3ed" ? "rgb(247, 243, 237)" : "rgb(38, 50, 56)";
      assert.equal(snapshot.backgroundTone, customPalette.tone, `custom footer tone did not follow ${background}`);
      assert.equal(snapshot.protectedInk.toLowerCase(), customPalette.ink, `custom footer ink token did not follow ${background}`);
      assert.equal(snapshot.protectedSurface.toLowerCase(), customPalette.surface, `custom footer surface token did not follow ${background}`);
      assert.equal(snapshot.color, expectedInk, `custom footer copy did not follow ${background}`);
      assert.ok(contrastRatio(snapshot.color, snapshot.backgroundSolid) >= 4.5, `custom footer copy lacks contrast against ${background}: ${snapshot.color} on ${snapshot.backgroundSolid}`);
      assert.ok(contrastRatio(snapshot.color, snapshot.protectedSurface) >= 4.5, `custom footer copy lacks contrast against its protection surface on ${background}`);
      assert.equal(snapshot.copyOverlap, String(snapshot.copyOcclusionScore === null || snapshot.copyOcclusionScore > 0), `${background} item halo flag does not match the planned overlap score`);
      assert.ok(snapshot.copyCanvasWidth > 0, `${background} custom footer copy canvas has no export-scale pixels`);
    }

    await page.evaluate(() => {
      window.__silhouetteExportTextCalls = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.__silhouetteExportOriginalFillText = original;
      CanvasRenderingContext2D.prototype.fillText = function captureSilhouetteText(text, ...args) {
        if (String(text).includes("대비 테스트 장비")) {
          window.__silhouetteExportTextCalls.push({
            fillStyle: this.fillStyle,
            x: Number(args[0]),
            y: Number(args[1]),
            canvasId: this.canvas?.id || "",
          });
        }
        return original.call(this, text, ...args);
      };
    });
    for (const background of ["paper", "charcoal"]) {
      await page.locator(`#backdropGrid [data-background="${background}"]`).click();
      await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.gearCopyRendered === "true");
      const expectedFillStyle = await page.evaluate(() => {
        const primary = document.querySelector("#boardGearList .board-gear-item[data-character-index='0'][data-gear-index='0'] .gear-tile-copy > strong");
        return primary ? getComputedStyle(primary).color : "";
      });
      await page.evaluate(() => { window.__silhouetteExportTextCalls = []; });
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#exportButton").click();
      const download = await downloadPromise;
      await download.cancel();
      await page.waitForFunction(() => !document.querySelector("#exportButton")?.hasAttribute("aria-busy"));
      const capturedCalls = await page.evaluate(() => window.__silhouetteExportTextCalls);
      const previewCalls = capturedCalls.filter(({ canvasId }) => canvasId === "boardCopyCanvas");
      const exportCalls = capturedCalls.filter(({ canvasId }) => canvasId !== "boardCopyCanvas");
      const previewAnchors = [...new Map(previewCalls.map((call) => [
        `${Math.round(call.x)}|${Math.round(call.y)}`,
        call,
      ])).values()];
      const expectedFill = normalizedColor(expectedFillStyle);
      assert.equal(exportCalls.length, 3, `${background} PNG should paint one primary info line per character`);
      assert.equal(previewAnchors.length, 3, `${background} custom preview should eventually paint each character's primary info line despite repeated redraws`);
      assert.ok(exportCalls.every(({ fillStyle }) => normalizedColor(fillStyle) === expectedFill), `${background} PNG custom footer copy drifted from its measured theme color: expected ${expectedFill}, got ${JSON.stringify(exportCalls)}`);
      assert.ok(previewAnchors.every(({ fillStyle }) => normalizedColor(fillStyle) === expectedFill), `${background} preview custom footer copy drifted from its measured theme color: expected ${expectedFill}, got ${JSON.stringify(previewAnchors)}`);
      assert.ok(exportCalls.every((call) => previewAnchors.some((preview) => (
        Math.abs(call.x - preview.x) <= 1 && Math.abs(call.y - preview.y) <= 1
      ))), `${background} custom PNG anchors drifted from the rendered preview: ${JSON.stringify({ previewAnchors, exportCalls })}`);
      const palette = customPaletteFor(background);
      assert.ok(contrastRatio(expectedFillStyle, palette.surface) >= 4.5, `${background} PNG custom footer copy lost readable contrast against its themed copy surface`);
    }
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.fillText = window.__silhouetteExportOriginalFillText;
    });
    console.log("PASS: silhouette custom footer follows the protected theme palette and PNG copy preserves the measured high-contrast color.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
