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

    const soloLayerOrders = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const originalCutout = board.dataset.cutout;
      const originalRatio = board.dataset.ratio;
      board.dataset.cast = "1";
      const layers = {};
      ["portrait", "landscape"].forEach((ratio) => {
        board.dataset.ratio = ratio;
        ["true", "false"].forEach((cutout) => {
          board.dataset.cutout = cutout;
          layers[`${ratio}/${cutout}`] = {
            title: getComputedStyle(board.querySelector(".board-editorial-header")).zIndex,
            portrait: getComputedStyle(board.querySelector(".portrait-wrap")).zIndex,
            gear: getComputedStyle(board.querySelector(".board-gear-list")).zIndex,
          };
        });
      });
      board.dataset.cutout = originalCutout;
      board.dataset.ratio = originalRatio;
      return layers;
    });
    Object.entries(soloLayerOrders).forEach(([variant, layers]) => {
      assert.ok(Number(layers.gear) > Number(layers.portrait), `solo equipment information must sit above the photo for ${variant}: ${JSON.stringify(soloLayerOrders)}`);
      assert.ok(Number(layers.title) > Number(layers.gear), `solo title must remain above equipment information for ${variant}: ${JSON.stringify(soloLayerOrders)}`);
    });

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
      const emptyPlaceholders = [...board.querySelectorAll(".character-empty-placeholder")].filter(visible).map((element) => {
        const style = getComputedStyle(element);
        const mark = element.querySelector(".character-empty-mark")?.getBoundingClientRect();
        return {
          borderWidth: style.borderTopWidth,
          backgroundAlpha: alpha(style.backgroundColor),
          boxShadow: style.boxShadow,
          beforeDisplay: getComputedStyle(element, "::before").display,
          afterDisplay: getComputedStyle(element, "::after").display,
          markWidth: mark?.width || 0,
          markHeight: mark?.height || 0,
        };
      });
      const boardButtons = [...board.querySelectorAll("button")].filter(visible);
      const title = document.querySelector("#boardTitle");
      const subtitle = document.querySelector("#boardSubtitle");
      const copyright = document.querySelector("#boardCopyright");
      const boardRect = board.getBoundingClientRect();
      const copyrightRect = copyright?.getBoundingClientRect();
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
        emptyPlaceholders,
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
        copyright: {
          text: copyright?.textContent?.trim() || "",
          color: copyright ? getComputedStyle(copyright).color : "",
          display: copyright ? getComputedStyle(copyright).display : "none",
          visibility: copyright ? getComputedStyle(copyright).visibility : "hidden",
          width: copyrightRect?.width || 0,
          height: copyrightRect?.height || 0,
          leftInset: copyrightRect ? copyrightRect.left - boardRect.left : -1,
          rightInset: copyrightRect ? boardRect.right - copyrightRect.right : -1,
          bottomInset: copyrightRect ? boardRect.bottom - copyrightRect.bottom : -1,
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
        assert.equal(snapshot.copyright.text, "© SQUARE ENIX", `copyright notice missing for ${count}/${background}`);
        assert.equal(snapshot.copyright.display, "block", `copyright notice is not rendered for ${count}/${background}`);
        assert.equal(snapshot.copyright.visibility, "visible", `copyright notice is not visible for ${count}/${background}`);
        assert.ok(snapshot.copyright.width > 0 && snapshot.copyright.height > 0, `copyright notice has no layout box for ${count}/${background}`);
        assert.ok(snapshot.copyright.leftInset >= -1 && snapshot.copyright.rightInset >= -1 && snapshot.copyright.bottomInset >= -1, `copyright notice escapes the card for ${count}/${background}`);
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
        assert.equal(snapshot.emptyPlaceholders.length, count, `expected one frameless empty photo guide per character for ${count}/${background}`);
        snapshot.emptyPlaceholders.forEach((placeholder) => {
          assert.equal(placeholder.borderWidth, "0px", `empty photo guide still has a border for ${count}/${background}`);
          assert.equal(placeholder.backgroundAlpha, 0, `empty photo guide still has a background panel for ${count}/${background}`);
          assert.equal(placeholder.boxShadow, "none", `empty photo guide still has a box shadow for ${count}/${background}`);
          assert.equal(placeholder.beforeDisplay, "none", `empty photo guide still renders an inner frame for ${count}/${background}`);
          assert.equal(placeholder.afterDisplay, "none", `empty photo guide still renders a corner accent for ${count}/${background}`);
          assert.ok(placeholder.markWidth > 0 && placeholder.markHeight > 0, `empty photo guide lost its circular add affordance for ${count}/${background}`);
        });
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
      const column = board?.querySelector(".multi-info-column");
      const boardRect = board?.getBoundingClientRect();
      const columnRect = column?.getBoundingClientRect();
      const primaryStyle = primary ? getComputedStyle(primary) : null;
      const secondaryCount = [...(board?.querySelectorAll(".multi-info-item > small") || [])].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).length;
      return {
        boardWidth: boardRect?.width || 0,
        columnWidth: columnRect?.width || 0,
        primaryFontSize: primaryStyle ? Number.parseFloat(primaryStyle.fontSize) : 0,
        secondaryCount,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    assert.ok(mobileLineup.boardWidth > 0 && mobileLineup.columnWidth > 0, "mobile lineup card is not visible");
    assert.ok(mobileLineup.primaryFontSize >= 8, `mobile lineup item type is too small: ${mobileLineup.primaryFontSize}px`);
    assert.equal(mobileLineup.secondaryCount, 0, "blank mobile lineup should not fabricate secondary item names");
    assert.equal(mobileLineup.overflow, false, "mobile lineup card overflows the viewport");
    await page.screenshot({ path: "artifacts/accessibility-card-readability-mobile.png", fullPage: true });
    console.log(`PASS: mobile lineup copy uses ${mobileLineup.primaryFontSize}px primary type without empty secondary names or overflow.`);
    console.log(`PASS: card text layers, opaque equipment notes, accessible names, and multi-info halos hold across ${results.length} cast/background states.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
