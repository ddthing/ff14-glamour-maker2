const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

// A deterministic abstract source lets the visual artifact exercise the
// photo mount without shipping or rewriting a real user's photograph.
const fixtureImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
    <rect width="720" height="960" fill="#d7e5e4"/>
    <rect x="56" y="82" width="608" height="796" fill="#f7f0e3"/>
    <path d="M122 850 158 250l103-94 156 42 138 194-53 425-201 102z" fill="#314b53"/>
    <path d="m224 193 160-38 129 103-56 118-156 34-93-87z" fill="#b88972"/>
    <circle cx="346" cy="304" r="73" fill="#e7c4a6"/>
    <path d="M254 500c42-82 134-110 208-57l80 407H185z" fill="#26373c"/>
    <path d="m520 514 82 68-31 45-91-49z" fill="#d4b688"/>
  </svg>
`)}`;
const assetPath = path.join(__dirname, "..", "assets", "themes", "vintage-scrapbook-plate.svg");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");

    const sourceBefore = await page.evaluate((image) => {
      state.characters[0] = {
        ...LookEditor.emptyCharacter(),
        src: image,
        originalSrc: image,
        fileName: "source-preservation-fixture.png",
        fileMeta: "source preservation fixture",
      };
      state.characterCount = 1;
      state.selectedCharacter = 0;
      const look = getSelectedLook();
      look.title = "원본 보존 검증";
      look.subtitle = "vintage scrapbook material";
      state.background = "rose";
      state.backgroundPattern = "stars";
      state.backgroundTexture = "none";
      renderAll();
      return {
        src: state.characters[0].src,
        originalSrc: state.characters[0].originalSrc,
        imageFit: state.characters[0].imageFit,
        zoom: state.characters[0].zoom,
        panX: state.characters[0].panX,
        panY: state.characters[0].panY,
      };
    }, fixtureImage);

    await page.evaluate(() => {
      const records = [
        [92011, "head", "낡은 깃털 장식 모자"],
        [92012, "body", "아기돼지 의상"],
        [92013, "hands", "달빛 장갑"],
        [92014, "legs", "별빛 바지"],
        [92015, "feet", "초승달 장화"],
      ];
      records.forEach(([id, slot, name]) => itemRecordCache.set(String(id), {
        id: String(id), slot, names: { ko: name, en: name, ja: name },
      }));
      const outfit = getSelectedLook().outfits[0];
      records.forEach(([id, slot]) => { outfit[slot] = String(id); });
      renderAll();
    });

    await page.locator("#scrapbookPreset").click();
    const selected = await page.evaluate(() => ({
      background: state.background,
      pattern: state.backgroundPattern,
      texture: state.backgroundTexture,
      backgroundImage: getComputedStyle(document.querySelector("#sceneBackground")).backgroundImage,
      source: {
        src: state.characters[0].src,
        originalSrc: state.characters[0].originalSrc,
        imageFit: state.characters[0].imageFit,
        zoom: state.characters[0].zoom,
        panX: state.characters[0].panX,
        panY: state.characters[0].panY,
      },
      pressed: document.querySelector("#scrapbookPreset")?.getAttribute("aria-pressed"),
    }));
    assert.deepEqual(selected.source, sourceBefore, "scrapbook preset must not mutate the source image or its placement");
    assert.deepEqual({ background: selected.background, pattern: selected.pattern, texture: selected.texture }, {
      background: "paper", pattern: "scrapbook", texture: "grain",
    });
    assert.match(selected.backgroundImage, /vintage-scrapbook-plate\.svg/);
    assert.equal(selected.pressed, "true");

    const gearNotes = await page.evaluate(() => [...document.querySelectorAll("#boardGearList > .board-gear-item")].map((note) => {
      const itemRect = note.getBoundingClientRect();
      const tapeRect = note.querySelector(".gear-tile-tape")?.getBoundingClientRect();
      return {
        slot: note.dataset.cardSlot,
        surfaceDisplay: getComputedStyle(note.querySelector(".gear-note-surface")).display,
        tapeOverhangs: Boolean(tapeRect && tapeRect.top < itemRect.top && tapeRect.bottom > itemRect.top),
        leadingLine: getComputedStyle(note.querySelector(".gear-slot-label"), "::before").display,
        trailingLine: getComputedStyle(note.querySelector(".gear-tile-copy"), "::after").content,
      };
    }));
    assert.deepEqual(gearNotes.map(({ slot }) => slot), ["head", "body", "hands", "legs", "feet"], "all five equipment notes must keep their canonical slot order");
    assert.ok(gearNotes.every(({ surfaceDisplay, tapeOverhangs, leadingLine, trailingLine }) => (
      surfaceDisplay === "block"
      && tapeOverhangs
      && leadingLine === "none"
      && trailingLine === "none"
    )), "scrapbook notes must use an overlapping tape and omit the two marked rules");

    const svg = fs.readFileSync(assetPath, "utf8");
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<image\b|<text\b|data:image|base64/i, "scrapbook plate must not contain photos, generated text, or embedded images");
    const asset = await page.evaluate(async () => {
      const response = await fetch("assets/themes/vintage-scrapbook-plate.svg", { cache: "no-store" });
      return { ok: response.ok, body: await response.text() };
    });
    assert.equal(asset.ok, true, "the scrapbook plate must be published as a browser asset");
    assert.doesNotMatch(asset.body, /<image\b|<text\b|data:image|base64/i, "published scrapbook plate must stay text-free and image-free");

    await page.evaluate(() => {
      window.__scrapbookRender = null;
      window.__scrapbookDrawImageCalls = [];
      window.__scrapbookDrawImageMetadata = [];
      const originalRender = CardPng.render;
      CardPng.render = async (args) => {
        window.__scrapbookRender = {
          hasBackgroundImage: Boolean(args.backgroundImage),
          width: args.backgroundImage?.naturalWidth || 0,
          height: args.backgroundImage?.naturalHeight || 0,
        };
        return originalRender(args);
      };
      window.__scrapbookOriginalRender = originalRender;
      const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
      window.__scrapbookOriginalDrawImage = originalDrawImage;
      CanvasRenderingContext2D.prototype.drawImage = function captureSource(image, ...args) {
        window.__scrapbookDrawImageCalls.push(String(image.currentSrc || image.src || ""));
        window.__scrapbookDrawImageMetadata.push({
          src: String(image.currentSrc || image.src || ""),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          argumentCount: args.length,
        });
        return originalDrawImage.call(this, image, ...args);
      };
    });

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    const download = await downloadPromise;
    await download.saveAs("artifacts/vintage-scrapbook-export.png");
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));

    const exportState = await page.evaluate(() => ({
      render: window.__scrapbookRender,
      drawImageCalls: window.__scrapbookDrawImageCalls,
      drawImageMetadata: window.__scrapbookDrawImageMetadata,
      source: {
        src: state.characters[0].src,
        originalSrc: state.characters[0].originalSrc,
      },
    }));
    assert.deepEqual(exportState.render, { hasBackgroundImage: true, width: 1080, height: 1350 }, "PNG export must load the text-free scrapbook plate");
    assert.match(exportState.drawImageCalls[0], /vintage-scrapbook-plate\.svg/, "PNG must paint the scrapbook plate before the source image");
    assert.ok(exportState.drawImageCalls.slice(1).every((source) => !/vintage-scrapbook-plate\.svg/.test(source)), "the scrapbook plate must not replace the source image");
    const sourceDraw = exportState.drawImageMetadata.find(({ src }) => src === sourceBefore.src);
    assert.deepEqual(sourceDraw && {
      naturalWidth: sourceDraw.naturalWidth,
      naturalHeight: sourceDraw.naturalHeight,
      argumentCount: sourceDraw.argumentCount,
    }, {
      naturalWidth: 720,
      naturalHeight: 960,
      argumentCount: 4,
    }, "PNG must draw the untouched source image directly, without a generated replacement or source-side filter pass");
    assert.deepEqual(exportState.source, { src: sourceBefore.src, originalSrc: sourceBefore.originalSrc }, "export must not rewrite the original photo references");

    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.drawImage = window.__scrapbookOriginalDrawImage;
      CardPng.render = window.__scrapbookOriginalRender;
    });
    await page.locator("#canvasBoard").screenshot({ path: "artifacts/vintage-scrapbook-board.png" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator("#styleTab").click();
    await page.locator("#scrapbookPreset").scrollIntoViewIfNeeded();
    const mobilePreset = await page.locator("#scrapbookPreset").boundingBox();
    assert.ok(mobilePreset && mobilePreset.x >= 0 && mobilePreset.x + mobilePreset.width <= 390, "scrapbook preset must fit a narrow inspector");
    console.log("PASS: vintage scrapbook uses a text-free decorative plate, preserves source image references, and paints the same plate in preview and PNG export.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
