const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent("<!doctype html><html><head></head><body></body></html>");
    for (const file of ["crop-plan.js", "card-layout.js", "card-composition.js"]) {
      await page.addScriptTag({ path: path.join(__dirname, "..", "models", file) });
    }
    await page.addStyleTag({ path: path.join(__dirname, "..", "styles", "card-composer.css") });
    await page.addStyleTag({ path: path.join(__dirname, "..", "styles", "card-readability.css") });
    await page.addStyleTag({ content: `
      :root { --sans: Arial, sans-serif; --mono: monospace; --primary: #4263eb; }
      body { margin: 0; }
      .canvas-board#cssCompositionBoard { position: relative !important; width: 600px !important; height: 337.5px !important; container-type: inline-size !important; overflow: hidden; }
      .canvas-board#cssCompositionBoard #boardGearList { inset: 0 !important; }
    ` });

    const result = await page.evaluate(async () => {
      const characters = Array.from({ length: 5 }, () => ({ cutout: true }));
      const layout = CardLayout.layoutFor({ characterCount: 5, characters });
      const gearByCharacter = Array.from({ length: 5 }, (_, characterIndex) => Array.from({ length: 37 }, (_, index) => ({
        id: `extra-${characterIndex}-${index}`,
        itemId: `${characterIndex}-${index}`,
        slot: "accessory",
        slotName: "Accessory",
        extra: index >= 5,
        name: index % 3 === 0 ? "아".repeat(160) : index % 3 === 1 ? "W".repeat(160) : "🎤".repeat(160),
        secondaryName: `${"🎤".repeat(160)}\n${"W".repeat(160)}`,
      })));
      const plan = CardLayout.planComposition({
        characterCount: 5,
        characters,
        layout,
        composition: { layer: "info-front", protectText: true, infoGap: 64 },
        gearByCharacter,
        multiInfoEnabled: true,
        selectedCharacter: 0,
        language: "ko",
      });
      const board = document.createElement("div");
      board.id = "cssCompositionBoard";
      board.className = "canvas-board";
      board.dataset.ratio = "landscape";
      board.dataset.cast = "5";
      board.dataset.compositionCustom = "true";
      board.dataset.compositionLayer = "info-front";
      board.dataset.copyProtection = "true";
      const list = document.createElement("div");
      list.id = "boardGearList";
      list.className = "board-gear-list board-gear-tiles";
      const surfaceLayer = document.createElement("div");
      surfaceLayer.id = "boardGearSurfaceLayer";
      surfaceLayer.className = "board-gear-list board-gear-tiles board-gear-surface-layer";
      const surfaceItem = document.createElement("div");
      surfaceItem.className = "board-gear-item board-gear-surface-item";
      const splitSurface = document.createElement("span");
      splitSurface.className = "gear-note-surface";
      surfaceItem.append(splitSurface);
      surfaceLayer.append(surfaceItem);
      board.append(list, surfaceLayer);
      document.body.append(board);

      const { layoutWidth, layoutHeight } = layout.dimensions;
      for (const item of plan.items) {
        const button = document.createElement("button");
        button.className = `board-gear-item gear-slot-${item.slot}`;
        button.dataset.characterIndex = String(item.characterIndex);
        button.dataset.gearIndex = String(item.gearIndex);
        button.dataset.copyOverlap = item.characterIndex === 0 && item.gearIndex === 0 ? "true" : "false";
        const left = item.x / layoutWidth * 100;
        const top = item.y / layoutHeight * 100;
        const width = item.width / layoutWidth * 100;
        const height = item.height / layoutHeight * 100;
        const protection = item.protectionBounds;
        button.setAttribute("style", `left:${left}%;top:${top}%;width:${width}%;height:${height}%;--plan-slot-size:${item.copy.slotSize};--plan-primary-size:${item.copy.primarySize};--plan-secondary-size:${item.copy.secondarySize};--plan-slot-line-height:${item.copy.slotLineHeight};--plan-primary-line-height:${item.copy.primaryLineHeight};--plan-secondary-line-height:${item.copy.secondaryLineHeight};--plan-group-gap:${item.copy.groupGap};--plan-copy-left:${(item.copyBounds.x - item.x) / item.width * 100}%;--plan-copy-top:${(item.copyBounds.y - item.y) / item.height * 100}%;--plan-copy-width:${item.copyBounds.width / item.width * 100}%;--plan-copy-height:${item.copyBounds.height / item.height * 100}%;--plan-protection-left:${(protection.x - item.x) / item.width * 100}%;--plan-protection-top:${(protection.y - item.y) / item.height * 100}%;--plan-protection-width:${protection.width / item.width * 100}%;--plan-protection-height:${protection.height / item.height * 100}%;--material-note-tint:#f4e8d7`);
        const surface = document.createElement("span");
        surface.className = "gear-note-surface";
        const tape = document.createElement("span");
        tape.className = "gear-tile-tape";
        const stamp = document.createElement("span");
        stamp.className = "gear-note-stamp";
        const protectionElement = document.createElement("span");
        protectionElement.className = "gear-note-protection";
        const copy = document.createElement("div");
        copy.className = "gear-tile-copy";
        const slot = document.createElement("span");
        slot.className = "gear-slot-label";
        slot.textContent = item.slotName;
        const primary = document.createElement("strong");
        primary.textContent = item.name;
        primary.dataset.fullName = item.name;
        const secondary = document.createElement("small");
        secondary.className = "gear-item-secondary";
        secondary.dataset.fullName = item.secondaryName;
        item.secondaryName.split("\n").forEach((line, index) => {
          const translation = document.createElement("span");
          translation.className = "gear-name-translation";
          translation.dataset.language = index === 0 ? "ja" : "en";
          translation.textContent = line;
          secondary.append(translation);
        });
        copy.append(slot, primary, secondary);
        button.append(surface, tape, stamp, protectionElement, copy);
        list.append(button);
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.__firstCustomNoteButton = list.querySelector('.board-gear-item[data-character-index="0"][data-gear-index="0"]');

      const boardRect = board.getBoundingClientRect();
      const scale = boardRect.width / layoutWidth;
      const itemStats = plan.items.map((item) => {
        const button = list.querySelector(`.board-gear-item[data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`);
        const copy = button.querySelector(":scope > .gear-tile-copy");
        const slot = copy.querySelector(":scope > .gear-slot-label");
        const primary = copy.querySelector(":scope > strong");
        const secondary = copy.querySelector(":scope > .gear-item-secondary");
        const protection = button.querySelector(":scope > .gear-note-protection");
        const copyRect = copy.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const secondaryRect = secondary.getBoundingClientRect();
        const buttonStyle = getComputedStyle(button);
        return {
          item,
          actualPrimaryFont: Number.parseFloat(getComputedStyle(primary).fontSize),
          expectedPrimaryFont: item.copy.primarySize * scale,
          copyBounds: {
            left: (copyRect.left - boardRect.left) / scale,
            top: (copyRect.top - boardRect.top) / scale,
            width: copyRect.width / scale,
            height: copyRect.height / scale,
          },
          slotTop: (slotRect.top - boardRect.top) / scale,
          primaryBottom: (primaryRect.bottom - boardRect.top) / scale,
          secondaryBottom: (secondaryRect.bottom - boardRect.top) / scale,
          slotFont: Number.parseFloat(getComputedStyle(slot).fontSize),
          overflows: copy.scrollHeight > copy.clientHeight + 1
            || primary.scrollWidth > primary.clientWidth + 1
            || secondary.scrollWidth > secondary.clientWidth + 1,
          textVisible: primaryRect.width > 0 && primaryRect.height > 0 && getComputedStyle(primary).fontSize !== "0px",
          slotAlignment: getComputedStyle(slot).textAlign,
          primaryAlignment: getComputedStyle(primary).textAlign,
          secondaryAlignment: getComputedStyle(secondary).textAlign,
          labelFontSize: Number.parseFloat(getComputedStyle(slot).fontSize),
          primaryFontSize: Number.parseFloat(getComputedStyle(primary).fontSize),
          secondaryFontSize: Number.parseFloat(getComputedStyle(secondary).fontSize),
          surfaceDisplay: getComputedStyle(button.querySelector(":scope > .gear-note-surface")).display,
          tapeDisplay: getComputedStyle(button.querySelector(":scope > .gear-tile-tape")).display,
          stampDisplay: getComputedStyle(button.querySelector(":scope > .gear-note-stamp")).display,
          protectionDisplay: getComputedStyle(protection).display,
          protectionBackground: getComputedStyle(protection).backgroundImage,
          protectionOpacity: getComputedStyle(protection).opacity,
          buttonBackground: buttonStyle.backgroundColor,
          buttonBorder: buttonStyle.borderWidth,
          buttonShadow: buttonStyle.boxShadow,
          buttonPointerEvents: buttonStyle.pointerEvents,
          focusVisible: button.matches(":focus-visible"),
          focusOutline: buttonStyle.outlineWidth,
          focusOutlineStyle: buttonStyle.outlineStyle,
        };
      });
      const boundaryFailures = itemStats.filter(({ item, copyBounds, slotTop, primaryBottom, secondaryBottom }) => (
        Math.abs(copyBounds.left - item.copyBounds.x) > 1
        || Math.abs(copyBounds.top - item.copyBounds.y) > 1
        || Math.abs(copyBounds.width - item.copyBounds.width) > 1
        || Math.abs(copyBounds.height - item.copyBounds.height) > 1
        || Math.abs(slotTop - item.copyBounds.y) > 1
        || primaryBottom > item.copyBounds.y + item.copyBounds.height + 1
        || secondaryBottom > item.copyBounds.y + item.copyBounds.height + 1
      ));
      board.dataset.compositionLayer = "person-front";
      const personFrontSurfaceDisplay = getComputedStyle(splitSurface).display;
      const personFrontProtectionDisplay = getComputedStyle(window.__firstCustomNoteButton.querySelector(":scope > .gear-note-protection")).display;
      board.dataset.compositionLayer = "info-front";
      const infoFrontProtectionDisplay = getComputedStyle(window.__firstCustomNoteButton.querySelector(":scope > .gear-note-protection")).display;
      return {
        count: itemStats.length,
        scale,
        fontFailures: itemStats.filter(({ actualPrimaryFont, expectedPrimaryFont }) => Math.abs(actualPrimaryFont - expectedPrimaryFont) > 0.1).length,
        overflowCount: itemStats.filter(({ overflows }) => overflows).length,
        invisibleCount: itemStats.filter(({ textVisible }) => !textVisible).length,
        boundaryFailures: boundaryFailures.length,
        first: itemStats[0],
        second: itemStats.find(({ item }) => item.characterIndex === 0 && item.gearIndex === 1),
        firstFocused: itemStats.find(({ item }) => item.characterIndex === 0 && item.gearIndex === 0),
        personFrontSurfaceDisplay,
        personFrontProtectionDisplay,
        infoFrontProtectionDisplay,
        minimumPrimaryFont: Math.min(...itemStats.map(({ actualPrimaryFont }) => actualPrimaryFont)),
      };
    });
    await page.keyboard.press("Tab");
    result.firstFocused = {
      ...result.firstFocused,
      ...await page.evaluate(() => {
        const button = window.__firstCustomNoteButton;
        const style = getComputedStyle(button);
        return {
          focusVisible: button.matches(":focus-visible"),
          focusOutline: style.outlineWidth,
          focusOutlineStyle: style.outlineStyle,
        };
      }),
    };

    assert.equal(result.count, 185, "all five sets of 37 names get DOM copy boxes");
    assert.equal(result.fontFailures, 0, `planned unitless px metrics must scale to computed DOM fonts: ${JSON.stringify(result.first)}`);
    assert.equal(result.overflowCount, 0, `no long copy can overflow its rendered box: ${JSON.stringify(result.first)}`);
    assert.equal(result.invisibleCount, 0, "all planned names retain a nonzero DOM text box");
    assert.equal(result.boundaryFailures, 0, `DOM copy, first glyph top and line boxes match the shared plan: ${JSON.stringify(result.first)}`);
    assert.equal(result.first.surfaceDisplay, "none", "custom notes have no filled or bordered note surface");
    assert.equal(result.first.tapeDisplay, "none", "custom notes do not add tape decoration");
    assert.equal(result.first.stampDisplay, "none", "custom notes do not add stamp decoration");
    assert.equal(result.first.buttonBackground, "rgba(0, 0, 0, 0)", "custom note buttons remain visually transparent");
    assert.equal(result.first.buttonBorder, "0px", "custom note buttons have no visible rectangular border");
    assert.equal(result.first.buttonShadow, "none", "custom note buttons have no box shadow");
    assert.equal(result.first.buttonPointerEvents, "auto", "transparent note buttons retain their full click target");
    assert.equal(result.first.slotAlignment, "left", "slot labels stay left aligned");
    assert.equal(result.first.primaryAlignment, "left", "item names stay left aligned");
    assert.equal(result.first.secondaryAlignment, "left", "secondary names stay left aligned");
    assert.ok(result.first.labelFontSize < result.first.primaryFontSize, "slot label remains quieter than item name");
    assert.ok(result.first.secondaryFontSize < result.first.primaryFontSize, "secondary name remains quieter than item name");
    assert.equal(result.firstFocused.protectionDisplay, "block", "only an overlapping note gets its soft copy halo");
    assert.equal(result.firstFocused.protectionOpacity, "0.78", "soft copy halo uses the shared opacity");
    assert.match(result.firstFocused.protectionBackground, /radial-gradient/iu, "copy protection is feathered rather than a hard rectangle");
    assert.equal(result.second.protectionDisplay, "none", "a clear rail has no copy halo");
    assert.equal(result.personFrontSurfaceDisplay, "none", "split person-front surfaces have no note boxes");
    assert.equal(result.personFrontProtectionDisplay, "block", "person-front protection is available only for an overlapping note");
    assert.equal(result.infoFrontProtectionDisplay, "block", "info-front protection uses the same overlap-only halo rule");
    assert.ok(result.firstFocused.focusVisible, "custom note remains reachable with keyboard focus");
    assert.equal(result.firstFocused.focusOutline, "2px", "keyboard focus keeps its visible outline");
    assert.equal(result.firstFocused.focusOutlineStyle, "solid", "keyboard focus perimeter remains visible");
    console.log(`PASS: ${result.count} dense DOM cards match copy bounds and text hierarchy; surfaces, overlap halos and keyboard focus are correct.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
