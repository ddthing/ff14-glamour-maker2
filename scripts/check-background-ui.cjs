const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("background-ui-test-reset") !== "true") {
        localStorage.clear();
        sessionStorage.setItem("background-ui-test-reset", "true");
      }
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#backgroundArtPanel");
    assert.equal(await page.locator("#backgroundPresetPanel").count(), 0, "background preset panel must be retired");
    assert.equal(await page.locator("#saveBackgroundPresetButton").count(), 0, "background preset save action must be retired");
    assert.equal(await page.locator("#backgroundPresetForm").count(), 0, "background preset form must be retired");

    const initial = await page.evaluate(() => {
      const panel = document.querySelector("#backgroundArtPanel");
      const groups = [...panel.querySelectorAll('[role="radiogroup"]')].map((group) => {
        const radios = [...group.querySelectorAll('[role="radio"]')];
        return {
          selected: radios.filter((radio) => radio.getAttribute("aria-checked") === "true").length,
          tabbable: radios.filter((radio) => radio.tabIndex === 0).length,
        };
      });
      const choices = [...panel.querySelectorAll(".backdrop-swatch, .background-art-choice")].map((choice) => {
        const rect = choice.getBoundingClientRect();
        const preview = choice.querySelector(".background-art-preview");
        const previewRect = preview?.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          radius: getComputedStyle(choice).borderRadius,
          preview: previewRect ? { width: Math.round(previewRect.width), height: Math.round(previewRect.height) } : null,
          selected: choice.classList.contains("is-selected"),
          pseudoDisplay: getComputedStyle(choice, "::after").display,
          pseudoContent: getComputedStyle(choice, "::after").content,
        };
      });
      return { groups, choices, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });

    assert.equal(initial.groups.length, 3, "background controls should expose solid, pattern, and texture groups");
    assert.ok(initial.groups.every(({ selected, tabbable }) => selected === 1 && tabbable === 1), `radio group state drifted: ${JSON.stringify(initial.groups)}`);
    assert.equal(new Set(initial.choices.map(({ height }) => height)).size, 1, `background cards have mismatched heights: ${JSON.stringify(initial.choices)}`);
    assert.equal(new Set(initial.choices.map(({ radius }) => radius)).size, 1, `background cards have mismatched radii: ${JSON.stringify(initial.choices)}`);
    assert.ok(initial.choices.every(({ preview }) => preview?.width === 24 && preview?.height === 30), `background previews are inconsistent: ${JSON.stringify(initial.choices)}`);
    assert.ok(initial.choices.slice(0, 8).filter(({ selected }) => selected).every(({ pseudoDisplay }) => pseudoDisplay === "none"), "solid selection retains the legacy square pseudo-border");
    assert.equal(initial.overflow, false, "background controls introduce horizontal overflow");

    await page.locator('[data-background="charcoal"]').click();
    await page.locator('[data-pattern="dots"]').click();
    await page.locator('[data-texture="grain"]').click();
    const selected = await page.evaluate(() => ({
      background: document.querySelector("#canvasBoard").dataset.background,
      pattern: document.querySelector("#canvasBoard").dataset.backgroundPattern,
      texture: document.querySelector("#canvasBoard").dataset.backgroundTexture,
      groups: [...document.querySelectorAll('#backgroundArtPanel [role="radiogroup"]')].map((group) => [...group.querySelectorAll('[role="radio"]')].filter((radio) => radio.getAttribute("aria-checked") === "true").length),
    }));
    assert.deepEqual(selected, { background: "charcoal", pattern: "dots", texture: "grain", groups: [1, 1, 1] }, "background axis selection did not stay independent");

    const textureRecipes = [];
    for (const texture of ["risograph", "dust", "fiber", "halftone"]) {
      await page.locator(`[data-texture="${texture}"]`).click();
      await page.waitForFunction((expected) => document.querySelector("#canvasBoard")?.dataset.backgroundTexture === expected, texture);
      textureRecipes.push(await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard");
        const textureLayer = document.querySelector("#canvasBoard .scene-texture");
        const style = getComputedStyle(textureLayer);
        return {
          texture: board.dataset.backgroundTexture,
          opacity: style.opacity,
          backgroundImage: style.backgroundImage,
          textureInk: getComputedStyle(board).getPropertyValue("--texture-ink").trim(),
        };
      }));
    }
    assert.deepEqual(textureRecipes.map(({ texture }) => texture), ["risograph", "dust", "fiber", "halftone"], "new texture choices did not reach the live card");
    assert.ok(textureRecipes.every(({ opacity, backgroundImage }) => Number.parseFloat(opacity) > 0 && backgroundImage !== "none"), `texture overlay recipes are not painted: ${JSON.stringify(textureRecipes)}`);
    assert.equal(new Set(textureRecipes.map(({ textureInk }) => textureInk)).size, 1, `texture recipes should use one contrast-aware ink: ${JSON.stringify(textureRecipes)}`);
    assert.equal(textureRecipes[0].textureInk, "#ffffff", `dark solid textures should use the inverse ink: ${JSON.stringify(textureRecipes)}`);
    assert.ok(
      textureRecipes.every(({ backgroundImage }) => backgroundImage.includes("color(srgb 1 1 1")),
      `dark solid texture recipes still contain a second colour: ${JSON.stringify(textureRecipes)}`,
    );

    await page.locator('[data-background="custom"]').click();
    const customControl = await page.evaluate(() => ({
      background: document.querySelector("#canvasBoard").dataset.background,
      hidden: document.querySelector("#customBackgroundControl").hidden,
      input: document.querySelector("#customBackgroundColorInput").value,
      preview: getComputedStyle(document.querySelector("#customBackgroundPreview")).backgroundColor,
      recipeInk: getComputedStyle(document.querySelector("#canvasBoard")).getPropertyValue("--recipe-ink").trim(),
    }));
    assert.deepEqual(customControl, {
      background: "custom",
      hidden: false,
      input: "#f7f5f0",
      preview: "rgb(247, 245, 240)",
      recipeInk: "#263238",
    }, `custom background control did not open consistently: ${JSON.stringify(customControl)}`);
    await page.locator("#customBackgroundColorInput").evaluate((input) => {
      input.value = "#123456";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(240);
    const custom = await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3") || "null");
      return {
        background: document.querySelector("#canvasBoard").dataset.background,
        boardColor: getComputedStyle(document.querySelector("#sceneBackground")).backgroundColor,
        preview: getComputedStyle(document.querySelector("#customBackgroundPreview")).backgroundColor,
        input: document.querySelector("#customBackgroundColorInput").value,
        output: document.querySelector("#customBackgroundColorValue").textContent,
        recipeInk: getComputedStyle(document.querySelector("#canvasBoard")).getPropertyValue("--recipe-ink").trim(),
        storedColor: draft?.customBackgroundColor,
        storedLookColor: draft?.looks?.[0]?.customBackgroundColor,
      };
    });
    assert.equal(custom.background, "custom", `custom color changed the wrong background mode: ${JSON.stringify(custom)}`);
    assert.equal(custom.boardColor, "rgb(18, 52, 86)", `custom color did not reach the live card: ${JSON.stringify(custom)}`);
    assert.equal(custom.preview, "rgb(18, 52, 86)", `custom swatch preview drifted from the card: ${JSON.stringify(custom)}`);
    assert.equal(custom.input, "#123456", `custom picker value was not normalized: ${JSON.stringify(custom)}`);
    assert.equal(custom.output, "#123456", `custom picker readout was not updated: ${JSON.stringify(custom)}`);
    assert.equal(custom.recipeInk, "#f7f3ed", `custom dark surfaces did not switch copy to light ink: ${JSON.stringify(custom)}`);
    assert.equal(custom.storedColor, "#123456", `custom color was not persisted in the draft: ${JSON.stringify(custom)}`);
    assert.equal(custom.storedLookColor, "#123456", `custom color was not persisted in the selected look: ${JSON.stringify(custom)}`);

    await page.reload();
    await page.waitForSelector("#backgroundArtPanel");
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.background === "custom");
    const restoredCustom = await page.evaluate(() => ({
      background: document.querySelector("#canvasBoard").dataset.background,
      input: document.querySelector("#customBackgroundColorInput").value,
      output: document.querySelector("#customBackgroundColorValue").textContent,
      hidden: document.querySelector("#customBackgroundControl").hidden,
      boardColor: getComputedStyle(document.querySelector("#canvasBoard")).backgroundColor,
    }));
    assert.deepEqual(restoredCustom, {
      background: "custom",
      input: "#123456",
      output: "#123456",
      hidden: false,
      boardColor: "rgb(18, 52, 86)",
    }, `custom background did not survive reload: ${JSON.stringify(restoredCustom)}`);
    await page.locator("#backgroundArtPanel").screenshot({ path: "artifacts/ui-background-custom.png" });

    await page.locator('#backgroundArtPanel button[data-pattern="bitmap"]').click();
    await page.waitForFunction(() => {
      const pattern = document.querySelector("#scenePattern");
      const label = document.querySelector('[data-pattern="bitmap"] [data-i18n="pattern.bitmap"]');
      return Number.parseFloat(getComputedStyle(pattern).opacity) >= 0.24 && Boolean(label?.textContent.trim());
    });
    const checkerboard = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const pattern = document.querySelector("#scenePattern");
      const style = getComputedStyle(pattern, "::before");
      return {
        boardPattern: board.dataset.backgroundPattern,
        display: getComputedStyle(pattern).display,
        opacity: getComputedStyle(pattern).opacity,
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        label: document.querySelector('#backgroundArtPanel button[data-pattern="bitmap"] [data-i18n="pattern.bitmap"]')?.textContent.trim(),
      };
    });
    assert.equal(checkerboard.boardPattern, "bitmap", `checkerboard selection did not reach the card: ${JSON.stringify(checkerboard)}`);
    assert.equal(checkerboard.display, "block", `checkerboard preview is not painted: ${JSON.stringify(checkerboard)}`);
    assert.ok(Number.parseFloat(checkerboard.opacity) >= 0.24, `checkerboard preview is too faint: ${JSON.stringify(checkerboard)}`);
    assert.notEqual(checkerboard.backgroundImage, "none", `checkerboard preview has no painted tiles: ${JSON.stringify(checkerboard)}`);
    assert.notEqual(checkerboard.backgroundSize, "auto", `checkerboard preview has no tile size: ${JSON.stringify(checkerboard)}`);
    assert.match(checkerboard.label, /체커보드|Checkerboard|チェッカーボード/);

    const patternPreviewContract = await page.evaluate(() => {
      const read = (key) => {
        const preview = document.querySelector(`[data-pattern="${key}"] .background-art-preview`);
        const style = getComputedStyle(preview);
        const before = getComputedStyle(preview, "::before");
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          beforeWidth: before.width,
          beforeHeight: before.height,
          beforeBackground: before.backgroundColor,
          beforeShadow: before.boxShadow,
          afterDisplay: getComputedStyle(preview, "::after").display,
        };
      };
      return {
        monochrome: Object.fromEntries(["dots", "stars", "halftone", "bitmap"].map((key) => [key, read(key)])),
        materials: Object.fromEntries(["collage", "scrapbook"].map((key) => [key, read(key)])),
        ginghamLabel: document.querySelector('[data-pattern="halftone"] [data-i18n="pattern.halftone"]')?.textContent.trim(),
      };
    });
    const monochromeColors = Object.values(patternPreviewContract.monochrome).map(({ backgroundColor }) => backgroundColor);
    assert.equal(new Set(monochromeColors).size, 1, `motif previews should share one paper color: ${JSON.stringify(patternPreviewContract)}`);
    assert.ok(
      Object.entries(patternPreviewContract.monochrome)
        .filter(([key]) => key !== "stars")
        .every(([, preview]) => preview.backgroundImage !== "none"),
      `motif previews lost their monochrome paint: ${JSON.stringify(patternPreviewContract)}`,
    );
    assert.deepEqual(
      [patternPreviewContract.monochrome.stars.beforeWidth, patternPreviewContract.monochrome.stars.beforeHeight],
      ["18px", "18px"],
      "the star thumbnail should show one large star",
    );
    assert.equal(patternPreviewContract.monochrome.stars.beforeShadow, "none", "the star thumbnail should not carry secondary motifs");
    assert.equal(patternPreviewContract.monochrome.stars.afterDisplay, "none", "the star thumbnail should not carry a second pseudo motif");
    assert.notEqual(
      patternPreviewContract.materials.collage.backgroundColor,
      patternPreviewContract.monochrome.dots.backgroundColor,
      "memory fragments should retain their material color",
    );
    assert.notEqual(
      patternPreviewContract.materials.collage.backgroundColor,
      patternPreviewContract.materials.scrapbook.backgroundColor,
      "memory fragments and quiet blue should remain distinguishable",
    );
    assert.match(patternPreviewContract.ginghamLabel, /깅엄체크|Gingham Check|ギンガムチェック/);

    const textureColumns = {};
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      textureColumns[width] = await page.locator(".background-texture-grid").evaluate((grid) => {
        const columns = getComputedStyle(grid).gridTemplateColumns.trim();
        return columns ? columns.split(/\s+/u).length : 0;
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.deepEqual(textureColumns, { 1280: 3, 390: 3, 320: 3 }, `texture choices should stay in three columns: ${JSON.stringify(textureColumns)}`);

    const texturePreviewContract = await page.evaluate(() => {
      const read = (key) => {
        const preview = document.querySelector(`[data-texture="${key}"] .background-art-preview`);
        const style = getComputedStyle(preview);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          maskImage: style.maskImage,
        };
      };
      return Object.fromEntries(["none", "grain", "risograph", "dust", "fiber", "halftone"].map((key) => [key, read(key)]));
    });
    const texturePreviewColors = Object.values(texturePreviewContract).map(({ backgroundColor }) => backgroundColor);
    assert.equal(new Set(texturePreviewColors).size, 1, `texture previews should share one paper ground: ${JSON.stringify(texturePreviewContract)}`);
    assert.equal(texturePreviewContract.none.backgroundImage, "none", "the empty texture preview should stay solid");
    assert.ok(
      Object.entries(texturePreviewContract)
        .filter(([key]) => key !== "none")
        .every(([, preview]) => preview.backgroundImage !== "none" && preview.maskImage === "none"),
      `texture previews should show a visible mark without a fading mask: ${JSON.stringify(texturePreviewContract)}`,
    );

    const darkGearCardContract = await page.evaluate(() => {
      const records = [
        ["92001", "head", "먹빛 테스트 모자"],
        ["92002", "body", "차콜 테스트 상의"],
        ["92003", "hands", "질감 테스트 장갑"],
        ["92004", "legs", "기록 테스트 바지"],
        ["92005", "feet", "푸른 테스트 장화"],
      ];
      records.forEach(([id, slot, name]) => itemRecordCache.set(id, { id, slot, names: { ko: name, en: name, ja: name } }));
      const outfit = getSelectedLook().outfits[0];
      records.forEach(([id, slot]) => { outfit[slot] = id; });
      const results = [];
      for (const background of ["ink", "charcoal"]) {
        state.background = background;
        state.backgroundPattern = "none";
        state.backgroundTexture = "none";
        renderAll();
        const board = document.querySelector("#canvasBoard");
        const note = document.querySelector("#boardGearList .board-gear-item");
        const primary = note?.querySelector(".gear-tile-copy > strong");
        const slot = note?.querySelector(".gear-slot-label");
        const read = (element) => element ? getComputedStyle(element) : null;
        const noteStyle = read(note);
        const primaryStyle = read(primary);
        const slotStyle = read(slot);
        results.push({
          background,
          tone: board?.dataset.backgroundTone,
          noteBackground: noteStyle?.backgroundColor,
          noteBorder: noteStyle?.borderColor,
          primaryColor: primaryStyle?.color,
          slotColor: slotStyle?.color,
        });
      }
      return results;
    });
    assert.ok(
      darkGearCardContract.every(({ tone, noteBackground, noteBorder, primaryColor, slotColor }) =>
        tone === "dark"
        && noteBackground === "rgba(29, 34, 40, 0.94)"
        && noteBorder === "rgba(247, 243, 237, 0.22)"
        && primaryColor === "rgb(247, 243, 237)"
        && slotColor === "rgba(247, 243, 237, 0.62)"),
      `dark solid gear cards lost their inverse readability contract: ${JSON.stringify(darkGearCardContract)}`,
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(await page.locator("#backgroundArtPanel .background-art-choice").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "background cards ignore reduced-motion");
    assert.ok(await page.locator("#backgroundArtPanel .backdrop-swatch").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "solid cards ignore reduced-motion");
    await page.locator("#backgroundArtPanel").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/ui-background-panel-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
      null,
      { timeout: 1500, polling: "raf" },
    );
    const viewportFit = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      viewportFit.scrollWidth <= viewportFit.width,
      `background controls overflow at 320px: ${JSON.stringify(viewportFit)}`,
    );
    console.log("PASS: solid, pattern, and texture cards share selection geometry, independent state, reduced-motion behavior, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
