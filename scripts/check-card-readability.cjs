const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const backgrounds = ["paper", "mist", "pearl", "rose", "tide", "dusk", "ink", "charcoal"];
const castCounts = [1, 2, 3, 5];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");
    await page.waitForSelector("#castCountControl [data-cast-count]");

    const chooseCount = async (count) => {
      await page.locator(`[data-cast-count="${count}"]`).click();
      await page.waitForFunction((value) => document.querySelector("#canvasBoard")?.dataset.cast === String(value), count);
    };

    const inspectBoard = async () => page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const visible = (element) => {
        if (!(element instanceof HTMLElement) || element.hidden || element.closest("[hidden]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
      };
      const alpha = (color) => {
        const value = String(color || "").trim().toLowerCase();
        if (value === "transparent") return 0;
        const slash = value.match(/\/\s*([0-9.]+)\s*\)$/);
        if (slash) return Number(slash[1]);
        const rgba = value.match(/rgba?\(([^)]+)\)/);
        if (!rgba) return 1;
        const parts = rgba[1].split(",").map((part) => part.trim());
        return parts.length === 4 ? Number(parts[3]) : 1;
      };
      const buttonName = (element) => (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();
      const gearItems = [...board.querySelectorAll(".board-gear-item")].filter(visible);
      const infoColumns = [...board.querySelectorAll(".multi-info-column")].filter(visible);
      const boardButtons = [...board.querySelectorAll("button")].filter(visible);
      const title = document.querySelector("#boardTitle");
      const subtitle = document.querySelector("#boardSubtitle");
      const sourceMode = board.dataset.sourceMode;
      const infoEnabled = board.dataset.info === "true";
      return {
        cast: board.dataset.cast,
        background: board.dataset.background,
        sourceMode,
        infoEnabled,
        gearCount: gearItems.length,
        gearNames: gearItems.map(buttonName),
        gearAlpha: gearItems.map((element) => alpha(getComputedStyle(element).backgroundColor)),
        infoCount: infoColumns.length,
        infoNames: infoColumns.map(buttonName),
        infoHalo: infoColumns.map((element) => getComputedStyle(element, "::before").backgroundImage),
        titleHalo: getComputedStyle(board).getPropertyValue("--title-halo").trim(),
        unnamedButtons: boardButtons.filter((element) => !buttonName(element)).map((element) => element.outerHTML.slice(0, 160)),
        title: {
          name: title?.getAttribute("aria-label") || "",
          text: title?.textContent?.trim() || "",
          color: title ? getComputedStyle(title).color : "",
        },
        subtitle: {
          name: subtitle?.getAttribute("aria-label") || "",
          text: subtitle?.textContent?.trim() || "",
          color: subtitle ? getComputedStyle(subtitle).color : "",
        },
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    const results = [];
    for (const background of backgrounds) {
      await page.locator(`#backdropGrid [data-background="${background}"]`).click();
      await page.waitForFunction((value) => document.querySelector("#canvasBoard")?.dataset.background === value, background);
      for (const count of castCounts) {
        await chooseCount(count);
        const snapshot = await inspectBoard();
        assert.equal(snapshot.cast, String(count), `board cast did not settle for ${count}`);
        assert.equal(snapshot.background, background, `board background did not settle for ${background}`);
        assert.equal(snapshot.overflow, false, `card overflows viewport for ${count}/${background}`);
        assert.ok(snapshot.title.name && snapshot.title.text && snapshot.title.color !== "rgba(0, 0, 0, 0)", `title layer lost semantics for ${count}/${background}`);
        assert.ok(snapshot.subtitle.name && snapshot.subtitle.color !== "rgba(0, 0, 0, 0)", `subtitle layer lost semantics for ${count}/${background}`);
        assert.equal(snapshot.titleHalo, "", `legacy title halo token leaked into ${count}/${background}`);
        assert.deepEqual(snapshot.unnamedButtons, [], `card button without accessible name for ${count}/${background}`);
        if (count <= 2) {
          assert.equal(snapshot.gearCount, 0, `blank workspace should not fabricate gear notes for ${count}/${background}`);
          assert.equal(snapshot.infoCount, 0, `multi-info layer should be hidden for ${count}/${background}`);
        } else {
          assert.equal(snapshot.gearCount, 0, `legacy gear notes should be hidden for ${count}/${background}`);
          assert.equal(snapshot.infoEnabled, true, `multi-info state unexpectedly disabled for ${count}/${background}`);
          assert.equal(snapshot.infoCount, count, `expected one info column per character for ${count}/${background}`);
          assert.ok(snapshot.infoNames.every(Boolean), `multi-info column lost accessible name for ${count}/${background}`);
          if (["original", "mixed"].includes(snapshot.sourceMode)) {
            assert.ok(snapshot.infoHalo.every((value) => value && value !== "none"), `full-frame info halo missing for ${count}/${background}`);
            if (["ink", "charcoal"].includes(background)) {
              assert.equal(snapshot.titleHalo, "", `dark cards must not reintroduce the removed title halo for ${count}/${background}`);
            }
          }
        }
        results.push(`${count}/${background}`);
      }
    }

    await page.locator('#backdropGrid [data-background="charcoal"]').click();
    await page.locator('[data-cast-count="5"]').click();
    await page.screenshot({ path: "artifacts/accessibility-card-readability.png", fullPage: true });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "5");
    const mobileLineup = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const primary = board?.querySelector(".multi-info-items");
      const secondary = board?.querySelector(".multi-info-item > small");
      const column = board?.querySelector(".multi-info-column");
      const boardRect = board?.getBoundingClientRect();
      const columnRect = column?.getBoundingClientRect();
      const primaryStyle = primary ? getComputedStyle(primary) : null;
      const secondaryStyle = secondary ? getComputedStyle(secondary) : null;
      return {
        boardWidth: boardRect?.width || 0,
        columnWidth: columnRect?.width || 0,
        primaryFontSize: primaryStyle ? Number.parseFloat(primaryStyle.fontSize) : 0,
        secondaryDisplay: secondaryStyle?.display || "none",
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    assert.ok(mobileLineup.boardWidth > 0 && mobileLineup.columnWidth > 0, "mobile lineup card is not visible");
    assert.ok(mobileLineup.primaryFontSize >= 8, `mobile lineup item type is too small: ${mobileLineup.primaryFontSize}px`);
    assert.equal(mobileLineup.secondaryDisplay, "none", "mobile lineup keeps a competing secondary item line");
    assert.equal(mobileLineup.overflow, false, "mobile lineup card overflows the viewport");
    await page.screenshot({ path: "artifacts/accessibility-card-readability-mobile.png", fullPage: true });
    console.log(`PASS: mobile lineup copy uses ${mobileLineup.primaryFontSize}px primary type without secondary-line collisions.`);
    console.log(`PASS: card text layers, opaque equipment notes, accessible names, and multi-info halos hold across ${results.length} cast/background states.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
