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
      board.append(list);
      document.body.append(board);

      const { layoutWidth, layoutHeight } = layout.dimensions;
      for (const item of plan.items) {
        const button = document.createElement("button");
        button.className = `board-gear-item gear-slot-${item.slot}`;
        button.dataset.characterIndex = String(item.characterIndex);
        button.dataset.gearIndex = String(item.gearIndex);
        const left = item.x / layoutWidth * 100;
        const top = item.y / layoutHeight * 100;
        const width = item.width / layoutWidth * 100;
        const height = item.height / layoutHeight * 100;
        button.setAttribute("style", `left:${left}%;top:${top}%;width:${width}%;height:${height}%;--plan-slot-size:${item.copy.slotSize};--plan-primary-size:${item.copy.primarySize};--plan-secondary-size:${item.copy.secondarySize};--plan-slot-line-height:${item.copy.slotLineHeight};--plan-primary-line-height:${item.copy.primaryLineHeight};--plan-secondary-line-height:${item.copy.secondaryLineHeight};--plan-group-gap:${item.copy.groupGap};--plan-copy-left:${(item.copyBounds.x - item.x) / item.width * 100}%;--plan-copy-top:${(item.copyBounds.y - item.y) / item.height * 100}%;--plan-copy-width:${item.copyBounds.width / item.width * 100}%;--plan-copy-height:${item.copyBounds.height / item.height * 100}%`);
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
        button.append(copy);
        list.append(button);
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const boardRect = board.getBoundingClientRect();
      const scale = boardRect.width / layoutWidth;
      const itemStats = plan.items.map((item) => {
        const button = list.querySelector(`.board-gear-item[data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`);
        const copy = button.querySelector(":scope > .gear-tile-copy");
        const slot = copy.querySelector(":scope > .gear-slot-label");
        const primary = copy.querySelector(":scope > strong");
        const secondary = copy.querySelector(":scope > .gear-item-secondary");
        const copyRect = copy.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const secondaryRect = secondary.getBoundingClientRect();
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
          primaryBottom: (primaryRect.bottom - boardRect.top) / scale,
          secondaryBottom: (secondaryRect.bottom - boardRect.top) / scale,
          slotFont: Number.parseFloat(getComputedStyle(slot).fontSize),
          overflows: copy.scrollHeight > copy.clientHeight + 1
            || primary.scrollWidth > primary.clientWidth + 1
            || secondary.scrollWidth > secondary.clientWidth + 1,
          textVisible: primaryRect.width > 0 && primaryRect.height > 0 && getComputedStyle(primary).fontSize !== "0px",
        };
      });
      const boundaryFailures = itemStats.filter(({ item, copyBounds, primaryBottom, secondaryBottom }) => (
        Math.abs(copyBounds.left - item.copyBounds.x) > 1
        || Math.abs(copyBounds.top - item.copyBounds.y) > 1
        || Math.abs(copyBounds.width - item.copyBounds.width) > 1
        || Math.abs(copyBounds.height - item.copyBounds.height) > 1
        || primaryBottom > item.copyBounds.y + item.copyBounds.height + 1
        || secondaryBottom > item.copyBounds.y + item.copyBounds.height + 1
      ));
      return {
        count: itemStats.length,
        scale,
        fontFailures: itemStats.filter(({ actualPrimaryFont, expectedPrimaryFont }) => Math.abs(actualPrimaryFont - expectedPrimaryFont) > 0.1).length,
        overflowCount: itemStats.filter(({ overflows }) => overflows).length,
        invisibleCount: itemStats.filter(({ textVisible }) => !textVisible).length,
        boundaryFailures: boundaryFailures.length,
        first: itemStats[0],
        minimumPrimaryFont: Math.min(...itemStats.map(({ actualPrimaryFont }) => actualPrimaryFont)),
      };
    });

    assert.equal(result.count, 185, "all five sets of 37 names get DOM copy boxes");
    assert.equal(result.fontFailures, 0, `planned unitless px metrics must scale to computed DOM fonts: ${JSON.stringify(result.first)}`);
    assert.equal(result.overflowCount, 0, `no long copy can overflow its rendered box: ${JSON.stringify(result.first)}`);
    assert.equal(result.invisibleCount, 0, "all planned names retain a nonzero DOM text box");
    assert.equal(result.boundaryFailures, 0, `DOM copy bounds and line boxes stay inside the shared plan: ${JSON.stringify(result.first)}`);
    console.log(`PASS: ${result.count} dense DOM cards match planned font sizes and copy bounds; minimum computed font ${result.minimumPrimaryFont}px.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
