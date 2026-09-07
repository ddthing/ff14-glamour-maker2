const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#imageSection");

    const snapshot = await page.evaluate(() => {
      const section = document.querySelector("#imageSection");
      const visible = (element) => {
        if (!(element instanceof HTMLElement) || element.hidden || element.closest("[hidden]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
      };
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      };
      const buttons = [...section.querySelectorAll("button")].filter(visible).map((element) => {
        const box = element.getBoundingClientRect();
        return { id: element.id, label: element.getAttribute("aria-label") || element.textContent.trim(), width: Math.round(box.width), height: Math.round(box.height) };
      });
      const state = document.querySelector("#imageState");
      const stateStyle = getComputedStyle(state);
      const processing = document.querySelector("#cutoutButton");
      const progress = processing.querySelector(".cutout-progress");
      processing.classList.add("is-processing");
      const processingStyle = getComputedStyle(progress);
      const processingAnimation = processingStyle.animationName;
      const processingPseudo = { content: processingStyle.content, position: processingStyle.position, left: processingStyle.left, width: processingStyle.width, duration: processingStyle.animationDuration };
      const progressClassMatch = progress.matches(".cutout-action.is-processing .cutout-progress");
      processing.classList.remove("is-processing");
      return {
        imageState: { dataState: state.dataset.state, radius: stateStyle.borderRadius, height: Math.round(state.getBoundingClientRect().height) },
        sourceCard: rect(".portrait-source-card"),
        fitRow: rect(".image-fit-row"),
        transformRow: rect(".image-transform-row"),
        positionRow: rect(".image-position-row"),
        cutout: rect("#cutoutButton"),
        previewEmpty: rect("#portraitWrap .character-figure.is-empty"),
        buttons,
        processingAnimation,
        processingPseudo,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        progressClassMatch,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });

    assert.ok(["empty", "original", "cutout"].includes(snapshot.imageState.dataState), "image state has no visual state token");
    assert.equal(snapshot.imageState.radius, "999px", "image state should use the shared compact status shape");
    assert.ok(snapshot.sourceCard.width > 240 && snapshot.sourceCard.height >= 80, "source card collapsed below its readable working size");
    for (const row of ["fitRow", "transformRow", "positionRow"]) assert.ok(snapshot[row].height >= 36, `${row} lost the shared control rhythm`);
    assert.ok(snapshot.cutout.height >= 40, "cutout action lost its primary working height");
    assert.ok(snapshot.previewEmpty.width >= 160 && snapshot.previewEmpty.height >= 56, "preview image add target lost its working size");
    assert.ok(snapshot.buttons.every(({ height }) => height >= 32), `image control below 32px: ${JSON.stringify(snapshot.buttons)}`);
    assert.equal(snapshot.processingAnimation, "cutout-progress", `processing state has no progress motion: ${JSON.stringify({ ...snapshot.processingPseudo, reducedMotion: snapshot.reducedMotion, processingClass: snapshot.processingClass, progressClassMatch: snapshot.progressClassMatch })}`);
    assert.equal(snapshot.overflow, false, "image panel introduces horizontal overflow");

    await page.screenshot({ path: "artifacts/ui-image-panel-after.png", fullPage: true });
    console.log("PASS: image panel control rhythm, state styling, processing motion, and 1280px layout consistency.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
