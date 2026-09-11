const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const fixtureImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
const slots = ["head", "body", "hands", "legs", "feet"];
const matrix = [];
for (const characterCount of [1, 2, 3, 4, 5]) {
  for (const singleRatio of ["portrait", "landscape"]) {
    for (const singleLayout of ["info-left", "info-right"]) {
      matrix.push({ characterCount, singleRatio, singleLayout, selectedCharacter: characterCount - 1 });
    }
  }
}

function caseLabel(backgroundName, combination) {
  return `${backgroundName} / ${combination.characterCount}인 / ${combination.singleRatio} / ${combination.singleLayout}`;
}

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "export must be a PNG");
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", "PNG must expose an IHDR chunk");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function maxDrift(actual, expected) {
  return Math.max(
    Math.abs(actual.x - expected.x),
    Math.abs(actual.y - expected.y),
    Math.abs(actual.width - expected.width),
    Math.abs(actual.height - expected.height),
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");

    await page.evaluate(({ image, itemSlots }) => {
      const records = itemSlots.map((slot, index) => ({
        id: String(92001 + index),
        slot,
        names: { ko: `행렬 검증 ${slot}`, en: `Matrix ${slot}`, ja: `行列 ${slot}` },
      }));
      records.forEach((record) => itemRecordCache.set(record.id, record));
      const itemIds = Object.fromEntries(records.map((record) => [record.slot, record.id]));
      state.characters = Array.from({ length: 5 }, () => ({
        ...LookEditor.emptyCharacter(),
        src: image,
        originalSrc: image,
        fileName: "background-matrix.png",
        fileMeta: "background matrix fixture",
      }));
      state.characterCount = 1;
      state.selectedCharacter = 0;
      state.singleRatio = "portrait";
      state.singleLayout = "info-left";
      state.titleAlign = "center";
      state.titleColor = "#263238";
      state.background = "rose";
      state.backgroundPattern = "stars";
      state.backgroundTexture = "none";
      const look = getSelectedLook();
      look.title = "프리셋 행렬 검증";
      look.subtitle = "preview and export contract";
      getLookOutfits(look).forEach((outfit) => itemSlots.forEach((slot) => { outfit[slot] = itemIds[slot]; }));
      renderAll();
    }, { image: fixtureImage, itemSlots: slots });

    await page.evaluate(() => {
      const originalRender = CardPng.render;
      window.__backgroundMatrixRenders = [];
      window.__backgroundMatrixOriginalRender = originalRender;
      CardPng.render = async (args) => {
        window.__backgroundMatrixRenders.push({
          background: args.state.background,
          pattern: args.state.backgroundPattern,
          texture: args.state.backgroundTexture,
          layoutWidth: args.dimensions.layoutWidth,
          layoutHeight: args.dimensions.layoutHeight,
          exportWidth: args.dimensions.exportWidth,
          exportHeight: args.dimensions.exportHeight,
          layout: args.layout ? {
            characterCount: args.layout.characterCount,
            ratio: args.layout.ratio,
            dimensions: { ...args.layout.dimensions },
            frames: args.layout.frames.map(({ x, y, width, height }) => ({ x, y, width, height })),
          } : null,
          hasBackgroundImage: Boolean(args.backgroundImage),
        });
        return originalRender(args);
      };
    });

    const backgroundCases = [
      {
        name: "vintage scrapbook",
        expected: { background: "paper", pattern: "scrapbook", texture: "grain", hasBackgroundImage: true },
      },
      {
        name: "paper collage",
        expected: { background: "linen", pattern: "collage", texture: "grain", hasBackgroundImage: true },
      },
      {
        name: "mist dots",
        expected: { background: "mist", pattern: "dots", texture: "grain", hasBackgroundImage: false },
      },
    ];
    let exportCount = 0;

    for (const backgroundCase of backgroundCases) {
      for (const combination of matrix) {
        const label = caseLabel(backgroundCase.name, combination);
        await page.evaluate((value) => {
          state.characterCount = value.characterCount;
          state.selectedCharacter = value.selectedCharacter;
          state.singleRatio = value.singleRatio;
          state.singleLayout = value.singleLayout;
          state.background = "rose";
          state.backgroundPattern = "stars";
          state.backgroundTexture = "none";
          renderAll();
        }, combination);
        await page.waitForFunction((value) => {
          const board = document.querySelector("#canvasBoard");
          return board?.dataset.cast === String(value.characterCount)
            && board?.dataset.ratio === CardLayout.ratioFor(value.characterCount, value.singleRatio)
            && board?.dataset.singleLayout === value.singleLayout;
        }, combination);

        const before = await page.evaluate(() => ({
          characterCount: state.characterCount,
          selectedCharacter: state.selectedCharacter,
          singleRatio: state.singleRatio,
          singleLayout: state.singleLayout,
          title: getSelectedLook().title,
          subtitle: getSelectedLook().subtitle,
          titleFont: state.titleFont,
          titleAlign: state.titleAlign,
          titleColor: state.titleColor,
          characters: state.characters.map((character) => ({
            src: character.src,
            originalSrc: character.originalSrc,
            cutout: character.cutout,
            imageFit: character.imageFit,
            zoom: character.zoom,
            panX: character.panX,
            panY: character.panY,
          })),
          outfits: getSelectedLook().outfits.map((outfit) => ({ ...outfit })),
        }));

        await page.evaluate((selection) => {
          state.background = selection.background;
          state.backgroundPattern = selection.pattern;
          state.backgroundTexture = selection.texture;
          renderStyles();
        }, backgroundCase.expected);
        await page.waitForFunction((expected) => {
          const board = document.querySelector("#canvasBoard");
          return state.background === expected.background
            && state.backgroundPattern === expected.pattern
            && state.backgroundTexture === expected.texture
            && board?.dataset.backgroundPattern === expected.pattern;
        }, backgroundCase.expected);

        const after = await page.evaluate(() => ({
          characterCount: state.characterCount,
          selectedCharacter: state.selectedCharacter,
          singleRatio: state.singleRatio,
          singleLayout: state.singleLayout,
          title: getSelectedLook().title,
          subtitle: getSelectedLook().subtitle,
          titleFont: state.titleFont,
          titleAlign: state.titleAlign,
          titleColor: state.titleColor,
          characters: state.characters.map((character) => ({
            src: character.src,
            originalSrc: character.originalSrc,
            cutout: character.cutout,
            imageFit: character.imageFit,
            zoom: character.zoom,
            panX: character.panX,
            panY: character.panY,
          })),
          outfits: getSelectedLook().outfits.map((outfit) => ({ ...outfit })),
        }));
        assert.deepEqual(after, before, `${label}: changing the direct background axes must preserve the rest of the card state`);

        const ui = await page.evaluate(() => {
          const board = document.querySelector("#canvasBoard");
          const boardRect = board.getBoundingClientRect();
          const gear = [...board.querySelectorAll(".board-gear-item")].map((item) => {
            const rect = item.getBoundingClientRect();
            return {
              x: rect.left - boardRect.left,
              y: rect.top - boardRect.top,
              width: rect.width,
              height: rect.height,
              right: boardRect.right - rect.right,
              bottom: boardRect.bottom - rect.bottom,
            };
          });
          const rails = [...board.querySelectorAll(".board-gear-rail")].map((rail) => {
            const rect = rail.getBoundingClientRect();
            return { x: rect.left - boardRect.left, y: rect.top - boardRect.top, width: rect.width, height: rect.height };
          });
          return {
            cast: board.dataset.cast,
            ratio: board.dataset.ratio,
            boardWidth: boardRect.width,
            boardHeight: boardRect.height,
            characterSlots: board.querySelectorAll(".character-slot").length,
            gearCount: gear.length,
            gear,
            rails,
            multiInfoCount: board.querySelectorAll(".multi-info-column").length,
            exportDisabled: document.querySelector("#exportButton").getAttribute("aria-disabled"),
          };
        });
        const expectedRatio = combination.characterCount === 1 ? combination.singleRatio : "landscape";
        assert.equal(ui.cast, String(combination.characterCount), `${label}: cast count drifted`);
        assert.equal(ui.ratio, expectedRatio, `${label}: effective card ratio drifted`);
        assert.equal(ui.characterSlots, combination.characterCount, `${label}: character slot count drifted`);
        assert.equal(ui.gearCount, combination.characterCount === 2 ? 10 : 5, `${label}: gear note count drifted`);
        assert.equal(ui.exportDisabled, "false", `${label}: a fixture-backed card must remain exportable`);
        if (combination.characterCount <= 2) {
          assert.ok(ui.gear.every(({ x, y, right, bottom }) => x >= -0.5 && y >= -0.5 && right >= -0.5 && bottom >= -0.5), `${label}: a gear note escaped the card: ${JSON.stringify(ui.gear)}`);
        }
        if (combination.characterCount >= 3) assert.equal(ui.multiInfoCount, combination.characterCount, `${label}: lineup information columns drifted`);

        if (combination.characterCount === 1) {
          const dimensions = await page.evaluate((value) => CardLayout.dimensionsFor(1, value.singleRatio), combination);
          const expectedPositions = await page.evaluate((value) => (
            value.singleRatio === "portrait"
              ? CardLayout.portraitGearPositions({ singleLayout: value.singleLayout })
              : CardLayout.landscapeSoloGearPositions({ singleLayout: value.singleLayout })
          ), combination);
          const scaleX = ui.boardWidth / dimensions.layoutWidth;
          const scaleY = ui.boardHeight / dimensions.layoutHeight;
          const drift = Math.max(...ui.gear.map((actual, index) => maxDrift(actual, {
            x: expectedPositions[index].x * scaleX,
            y: expectedPositions[index].y * scaleY,
            width: expectedPositions[index].width * scaleX,
            height: expectedPositions[index].height * scaleY,
          })));
          assert.ok(drift <= 0.75, `${label}: preview gear geometry drifted ${drift.toFixed(2)}px from CardLayout`);
        }
        if (combination.characterCount === 2) {
          const expectedRails = await page.evaluate(() => CardLayout.infoRails({ characterCount: 2 }));
          const scaleX = ui.boardWidth / 1200;
          const scaleY = ui.boardHeight / 675;
          const drift = Math.max(...ui.rails.map((actual, index) => maxDrift(actual, {
            x: expectedRails[index].x * scaleX,
            y: expectedRails[index].y * scaleY,
            width: expectedRails[index].width * scaleX,
            height: expectedRails[index].height * scaleY,
          })));
          assert.ok(drift <= 2.5, `${label}: preview information rail geometry drifted ${drift.toFixed(2)}px from CardLayout`);
        }

        const downloadPromise = page.waitForEvent("download");
        await page.locator("#exportButton").click();
        const download = await downloadPromise;
        const outputPath = await download.path();
        assert.ok(outputPath, `${label}: export did not produce a file`);
        const outputDimensions = readPngDimensions(outputPath);
        const expectedExport = await page.evaluate((value) => CardLayout.dimensionsFor(value.characterCount, value.singleRatio), combination);
        const expectedLayout = await page.evaluate((value) => CardLayout.layoutFor({
          characterCount: value.characterCount,
          singleRatio: value.singleRatio,
          singleLayout: value.singleLayout,
          characters: state.characters.slice(0, value.characterCount),
        }), combination);
        assert.deepEqual(outputDimensions, { width: expectedExport.exportWidth, height: expectedExport.exportHeight }, `${label}: PNG dimensions drifted from the effective ratio`);
        await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
        const renderTrace = await page.evaluate(() => window.__backgroundMatrixRenders.at(-1));
        assert.deepEqual(renderTrace, {
          background: backgroundCase.expected.background,
          pattern: backgroundCase.expected.pattern,
          texture: backgroundCase.expected.texture,
          layoutWidth: expectedExport.layoutWidth,
          layoutHeight: expectedExport.layoutHeight,
          exportWidth: expectedExport.exportWidth,
          exportHeight: expectedExport.exportHeight,
          layout: expectedLayout,
          hasBackgroundImage: backgroundCase.expected.hasBackgroundImage,
        }, `${label}: PNG renderer did not receive the selected background axes and effective ratio`);
        exportCount += 1;
      }
    }

    await page.evaluate(() => {
      CardPng.render = window.__backgroundMatrixOriginalRender;
    });
    console.log(`PASS: ${backgroundCases.length} direct background recipes × ${matrix.length} cast/ratio/layout states verified in preview and PNG export (${exportCount} exports).`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
