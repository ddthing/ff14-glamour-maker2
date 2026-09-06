const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#backgroundArtPanel");

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

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(await page.locator("#backgroundArtPanel .background-art-choice").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "background cards ignore reduced-motion");
    assert.ok(await page.locator("#backgroundArtPanel .backdrop-swatch").first().evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration) < 0.001), "solid cards ignore reduced-motion");
    await page.locator("#backgroundArtPanel").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/ui-background-panel-after.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "background controls overflow at 320px");
    console.log("PASS: solid, pattern, and texture cards share selection geometry, independent state, reduced-motion behavior, and 320px reflow.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
