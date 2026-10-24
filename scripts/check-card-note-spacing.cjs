const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, locale: "ko-KR" });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.route("**/api/items/search**", route => route.fulfill({ json: { results: [] } }));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");
    await page.evaluate(() => {
      const look = getSelectedLook();
      const slots = ["head", "body", "hands", "legs", "feet"];
      const korean = ["서리빛 여행자의 모자", "한밤의 탐험가 외투", "은빛 실로 엮은 장갑", "도시 여행자의 바지", "별을 따라 걷는 장화"];
      const english = ["Frostbound Traveler Hat", "Midnight Explorer Coat", "Silverthread Gloves", "Urban Traveler Trousers", "Stargazer Boots"];
      slots.forEach((slot, index) => {
        const id = String(980001 + index);
        itemRecordCache.set(id, { id, slot, names: { ko: korean[index], en: english[index] } });
        look.outfits.forEach(outfit => { outfit[slot] = id; });
      });
      look.extraEquipment[0] = [
        ["earrings", "달빛 진주 귀걸이", "Moonlit Pearl Earrings"],
        ["necklace", "은하수 목걸이", "Milky Way Necklace"],
        ["bracelet", "작은 별 팔찌", "Little Star Bracelet"],
        ["ringLeft", "푸른 새벽 반지", "Blue Dawn Ring"],
        ["facewear", "얇은 테 안경", "Fine Frame Glasses"],
        ["fashion", "비 오는 날의 우산", "Rainy Day Parasol"],
      ].map(([slot, ko, en], index) => ({ id: `extra-spacing-${index}`, slot, names: { ko, en }, source: "manual", itemId: null, showOnCard: true }));
      state.language = "ko";
      state.characterCount = 1;
      state.selectedCharacter = 0;
      state.singleRatio = "portrait";
      state.characters[0].cutout = true;
      syncSelectedCharacter();
    });

    for (const singleLayout of ["info-left", "info-right"]) {
      for (const layer of ["info-front", "person-front"]) {
        for (const protectText of [true, false]) {
          await page.evaluate(({ singleLayout, layer, protectText }) => {
            state.singleLayout = singleLayout;
            getSelectedLook().cardComposition = { layer, protectText, infoGap: 20 };
            renderAll();
          }, { singleLayout, layer, protectText });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            renderCardCopyPreview();
          });
          const result = await page.evaluate(() => {
            const plan = compositionPlan;
            const board = document.querySelector("#canvasBoard").getBoundingClientRect();
            const scale = board.width / plan.dimensions.layoutWidth;
            // Exercise logical alignment even when this particular stylesheet
            // resolves the source to a physical `left` value.
            document.querySelectorAll("#boardGearList .gear-tile-copy > *").forEach(element => element.style.setProperty("text-align", "start", "important"));
            const gear = captureExportGearInfo(getCardGearByCharacter(), createSnapshot(), getExportDimensions(), plan);
            const glyphRect = element => {
              const range = document.createRange();
              range.selectNodeContents(element);
              return range.getBoundingClientRect();
            };
            return {
              items: plan.items.map(item => {
                const note = document.querySelector(`#boardGearList [data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`);
                const copy = note.querySelector(".gear-tile-copy");
                const primary = copy.querySelector("strong");
                const slot = copy.querySelector(".gear-slot-label");
                const secondary = copy.querySelector(".gear-item-secondary");
                const noteRect = note.getBoundingClientRect();
                const copyRect = copy.getBoundingClientRect();
                const primaryGlyph = glyphRect(primary);
                const slotGlyph = glyphRect(slot);
                const secondaryGlyph = glyphRect(secondary);
                const captured = gear[item.characterIndex][item.gearIndex].preview;
                const protection = note.querySelector(".gear-note-protection");
                const surfaceRoot = plan.effectiveLayer === "person-front" ? document.querySelector("#boardGearSurfaceLayer") : document.querySelector("#boardGearList");
                const surface = surfaceRoot.querySelector(`[data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"] .gear-note-surface`);
                return {
                  item,
                  insetX: (copyRect.left - noteRect.left) / scale,
                  insetY: (copyRect.top - noteRect.top) / scale,
                  glyphX: (primaryGlyph.left - board.left) / scale,
                  slotX: (slotGlyph.left - board.left) / scale,
                  secondaryX: (secondaryGlyph.left - board.left) / scale,
                  capturedX: captured?.primaryCopy?.lines?.[0]?.x,
                  capturedAlign: captured?.primaryCopy?.textAlign,
                  copyOutline: getComputedStyle(copy).outlineStyle,
                  protectionBorder: Number.parseFloat(getComputedStyle(protection).borderTopWidth),
                  protectionOutline: getComputedStyle(protection).outlineStyle,
                  surfaceBorder: Number.parseFloat(getComputedStyle(surface).borderTopWidth),
                  surfaceRadius: Number.parseFloat(getComputedStyle(surface).borderTopLeftRadius),
                };
              }),
              visibleCount: document.querySelectorAll("#boardGearList .board-gear-item").length,
              sourceCloneCount: document.querySelectorAll("#boardGearSurfaceLayer .board-gear-surface-item").length,
              gearStack: Number(getComputedStyle(document.querySelector("#boardGearList")).zIndex),
              portraitStack: Number(getComputedStyle(document.querySelector("#portraitWrap")).zIndex),
            };
          });
          const label = `${singleLayout}/${layer}/protect=${protectText}`;
          assert.equal(result.visibleCount, 11, `${label}: every selected item remains actionable`);
          assert.equal(result.sourceCloneCount, layer === "person-front" ? 11 : 0);
          assert.ok(result.gearStack > result.portraitStack, `${label}: glyphs must share PNG's foreground plane; protection controls their opaque backing`);
          for (const value of result.items) {
            assert.ok(value.item.height < 160, `${label}: ordinary labels must not stretch into tall cards`);
            assert.ok(value.item.width / value.item.height > 2.2, `${label}: ordinary notes must be slim horizontal labels`);
            assert.ok(value.insetX >= 18 && value.insetY >= 14, `${label}: real copy lacks safe padding`);
            assert.ok(Math.abs(value.slotX - value.glyphX) < 1 && Math.abs(value.secondaryX - value.glyphX) < 1, `${label}: slot, primary and translation left edges disagree`);
            assert.equal(value.capturedAlign, "left", `${label}: note side must not change glyph alignment`);
            assert.ok(Math.abs(value.capturedX - value.glyphX) < 1, `${label}: PNG/canvas anchors drift from the source glyphs`);
            assert.equal(value.copyOutline, "none", `${label}: glyph region must not add an inner border`);
            assert.equal(value.protectionBorder, 0, `${label}: text protection must be a fill, not a second frame`);
            assert.equal(value.protectionOutline, "none");
            assert.ok(value.surfaceBorder > 0, `${label}: the single perimeter must have a valid CSS length`);
            assert.ok(value.surfaceRadius > 0, `${label}: the visible surface must keep rounded corners`);
          }
          const left = result.items.filter(({ item }) => item.railSide === "left").sort((a, b) => a.item.y - b.item.y);
          const right = result.items.filter(({ item }) => item.railSide === "right").sort((a, b) => a.item.y - b.item.y);
          right.slice(0, Math.min(left.length, right.length)).forEach((value, index) => {
            assert.ok(Math.abs(value.item.y - left[index].item.y) < 0.1, `${label}: paired rows should share a top edge`);
            assert.ok(Math.abs(value.item.copyBounds.y - left[index].item.copyBounds.y) < 0.1, `${label}: paired copy must share its vertical anchor`);
          });
          for (const rail of [left, right]) {
            rail.slice(1).forEach((value, index) => assert.ok(value.item.y - (rail[index].item.y + rail[index].item.height) >= 20, `${label}: notes need real separation`));
          }
        }
      }
    }

    for (const { count, width } of [320, 375, 430, 768, 1600].flatMap(width => [1, 2, 3, 5].map(count => ({ count, width })))) {
      await page.evaluate(({ count, width }) => {
        state.characterCount = count;
        state.multiInfoEnabled = true;
        state.characters.slice(0, count).forEach(character => { character.cutout = true; });
        const look = getSelectedLook();
        look.title = width === 430 ? "별빛의여행자".repeat(11).slice(0, 64) : "고요한 새벽의 여행자";
        look.subtitle = "LAYOUT QA · 합성 이미지 / 가상 장비명";
        look.cardComposition = { layer: "person-front", protectText: true, infoGap: 20 };
        renderAll();
      }, { count, width });
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const board = document.querySelector("#canvasBoard");
        const canvas = document.querySelector("#boardCopyCanvas");
        return Math.abs(Number(canvas?.dataset.renderedBoardWidth) - board?.getBoundingClientRect().width) < 0.1;
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const mobile = await page.evaluate(() => {
        const bitmapBefore = elements.boardCopyCanvas.toDataURL();
        const header = captureExportCopy().slice(0, 2);
        const headerBottom = Math.max(...header.flatMap(copy => copy.lines.map(line => line.y + line.height)));
        const firstNoteTop = Math.min(...compositionPlan.items.map(item => item.y));
        renderCardCopyPreview();
        return { headerBottom, firstNoteTop, autoBitmapMatches: bitmapBefore === elements.boardCopyCanvas.toDataURL(), width: elements.board.getBoundingClientRect().width };
      });
      assert.ok(mobile.headerBottom + 4 < mobile.firstNoteTop, `${count}-person ${width}px header must clear the first note row: ${JSON.stringify(mobile)}`);
      assert.equal(mobile.autoBitmapMatches, true, `${count}-person ${width}px resize must capture after title fitting, without a manual redraw`);
      await page.setViewportSize({ width: 1600, height: 1080 });
    }
    await page.evaluate(() => { state.characterCount = 1; renderAll(); });

    const hiddenCapture = await page.evaluate(() => {
      const look = getSelectedLook();
      look.cardVisibility[0].head = false;
      look.extraEquipment[0][0].showOnCard = false;
      renderAll();
      const gear = captureExportGearInfo(getCardGearByCharacter(), createSnapshot(), getExportDimensions(), compositionPlan)[0];
      return gear.map(entry => ({ id: entry.id, name: entry.name, visible: entry.showOnCard, copy: entry.preview?.primaryCopy?.lines?.map(line => line.text).join("") || "" }));
    });
    assert.ok(hiddenCapture.filter(entry => !entry.visible).every(entry => !entry.copy), "hidden entries must never borrow another item's glyphs");
    assert.ok(hiddenCapture.filter(entry => entry.visible).every(entry => entry.copy.replace(/\s/gu, "") === entry.name.replace(/\s/gu, "")), "visible extras retain their raw-index copy association");

    const materialResults = await page.evaluate(() => {
      const look = getSelectedLook();
      state.characterCount = 2;
      state.characters[1].cutout = true;
      look.extraEquipment[1] = look.extraEquipment[0].map(entry => ({ ...entry, id: `${entry.id}-second`, names: { ...entry.names } }));
      look.cardComposition = { layer: "person-front", protectText: true, infoGap: 20 };
      renderAll();
      return ["collage", "scrapbook", "none", "collage"].map(pattern => {
        state.backgroundPattern = pattern;
        // Match the background control's incremental render, including a
        // pattern change that does not otherwise alter note geometry.
        renderStyles({ refreshInfo: false, fitTitle: false });
        const normalizeColor = value => { const probe = document.createElement("span"); probe.style.backgroundColor = value; return probe.style.backgroundColor; };
        return compositionPlan.items.map(item => {
          const selector = `[data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`;
          const expectedTint = CardMaterials.noteFor(pattern, item.gearIndex)?.tint || getComputedStyle(elements.board).getPropertyValue("--card-copy-protected-surface").trim();
          return {
            pattern,
            characterIndex: item.characterIndex,
            gearIndex: item.gearIndex,
            expected: normalizeColor(expectedTint),
            note: getComputedStyle(document.querySelector(`#boardGearList ${selector} .gear-note-protection`)).backgroundColor,
            surface: getComputedStyle(document.querySelector(`#boardGearSurfaceLayer ${selector} .gear-note-surface`)).backgroundColor,
          };
        });
      }).flat();
    });
    assert.ok(materialResults.some(item => item.characterIndex === 1 && item.gearIndex > 5), "material check covers a second character and extra items beyond the legacy palette count");
    materialResults.forEach(item => {
      assert.equal(item.note, item.expected, `protected material tint must use raw index: ${JSON.stringify(item)}`);
      assert.equal(item.surface, item.expected, `visible material tint must match PNG's raw-index palette: ${JSON.stringify(item)}`);
    });

    const lineupHiddenCopy = await page.evaluate(() => {
      const look = getSelectedLook();
      look.extraEquipment = Array.from({ length: 5 }, () => []);
      look.cardComposition = { layer: "info-front", protectText: true, infoGap: 0 };
      state.characterCount = 3;
      state.multiInfoEnabled = true;
      renderAll();
      const gear = captureExportGearInfo(getCardGearByCharacter(), createSnapshot(), getExportDimensions(), compositionPlan);
      return { isCustom: compositionPlan.isCustom, headCopy: gear[0][0].preview || null, bodyCopy: gear[0][1].preview?.primaryCopy?.lines?.map(line => line.text).join("") };
    });
    assert.equal(lineupHiddenCopy.isCustom, false);
    assert.equal(lineupHiddenCopy.headCopy, null, "legacy lineup may not substitute visible-order copy for a missing raw index");
    assert.ok(lineupHiddenCopy.bodyCopy.includes("탐험가"));
    assert.deepEqual(pageErrors, [], "layout rendering must not throw browser errors");
    console.log("PASS: slim aligned notes, real glyph padding/gutters, one border, info-right capture parity, and hidden-index isolation.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
