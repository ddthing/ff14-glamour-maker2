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
      const render = async (compositionPlan) => {
        const blob = await CardPng.render({
          state,
          dimensions: layout.dimensions,
          layout,
          compositionPlan,
          exportTheme,
          background: material,
          patternStars: [],
          images: [redImage, redImage, redImage],
          copyLayout: [],
          gear,
          outlineColor: "#ffffff",
        });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const pixel = (x, y) => Array.from(context.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data);
        bitmap.close();
        return { blob, pixel };
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
      const backgroundPoint = {
        x: Math.min(sample.x + sample.width - 4, sample.copyBounds.x + sample.copyBounds.width - 3),
        y: Math.max(sample.y + sample.height - 4, sample.copyBounds.y + sample.copyBounds.height - 3),
      };
      const protectedPoint = { x: sample.copyBounds.x + 4, y: sample.copyBounds.y + 4 };
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
      const infoPixel = infoFront.pixel(backgroundPoint.x, backgroundPoint.y);
      const infoPlanItem = infoFrontPlan.items[0];
      const infoCopyPixel = infoFront.pixel(infoPlanItem.copyBounds.x + 4, infoPlanItem.copyBounds.y + 4);
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
        personBytes: personFront.blob.size,
        infoBytes: infoFront.blob.size,
        occupancySummary,
        hiddenLegacyPixel,
      };
    });

    assert.equal(result.plan.effectiveLayer, "person-front");
    assert.equal(result.plan.items.length, 18, "each character's core and accessory entries must reach the PNG plan");
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
    assert.ok(result.personPixel[0] > 180 && result.personPixel[1] < 90, `person-front must keep the subject above note material outside the copy box: ${result.personPixel}`);
    assert.ok(result.copyPixel[0] > 180 && result.copyPixel[1] > 170 && result.copyPixel[2] > 150, `protected copy box must be opaque above the subject: ${result.copyPixel}`);
    assert.ok(result.infoPixel[0] > 200 && result.infoPixel[1] > 190 && result.infoPixel[2] > 180, `info-front note surface must cover the subject: ${result.infoPixel}`);
    assert.ok(result.infoCopyPixel[0] > 180 && result.infoCopyPixel[1] > 170, "info-front copy remains on its opaque protected surface");
    assert.ok(result.hiddenLegacyPixel[0] > 180 && result.hiddenLegacyPixel[1] < 90, `a hidden legacy core item must stay hidden without shifting its neighbors: ${result.hiddenLegacyPixel}`);
    console.log("PASS: CardPng uses the shared note plan, preserves person/info layer order, and protects copy pixels.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
