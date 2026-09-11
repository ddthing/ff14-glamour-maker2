const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const artifactsDir = path.join(__dirname, "..", "artifacts");
const fixtureSpecs = [
  { width: 120, height: 180, color: "#d26a6a" },
  { width: 160, height: 120, color: "#5e9cc9" },
  { width: 180, height: 180, color: "#77ad78" },
  { width: 240, height: 160, color: "#c58c55" },
  { width: 140, height: 220, color: "#9b79ba" },
];

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path.basename(filePath)} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function maxRectDelta(previewRect, exportRect) {
  return Math.max(
    Math.abs(previewRect.x - exportRect.x),
    Math.abs(previewRect.y - exportRect.y),
    Math.abs(previewRect.width - exportRect.width),
    Math.abs(previewRect.height - exportRect.height),
  );
}

(async () => {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`${baseUrl}/?preview-export-parity=1`);
    await page.waitForSelector("#canvasBoard");

    const fixtures = await Promise.all(fixtureSpecs.map(async (spec, index) => {
      const base64 = await page.evaluate(({ width, height, color }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = color;
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#ffffff";
        context.font = "bold 20px sans-serif";
        context.fillText(String(width), 6, 24);
        return canvas.toDataURL("image/png").split(",")[1];
      }, spec);
      return {
        name: `parity-${index + 1}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(base64, "base64"),
      };
    }));
    await page.locator("#imageInput").setInputFiles(fixtures);
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll("#portraitWrap img")];
      return images.length === 5 && images.every((image) => image.complete && image.naturalWidth > 0);
    });

    await page.evaluate(() => {
      window.__previewExportDrawImageCalls = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      window.__previewExportOriginalDrawImage = original;
      CanvasRenderingContext2D.prototype.drawImage = function drawImageProbe(image, ...args) {
        window.__previewExportDrawImageCalls.push({
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          src: image.currentSrc || image.src,
          args,
        });
        return original.call(this, image, ...args);
      };
    });

    const results = [];
    for (const mode of ["original", "cutout", "mixed"]) {
      await page.evaluate((sourceMode) => {
        state.characters.forEach((character, index) => {
          character.cutout = sourceMode === "cutout" || (sourceMode === "mixed" && index === 0);
        });
        state.selectedCharacter = 0;
        syncSelectedCharacter();
        renderAll();
      }, mode);
      for (const count of [1, 2, 3, 4, 5]) {
        await page.locator(`[data-cast-count="${count}"]`).click();
        await page.waitForFunction((expectedCount) => {
          const board = document.querySelector("#canvasBoard");
          const images = [...document.querySelectorAll("#portraitWrap img")];
          return board?.dataset.cast === String(expectedCount)
            && images.length === expectedCount
            && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
        }, count);
        await page.evaluate(() => document.fonts.ready);

      const preview = await page.evaluate((expectedCount) => {
        const board = document.querySelector("#canvasBoard").getBoundingClientRect();
        const layoutWidth = expectedCount === 1 && document.querySelector("#canvasBoard").dataset.ratio === "portrait" ? 1080 : 1200;
        const images = [...document.querySelectorAll("#portraitWrap img")];
        const parsePosition = (token, axis) => {
          const value = String(token || "").toLowerCase();
          if (value === "left" || value === "top") return 0;
          if (value === "right" || value === "bottom") return 1;
          if (value === "center") return 0.5;
          if (value.endsWith("%")) return Number.parseFloat(value) / 100;
          return axis === "x" ? 0.5 : 0.5;
        };
        return {
          board: { left: board.left, top: board.top, width: board.width, height: board.height },
          images: images.map((image, index) => {
            const rect = image.getBoundingClientRect();
            const style = getComputedStyle(image);
            const fit = style.objectFit;
            const scale = fit === "cover"
              ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
              : Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
            const paintedWidth = image.naturalWidth * scale;
            const paintedHeight = image.naturalHeight * scale;
            const positions = style.objectPosition.split(/\s+/);
            const offsetX = (rect.width - paintedWidth) * parsePosition(positions[0], "x");
            const offsetY = (rect.height - paintedHeight) * parsePosition(positions[1] || positions[0], "y");
            return {
              index,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              src: image.currentSrc || image.src,
              fit,
              objectPosition: style.objectPosition,
              rect: {
                x: (rect.left - board.left + offsetX) * layoutWidth / board.width,
                y: (rect.top - board.top + offsetY) * layoutWidth / board.width,
                width: paintedWidth * layoutWidth / board.width,
                height: paintedHeight * layoutWidth / board.width,
              },
            };
          }),
        };
      }, count);

      const beforeExport = await page.evaluate(() => window.__previewExportDrawImageCalls.length);
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#exportButton").click();
      const download = await downloadPromise;
      await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
      const outputPath = path.join(artifactsDir, `preview-export-parity-${mode}-${count}.png`);
      await download.saveAs(outputPath);
      const drawCalls = await page.evaluate((start) => window.__previewExportDrawImageCalls.slice(start), beforeExport);
      const dimensions = readPngDimensions(outputPath);
      const expectedDimensions = count === 1
        ? { width: 2160, height: 2700 }
        : { width: 2400, height: 1350 };
      assert.deepEqual(dimensions, expectedDimensions, `${count}인 PNG dimensions differ from the preview ratio contract`);
      assert.equal(drawCalls.length, count, `${count}인 PNG should draw exactly ${count} character images`);

      const exportRects = drawCalls.map((call, index) => {
        assert.equal(call.args.length, 4, `${count}인 캐릭터 ${index + 1} image draw should use a full image rectangle`);
        return {
          x: call.args[0], y: call.args[1], width: call.args[2], height: call.args[3],
          naturalWidth: call.naturalWidth, naturalHeight: call.naturalHeight,
          src: call.src,
        };
      });
      assert.deepEqual(
        exportRects.map(({ src }) => src),
        preview.images.map(({ src }) => src),
        `${mode} ${count}인 PNG source asset differs from preview source asset`,
      );
      assert.deepEqual(
        exportRects.map(({ naturalWidth, naturalHeight }) => [naturalWidth, naturalHeight]),
        preview.images.map(({ naturalWidth, naturalHeight }) => [naturalWidth, naturalHeight]),
        `${count}인 PNG image order differs from preview image order`,
      );
      const deltas = preview.images.map((image, index) => maxRectDelta(image.rect, exportRects[index]));
      const maxDelta = Math.max(...deltas);
      assert.ok(maxDelta <= 0.75, `${mode} ${count}인 image frame drifted ${maxDelta.toFixed(2)} layout px from the preview`);
      results.push({
        mode,
        count,
        ratio: `${expectedDimensions.width}x${expectedDimensions.height}`,
        previewImageCount: preview.images.length,
        exportedImageCount: drawCalls.length,
        maxRectDelta: Math.max(...deltas),
        deltas,
        previewImages: preview.images.map((image) => ({
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          fit: image.fit,
          objectPosition: image.objectPosition,
          rect: image.rect,
        })),
        exportRects,
      });
      await page.locator("#canvasBoard").screenshot({ path: path.join(artifactsDir, `preview-export-parity-${mode}-${count}-preview.png`) });
      }
    }

    await page.evaluate(() => {
      state.characterCount = 1;
      state.singleRatio = "portrait";
      state.singleLayout = "info-left";
      state.selectedCharacter = 0;
      state.characters[0].cutout = false;
      state.characters[0].imageFit = "contain";
      state.characters[0].zoom = 145;
      state.characters[0].panX = 48;
      state.characters[0].panY = -36;
      syncSelectedCharacter();
      renderAll();
    });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "1");
    const placementBeforeExport = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const image = document.querySelector("#portraitWrap img");
      const character = state.characters[0];
      const layout = CardLayout.layoutFor({
        characterCount: 1,
        singleRatio: state.singleRatio,
        singleLayout: state.singleLayout,
        characters: [character],
      });
      const frame = layout.frames[0];
      const dimensions = layout.dimensions;
      const panScale = dimensions.layoutWidth / board.width;
      return {
        expected: CardLayout.imageRectFor({
          frame,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          imageFit: character.imageFit,
          zoom: character.zoom,
          panX: character.panX,
          panY: character.panY,
          cutout: character.cutout,
          panScale,
        }),
        panScale,
      };
    });
    const placementStart = await page.evaluate(() => window.__previewExportDrawImageCalls.length);
    const placementDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    await placementDownloadPromise;
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
    const placementDrawCalls = await page.evaluate((start) => window.__previewExportDrawImageCalls.slice(start), placementStart);
    assert.equal(placementDrawCalls.length, 1, "placement regression should render one character image");
    const placementRect = placementDrawCalls[0].args;
    assert.ok(Math.abs(placementRect[0] - placementBeforeExport.expected.x) <= 0.5, `PNG pan scale changed x: expected ${placementBeforeExport.expected.x}, got ${placementRect[0]} (scale ${placementBeforeExport.panScale})`);
    assert.ok(Math.abs(placementRect[1] - placementBeforeExport.expected.y) <= 0.5, `PNG pan scale changed y: expected ${placementBeforeExport.expected.y}, got ${placementRect[1]} (scale ${placementBeforeExport.panScale})`);

    const placementCases = [
      { name: "solo-cover", count: 1, singleRatio: "portrait", cutout: false, imageFit: "cover", focalPoint: { x: 0.27, y: 0.31 }, zoom: 130, panX: -40, panY: 30 },
      { name: "lineup-cutout-contain", count: 3, singleRatio: "landscape", cutout: true, imageFit: "contain", focalPoint: { x: 0.61, y: 0.34 }, zoom: 138, panX: 35, panY: -45 },
      { name: "lineup-original-cover", count: 3, singleRatio: "landscape", cutout: false, imageFit: "cover", zoom: 125, panX: -32, panY: 28 },
    ];
    for (const scenario of placementCases) {
      await page.evaluate((next) => {
        state.characterCount = next.count;
        state.singleRatio = next.singleRatio;
        state.singleLayout = "info-left";
        state.selectedCharacter = 0;
        state.characters.slice(0, next.count).forEach((character) => {
          character.cutout = next.cutout;
          character.imageFit = next.imageFit;
          character.focalPoint = next.focalPoint ? { ...next.focalPoint } : null;
          character.zoom = next.zoom;
          character.panX = next.panX;
          character.panY = next.panY;
        });
        syncSelectedCharacter();
        renderAll();
      }, scenario);
      await page.waitForFunction((expectedCount) => document.querySelectorAll("#portraitWrap img").length === expectedCount, scenario.count);
      const expected = await page.evaluate((next) => {
        const board = document.querySelector("#canvasBoard").getBoundingClientRect();
        const characters = state.characters.slice(0, next.count);
        const layout = CardLayout.layoutFor({
          characterCount: next.count,
          singleRatio: next.singleRatio,
          singleLayout: state.singleLayout,
          characters,
        });
        const dimensions = layout.dimensions;
        const frames = layout.frames;
        const images = [...document.querySelectorAll("#portraitWrap img")];
        const panScale = dimensions.layoutWidth / board.width;
        return {
          panScale,
          rects: frames.map((frame, index) => {
            const image = images[index];
            const character = characters[index];
            return CardLayout.imageRectFor({
              frame,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              imageFit: next.imageFit,
              zoom: next.zoom,
              panX: character.panX,
              panY: character.panY,
              cutout: next.cutout,
              focalPoint: character.focalPoint,
              panScale,
            });
          }),
        };
      }, scenario);
      const start = await page.evaluate(() => window.__previewExportDrawImageCalls.length);
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#exportButton").click();
      await downloadPromise;
      await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
      const calls = await page.evaluate((offset) => window.__previewExportDrawImageCalls.slice(offset), start);
      assert.equal(calls.length, scenario.count, `${scenario.name} should draw ${scenario.count} character images`);
      calls.forEach((call, index) => {
        assert.ok(Math.abs(call.args[0] - expected.rects[index].x) <= 0.5, `${scenario.name} character ${index + 1} x drifted: expected ${expected.rects[index].x}, got ${call.args[0]} (scale ${expected.panScale})`);
        assert.ok(Math.abs(call.args[1] - expected.rects[index].y) <= 0.5, `${scenario.name} character ${index + 1} y drifted: expected ${expected.rects[index].y}, got ${call.args[1]} (scale ${expected.panScale})`);
        assert.ok(Math.abs(call.args[2] - expected.rects[index].width) <= 0.5, `${scenario.name} character ${index + 1} width drifted`);
        assert.ok(Math.abs(call.args[3] - expected.rects[index].height) <= 0.5, `${scenario.name} character ${index + 1} height drifted`);
      });
    }

    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.drawImage = window.__previewExportOriginalDrawImage;
    });
    console.log(JSON.stringify({ status: "PASS", results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
