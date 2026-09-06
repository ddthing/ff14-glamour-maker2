const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const viewports = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "mobile", width: 320, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.addInitScript(() => localStorage.clear());
      await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
      await page.waitForSelector("#castSelector button");

      const visited = new Set();
      const requiredIds = ["exportButton", "styleTab", "libraryToggleButton", "cardTitleInput", "cardSubtitleInput", "titleFontSelect", "resetButton"];
      let firstNamedTarget = "";
      let cycleDetected = false;
      let focusedCount = 0;
      for (let step = 0; step < 140; step += 1) {
        await page.keyboard.press("Tab");
        const current = await page.evaluate(() => {
          const element = document.activeElement;
          if (!(element instanceof HTMLElement)) return null;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const hidden = element.hidden || Boolean(element.closest("[hidden]"));
          const visible = !hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          const focusable = element.matches("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])");
          const labelledBy = (element.getAttribute("aria-labelledby") || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.innerText || "")
            .join(" ");
          const labelText = element.labels ? Array.from(element.labels).map((label) => label.innerText || "").join(" ") : "";
          const name = (element.getAttribute("aria-label") || labelledBy || labelText || element.getAttribute("title") || element.innerText || element.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim();
          return {
            id: element.id,
            tag: element.tagName.toLowerCase(),
            className: element.className,
            name,
            visible,
            focusable,
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
            focusStyle: { outline: style.outlineStyle, boxShadow: style.boxShadow },
          };
        });
        if (!current || !current.focusable) continue;
        assert.ok(current.visible, `${viewport.label}: a focusable control is hidden or has no visible box (${current.id || current.className})`);
        focusedCount += 1;
        assert.ok(current.name, `${viewport.label}: focused control has no accessible name (${current.tag}#${current.id}.${current.className})`);
        assert.ok(current.rect.right > 0 && current.rect.left < viewport.width && current.rect.bottom > 0 && current.rect.top < viewport.height, `${viewport.label}: focus moved outside the viewport (${current.id || current.className})`);
        const targetKey = `${current.id || current.tag}:${current.name}`;
        if (!firstNamedTarget) firstNamedTarget = targetKey;
        else if (step > 20 && targetKey === firstNamedTarget) {
          cycleDetected = true;
          break;
        }
        visited.add(current.id || `${current.tag}.${current.className}`);
      }
      assert.ok(focusedCount >= 24, `${viewport.label}: keyboard route visited too few controls (${focusedCount})`);
      assert.ok(cycleDetected, `${viewport.label}: keyboard route did not complete a focus cycle within the guard limit`);
      for (const requiredId of requiredIds) {
        assert.ok(visited.has(requiredId), `${viewport.label}: ${requiredId} was not reachable by Tab`);
      }
      console.log(`${viewport.label}: ${focusedCount} named controls reachable by Tab (${visited.size} unique targets).`);
      await page.close();
    }
    console.log("PASS: desktop and mobile keyboard routes keep focus named and visible.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
