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
