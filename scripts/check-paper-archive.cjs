const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");
    const before = await page.evaluate(() => {
      state.background = "rose";
      state.backgroundPattern = "stars";
      renderStyles();
      return JSON.stringify({ characters: state.characters, title: state.title, titleFont: state.titleFont, castCount: state.castCount });
    });
    await page.locator("#scrapbookPreset").evaluate((button) => button.click());
    const after = await page.evaluate(() => ({
      protected: JSON.stringify({ characters: state.characters, title: state.title, titleFont: state.titleFont, castCount: state.castCount }),
      background: state.background, pattern: state.backgroundPattern, texture: state.backgroundTexture,
    }));
    assert.equal(after.protected, before, "theme must preserve character data and typography");
    assert.equal(after.background, "paper");
    assert.equal(after.pattern, "scrapbook");
    assert.equal(after.texture, "grain");
    assert.equal(await page.locator("#scrapbookPreset").getAttribute("aria-pressed"), "true");
    await page.locator("#collagePreset").evaluate((button) => button.click());
    const collageState = await page.evaluate(() => ({
      background: state.background, pattern: state.backgroundPattern, texture: state.backgroundTexture,
    }));
    assert.deepEqual(collageState, { background: "linen", pattern: "collage", texture: "grain" });
    assert.equal(await page.locator("#collagePreset").getAttribute("aria-pressed"), "true");
    await page.evaluate(() => {
      const records = [
        ["91001", "head", "낡은 깃털 장식 모자"],
        ["91002", "body", "아기돼지 의상"],
        ["91003", "hands", "달빛 장갑"],
        ["91004", "legs", "별빛 바지"],
        ["91005", "feet", "초승달 장화"],
      ];
      records.forEach(([id, slot, name]) => itemRecordCache.set(id, {
        id, slot, names: { ko: name, en: name, ja: name },
      }));
      const outfit = getSelectedLook().outfits[0];
      records.forEach(([id, slot]) => { outfit[slot] = id; });
      renderAll();
    });
    const collageAsset = await page.evaluate(async () => ({
      fetched: (await fetch("assets/themes/collage-paper-plate.png", { cache: "no-store" })).ok,
      backgroundImage: getComputedStyle(document.querySelector("#sceneBackground")).backgroundImage,
    }));
    assert.equal(collageAsset.fetched, true, "the collage plate must be published as a browser asset");
    assert.match(collageAsset.backgroundImage, /collage-paper-plate\.png/, "preview must paint the collage plate");
    await page.evaluate(() => {
      window.__collageRender = null;
      const originalRender = CardPng.render;
      CardPng.render = async (args) => {
        window.__collageRender = {
          hasBackgroundImage: Boolean(args.backgroundImage),
          width: args.backgroundImage?.naturalWidth || 0,
          height: args.backgroundImage?.naturalHeight || 0,
        };
        return originalRender(args);
      };
      window.__collageDrawImageCalls = [];
      const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
      window.__collageOriginalDrawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.drawImage = function captureCollageBackground(image, ...args) {
        if (String(image.currentSrc || image.src || "").includes("collage-paper-plate.png")) {
          window.__collageDrawImageCalls.push({
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            args,
          });
        }
        return originalDrawImage.call(this, image, ...args);
      };
      window.__collageTapeFillRects = [];
      const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
      window.__collageOriginalFillRect = originalFillRect;
      CanvasRenderingContext2D.prototype.fillRect = function captureCollageTape(...args) {
        if (/215, 196, 164/.test(String(this.fillStyle))) {
          window.__collageTapeFillRects.push({ fillStyle: this.fillStyle, args });
        }
        return originalFillRect.apply(this, args);
      };
    });
    await page.locator("#imageInput").setInputFiles({ name: "collage-fixture.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#portraitWrap img")?.naturalWidth > 0);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    const download = await downloadPromise;
    await download.saveAs("artifacts/collage-card-export.png");
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
    const exportAsset = await page.evaluate(() => window.__collageRender);
    assert.deepEqual(exportAsset, { hasBackgroundImage: true, width: 1122, height: 1402 }, "PNG export must load the same collage plate");
    const gearBounds = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      return [...document.querySelectorAll("#boardGearList .board-gear-item")].map((item) => {
        const rect = item.getBoundingClientRect();
        return {
          left: rect.left - board.left,
          top: rect.top - board.top,
          width: rect.width,
          height: rect.height,
          right: board.right - rect.right,
          bottom: board.bottom - rect.bottom,
          position: getComputedStyle(item).position,
        };
      });
    });
    assert.equal(gearBounds.length, 5, "collage portrait must render all five equipment notes");
    assert.ok(gearBounds.every(({ left, top, right, bottom }) => left >= -0.5 && top >= -0.5 && right >= -0.5 && bottom >= -0.5), `collage equipment notes escaped the card: ${JSON.stringify(gearBounds)}`);
    assert.ok(gearBounds.every(({ position }) => position === "absolute"), `collage portrait notes lost absolute placement: ${JSON.stringify(gearBounds)}`);
    const collageTape = await page.evaluate(() => {
      const note = document.querySelector("#boardGearList .board-gear-item");
      const styles = getComputedStyle(note, "::after");
      return {
        content: styles.content,
        width: Number.parseFloat(styles.width),
        height: Number.parseFloat(styles.height),
        top: Number.parseFloat(styles.top),
        backgroundColor: styles.backgroundColor,
      };
    });
    assert.equal(collageTape.content, '""', "collage notes must expose one semantic tape layer");
    assert.ok(collageTape.width > 0 && collageTape.height > 0 && collageTape.top < 0, `collage tape geometry is invalid: ${JSON.stringify(collageTape)}`);
    assert.notEqual(collageTape.backgroundColor, "rgba(0, 0, 0, 0)", "collage tape must remain visible");
    const gearGeometry = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const dimensions = CardLayout.dimensionsFor(1, "portrait");
      const actual = [...document.querySelectorAll("#boardGearList .board-gear-item")].map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.left - board.left, y: rect.top - board.top, width: rect.width, height: rect.height };
      });
      const expected = CardLayout.portraitGearPositions({ singleLayout: state.singleLayout }).map((position) => ({
        x: position.x * board.width / dimensions.layoutWidth,
        y: position.y * board.height / dimensions.layoutHeight,
        width: position.width * board.width / dimensions.layoutWidth,
        height: position.height * board.height / dimensions.layoutHeight,
      }));
      return { actual, expected };
    });
    const maxGearDrift = Math.max(...gearGeometry.actual.map((actual, index) => {
      const expected = gearGeometry.expected[index];
      return Math.max(
        Math.abs(actual.x - expected.x), Math.abs(actual.y - expected.y),
        Math.abs(actual.width - expected.width), Math.abs(actual.height - expected.height),
      );
    }));
    assert.ok(maxGearDrift <= 0.75, `preview equipment geometry drifted ${maxGearDrift.toFixed(2)}px from CardLayout: ${JSON.stringify(gearGeometry)}`);
    await page.evaluate(() => {
      state.singleLayout = "info-right";
      renderStyles();
    });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.singleLayout === "info-right");
    const rightGearGeometry = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const dimensions = CardLayout.dimensionsFor(1, "portrait");
      const actual = [...document.querySelectorAll("#boardGearList .board-gear-item")].map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.left - board.left, y: rect.top - board.top, width: rect.width, height: rect.height };
      });
      const expected = CardLayout.portraitGearPositions({ singleLayout: "info-right" }).map((position) => ({
        x: position.x * board.width / dimensions.layoutWidth,
        y: position.y * board.height / dimensions.layoutHeight,
        width: position.width * board.width / dimensions.layoutWidth,
        height: position.height * board.height / dimensions.layoutHeight,
      }));
      return { actual, expected };
    });
    const maxRightGearDrift = Math.max(...rightGearGeometry.actual.map((actual, index) => {
      const expected = rightGearGeometry.expected[index];
      return Math.max(
        Math.abs(actual.x - expected.x), Math.abs(actual.y - expected.y),
        Math.abs(actual.width - expected.width), Math.abs(actual.height - expected.height),
      );
    }));
    assert.ok(maxRightGearDrift <= 0.75, `right-aligned preview equipment geometry drifted ${maxRightGearDrift.toFixed(2)}px from CardLayout: ${JSON.stringify(rightGearGeometry)}`);
    await page.evaluate(() => {
      state.singleRatio = "landscape";
      renderStyles();
    });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.ratio === "landscape");
    const landscapeGearGeometry = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard").getBoundingClientRect();
      const dimensions = CardLayout.dimensionsFor(1, "landscape");
      const actual = [...document.querySelectorAll("#boardGearList .board-gear-item")].map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.left - board.left, y: rect.top - board.top, width: rect.width, height: rect.height };
      });
      const expected = CardLayout.landscapeSoloGearPositions({ singleLayout: "info-right" }).map((position) => ({
        x: position.x * board.width / dimensions.layoutWidth,
        y: position.y * board.height / dimensions.layoutHeight,
        width: position.width * board.width / dimensions.layoutWidth,
        height: position.height * board.height / dimensions.layoutHeight,
      }));
      return { actual, expected };
    });
    const maxLandscapeGearDrift = Math.max(...landscapeGearGeometry.actual.map((actual, index) => {
      const expected = landscapeGearGeometry.expected[index];
      return Math.max(
        Math.abs(actual.x - expected.x), Math.abs(actual.y - expected.y),
        Math.abs(actual.width - expected.width), Math.abs(actual.height - expected.height),
      );
    }));
    assert.ok(maxLandscapeGearDrift <= 0.75, `landscape preview equipment geometry drifted ${maxLandscapeGearDrift.toFixed(2)}px from CardLayout: ${JSON.stringify(landscapeGearGeometry)}`);
    const backgroundDraw = await page.evaluate(() => window.__collageDrawImageCalls[0]);
    const tapeDraw = await page.evaluate(() => window.__collageTapeFillRects[0]);
    assert.ok(tapeDraw?.args?.[2] > 0 && tapeDraw?.args?.[3] > 0, `PNG collage notes must draw the matching tape layer: ${JSON.stringify(tapeDraw)}`);
    assert.equal(backgroundDraw.args.length, 8, "PNG collage plate should use a source crop, not stretch the asset");
    const [sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight] = backgroundDraw.args;
    const coverScale = Math.max(1080 / backgroundDraw.naturalWidth, 1350 / backgroundDraw.naturalHeight);
    assert.ok(Math.abs(sourceX - (backgroundDraw.naturalWidth - 1080 / coverScale) / 2) < 0.01, "PNG collage crop must stay centered horizontally");
    assert.ok(Math.abs(sourceY - (backgroundDraw.naturalHeight - 1350 / coverScale) / 2) < 0.01, "PNG collage crop must stay centered vertically");
    assert.deepEqual([targetX, targetY, targetWidth, targetHeight], [0, 0, 1080, 1350], "PNG collage plate target must cover the full portrait card");
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.drawImage = window.__collageOriginalDrawImage;
      CanvasRenderingContext2D.prototype.fillRect = window.__collageOriginalFillRect;
    });
    await page.locator("#canvasBoard").screenshot({ path: "artifacts/collage-board.png" });
    await page.reload();
    await page.waitForSelector("#canvasBoard");
    assert.equal(await page.locator("#collagePreset").getAttribute("aria-pressed"), "true");
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#styleTab").click();
      await page.locator("#collagePreset").scrollIntoViewIfNeeded();
      const box = await page.locator("#collagePreset").boundingBox();
      assert.ok(box.width > 100 && box.x >= 0 && box.x + box.width <= width);
      await page.screenshot({ path: `artifacts/collage-${width}.png` });
    }
    console.log("PASS: vintage scrapbook and paper collage change only background axes, persist, and fit desktop/mobile.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
