const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const modelPaths = [
  "crop-plan.js",
  "card-art.js",
  "card-layout.js",
  "card-composition.js",
  "card-copy.js",
  "card-materials.js",
  "card-gear-copy.js",
  "card-ornaments.js",
  "card-png.js",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    for (const file of modelPaths) await page.addScriptTag({ path: path.join(__dirname, "..", "models", file) });

    const result = await page.evaluate(async () => {
      const dimensions = { layoutWidth: 360, layoutHeight: 260, exportWidth: 720, exportHeight: 520 };
      const art = {
        enabled: true,
        badge: "heart",
        ornaments: 0,
        accentColor: "#d9b5c6",
        paperColor: "#fffaf4",
        patternScale: 100,
        patternOpacity: 18,
      };
      const draw = (plan, backgroundPattern = "none", overrides = {}) => {
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.layoutWidth;
        canvas.height = dimensions.layoutHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const outcome = CardOrnaments.draw(context, {
          plan: { ...plan, art: { ...art, ...overrides } },
          dimensions,
          backgroundPattern,
          background: { pattern: ["#334b6b", "#f4ede4"] },
        });
        return {
          outcome,
          pixels: [...context.getImageData(0, 0, canvas.width, canvas.height).data],
          pixelAt: (x, y) => [...context.getImageData(x, y, 1, 1).data],
        };
      };
      const emptyPlan = { groupPanels: [], items: [] };
      const disabled = draw(emptyPlan, "halftone", { enabled: false });
      const disabledHasInk = disabled.pixels.some((channel, index) => index % 4 === 3 && channel > 0);

      const basePanel = {
        characterIndex: 0,
        x: 40,
        y: 40,
        width: 100,
        height: 100,
        contentRect: { x: 60, y: 60, width: 60, height: 50 },
      };
      const shapes = ["heart", "flower", "scallop"].map((shape) => draw({
        effectiveLayout: "footer",
        groupPanels: [{ ...basePanel, shape }],
        items: [{ copyBounds: basePanel.contentRect }],
      }));
      const sameShapeWithManyItems = draw({
        effectiveLayout: "footer",
        groupPanels: [{ ...basePanel, shape: "heart" }],
        items: Array.from({ length: 40 }, () => ({ copyBounds: basePanel.contentRect })),
      });
      const sameShapeWithOneItem = draw({
        effectiveLayout: "footer",
        groupPanels: [{ ...basePanel, shape: "heart" }],
        items: [{ copyBounds: basePanel.contentRect }],
      });
      const twoPanels = draw({
        effectiveLayout: "footer",
        groupPanels: [
          { ...basePanel, shape: "heart" },
          { ...basePanel, characterIndex: 1, x: 190, shape: "flower" },
        ],
        items: [],
      });
      const nonFooterBadge = draw({
        effectiveLayout: "center",
        groupPanels: [{ ...basePanel, shape: "heart" }],
        items: [],
      });
      const ornamentOne = draw(emptyPlan, "none", { ornaments: 55 });
      const ornamentTwo = draw(emptyPlan, "none", { ornaments: 55 });
      const ornamentLow = draw(emptyPlan, "none", { ornaments: 20 });
      const ornamentHigh = draw(emptyPlan, "none", { ornaments: 100 });
      const noOrnaments = draw(emptyPlan, "none", { ornaments: 0 });
      const excludedStar = draw({
        header: { x: 0, y: 0, width: 90, height: 60, hidden: false },
        imageRects: [{ x: 0, y: 0, width: 360, height: 260 }],
        items: [],
        groupPanels: [],
      }, "none", { ornaments: 100 });

      const stripesBase = draw(emptyPlan, "stripes", { patternOpacity: 40, patternScale: 100 });
      const stripesScaled = draw(emptyPlan, "stripes", { patternOpacity: 40, patternScale: 160 });
      const stripesFaint = draw(emptyPlan, "stripes", { patternOpacity: 10, patternScale: 100 });
      const plaid = draw(emptyPlan, "plaid", { patternOpacity: 40, patternScale: 100 });
      const plaidAltAccent = draw(emptyPlan, "plaid", { accentColor: "#8a3e46", patternOpacity: 40, patternScale: 100 });
      const plaidDense = draw(emptyPlan, "plaid", { density: 100, patternOpacity: 40, patternScale: 100 });
      const plaidSparse = draw(emptyPlan, "plaid", { density: 0, patternOpacity: 40, patternScale: 100 });
      const gingham = draw(emptyPlan, "halftone", { patternOpacity: 40, patternScale: 100 });

      const artCharacters = [{
        cutout: true,
        imageFit: "contain",
        zoom: 100,
        panX: 0,
        panY: 0,
        focalPoint: { x: 50, y: 50 },
        shadow: { x: 0, y: 0, blur: 0, strength: 0 },
      }];
      const exportArt = {
        ...art,
        badge: "heart",
        layout: "footer",
        ratio: "lookbook",
        ornaments: 0,
        showSlots: true,
        secondaryMode: "none",
        textAlign: "center",
        textScale: 100,
        patternOpacity: 40,
      };
      const artState = {
        characterCount: 1,
        selectedCharacter: 0,
        singleRatio: "portrait",
        singleLayout: "info-left",
        characters: artCharacters,
        cardComposition: { layer: "info-front", protectText: true, infoGap: 0, art: exportArt },
        multiInfoEnabled: false,
        multiInfoMode: "clear",
        backgroundPattern: "plaid",
        backgroundTexture: "none",
        background: "ink",
        customBackgroundColor: "#343543",
        outline: { color: "#ffffff", width: 0 },
        shadow: { x: 0, y: 0, blur: 0, strength: 0 },
      };
      const artLayout = CardLayout.layoutFor({
        characterCount: 1,
        singleRatio: artState.singleRatio,
        singleLayout: artState.singleLayout,
        characters: artCharacters,
        art: exportArt,
      });
      const characterCanvas = document.createElement("canvas");
      characterCanvas.width = 100;
      characterCanvas.height = 160;
      const characterContext = characterCanvas.getContext("2d");
      characterContext.fillStyle = "#d26171";
      characterContext.fillRect(0, 0, characterCanvas.width, characterCanvas.height);
      const characterImage = new Image();
      characterImage.src = characterCanvas.toDataURL("image/png");
      await characterImage.decode();
      const artImageRects = [CardLayout.imageRectFor({
        frame: artLayout.frames[0],
        naturalWidth: characterImage.naturalWidth,
        naturalHeight: characterImage.naturalHeight,
        imageFit: artCharacters[0].imageFit,
        zoom: artCharacters[0].zoom,
        panX: artCharacters[0].panX,
        panY: artCharacters[0].panY,
        focalPoint: artCharacters[0].focalPoint,
        panScale: 1,
      })];
      const artOccupancyByCharacter = [CardComposition.alphaOccupancyFor(
        characterImage,
        characterImage.currentSrc || characterImage.src || "",
      )];
      const artGear = [[{
        id: "art-pixel-test",
        slot: "head",
        slotName: "Head",
        name: "Crown of stars",
        secondaryName: "",
        showOnCard: true,
      }]];
      const artPlan = CardLayout.planComposition({
        characterCount: 1,
        singleRatio: artState.singleRatio,
        singleLayout: artState.singleLayout,
        characters: artCharacters,
        layout: artLayout,
        composition: artState.cardComposition,
        gearByCharacter: artGear,
        multiInfoEnabled: false,
        selectedCharacter: 0,
        language: "en",
        imageRects: artImageRects,
        occupancyByCharacter: artOccupancyByCharacter,
      });
      const patternOnlyState = {
        ...artState,
        cardComposition: { layer: "info-front", protectText: true, infoGap: 0, art: { ...exportArt, enabled: false } },
      };
      const patternOnlyLayout = CardLayout.layoutFor({
        characterCount: 1,
        singleRatio: patternOnlyState.singleRatio,
        singleLayout: patternOnlyState.singleLayout,
        characters: artCharacters,
      });
      const patternOnlyPlan = CardLayout.planComposition({
        characterCount: 1,
        singleRatio: patternOnlyState.singleRatio,
        singleLayout: patternOnlyState.singleLayout,
        characters: artCharacters,
        layout: patternOnlyLayout,
        composition: patternOnlyState.cardComposition,
        gearByCharacter: artGear,
        multiInfoEnabled: false,
        selectedCharacter: 0,
        language: "en",
      });
      const exportTheme = {
        text: "#f7f3ed",
        muted: "rgba(247,243,237,.62)",
        infoShadow: "rgba(29,34,40,.9)",
        header: "rgba(29,34,40,.92)",
        headerBorder: "rgba(247,243,237,.24)",
        panel: "rgba(29,34,40,.96)",
        panelBorder: "rgba(247,243,237,.24)",
        radius: 10,
      };
      const exportBackground = { solid: "#343543", pattern: ["#d8d7ef", "#777c9c"], tone: "dark" };
      const renderArtPng = async (backgroundPattern, { patternOnly = false, optionalPlan = false } = {}) => {
        const renderState = patternOnly
          ? {
            ...artState,
            backgroundPattern,
            cardComposition: { ...artState.cardComposition, art: { ...exportArt, enabled: false } },
          }
          : { ...artState, backgroundPattern };
        const renderPlan = patternOnly
          ? patternOnlyPlan
          : artPlan;
        const renderLayout = patternOnly ? patternOnlyLayout : artLayout;
        const blob = await CardPng.render({
          state: renderState,
          layout: optionalPlan ? null : renderLayout,
          dimensions: renderLayout.dimensions,
          compositionPlan: optionalPlan ? null : renderPlan,
          exportTheme,
          background: exportBackground,
          textureInk: "#f7f3ed",
          patternStars: [],
          images: [characterImage],
          copyLayout: [],
          gear: artGear,
          outlineColor: "#ffffff",
        });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const pixelAt = (x, y) => [...context.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data];
        const panel = renderPlan.groupPanels?.[0] || artPlan.groupPanels[0];
        const content = panel.contentRect;
        const contentPixels = context.getImageData(
          Math.floor(content.x * 2),
          Math.floor(content.y * 2),
          Math.max(1, Math.ceil(content.width * 2)),
          Math.max(1, Math.ceil(content.height * 2)),
        ).data;
        let darkCopyPixels = 0;
        for (let offset = 0; offset < contentPixels.length; offset += 4) {
          if (contentPixels[offset] < 100 && contentPixels[offset + 1] < 110 && contentPixels[offset + 2] < 120 && contentPixels[offset + 3] > 240) darkCopyPixels += 1;
        }
        bitmap.close();
        return {
          width: canvas.width,
          height: canvas.height,
          panelPaper: pixelAt(panel.x + panel.width * 0.5, panel.y + panel.height * 0.84),
          copyPixelCount: darkCopyPixels,
          plaidPixel: pixelAt(962, 20),
        };
      };
      const artPng = await renderArtPng("plaid");
      const artPngNoPattern = await renderArtPng("none");
      const patternOnlyPng = await renderArtPng("plaid", { patternOnly: true });
      const patternOnlyNoPattern = await renderArtPng("none", { patternOnly: true });
      const optionalPlanPng = await renderArtPng("plaid", { optionalPlan: true });
      const noImagePng = await CardPng.render({
        state: artState,
        dimensions: artLayout.dimensions,
        exportTheme,
        background: exportBackground,
        textureInk: "#f7f3ed",
        patternStars: [],
        copyLayout: [],
        gear: artGear,
        outlineColor: "#ffffff",
      });
      const hiddenInfoArt = { ...exportArt, showSlots: false, secondaryMode: "none" };
      const hiddenInfoState = {
        ...artState,
        backgroundPattern: "none",
        cardComposition: { ...artState.cardComposition, art: hiddenInfoArt },
      };
      const hiddenInfoGear = [[{
        ...artGear[0][0],
        slotName: "HIDDEN_SLOT_LABEL",
        secondaryName: "HIDDEN_TRANSLATION",
      }]];
      const hiddenInfoPlan = CardLayout.planComposition({
        characterCount: 1,
        singleRatio: hiddenInfoState.singleRatio,
        singleLayout: hiddenInfoState.singleLayout,
        characters: artCharacters,
        layout: artLayout,
        composition: hiddenInfoState.cardComposition,
        gearByCharacter: hiddenInfoGear,
        multiInfoEnabled: false,
        selectedCharacter: 0,
        language: "en",
      });
      const capturedFallbackText = [];
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function recordFallbackCopy(text, ...args) {
        capturedFallbackText.push(String(text));
        return originalFillText.call(this, text, ...args);
      };
      try {
        await CardPng.render({
          state: hiddenInfoState,
          layout: artLayout,
          dimensions: artLayout.dimensions,
          compositionPlan: hiddenInfoPlan,
          exportTheme,
          background: exportBackground,
          textureInk: "#f7f3ed",
          patternStars: [],
          images: [characterImage],
          copyLayout: [],
          gear: hiddenInfoGear,
          outlineColor: "#ffffff",
        });
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }

      return {
        disabled: { handled: disabled.outcome.patternHandled, hasInk: disabledHasInk },
        panels: shapes.map((shape) => ({ count: shape.outcome.panelsDrawn, center: shape.pixelAt(90, 85), outside: shape.pixelAt(43, 43) })),
        shapesDiffer: shapes[0].pixels.some((channel, index) => channel !== shapes[1].pixels[index])
          && shapes[1].pixels.some((channel, index) => channel !== shapes[2].pixels[index]),
        samePanel: {
          oneCount: sameShapeWithOneItem.outcome.panelsDrawn,
          manyCount: sameShapeWithManyItems.outcome.panelsDrawn,
          pixelsMatch: sameShapeWithOneItem.pixels.every((channel, index) => channel === sameShapeWithManyItems.pixels[index]),
        },
        twoPanels: twoPanels.outcome.panelsDrawn,
        nonFooterBadge: nonFooterBadge.outcome.panelsDrawn,
        ornaments: {
          count: ornamentOne.outcome.ornamentsDrawn,
          deterministic: ornamentOne.pixels.every((channel, index) => channel === ornamentTwo.pixels[index]),
          fullyBlocked: excludedStar.outcome.ornamentsDrawn,
          moreAtHighAmount: ornamentHigh.outcome.ornamentsDrawn > ornamentLow.outcome.ornamentsDrawn,
          brighterAtHighAmount: ornamentHigh.pixelAt(10, 15)[3] > ornamentLow.pixelAt(10, 15)[3],
          noneWhenZero: noOrnaments.outcome.ornamentsDrawn === 0 && noOrnaments.pixelAt(10, 15)[3] === 0,
        },
        patterns: {
          stripesHandled: stripesBase.outcome.patternHandled,
          plaidHandled: plaid.outcome.patternHandled,
          ginghamHandled: gingham.outcome.patternHandled,
          scaleChangesPixels: stripesBase.pixels.some((channel, index) => channel !== stripesScaled.pixels[index]),
          opacityChangesPixel: stripesBase.pixelAt(2, 100)[3] > stripesFaint.pixelAt(2, 100)[3],
          plaidAccentChangesColor: plaid.pixelAt(52, 120).some((channel, index) => channel !== plaidAltAccent.pixelAt(52, 120)[index]),
          plaidDensityChangesOpacity: plaidDense.pixelAt(52, 120)[3] > plaidSparse.pixelAt(52, 120)[3],
        },
        palettes: {
          lightPaperInk: CardOrnaments.paletteFor({ paperColor: "#fffaf4", accentColor: "#d9b5c6" }).ink,
          darkPaperInk: CardOrnaments.paletteFor({ paperColor: "#253044", accentColor: "#d9b5c6" }).ink,
        },
        png: {
          dimensionsMatchPlan: artPng.width === artLayout.dimensions.exportWidth && artPng.height === artLayout.dimensions.exportHeight,
          panelRemainsPaperOnDarkCard: artPng.panelPaper[0] > 240 && artPng.panelPaper[1] > 235 && artPng.panelPaper[2] > 225,
          darkCopyVisibleOnPaper: artPng.copyPixelCount > 0,
          sharedPatternChangesExport: artPng.plaidPixel.some((channel, index) => channel !== artPngNoPattern.plaidPixel[index]),
          patternOnlyChangesExport: patternOnlyPng.plaidPixel.some((channel, index) => channel !== patternOnlyNoPattern.plaidPixel[index]),
          optionalPlanMatchesExplicit: {
            dimensions: artPng.width === optionalPlanPng.width && artPng.height === optionalPlanPng.height,
            panel: artPng.panelPaper.every((channel, index) => channel === optionalPlanPng.panelPaper[index]),
            pattern: artPng.plaidPixel.every((channel, index) => channel === optionalPlanPng.plaidPixel[index]),
            text: artPng.copyPixelCount === optionalPlanPng.copyPixelCount,
          },
          missingImageArraySafe: noImagePng.size > 0,
          patternOnlyPreservesLegacyLayout: patternOnlyLayout.dimensions.layoutWidth === 1080
            && patternOnlyLayout.dimensions.layoutHeight === 1350
            && patternOnlyPlan.art?.enabled !== true,
          hiddenLabelsRemainHidden: !capturedFallbackText.some((text) => /HIDDEN_SLOT_LABEL|HIDDEN_TRANSLATION/u.test(text)),
          primaryFallbackCopyVisible: capturedFallbackText.join("").replace(/\s/gu, "").includes("Crownofstars"),
          groupCount: artPlan.groupPanels.length,
        },
      };
    });

    assert.deepEqual(result.disabled, { handled: false, hasInk: false }, "disabled art leaves the shared layer blank and legacy pattern path active");
    assert.deepEqual(result.panels.map(({ count }) => count), [1, 1, 1], "each planned group gets exactly one shaped mat");
    for (const panel of result.panels) {
      assert.ok(panel.center[3] > 240, "the central copy-safe area is opaque paper");
      assert.equal(panel.outside[3], 0, "the mat does not paint outside its outer shape rect");
    }
    assert.equal(result.shapesDiffer, true, "heart, flower and scallop paths are distinct");
    assert.deepEqual(result.samePanel, { oneCount: 1, manyCount: 1, pixelsMatch: true }, "mat count and pixels depend on groups, not individual items");
    assert.equal(result.twoPanels, 2, "two character groups get two mats");
    assert.equal(result.nonFooterBadge, 0, "grouped paper badges are reserved for footer compositions");
    assert.ok(result.ornaments.count > 0, "the ornament dial enables generic stars and corner rules");
    assert.equal(result.ornaments.deterministic, true, "ornament placement and pixels are deterministic");
    assert.equal(result.ornaments.fullyBlocked, 0, "safe-area decorations stay out of image, title, and text bounds");
    assert.equal(result.ornaments.moreAtHighAmount, true, "the ornament dial changes how many stars appear");
    assert.equal(result.ornaments.brighterAtHighAmount, true, "the ornament dial also controls star intensity");
    assert.equal(result.ornaments.noneWhenZero, true, "zero ornaments stays completely undecorated");
    assert.deepEqual(result.patterns, {
      stripesHandled: true,
      plaidHandled: true,
      ginghamHandled: true,
      scaleChangesPixels: true,
      opacityChangesPixel: true,
      plaidAccentChangesColor: true,
      plaidDensityChangesOpacity: true,
    }, "shared stripes, plaid and gingham honor the pattern controls");
    assert.equal(result.palettes.lightPaperInk, "#111111", "white paper mats use dark copy even on a dark card");
    assert.equal(result.palettes.darkPaperInk, "#ffffff", "dark paper mats retain light copy");
    assert.deepEqual(result.png, {
      dimensionsMatchPlan: true,
      panelRemainsPaperOnDarkCard: true,
      darkCopyVisibleOnPaper: true,
      sharedPatternChangesExport: true,
      patternOnlyChangesExport: true,
      optionalPlanMatchesExplicit: {
        dimensions: true,
        panel: true,
        pattern: true,
        text: true,
      },
      missingImageArraySafe: true,
      patternOnlyPreservesLegacyLayout: true,
      hiddenLabelsRemainHidden: true,
      primaryFallbackCopyVisible: true,
      groupCount: 1,
    }, "PNG uses the art canvas, paper-contrast palette, grouped copy bounds, and shared pattern geometry");
    console.log("PASS: shared card ornaments are deterministic, group-based, safe-area-aware, and contrast-aware.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
