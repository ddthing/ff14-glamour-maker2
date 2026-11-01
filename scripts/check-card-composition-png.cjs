const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const modelPaths = [
  "crop-plan.js",
  "card-layout.js",
  "card-composition.js",
  "card-copy.js",
  "card-materials.js",
  "card-gear-copy.js",
  "card-png.js",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent("<!doctype html><html><body></body></html>");
    for (const file of modelPaths) await page.addScriptTag({ path: path.join(__dirname, "..", "models", file) });

    const result = await page.evaluate(async () => {
      const layout = CardLayout.layoutFor({
        characterCount: 3,
        singleRatio: "landscape",
        characters: [{ cutout: true }, { cutout: true }, { cutout: true }],
      });
      const state = {
        characterCount: 3,
        selectedCharacter: 0,
        singleLayout: "info-left",
        characters: Array.from({ length: 3 }, () => ({
          cutout: true,
          imageFit: "contain",
          zoom: 100,
          panX: 0,
          panY: 0,
          shadow: { x: 0, y: 0, blur: 0, strength: 0 },
        })),
        cardComposition: { layer: "person-front", protectText: true, infoGap: 0 },
        multiInfoEnabled: true,
        multiInfoMode: "normal",
        backgroundPattern: "none",
        backgroundTexture: "none",
        background: "paper",
        outline: { width: 0 },
        shadow: { x: 0, y: 0, blur: 0, strength: 0 },
      };
      const gear = Array.from({ length: 3 }, (_, characterIndex) => Array.from({ length: 6 }, (_, index) => ({
        id: `char-${characterIndex}-item-${index}`,
        itemId: `${characterIndex}-${index}`,
        slot: "accessory",
        slotName: "Accessory",
        name: `Accessory copy ${characterIndex}-${index}`,
        secondaryName: "English reference",
        extra: index >= 5,
      })));
      const plan = CardLayout.planComposition({
        characterCount: 3,
        singleRatio: "landscape",
        singleLayout: state.singleLayout,
        characters: state.characters,
        layout,
        composition: state.cardComposition,
        gearByCharacter: gear,
        multiInfoEnabled: state.multiInfoEnabled,
        selectedCharacter: state.selectedCharacter,
        language: "ko",
      });
      const redSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="519"><rect width="400" height="519" fill="#e34242"/></svg>`;
      const redImage = new Image();
      redImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(redSvg)}`;
      await redImage.decode();
      const material = { solid: "#f7f5f0", pattern: ["#333333", "#ffffff"], tone: "light" };
      const exportTheme = {
        text: "#263238",
        muted: "rgba(38,50,56,.6)",
        infoShadow: "rgba(255,255,255,.9)",
        panel: "rgba(255,250,244,.96)",
        panelBorder: "rgba(38,50,56,.18)",
        radius: 10,
      };
      const render = async (
        compositionPlan,
        backgroundPattern = state.backgroundPattern,
        gearData = gear,
        stateData = state,
        layoutData = layout,
        imageData = [redImage, redImage, redImage],
      ) => {
        const blob = await CardPng.render({
          state: { ...stateData, backgroundPattern },
          dimensions: layoutData.dimensions,
          layout: layoutData,
          compositionPlan,
          exportTheme,
          background: material,
          patternStars: [],
          images: imageData,
          copyLayout: [],
          gear: gearData,
          outlineColor: "#ffffff",
        });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const pixel = (x, y) => Array.from(context.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data);
        const firstInkOffset = (bounds) => {
          const left = Math.round(bounds.x * 2);
          const top = Math.round(bounds.y * 2);
          const width = Math.max(1, Math.ceil(bounds.width * 2));
          const height = Math.max(1, Math.ceil(bounds.height * 2));
          const data = context.getImageData(left, top, width, height).data;
          for (let row = 0; row < height; row += 1) {
            for (let column = 0; column < width; column += 1) {
              const offset = (row * width + column) * 4;
              if (data[offset] < 130 && data[offset + 1] < 150 && data[offset + 2] < 165 && data[offset + 3] > 240) {
                return row / 2;
              }
            }
          }
          return null;
        };
        bitmap.close();
        return { blob, pixel, firstInkOffset };
      };
      const personFront = await render(plan);
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = 64;
      maskCanvas.height = 96;
      const maskContext = maskCanvas.getContext("2d");
      maskContext.fillStyle = "#e34242";
      maskContext.fillRect(24, 0, 16, 96);
      const maskImage = new Image();
      maskImage.src = maskCanvas.toDataURL("image/png");
      await maskImage.decode();
      const occupancy = CardComposition.alphaOccupancyFor(maskImage, "composition-test-cutout");
      const cachedOccupancy = CardComposition.alphaOccupancyFor(maskImage, "composition-test-cutout");
      const occupancySummary = {
        width: occupancy?.width,
        height: occupancy?.height,
        length: occupancy?.alpha?.length,
        transparent: occupancy?.alpha?.[48 * 64 + 2],
        subject: occupancy?.alpha?.[48 * 64 + 32],
        cached: occupancy === cachedOccupancy,
      };
      CardComposition.clearOccupancyCache();
      const refreshedOccupancy = CardComposition.alphaOccupancyFor(maskImage, "composition-test-cutout");
      occupancySummary.clears = refreshedOccupancy !== occupancy;
      const sample = plan.items[0];
      const protectionBounds = sample.protectionBounds;
      const infoFrontPlan = CardLayout.planComposition({
        characterCount: 3,
        singleRatio: "landscape",
        singleLayout: state.singleLayout,
        characters: state.characters,
        layout,
        composition: { layer: "info-front", protectText: true, infoGap: 0 },
        gearByCharacter: gear,
        multiInfoEnabled: true,
        selectedCharacter: 0,
        language: "ko",
      });
      const infoPlanItem = infoFrontPlan.items[0];
      const noSurfacePlan = { ...infoFrontPlan, items: [] };
      const clearInfoPlan = {
        ...infoFrontPlan,
        items: infoFrontPlan.items.map((item) => ({ ...item, copyOcclusionScore: 0 })),
      };
      const personClearPlan = {
        ...plan,
        items: plan.items.map((item) => ({ ...item, copyOcclusionScore: 0 })),
      };
      const noSurfaceBaseline = await render(noSurfacePlan);
      const clearInfo = await render(clearInfoPlan);
      const noteCorner = { x: infoPlanItem.x + 1, y: infoPlanItem.y + 1 };
      const clearNoteCornerPixel = clearInfo.pixel(noteCorner.x, noteCorner.y);
      const baselineNoteCornerPixel = noSurfaceBaseline.pixel(noteCorner.x, noteCorner.y);
      const collageClear = await render(clearInfoPlan, "collage");
      const collageBaseline = await render(noSurfacePlan, "collage");
      const scrapbookClear = await render(clearInfoPlan, "scrapbook");
      const scrapbookBaseline = await render(noSurfacePlan, "scrapbook");
      const collageNoteCornerPixel = collageClear.pixel(noteCorner.x, noteCorner.y);
      const collageBaselinePixel = collageBaseline.pixel(noteCorner.x, noteCorner.y);
      const scrapbookNoteCornerPixel = scrapbookClear.pixel(noteCorner.x, noteCorner.y);
      const scrapbookBaselinePixel = scrapbookBaseline.pixel(noteCorner.x, noteCorner.y);
      const personClear = await render(personClearPlan);
      const personNoSurfaceBaseline = await render({ ...plan, items: [] });
      const personClearCornerPixel = personClear.pixel(noteCorner.x, noteCorner.y);
      const personBaselineCornerPixel = personNoSurfaceBaseline.pixel(noteCorner.x, noteCorner.y);

      const sourceCharacters = Array.from({ length: 3 }, () => ({ ...state.characters[0], cutout: false }));
      const sourceLayout = CardLayout.layoutFor({ characterCount: 3, singleRatio: "landscape", characters: sourceCharacters });
      const sourceImageRects = sourceCharacters.map((character, index) => CardLayout.imageRectFor({
        frame: sourceLayout.frames[index],
        naturalWidth: redImage.naturalWidth,
        naturalHeight: redImage.naturalHeight,
        imageFit: character.imageFit,
        zoom: character.zoom,
        panX: character.panX,
        panY: character.panY,
        focalPoint: character.focalPoint,
      }));
      const sourcePlan = CardLayout.planComposition({
        characterCount: 3,
        singleRatio: "landscape",
        singleLayout: state.singleLayout,
        characters: sourceCharacters,
        layout: sourceLayout,
        composition: { layer: "info-front", protectText: true, infoGap: 0 },
        gearByCharacter: gear,
        multiInfoEnabled: true,
        selectedCharacter: 0,
        language: "ko",
        imageRects: sourceImageRects,
      });
      const sourceUnknownPlan = {
        ...sourcePlan,
        items: sourcePlan.items.map((item, index) => ({ ...item, copyOcclusionScore: index === 0 ? null : 0 })),
      };
      const sourceUnknown = await render(sourceUnknownPlan, state.backgroundPattern, gear, { ...state, characters: sourceCharacters }, sourceLayout);
      const sourceBaseline = await render({ ...sourcePlan, items: [] }, state.backgroundPattern, gear, { ...state, characters: sourceCharacters }, sourceLayout);
      const sourceProbeItem = sourceUnknownPlan.items[0];
      const sourceHaloPoint = {
        x: sourceProbeItem.protectionBounds.x + sourceProbeItem.protectionBounds.width / 2,
        y: sourceProbeItem.copyBounds.y + sourceProbeItem.copyBounds.height + 1,
      };
      const sourceHaloPixel = sourceUnknown.pixel(sourceHaloPoint.x, sourceHaloPoint.y);
      const sourceBaselinePixel = sourceBaseline.pixel(sourceHaloPoint.x, sourceHaloPoint.y);

      const emptyCanvas = document.createElement("canvas");
      emptyCanvas.width = 64;
      emptyCanvas.height = 96;
      const emptyImage = new Image();
      emptyImage.src = emptyCanvas.toDataURL("image/png");
      await emptyImage.decode();
      const emptyOccupancy = CardComposition.alphaOccupancyFor(emptyImage, "composition-empty-protected-rail");
      const clearCutoutCharacters = Array.from({ length: 3 }, () => ({ ...state.characters[0], cutout: true }));
      const emptyImageRects = clearCutoutCharacters.map((character, index) => CardLayout.imageRectFor({
        frame: layout.frames[index],
        naturalWidth: emptyImage.naturalWidth,
        naturalHeight: emptyImage.naturalHeight,
        imageFit: character.imageFit,
        zoom: character.zoom,
        panX: character.panX,
        panY: character.panY,
        focalPoint: character.focalPoint,
      }));
      const clearCutoutPlan = CardLayout.planComposition({
        characterCount: 3,
        singleRatio: "landscape",
        singleLayout: state.singleLayout,
        characters: clearCutoutCharacters,
        layout,
        composition: { layer: "person-front", protectText: true, infoGap: 0 },
        gearByCharacter: gear,
        multiInfoEnabled: true,
        selectedCharacter: 0,
        language: "ko",
        occupancyByCharacter: clearCutoutCharacters.map(() => emptyOccupancy),
        imageRects: emptyImageRects,
      });
      const clearCutoutPng = await render(clearCutoutPlan, state.backgroundPattern, gear, { ...state, characters: clearCutoutCharacters }, layout, [emptyImage, emptyImage, emptyImage]);
      const clearCutoutItem = clearCutoutPlan.items[0];
      const clearCutoutPoint = { x: clearCutoutItem.x + 1, y: clearCutoutItem.y + 1 };
      const clearCutoutPixel = clearCutoutPng.pixel(clearCutoutPoint.x, clearCutoutPoint.y);
      const clearCutoutBaseline = await render({ ...clearCutoutPlan, items: [] }, state.backgroundPattern, gear, { ...state, characters: clearCutoutCharacters }, layout, [emptyImage, emptyImage, emptyImage]);
      const clearCutoutBaselinePixel = clearCutoutBaseline.pixel(clearCutoutPoint.x, clearCutoutPoint.y);

      const protectionCanvas = document.createElement("canvas");
      protectionCanvas.width = 100;
      protectionCanvas.height = 80;
      const protectionContext = protectionCanvas.getContext("2d", { willReadFrequently: true });
      protectionContext.fillStyle = "#e34242";
      protectionContext.fillRect(0, 0, protectionCanvas.width, protectionCanvas.height);
      const protectionHelperResult = CardPng.drawCopyProtection(
        protectionContext,
        { x: 20, y: 20, width: 60, height: 40 },
        "#fffaf4",
      );
      const protectionPixel = (x, y) => Array.from(protectionContext.getImageData(x, y, 1, 1).data);
      const protectionCenterPixel = protectionPixel(50, 40);
      const protectionFadePixel = protectionPixel(78, 40);
      const protectionCornerPixel = protectionPixel(21, 21);

      const imageRectProbePlan = { ...plan, isCustom: false, items: [], imageRects: [{ x: 10, y: 10, width: 50, height: 50 }, null, null] };
      const imageRectProbe = await render(imageRectProbePlan, state.backgroundPattern, [[], [], []]);
      const imageRectOverridePixel = imageRectProbe.pixel(30, 30);
      const originBounds = {
        x: infoPlanItem.x + 18,
        y: infoPlanItem.y + 18,
        width: infoPlanItem.width - 36,
        height: infoPlanItem.height - 36,
      };
      const originPlanItem = {
        ...infoPlanItem,
        name: "Top",
        slotName: "",
        secondaryName: "",
        copyBounds: originBounds,
        copy: {
          primarySize: 12,
          primaryLineHeight: 14,
          secondarySize: 0,
          secondaryLineHeight: 0,
          slotSize: 0,
          slotLineHeight: 0,
          groupGap: 0,
        },
      };
      const originPlan = { ...infoFrontPlan, items: [originPlanItem] };
      const originGear = gear.map((items, characterIndex) => characterIndex === 0
        ? items.map((item, index) => index === 0 ? { ...item, name: "Top", slotName: "", secondaryName: "" } : item)
        : items);
      const originFront = await render(originPlan, state.backgroundPattern, originGear);
      const firstGlyphInkOffset = originFront.firstInkOffset(originBounds);
      const validPlanGeometry = plan.items.every((item) => {
        const copy = item.copyBounds;
        const protection = item.protectionBounds;
        return Boolean(copy && protection)
          && copy.x >= item.x && copy.y >= item.y
          && copy.x + copy.width <= item.x + item.width
          && copy.y + copy.height <= item.y + item.height
          && protection.x <= copy.x && protection.y <= copy.y
          && protection.x + protection.width >= copy.x + copy.width
          && protection.y + protection.height >= copy.y + copy.height
          && copy.x - protection.x >= 10
          && copy.y - protection.y >= 10
          && protection.x + protection.width - (copy.x + copy.width) >= 10
          && protection.y + protection.height - (copy.y + copy.height) >= 10;
      });
      const sampleZone = plan.protectedZones.find((zone) => zone.characterIndex === sample.characterIndex && zone.gearIndex === sample.gearIndex);
      const protectedZoneMatches = sampleZone && sampleZone.x === protectionBounds.x && sampleZone.y === protectionBounds.y
        && sampleZone.width === protectionBounds.width && sampleZone.height === protectionBounds.height;
      const legacyCharacter = { ...state.characters[0] };
      const legacyState = {
        ...state,
        characterCount: 1,
        selectedCharacter: 0,
        characters: [legacyCharacter],
        multiInfoEnabled: false,
      };
      delete legacyState.cardComposition;
      const legacyLayout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: [legacyCharacter] });
      const legacyGear = [Array.from({ length: 5 }, (_, index) => ({
        id: `legacy-${index}`,
        slot: ["head", "body", "hands", "legs", "feet"][index],
        slotName: `Slot ${index}`,
        name: `Legacy gear ${index}`,
        showOnCard: index !== 2,
      }))];
      const hiddenLegacyBlob = await CardPng.render({
        state: legacyState,
        dimensions: legacyLayout.dimensions,
        layout: legacyLayout,
        exportTheme,
        background: material,
        patternStars: [],
        images: [redImage],
        copyLayout: [],
        gear: legacyGear,
        outlineColor: "#ffffff",
      });
      const hiddenLegacyBitmap = await createImageBitmap(hiddenLegacyBlob);
      const hiddenLegacyCanvas = document.createElement("canvas");
      hiddenLegacyCanvas.width = hiddenLegacyBitmap.width;
      hiddenLegacyCanvas.height = hiddenLegacyBitmap.height;
      const hiddenLegacyContext = hiddenLegacyCanvas.getContext("2d", { willReadFrequently: true });
      hiddenLegacyContext.drawImage(hiddenLegacyBitmap, 0, 0);
      const hiddenPosition = CardLayout.portraitGearPositions()[2];
      const hiddenLegacyPixel = Array.from(hiddenLegacyContext.getImageData(
        Math.round((hiddenPosition.x + hiddenPosition.width / 2) * 2),
        Math.round((hiddenPosition.y + hiddenPosition.height / 2) * 2),
        1,
        1,
      ).data);
      hiddenLegacyBitmap.close();
      const pixelDistance = (first, second) => first.reduce((sum, value, index) => sum + Math.abs(value - second[index]), 0);
      return {
        plan,
        clearNoteCornerPixel,
        baselineNoteCornerPixel,
        personClearCornerPixel,
        personBaselineCornerPixel,
        collageNoteCornerPixel,
        collageBaselinePixel,
        scrapbookNoteCornerPixel,
        scrapbookBaselinePixel,
        sourceHaloPixel,
        sourceBaselinePixel,
        sourceHaloDistance: pixelDistance(sourceHaloPixel, sourceBaselinePixel),
        clearCutoutPixel,
        clearCutoutBaselinePixel,
        clearCutoutScores: clearCutoutPlan.items.map((item) => item.copyOcclusionScore),
        protectionHelperResult,
        protectionCenterPixel,
        protectionFadePixel,
        protectionCornerPixel,
        imageRectOverridePixel,
        firstGlyphInkOffset,
        validPlanGeometry,
        protectedZoneMatches: Boolean(protectedZoneMatches),
        personBytes: personFront.blob.size,
        infoBytes: clearInfo.blob.size,
        occupancySummary,
        hiddenLegacyPixel,
      };
    });

    assert.equal(result.plan.effectiveLayer, "person-front");
    assert.equal(result.plan.items.length, 18, "each character's core and accessory entries must reach the PNG plan");
    assert.ok(result.validPlanGeometry, "copy bounds stay inside their click targets and feather bounds add breathing room around every copy line");
    assert.ok(result.protectedZoneMatches, "foreground occupancy uses the expanded protection bounds rather than the glyph bounds");
    assert.deepEqual(result.occupancySummary, {
      width: 64,
      height: 96,
      length: 6144,
      transparent: 0,
      subject: 255,
      cached: true,
      clears: true,
    }, "cutout alpha is downsampled once and reused from the bounded cache");
    assert.ok(result.personBytes > 1000 && result.infoBytes > 1000, "both layers export a complete PNG");
    assert.deepEqual(result.clearNoteCornerPixel, result.baselineNoteCornerPixel, "info-front custom notes paint no full-size rectangle outside their copy");
    assert.deepEqual(result.personClearCornerPixel, result.personBaselineCornerPixel, "person-front custom notes paint no material surface before the character");
    assert.deepEqual(result.collageNoteCornerPixel, result.collageBaselinePixel, "custom collage notes do not restore paper boxes");
    assert.deepEqual(result.scrapbookNoteCornerPixel, result.scrapbookBaselinePixel, "custom scrapbook notes do not restore paper boxes");
    assert.ok(result.clearCutoutScores.length > 0 && result.clearCutoutScores.every((score) => score === 0), "empty cutout masks produce zero copy occlusion for clear rails");
    assert.deepEqual(result.clearCutoutPixel, result.clearCutoutBaselinePixel, "empty protected cutout rails add no alpha or halo to the exported card");
    assert.ok(result.sourceHaloDistance > 10, `unknown overlap on source screenshots keeps a feathered halo: ${result.sourceHaloPixel} vs ${result.sourceBaselinePixel}`);
    assert.equal(result.protectionHelperResult, true, "copy protection helper accepts valid bounds");
    assert.ok(result.protectionCenterPixel[0] > 230 && result.protectionCenterPixel[1] > 180, `soft protection is visible in the ellipse center: ${result.protectionCenterPixel}`);
    assert.ok(result.protectionFadePixel[1] > 66, `the feather fades with the tint color instead of introducing a dark fringe: ${result.protectionFadePixel}`);
    assert.deepEqual(result.protectionCornerPixel, [227, 66, 66, 255], "feathered protection leaves the bounding-box corners clear");
    assert.ok(result.imageRectOverridePixel[0] > 180 && result.imageRectOverridePixel[1] < 90, `PNG cutout placement honors the resolved per-character image rectangle: ${result.imageRectOverridePixel}`);
    assert.ok(result.firstGlyphInkOffset != null && result.firstGlyphInkOffset <= 4, `fallback PNG glyphs start at the planned top edge instead of vertical centering: ${result.firstGlyphInkOffset}`);
    assert.ok(result.hiddenLegacyPixel[0] > 180 && result.hiddenLegacyPixel[1] < 90, `a hidden legacy core item must stay hidden without shifting its neighbors: ${result.hiddenLegacyPixel}`);
    console.log("PASS: CardPng keeps custom copy typography-only, adds only overlap-sensitive feather protection, follows planned cutout frames, and preserves legacy cards.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
