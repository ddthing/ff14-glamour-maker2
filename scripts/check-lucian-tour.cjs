const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    let fileChooserCount = 0;
    page.on("filechooser", () => { fileChooserCount += 1; });
    page.on("pageerror", (error) => { throw error; });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.LucianTour && document.querySelector("#editorTourButton")));
    await page.locator("#itemsTab").click();

    const trigger = page.locator("#editorTourButton");
    const overlay = page.locator("#editorTourOverlay");
    assert.equal(await overlay.isHidden(), true, "the guide must not open automatically");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    const lightTipColor = await page.evaluate(() => getComputedStyle(document.querySelector("#editorTourOverlay .u197-tip")).backgroundColor);

    await trigger.click();
    await page.waitForFunction(() => window.LucianTour.getState().open);
    assert.equal(await page.evaluate(() => document.body.classList.contains("u197-tour-active")), true, "opening the guide should disable the competing inspector intro motion");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#itemsPanel")).animationName), "none", "tour targets should remain in their final position while spotlighted");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#editorTourOverlay .u197-dots i").count(), 5, "the guide should have five real editor steps");
    assert.equal(await page.locator("#editorTourOverlay .u197-count").textContent(), "1 / 5");
    assert.match((await page.evaluate(() => window.LucianTour.getState().targetId)), /character-empty-mark/, "the photo step should point to the real add-photo control");
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-tour-next]")), true, "opening should focus the next-step control");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-tour-close]")), true, "Tab should stay within the guide controls");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-tour-next]")), true);
    await page.evaluate(() => document.querySelector("#lookManagerDialog").showModal());
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#lookManagerDialog").open);
    assert.equal(await page.evaluate(() => window.LucianTour.getState().open), true, "Escape should close a native dialog before the guide");
    await page.evaluate(() => document.querySelector("#languagePickerToggle").click());
    await page.waitForFunction(() => document.querySelector(".u267-picker")?.classList.contains("is-open"));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".u267-picker")?.classList.contains("is-open"));
    assert.equal(await page.evaluate(() => window.LucianTour.getState().open), true, "Escape should close the language picker before the guide");

    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("#editorTourButton .editor-tour-trigger-label")?.textContent === "How to use");
    assert.equal(await page.locator("#editorTourOverlay .u197-tip h2").textContent(), "Add a photo");
    await page.locator("#languageSelect").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    assert.equal(await page.locator("#editorTourButton .editor-tour-trigger-label").textContent(), "使い方");
    assert.equal(await page.locator("#editorTourOverlay .u197-tip h2").textContent(), "写真を追加");
    await page.locator("#languageSelect").selectOption("ko");
    await page.waitForFunction(() => document.documentElement.lang === "ko");

    await page.locator("#editorTourOverlay [data-tour-next]").click();
    assert.equal(await page.locator("#styleTab").getAttribute("aria-selected"), "true", "cast guidance should open the real Style panel");
    assert.equal((await page.evaluate(() => window.LucianTour.getState().targetId)), "castCountControl", "cast guidance should spotlight the whole cast control group");
    await page.locator("#editorTourOverlay [data-tour-next]").click();
    assert.equal(await page.locator("#itemsTab").getAttribute("aria-selected"), "true", "gear guidance should open the real Items panel");
    assert.equal((await page.evaluate(() => window.LucianTour.getState().targetId)), "itemSearch", "gear guidance should point at the live item search field");
    await page.locator("#itemSearch").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-tour-previous]")), true, "Tab from the real search target should remain in the tour");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "itemSearch", "reverse Tab should return to the spotlighted search target");
    await page.locator("#editorTourOverlay [data-tour-previous]").click();
    assert.equal(await page.locator("#styleTab").getAttribute("aria-selected"), "true", "Previous should restore the preceding guide step");
    await page.locator("#editorTourOverlay [data-tour-next]").click();
    const spotlightTravel = await page.evaluate(() => new Promise((resolve, reject) => {
      const startedAt = performance.now();
      let observedAnimation = false;
      const timeout = window.setTimeout(() => reject(new Error("spotlight travel did not settle within 5 seconds")), 5000);
      const sample = () => {
        const state = window.LucianTour.getState();
        if (state.animating) observedAnimation = true;
        if (observedAnimation && !state.animating) {
          window.clearTimeout(timeout);
          resolve({ duration: performance.now() - startedAt, observedAnimation, state });
          return;
        }
        requestAnimationFrame(sample);
      };
      window.LucianTour.next();
      observedAnimation = window.LucianTour.getState().animating;
      requestAnimationFrame(sample);
    }));
    assert.equal(spotlightTravel.observedAnimation, true, "a programmatic panel switch must preserve the #197 spotlight travel instead of jumping");
    assert.equal(spotlightTravel.state.stepIndex, 3);
    assert.equal(spotlightTravel.state.activePanel, "stylePanel", "the timed travel should cover the real Items→Style transition");
    assert.ok(spotlightTravel.duration >= 500, `the complete 520ms spotlight travel should be measured from before the real step transition: ${spotlightTravel.duration.toFixed(1)}ms`);

    await page.locator("#editorTourOverlay [data-tour-previous]").click();
    assert.equal(await page.evaluate(() => window.LucianTour.getState().animating), true, "changing steps should start a fresh spotlight travel before the reduced-motion preference changes");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => {
      const state = window.LucianTour.getState();
      return state.reducedMotion && !state.animating;
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const reducedMotionAlignment = await page.evaluate(() => {
      const target = document.querySelector("#itemSearch").getBoundingClientRect();
      const state = window.LucianTour.getState();
      const [x, y, width, height] = state.targetRect.split(",").map(Number);
      return {
        aligned: Math.abs(x - Math.max(0, target.left - 6)) <= 1
        && Math.abs(y - Math.max(0, target.top - 6)) <= 1
        && Math.abs(width - (Math.min(innerWidth, target.right + 6) - Math.max(0, target.left - 6))) <= 1
        && Math.abs(height - (Math.min(innerHeight, target.bottom + 6) - Math.max(0, target.top - 6))) <= 1,
        state,
        target: { left: target.left, top: target.top, right: target.right, bottom: target.bottom },
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { windowY: scrollY, documentTop: document.documentElement.scrollTop, documentHeight: document.documentElement.scrollHeight },
        panels: ["stylePanel", "itemsPanel"].map((id) => {
          const panel = document.getElementById(id);
          return { id, top: panel.getBoundingClientRect().top, scrollTop: panel.scrollTop, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, overflowY: getComputedStyle(panel).overflowY };
        }),
      };
    });
    assert.equal(reducedMotionAlignment.aligned, true, `switching to reduced motion during travel should cancel the RAF and paint the current target immediately: ${JSON.stringify(reducedMotionAlignment)}`);
    await page.locator("#editorTourOverlay [data-tour-next]").click();

    const desktopPalette = await page.evaluate(() => {
      const rect = document.querySelector("#backdropGrid").getBoundingClientRect();
      return rect.width <= innerWidth - 24 && rect.height <= innerHeight - 24;
    });
    const desktopTarget = await page.evaluate(() => window.LucianTour.getState().targetId);
    assert.equal(desktopTarget, desktopPalette ? "backdropGrid" : document.querySelector("#backdropGrid [data-background].is-selected")?.className, "appearance should spotlight the full visible palette, or the selected swatch if the full palette cannot fit");

    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForFunction(() => {
      const state = window.LucianTour.getState();
      const target = state.targetId === "backdropGrid"
        ? document.querySelector("#backdropGrid")
        : document.querySelector("#backdropGrid [data-background].is-selected");
      const tip = document.querySelector("#editorTourOverlay .u197-tip");
      if (!target || !tip || state.animating) return false;
      const rect = target.getBoundingClientRect();
      const [x, y, width, height] = state.targetRect.split(",").map(Number);
      const left = Math.max(0, Math.min(innerWidth, rect.left - 6));
      const top = Math.max(0, Math.min(innerHeight, rect.top - 6));
      const right = Math.max(left, Math.min(innerWidth, rect.right + 6));
      const bottom = Math.max(top, Math.min(innerHeight, rect.bottom + 6));
      const tipRect = tip.getBoundingClientRect();
      return Math.abs(x - left) <= 1
        && Math.abs(y - top) <= 1
        && Math.abs(width - (right - left)) <= 1
        && Math.abs(height - (bottom - top)) <= 1
        && tipRect.left >= 0 && tipRect.right <= innerWidth + 1
        && tipRect.top >= 0 && tipRect.bottom <= innerHeight + 1;
    }, null, { timeout: 5000 });
    const mobileGeometry = await page.evaluate(() => {
      const state = window.LucianTour.getState();
      const target = state.targetId === "backdropGrid"
        ? document.querySelector("#backdropGrid")
        : document.querySelector("#backdropGrid [data-background].is-selected");
      const targetRect = target.getBoundingClientRect();
      const [x, y, width, height] = state.targetRect.split(",").map(Number);
      const tip = document.querySelector("#editorTourOverlay .u197-tip").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        tipWithinViewport: tip.left >= 0 && tip.right <= innerWidth + 1 && tip.top >= 0 && tip.bottom <= innerHeight + 1,
        hole: { x, y, width, height },
        tip: { left: tip.left, right: tip.right, top: tip.top, bottom: tip.bottom },
      };
    });
    assert.equal(mobileGeometry.overflow, false, `the tour must not add horizontal scroll at 375px: ${JSON.stringify(mobileGeometry)}`);
    assert.equal(mobileGeometry.tipWithinViewport, true, `the tour tip should remain visible at 375px: ${JSON.stringify(mobileGeometry)}`);
    const manualScrollAlignment = await page.evaluate(() => new Promise((resolve) => {
      const before = window.scrollY;
      const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      window.scrollBy(0, before < maximum - 2 ? 24 : -24);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const state = window.LucianTour.getState();
        const target = state.targetId === "backdropGrid"
          ? document.querySelector("#backdropGrid")
          : document.querySelector("#backdropGrid [data-background].is-selected");
        const rect = target.getBoundingClientRect();
        const [x, y, width, height] = state.targetRect.split(",").map(Number);
        resolve({
          scrolled: Math.abs(window.scrollY - before) > 1,
          aligned: Math.abs(x - Math.max(0, rect.left - 6)) <= 1
            && Math.abs(y - Math.max(0, rect.top - 6)) <= 1
            && Math.abs(width - (Math.min(innerWidth, rect.right + 6) - Math.max(0, rect.left - 6))) <= 1
            && Math.abs(height - (Math.min(innerHeight, rect.bottom + 6) - Math.max(0, rect.top - 6))) <= 1,
        });
      }));
    }));
    assert.equal(manualScrollAlignment.scrolled, true, `the phone page should allow a real manual scroll: ${JSON.stringify(manualScrollAlignment)}`);
    assert.equal(manualScrollAlignment.aligned, true, `the spotlight should realign after a manual page scroll: ${JSON.stringify(manualScrollAlignment)}`);
    await page.evaluate(() => new Promise((resolve) => {
      let previous = null;
      let stableFrames = 0;
      const sample = () => {
        const tip = document.querySelector("#editorTourOverlay .u197-tip");
        const rect = tip.getBoundingClientRect();
        const position = [rect.x, rect.y, rect.width, rect.height];
        const stable = previous && position.every((value, index) => Math.abs(value - previous[index]) < 0.05);
        stableFrames = stable ? stableFrames + 1 : 0;
        previous = position;
        const moving = tip.getAnimations().some((animation) => animation.playState === "running");
        if (stableFrames >= 2 && !moving) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    const finalMobilePlacement = await page.evaluate(() => {
      const state = window.LucianTour.getState();
      const target = state.targetId === "backdropGrid"
        ? document.querySelector("#backdropGrid")
        : document.querySelector("#backdropGrid [data-background].is-selected");
      const targetRect = target.getBoundingClientRect();
      const tip = document.querySelector("#editorTourOverlay .u197-tip");
      const tipRect = tip.getBoundingClientRect();
      const [x, y, width, height] = state.targetRect.split(",").map(Number);
      const ring = { left: x, top: y, right: x + width, bottom: y + height };
      const overlaps = tipRect.left < ring.right && tipRect.right > ring.left && tipRect.top < ring.bottom && tipRect.bottom > ring.top;
      const margin = 12;
      const edge = 12;
      const fitsSide = targetRect.top - margin - edge >= tipRect.height
        || innerHeight - edge - targetRect.bottom - margin >= tipRect.height
        || targetRect.left - margin - edge >= tipRect.width
        || innerWidth - edge - targetRect.right - margin >= tipRect.width;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        aligned: Math.abs(x - Math.max(0, targetRect.left - 6)) <= 1
          && Math.abs(y - Math.max(0, targetRect.top - 6)) <= 1,
        tip: { left: tipRect.left, right: tipRect.right, top: tipRect.top, bottom: tipRect.bottom, width: tipRect.width, height: tipRect.height },
        side: ["dn", "up", "rt", "lt"].find((name) => tip.classList.contains(name)),
        arrowContent: getComputedStyle(tip, "::before").content,
        overflowY: getComputedStyle(tip).overflowY,
        overlaps,
        fitsSide,
      };
    });
    assert.equal(finalMobilePlacement.overflow, false, `the tour must not add horizontal scroll at 375px: ${JSON.stringify(finalMobilePlacement)}`);
    assert.equal(finalMobilePlacement.aligned, true, `the final spotlight should align to the real palette after manual scroll: ${JSON.stringify(finalMobilePlacement)}`);
    assert.notEqual(finalMobilePlacement.arrowContent, "none", "the Lucian speech-bubble tail should remain visible");
    assert.equal(finalMobilePlacement.overflowY, "visible", "the outer tip must not clip its speech-bubble tail");
    if (finalMobilePlacement.fitsSide) assert.equal(finalMobilePlacement.overlaps, false, `the tip must not occlude the spotlight when a side fits: ${JSON.stringify(finalMobilePlacement)}`);
    fs.mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/lucian-tour-375.png" });

    await page.locator("#editorTourOverlay [data-tour-next]").click();
    assert.equal((await page.evaluate(() => window.LucianTour.getState().targetId)), "exportButton", "the last guide step should point at the actual PNG export button");
    assert.equal(await page.locator("#editorTourOverlay [data-tour-next]").textContent(), "완료");
    assert.equal(fileChooserCount, 0, "opening and advancing the tour must never open a file chooser");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.LucianTour.getState().open);
    assert.equal(await page.evaluate(() => document.body.classList.contains("u197-tour-active")), false, "closing the guide should remove its motion scope");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#itemsPanel")).animationName), "panel-in", "the app's inspector intro motion should be restored after the guide closes");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "editorTourButton", "Escape should restore focus to the Usage trigger");
    assert.equal(await page.locator("#itemsTab").getAttribute("aria-selected"), "true", "closing should restore the original panel");

    await trigger.click();
    assert.equal(await page.locator("#editorTourOverlay .u197-count").textContent(), "1 / 5", "the Usage trigger should replay from the first step");
    await page.locator("#editorTourOverlay [data-tour-close]").click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "editorTourButton");

    await page.locator("#editorThemeToggle").click();
    await page.waitForFunction(() => document.documentElement.dataset.editorTheme === "dark");
    await trigger.click();
    const darkTipColor = await page.evaluate(() => getComputedStyle(document.querySelector("#editorTourOverlay .u197-tip")).backgroundColor);
    assert.notEqual(darkTipColor, lightTipColor, "the guide surface should follow the editor light/dark tokens");
    await page.locator("#editorTourOverlay [data-tour-close]").click();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => window.LucianTour.getState().reducedMotion);
    await trigger.click();
    assert.equal(await page.evaluate(() => window.LucianTour.getState().animating), false, "reduced motion should skip the spotlight travel animation");
    const pulseDuration = await page.evaluate(() => getComputedStyle(document.querySelector(".u197-ring"), "::after").animationDuration);
    assert.ok(pulseDuration.endsWith("s") && Number.parseFloat(pulseDuration) <= 0.00001, `reduced motion should disable the pulsing ring: ${pulseDuration}`);
    await page.locator("#editorTourOverlay [data-tour-close]").click();

    await page.locator("#styleTab").click();
    await page.locator('#castCountControl [data-cast-count="2"]').click();
    await page.locator("#imageInput").setInputFiles({ name: "tour-selected-character.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector('#portraitWrap [data-character-image-action="change"][data-character-image-action-index="0"]'));
    assert.equal(await page.evaluate(() => state.selectedCharacter), 0);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('#portraitWrap .character-figure[data-character-index="1"].is-empty'))), true, "the second character should remain empty for target selection");
    await trigger.click();
    const selectedFilledTarget = await page.evaluate(() => window.LucianTour.getState());
    assert.match(selectedFilledTarget.targetId, /character-image-action/, `a filled selected character should point at its own Change photo button: ${JSON.stringify(selectedFilledTarget)}`);
    assert.equal(selectedFilledTarget.targetIndex, "0", "an empty second slot must not steal the photo step from the selected filled character");
    await page.locator("#editorTourOverlay [data-tour-close]").click();

    assert.equal(fileChooserCount, 0);
    console.log(JSON.stringify({ status: "PASS", desktopPalette, desktopTarget, mobileGeometry, lightTipColor, darkTipColor }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
