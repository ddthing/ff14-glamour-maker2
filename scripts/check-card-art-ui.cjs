const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const draftStorageKey = "tuyeong-set-maker2-draft-v3";

function imageFile(dataUrl, index) {
  return {
    name: `card-art-subject-${index + 1}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
  };
}

async function readSavedLook(page, lookId) {
  return page.evaluate(async ({ key, id }) => {
    const saved = await draftStorage.readValue(key);
    return saved?.looks?.find((look) => look.id === id) || null;
  }, { key: draftStorageKey, id: lookId });
}

async function makeExtras(page, characterCount, itemCount) {
  const extras = Array.from({ length: 5 }, (_, characterIndex) => (
    characterIndex < characterCount
      ? Array.from({ length: itemCount }, (_, itemIndex) => ({
        id: `extra-art-ui-${characterIndex + 1}-${itemIndex + 1}`,
        slot: "custom",
        names: {
          ko: `카드 검증 장비 ${characterIndex + 1}-${itemIndex + 1}`,
          en: `Card check gear ${characterIndex + 1}-${itemIndex + 1}`,
          ja: `カード検証装備 ${characterIndex + 1}-${itemIndex + 1}`,
        },
        itemId: null,
        source: "manual",
        showOnCard: true,
      }))
      : []
  ));
  await page.evaluate((value) => {
    const look = getSelectedLook();
    look.extraEquipment = Equipment.normalizeExtras(value);
    serializedLookCache.delete(look);
    renderAll();
    saveState({ immediate: true });
  }, extras);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      acceptDownloads: true,
      locale: "ko-KR",
    });
    try {
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.route("**/api/items/search*", (route) => route.fulfill({ json: { results: [] } }));
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof CardArt !== "undefined"
        && typeof CardOrnaments !== "undefined"
        && typeof getSelectedLook === "function"
        && Boolean(document.querySelector("#cardArtRecipe")));

      assert.deepEqual(pageErrors, [], "the art controls and model scripts load without runtime errors");
      const initial = await page.evaluate(() => ({
        artEnabled: document.querySelector("#cardArtEnabled").checked,
        settingsDisabled: document.querySelector("#cardArtSettings").disabled,
        textOpen: document.querySelector("#cardArtTextDetails").open,
        decorationOpen: document.querySelector("#cardArtDecorationDetails").open,
        compositionOpen: document.querySelector("#compositionDetails").open,
        recipe: document.querySelector("#cardArtRecipe").value,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        densityTouchHeight: parseFloat(getComputedStyle(document.querySelector("#cardArtDensityRange")).minHeight),
      }));
      assert.equal(initial.artEnabled, false, "art starts disabled so existing card geometry remains the default");
      assert.equal(initial.settingsDisabled, true, "advanced controls are unavailable until card design is enabled");
      assert.equal(initial.recipe, "custom", "the default look is not misrepresented as a recipe");
      assert.equal(initial.textOpen, false, "text controls start progressively disclosed");
      assert.equal(initial.decorationOpen, false, "decoration controls start progressively disclosed");
      assert.equal(initial.compositionOpen, false, "legacy layer and spacing details start collapsed");
      assert.equal(initial.overflow, false, "the compact controls fit a 375px viewport");
      assert.ok(initial.densityTouchHeight >= 40, "range controls keep a 40px touch target");

      for (const [language, expectedLabel] of [["ko", "카드 스타일"], ["en", "Card style"], ["ja", "カードスタイル"]]) {
        await page.locator("#languageSelect").selectOption(language);
        assert.equal(await page.locator("label[for='cardArtRecipe'] > span").textContent(), expectedLabel, `${language} card style label is translated`);
        assert.ok(await page.locator("#cardArtRecipe option[value='catalog']").textContent() !== "cardArt.recipeCatalog", `${language} recipe label is translated`);
        assert.ok(await page.locator("#cardArtEnabled").getAttribute("aria-label") !== "cardArt.enabledAria", `${language} toggle has a translated accessible name`);
      }
      await page.locator("#languageSelect").selectOption("ko");

      const originalLookId = await page.evaluate(() => getSelectedLook().id);
      const legacyRatio = await page.evaluate(() => getCardLayout().ratio);
      await page.locator("#cardArtRecipe").focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.enabled === true);
      assert.equal(await page.locator("#cardArtRecipe").inputValue(), "catalog", "a native select responds to the keyboard");
      const afterCatalog = await page.evaluate(() => ({
        count: state.characterCount,
        ratio: getCardLayout().ratio,
        enabled: getSelectedLook().cardComposition.art.enabled,
      }));
      assert.equal(afterCatalog.count, 1, "choosing a recipe does not change the cast count");
      assert.equal(afterCatalog.ratio, "square", "the recipe applies its suggested card ratio");
      assert.equal(await page.locator("#cardArtBadgeField").isVisible(), false, "list-backdrop choices are hidden outside a footer layout");
      await page.locator("#cardArtEnabled").focus();
      await page.keyboard.press("Space");
      await page.waitForFunction(() => getSelectedLook().cardComposition.art.enabled === false);
      const disabledRecipe = await page.evaluate(() => ({
        ratio: getCardLayout().ratio,
        art: getSelectedLook().cardComposition.art,
        artCanvasHidden: document.querySelector("#boardArtCanvas").hidden,
        legacyPatternVisible: !document.querySelector("#scenePattern").hidden,
      }));
      assert.equal(disabledRecipe.ratio, legacyRatio, "turning art off restores the existing card ratio");
      assert.equal(disabledRecipe.art.layout, "center", "turning art off retains the chosen art settings");
      assert.equal(disabledRecipe.art.ratio, "square", "turning art off retains its suggested ratio for later");
      assert.equal(disabledRecipe.artCanvasHidden, true, "the art surface hides when art is disabled");
      assert.equal(disabledRecipe.legacyPatternVisible, true, "the existing pattern layer returns when art is disabled");

      await page.locator("#cardArtRecipe").selectOption("romantic");
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.layout === "footer");
      const recipeBackground = await page.evaluate(() => ({ background: state.background, pattern: state.backgroundPattern }));
      assert.deepEqual(recipeBackground, { background: "rose", pattern: "stripes" }, "a recipe applies its suggested background and pattern");
      await page.locator("#undoButton").click();
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.enabled === false
        && state.background === "paper"
        && state.backgroundPattern === "none");
      await page.locator("#redoButton").click();
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.layout === "footer"
        && state.background === "rose"
        && state.backgroundPattern === "stripes");
      await page.locator("#cardArtDecorationDetails > summary").click();
      assert.equal(await page.locator("#cardArtBadgeField").isVisible(), true, "list-backdrop choices are available after opening footer decoration controls");
      const historyBeforeScrub = await page.evaluate(() => state.history.length);
      await page.locator("#cardArtDensityRange").evaluate((input) => {
        input.value = "63";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = "79";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.density === 79);
      assert.equal(await page.evaluate(() => state.history.length), historyBeforeScrub + 1, "one continuous range scrub creates one undo entry");
      assert.equal(await page.evaluate(() => compositionRangeHistoryActive), true, "the pagehide check runs before the range gesture ends");
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await page.waitForFunction(async ({ key, id }) => {
        const saved = await draftStorage.readValue(key);
        return saved?.looks?.find((look) => look.id === id)?.cardComposition?.art?.density === 79;
      }, { key: draftStorageKey, id: originalLookId }, { timeout: 8000 });
      assert.equal(await page.evaluate(() => compositionRangeHistoryActive), true, "flushing a pending save does not end the scrub");
      await page.evaluate(() => finishCompositionRangeEdit());
      await page.locator("#undoButton").click();
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.density === 50);
      await page.locator("#redoButton").click();
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.density === 79);

      await page.locator("#libraryToggleButton").click();
      await page.locator("#addLookButton").click();
      await page.waitForFunction((id) => getSelectedLook().id !== id, originalLookId);
      const secondLookId = await page.evaluate(() => getSelectedLook().id);
      assert.notEqual(secondLookId, originalLookId, "a second look is created");
      assert.equal(await page.evaluate(() => CardArt.normalize(getSelectedLook().cardComposition.art).enabled), false, "a new look does not inherit the other look's art settings");
      await page.evaluate((id) => selectLook(id), originalLookId);
      await page.waitForFunction((id) => getSelectedLook().id === id && getSelectedLook().cardComposition.art?.density === 79, originalLookId);
      await page.evaluate(async () => { await draftAutosave.flush(); });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction((id) => typeof getSelectedLook === "function"
        && getSelectedLook().id === id
        && getSelectedLook().cardComposition.art?.density === 79, originalLookId);

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('[data-cast-count="3"]').click();
      const fixtureImages = await page.evaluate(() => Array.from({ length: 3 }, (_, index) => {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 700;
        const context = canvas.getContext("2d");
        const hues = ["#587c8f", "#9a6f62", "#71805b"];
        context.fillStyle = "#f1eee7";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = hues[index];
        context.beginPath();
        context.moveTo(178, 182);
        context.lineTo(302, 182);
        context.lineTo(360, 652);
        context.lineTo(128, 652);
        context.closePath();
        context.fill();
        context.fillStyle = "#d8b899";
        context.beginPath();
        context.arc(240, 126, 58, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#27333d";
        context.fillRect(184, 632, 42, 58);
        context.fillRect(254, 632, 42, 58);
        return canvas.toDataURL("image/png");
      }));
      await page.locator("#imageInput").setInputFiles(fixtureImages.map(imageFile));
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll("#portraitWrap .character-figure img")];
        return images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0);
      }, null, { timeout: 15000 });
      await makeExtras(page, 3, 7);
      await page.locator("#cardSubtitleInput").fill("Field notes from the summer lookbook");
      await page.locator("#cardArtRecipe").selectOption("tartan");
      await page.waitForFunction(() => compositionPlan?.items?.length === 21
        && getSelectedLook().cardComposition.art?.badge === "scallop"
        && getCardLayout().ratio === "lookbook");

      const weightValues = await page.evaluate(() => getTitleWeightOptions(state.titleFont).map(({ weight }) => weight));
      assert.ok(weightValues.length > 1, "the selected title font exposes named weight choices");
      await page.locator("#focusCardTitleButton").click();
      const titleWeightBeforeBold = await page.evaluate(() => state.titleWeight);
      await page.locator("#textEditorBoldButton").click();
      await page.waitForFunction((weight) => state.titleWeight !== weight, titleWeightBeforeBold);
      await page.locator("#textEditorColorInput").evaluate((input) => {
        input.value = "#18344a";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelector("#boardTitle").textContent.trim().length > 0);

      const preview = await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard");
        const rect = board.getBoundingClientRect();
        const title = document.querySelector("#boardTitle");
        const subtitle = document.querySelector("#boardSubtitle");
        const titleRect = title.getBoundingClientRect();
        const subtitleRect = subtitle.getBoundingClientRect();
        const layout = getCardLayout();
        return {
          ratio: rect.width / rect.height,
          expectedRatio: layout.dimensions.layoutWidth / layout.dimensions.layoutHeight,
          dimensions: layout.dimensions,
          artCanvas: { width: document.querySelector("#boardArtCanvas").width, height: document.querySelector("#boardArtCanvas").height },
          artEnabled: board.dataset.artEnabled,
          artPatternHandled: document.querySelector("#scenePattern").hidden,
          groupPanels: layout.groupPanels?.length || 0,
          gearItems: document.querySelectorAll("#boardGearList .board-gear-item.is-extra").length,
          planItems: compositionPlan.items.length,
          plannedItemKeys: compositionPlan.items.map((item) => `${item.characterIndex}:${item.gearIndex}`),
          titleVisible: titleRect.width > 0 && titleRect.height > 0,
          subtitleText: subtitle.textContent.trim(),
          subtitleVisible: subtitleRect.width > 0 && subtitleRect.height > 0,
          titleColor: getComputedStyle(title).color,
          titleWeight: getComputedStyle(title).fontWeight,
          storedTitleWeight: String(state.titleWeight),
        };
      });
      assert.equal(preview.artEnabled, "true", "the card preview opts into art mode");
      assert.equal(preview.artPatternHandled, true, "the art canvas takes ownership of the recipe pattern");
      assert.ok(Math.abs(preview.ratio - preview.expectedRatio) < 0.02, `the preview follows the selected 6:5 ratio: ${JSON.stringify(preview)}`);
      assert.equal(preview.artCanvas.width, preview.dimensions.exportWidth, "preview art uses export-resolution width");
      assert.equal(preview.artCanvas.height, preview.dimensions.exportHeight, "preview art uses export-resolution height");
      assert.equal(preview.groupPanels, 3, "the footer recipe gives each character a text panel");
      assert.equal(preview.gearItems, 21, "all selected equipment entries appear in the card preview");
      assert.equal(preview.planItems, 21, "the planner keeps all selected entries for PNG export");
      assert.equal(new Set(preview.plannedItemKeys).size, 21, "the preview/export plan has no duplicate item slots");
      assert.ok(preview.titleVisible, "the editorial title stays visible with art enabled");
      assert.equal(preview.subtitleText, "Field notes from the summer lookbook", "the subtitle remains attached to the title");
      assert.ok(preview.subtitleVisible, "the subtitle stays visible with art enabled");
      assert.equal(preview.titleColor, "rgb(24, 52, 74)", "an explicit title color remains active in art mode");
      assert.equal(preview.titleWeight, preview.storedTitleWeight, "the selected title weight remains active in art mode");

      await page.evaluate(() => {
        const original = CardPng.render;
        CardPng.render = async (options) => {
          const plan = options.compositionPlan || {};
          const art = plan.art || options.state.cardComposition?.art || {};
          window.__cardArtPngCapture = {
            dimensions: { ...options.dimensions },
            layoutRatio: options.layout.ratio,
              backgroundPattern: options.state.backgroundPattern,
            art: { ...art },
            groupPanels: (plan.groupPanels || []).map((panel) => ({ characterIndex: panel.characterIndex, shape: panel.shape })),
            plannedItemKeys: (plan.items || []).map((item) => `${item.characterIndex}:${item.gearIndex}`),
            gearCounts: options.gear.map((items) => items.length),
            copyTextLines: (options.copyLayout || []).flatMap((entry) => entry.lines || []).map((line) => line.text),
          };
          return original(options);
        };
      });
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await page.locator("#exportButton").click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      assert.ok(downloadPath, "the art card exports as a local PNG download");
      const pngBytes = fs.readFileSync(downloadPath);
      const pngDimensions = await page.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const result = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      }, pngBytes.toString("base64"));
      const pngCapture = await page.evaluate(() => window.__cardArtPngCapture);
      assert.deepEqual(pngDimensions, { width: 2400, height: 2000 }, "the PNG export uses the selected lookbook ratio and resolution");
      assert.equal(pngCapture.layoutRatio, "lookbook", "PNG export receives the art layout ratio");
      assert.equal(pngCapture.art.layout, "footer", "PNG export receives the selected footer layout");
      assert.equal(pngCapture.art.textAlign, "center", "PNG export receives the chosen copy alignment");
      assert.equal(pngCapture.art.badge, "scallop", "PNG export receives the selected list backdrop shape");
      assert.equal(pngCapture.groupPanels.length, 3, "PNG export receives all three list panels");
      assert.deepEqual(pngCapture.gearCounts.slice(0, 3), [7, 7, 7], "PNG export receives every selected item for each active character");
      assert.equal(pngCapture.plannedItemKeys.length, 21, "PNG export keeps the full selected-entry plan");
      assert.ok(pngCapture.copyTextLines.includes("새로운 룩"), "PNG export retains the title while its header is visible");
      assert.ok(pngCapture.copyTextLines.includes("Field notes from the summer lookbook"), "PNG export retains the subtitle while its title header is visible");

      await page.locator("#cardArtTextDetails > summary").click();
      await page.locator("#cardArtTitlePlacement").selectOption("hidden");
      await page.waitForFunction(() => getSelectedLook().cardComposition.art?.titlePlacement === "hidden");
      const hiddenHeader = await page.evaluate(() => ({
        display: getComputedStyle(document.querySelector(".board-editorial-header")).display,
        copy: captureExportCopy().flatMap((entry) => entry.lines || []).map((line) => line.text),
      }));
      assert.equal(hiddenHeader.display, "none", "the hidden-title choice hides the full editorial header");
      assert.ok(!hiddenHeader.copy.includes("새로운 룩"), "a hidden title is not captured into the PNG copy layer");
      assert.ok(!hiddenHeader.copy.includes("Field notes from the summer lookbook"), "a hidden title also hides its subtitle in PNG copy capture");
      await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
      const hiddenDownloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await page.locator("#exportButton").click();
      await hiddenDownloadPromise;
      const hiddenPngCapture = await page.evaluate(() => window.__cardArtPngCapture);
      assert.ok(!hiddenPngCapture.copyTextLines.includes("Field notes from the summer lookbook"), "PNG export omits the subtitle with a hidden title placement");

      await page.locator('button[data-pattern="none"]').click();
      await page.waitForFunction(() => state.backgroundPattern === "none");
      await page.locator("label.card-art-enabled-toggle").click();
      await page.waitForFunction(() => document.querySelector("#canvasBoard").dataset.artEnabled === "false");
      const disabledGeometry = await page.evaluate(() => ({
        ratio: getCardLayout().ratio,
        art: getSelectedLook().cardComposition.art,
        count: state.characterCount,
        entries: getCardGearByCharacter().slice(0, state.characterCount).map((items) => items.length),
        composedImages: [...document.querySelectorAll("#portraitWrap .character-figure img")].filter((image) => image.dataset.compositionPlaced === "true").length,
        artCanvasHidden: document.querySelector("#boardArtCanvas").hidden,
        scenePatternHidden: document.querySelector("#scenePattern").hidden,
      }));
      assert.equal(disabledGeometry.ratio, "landscape", "disabling card art restores the existing three-person ratio");
      assert.equal(disabledGeometry.art.layout, "footer", "the selected art layout is preserved when disabled");
      assert.equal(disabledGeometry.art.ratio, "lookbook", "the selected art ratio is preserved when disabled");
      assert.equal(disabledGeometry.art.badge, "scallop", "the list backdrop setting is preserved when disabled");
      assert.equal(disabledGeometry.count, 3, "disabling art does not change the cast");
      assert.deepEqual(disabledGeometry.entries, [7, 7, 7], "disabling art does not remove equipment data");
      assert.equal(disabledGeometry.composedImages, 0, "disabling art restores legacy image placement");
      assert.equal(disabledGeometry.artCanvasHidden, true, "the ornament canvas is hidden when disabled");
      assert.equal(disabledGeometry.scenePatternHidden, false, "the normal pattern layer is restored when disabled");

      await page.locator('button[data-pattern="stripes"]').click();
      await page.waitForFunction(() => document.querySelector("#canvasBoard").dataset.artEnabled === "false"
        && document.querySelector("#canvasBoard").dataset.artPatternOnly === "true"
        && !document.querySelector("#boardArtCanvas").hidden
        && document.querySelector("#scenePattern").hidden);
      const legacyPattern = await page.evaluate(() => {
        const canvas = document.querySelector("#boardArtCanvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] > 0) painted += 1;
        return {
          ratio: getCardLayout().ratio,
          artEnabled: getSelectedLook().cardComposition.art.enabled,
          pattern: state.backgroundPattern,
          pixels: painted,
        };
      });
      assert.equal(legacyPattern.ratio, "landscape", "a pattern-only render does not change the existing card ratio");
      assert.equal(legacyPattern.artEnabled, false, "a pattern-only render does not enable card artwork");
      assert.equal(legacyPattern.pattern, "stripes", "the background button keeps its selected pattern");
      assert.ok(legacyPattern.pixels > 0, "stripes paint into the live preview even with card art disabled");

      await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
      const legacyPatternDownloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await page.locator("#exportButton").click();
      const legacyPatternDownload = await legacyPatternDownloadPromise;
      const legacyPatternPath = await legacyPatternDownload.path();
      const legacyPatternBytes = fs.readFileSync(legacyPatternPath);
      const legacyPatternDimensions = await page.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const result = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      }, legacyPatternBytes.toString("base64"));
      const legacyPatternCapture = await page.evaluate(() => window.__cardArtPngCapture);
      assert.deepEqual(legacyPatternDimensions, { width: 2400, height: 1350 }, "pattern-only PNG keeps the legacy landscape dimensions");
      assert.equal(legacyPatternCapture.backgroundPattern, "stripes", "pattern-only PNG passes the existing background selection through");
      assert.equal(legacyPatternCapture.art.enabled, false, "pattern-only PNG leaves saved art disabled");

      const savedFirstLook = await readSavedLook(page, originalLookId);
      assert.equal(savedFirstLook?.cardComposition?.art?.enabled, false, "the current per-look art toggle autosaves");
      assert.equal(savedFirstLook?.extraEquipment?.[0]?.length, 7, "the art controls leave registered equipment intact");
      assert.deepEqual(pageErrors, [], "the art preview and PNG flow produce no browser errors");
      console.log("PASS: card-art controls are localized, keyboard/touch accessible, per-look persistent, undo-grouped, and shared with preview and PNG export.");
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
