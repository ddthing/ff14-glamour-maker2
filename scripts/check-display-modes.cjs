const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const viewports = [
  { width: 320, height: 800, label: "320px" },
  { width: 640, height: 900, label: "640px" },
  { width: 1280, height: 900, label: "desktop" },
];
const focusTargets = [
  "#lookSearch",
  "#styleTab",
  "#exportButton",
  "#imageDropZone",
  "#focusCanvasButton",
  "#boardTitle",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active", colorScheme: "dark" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");

    const snapshots = [];
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const snapshot = await page.evaluate((label) => {
        const visible = (element) => {
          if (!(element instanceof HTMLElement) || element.hidden || element.closest("[hidden]")) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
        };
        const controls = [...document.querySelectorAll("button, input, select, textarea, [contenteditable='true'], a[href]")].filter(visible);
        const smallTargets = controls.map((element) => {
          const rect = element.getBoundingClientRect();
          return { id: element.id, className: String(element.className || ""), width: Math.round(rect.width), height: Math.round(rect.height), text: (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) };
        }).filter(({ width, height }) => width < 24 || height < 24);
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const forcedColors = matchMedia("(forced-colors: active)").matches;
        return {
          label,
          reducedMotion,
          forcedColors,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          smallTargets,
          controlCount: controls.length,
        };
      }, viewport.label);
      const unhandledSmallTargets = snapshot.smallTargets.filter(({ id, className }) => id !== "boardSubtitle" && !className.split(/\s+/).includes("caption-description"));
      assert.deepEqual(unhandledSmallTargets, [], `interactive target below 24px at ${viewport.label}: ${JSON.stringify(unhandledSmallTargets)}`);
      snapshots.push(snapshot);

      for (const selector of focusTargets) {
        const target = page.locator(selector);
        if (!(await target.count()) || !(await target.isVisible())) continue;
        // Reach the control through real Tab input so `:focus-visible` is
        // evaluated the same way a keyboard user sees it.
        await page.locator(".skip-link").focus();
        let reached = false;
        for (let step = 0; step < 180; step += 1) {
          await page.keyboard.press("Tab");
          reached = await target.evaluate((element) => element === document.activeElement);
          if (reached) break;
        }
        assert.equal(reached, true, `could not reach ${selector} with Tab at ${viewport.label}`);
        const focus = await target.evaluate((element) => {
          const style = getComputedStyle(element);
          return { focusVisible: element.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, borderWidth: style.borderWidth, boxShadow: style.boxShadow };
        });
        assert.notEqual(focus.outlineStyle, "none", `focus outline missing for ${selector} at ${viewport.label}`);
        assert.ok(focus.outlineWidth !== "0px" || focus.borderWidth !== "0px" || focus.boxShadow !== "none", `focus indicator has no visible style for ${selector} at ${viewport.label}`);
      }
    }

    assert.ok(snapshots.every((snapshot) => snapshot.reducedMotion), "reduced-motion media query was not active");
    assert.ok(snapshots.every((snapshot) => snapshot.forcedColors), "forced-colors media query was not active");
    assert.ok(snapshots.every((snapshot) => !snapshot.overflow), "display mode introduced horizontal overflow");
    console.log(`PASS: reduced motion, forced colors, focus rings, and reflow hold at ${snapshots.map((snapshot) => snapshot.label).join(", ")}.`);
    console.log(JSON.stringify(snapshots.map(({ label, controlCount, smallTargets }) => ({ label, controlCount, smallTargets })), null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
