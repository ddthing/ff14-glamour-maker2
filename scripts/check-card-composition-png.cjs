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
      const render = async (compositionPlan, backgroundPattern = state.backgroundPattern, gearData = gear) => {
        const blob = await CardPng.render({
          state: { ...state, backgroundPattern },
          dimensions: layout.dimensions,
          layout,
          compositionPlan,
          exportTheme,
          background: material,
          patternStars: [],
          images: [redImage, redImage, redImage],
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
      const backgroundPoint = { x: protectionBounds.x - 1, y: protectionBounds.y + protectionBounds.height / 2 };
      const protectedPoint = { x: protectionBounds.x + 2, y: protectionBounds.y + protectionBounds.height / 2 };
      const personPixel = personFront.pixel(backgroundPoint.x, backgroundPoint.y);
      const copyPixel = personFront.pixel(protectedPoint.x, protectedPoint.y);
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
      const infoFront = await render(infoFrontPlan);
      const infoPlanItem = infoFrontPlan.items[0];
      const infoBackgroundPoint = {
        x: infoPlanItem.protectionBounds.x - 1,
        y: infoPlanItem.protectionBounds.y + infoPlanItem.protectionBounds.height / 2,
      };
      const infoPixel = infoFront.pixel(infoBackgroundPoint.x, infoBackgroundPoint.y);
      const infoCopyPixel = infoFront.pixel(infoPlanItem.copyBounds.x - 1, infoPlanItem.copyBounds.y + infoPlanItem.copyBounds.height / 2);
      const infoInteriorPixel = infoFront.pixel(
        infoPlanItem.x + infoPlanItem.noteRadius + 2,
        infoPlanItem.y + infoPlanItem.noteRadius + 2,
      );
      const infoCornerPixel = infoFront.pixel(infoPlanItem.x + 0.5, infoPlanItem.y + 0.5);
      const infoEdgePixel = infoFront.pixel(infoPlanItem.x + infoPlanItem.width / 2, infoPlanItem.y);
      const collageFront = await render(infoFrontPlan, "collage");
      const scrapbookFront = await render(infoFrontPlan, "scrapbook");
      const collageSurfacePixel = collageFront.pixel(
        infoPlanItem.x + infoPlanItem.noteRadius + 2,
        infoPlanItem.y + infoPlanItem.noteRadius + 2,
      );
      const scrapbookSurfacePixel = scrapbookFront.pixel(
        infoPlanItem.x + infoPlanItem.noteRadius + 2,
        infoPlanItem.y + infoPlanItem.noteRadius + 2,
      );
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
        return Boolean(copy && protection && item.noteRadius > 0)
          && copy.x >= item.x && copy.y >= item.y
          && copy.x + copy.width <= item.x + item.width
          && copy.y + copy.height <= item.y + item.height
          && protection.x >= item.x && protection.y >= item.y
          && protection.x + protection.width <= item.x + item.width
          && protection.y + protection.height <= item.y + item.height
          && protection.x <= copy.x && protection.y <= copy.y
          && protection.x + protection.width >= copy.x + copy.width
          && protection.y + protection.height >= copy.y + copy.height
          && copy.x - protection.x >= 7 && copy.x - protection.x <= 10
          && copy.y - protection.y >= 7 && copy.y - protection.y <= 9
          && item.noteRadius <= Math.min(item.width / 2, item.height / 2);
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
      return {
        plan,
        personPixel,
        copyPixel,
        infoPixel,
        infoCopyPixel,
        infoInteriorPixel,
        infoCornerPixel,
        infoEdgePixel,
        collageSurfacePixel,
        scrapbookSurfacePixel,
        firstGlyphInkOffset,
        validPlanGeometry,
        protectedZoneMatches: Boolean(protectedZoneMatches),
        personBytes: personFront.blob.size,
        infoBytes: infoFront.blob.size,
        occupancySummary,
        hiddenLegacyPixel,
      };
    });

    assert.equal(result.plan.effectiveLayer, "person-front");
    assert.equal(result.plan.items.length, 18, "each character's core and accessory entries must reach the PNG plan");
    assert.ok(result.validPlanGeometry, "glyph and protection bounds stay inside each note with the planned breathing inset and shared logical radius");
    assert.ok(result.protectedZoneMatches, "foreground occupancy uses the wider protection bounds rather than the glyph bounds");
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
    assert.ok(result.personPixel[0] > 180 && result.personPixel[1] < 90, `person-front keeps the subject over note material outside the glyph protection inset: ${result.personPixel}`);
    assert.ok(result.copyPixel[0] > 235 && result.copyPixel[1] > 225 && result.copyPixel[2] > 215, `protected glyph breathing area stays opaque above the subject: ${result.copyPixel}`);
    assert.ok(result.infoPixel[0] > 235 && result.infoPixel[1] > 225 && result.infoPixel[2] > 215, `info-front note surface covers the subject: ${result.infoPixel}`);
    assert.ok(result.infoInteriorPixel[0] > 245 && result.infoInteriorPixel[1] > 235, `note interior uses its quiet opaque fill: ${result.infoInteriorPixel}`);
    assert.deepEqual(result.collageSurfacePixel.slice(0, 3), [244, 232, 215], "custom collage notes retain the existing archive-paper tint");
    assert.deepEqual(result.scrapbookSurfacePixel.slice(0, 3), [247, 240, 227], "custom scrapbook notes retain the existing blue-paper tint");
    assert.ok(result.firstGlyphInkOffset != null && result.firstGlyphInkOffset <= 4, `fallback PNG glyphs start at the planned top edge instead of vertical centering: ${result.firstGlyphInkOffset}`);
    assert.ok(result.infoEdgePixel[0] < result.infoInteriorPixel[0] - 18, `note has one subtle perimeter at its outer edge: ${result.infoEdgePixel} vs ${result.infoInteriorPixel}`);
    const innerEdgeDistance = Math.abs(result.infoCopyPixel[0] - result.infoInteriorPixel[0])
      + Math.abs(result.infoCopyPixel[1] - result.infoInteriorPixel[1])
      + Math.abs(result.infoCopyPixel[2] - result.infoInteriorPixel[2]);
    assert.ok(innerEdgeDistance < 8, `glyph bounds have no nested protection outline: ${result.infoCopyPixel} vs ${result.infoInteriorPixel}`);
    const cornerDistance = Math.abs(result.infoCornerPixel[0] - result.infoInteriorPixel[0])
      + Math.abs(result.infoCornerPixel[1] - result.infoInteriorPixel[1])
      + Math.abs(result.infoCornerPixel[2] - result.infoInteriorPixel[2]);
    assert.ok(cornerDistance > 10, `rounded note corner leaves the underlying card visible: ${result.infoCornerPixel} vs ${result.infoInteriorPixel}`);
    assert.ok(result.hiddenLegacyPixel[0] > 180 && result.hiddenLegacyPixel[1] < 90, `a hidden legacy core item must stay hidden without shifting its neighbors: ${result.hiddenLegacyPixel}`);
    console.log("PASS: CardPng keeps custom notes rounded and single-edged, preserves person/info layer order, and protects glyphs with planner clearance.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
