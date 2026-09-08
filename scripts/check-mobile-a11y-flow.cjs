const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";

async function mobileLayout(page) {
  return page.evaluate(() => {
    const search = document.querySelector("#lookSearchField");
    const input = document.querySelector("#lookSearch");
    const toggle = document.querySelector("#mobileLookSearchToggle");
    const rail = document.querySelector(".rail");
    const stageWrap = document.querySelector(".stage-wrap");
    const searchRect = search?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const railRect = rail?.getBoundingClientRect();
    const stageWrapRect = stageWrap?.getBoundingClientRect();
    return {
      width: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      searchVisible: Boolean(searchRect && searchRect.width > 0 && searchRect.height > 0),
      searchRect: searchRect ? { left: searchRect.left, right: searchRect.right, top: searchRect.top, bottom: searchRect.bottom } : null,
      inputRect: inputRect ? { left: inputRect.left, right: inputRect.right, top: inputRect.top, bottom: inputRect.bottom } : null,
      canvasTop: stageWrapRect?.top ?? null,
      toggleExpanded: toggle?.getAttribute("aria-expanded"),
      activeId: document.activeElement?.id || "",
      railTop: railRect?.top ?? null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl);
    await page.waitForSelector("#canvasBoard");

    const [emptySlotChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator(".character-figure.is-empty").click(),
    ]);
    assert.equal(emptySlotChooser.isMultiple(), true, "empty canvas slot should open the multi-image picker");
    assert.equal(await page.locator(".character-empty-placeholder strong").textContent(), "사진 추가", "empty canvas slot should expose a direct photo action");

    // LOOK BOOK is intentionally collapsed on first visit. Open the rail
    // surface before checking its touch search affordance.
    await page.locator("#libraryToggleButton").click();
    await page.waitForFunction(() => document.querySelector("#libraryToggleButton")?.getAttribute("aria-expanded") === "true");
    const initial = await mobileLayout(page);
    assert.equal(await page.locator("#mobileLookSearchToggle").isVisible(), true, "mobile search toggle is visible");
    assert.equal(initial.searchVisible, false, "mobile look search starts collapsed");
    assert.equal(initial.width, initial.viewportWidth, `mobile page has horizontal overflow: ${JSON.stringify(initial)}`);

    await page.locator("#mobileLookSearchToggle").click();
    await page.waitForFunction(() => document.activeElement?.id === "lookSearch");
    await page.waitForFunction(() => {
      const search = document.querySelector("#lookSearchField")?.getBoundingClientRect();
      const canvas = document.querySelector(".stage-wrap")?.getBoundingClientRect();
      return search && canvas && search.bottom <= canvas.top + 1;
    });
    const opened = await mobileLayout(page);
    assert.equal(opened.toggleExpanded, "true", "mobile search toggle exposes its expanded state");
    assert.equal(opened.searchVisible, true, "mobile look search opens as a visible field");
    assert.equal(opened.activeId, "lookSearch", "opening mobile look search moves focus into the field");
    assert.ok(opened.searchRect.left >= 0 && opened.searchRect.right <= opened.viewportWidth, "mobile look search stays within the viewport");
    assert.ok(opened.canvasTop === null || opened.searchRect.bottom <= opened.canvasTop + 1, `mobile look search covers the canvas: ${JSON.stringify(opened)}`);

    await page.locator("#lookSearch").fill("새로운");
    assert.equal(await page.locator(".look-list-item:not([hidden])").count(), 1, "mobile look search filters the list");
    await page.keyboard.press("Escape");
    const escaped = await mobileLayout(page);
    assert.equal(escaped.searchVisible, false, "Escape closes mobile look search");
    assert.equal(escaped.activeId, "mobileLookSearchToggle", "Escape returns focus to the search trigger");

    await page.keyboard.press("Control+K");
    await page.waitForFunction(() => document.activeElement?.id === "lookSearch");
    assert.equal((await mobileLayout(page)).searchVisible, true, "Ctrl+K opens the mobile look search");
    await page.mouse.click(6, 360);
    const outside = await mobileLayout(page);
    assert.equal(outside.searchVisible, false, "outside click closes mobile look search");

    await page.locator("#itemsTab").click();
    await page.waitForTimeout(200);
    const itemSearch = await page.locator("#itemSearch").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const railRect = document.querySelector(".rail").getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, railTop: railRect.top, visible: rect.width > 0 && rect.height > 0 };
    });
    assert.equal(itemSearch.visible, true, "equipment search is visible after panel switch");
    assert.ok(itemSearch.bottom <= itemSearch.railTop - 12, `equipment search is covered by the mobile rail: ${JSON.stringify(itemSearch)}`);

    await page.locator("#styleTab").click();
    await page.locator('[data-cast-count="3"]').click();
    await page.locator("#multiCardControls").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("#multiCardControls").isVisible(), true, "lineup controls are visible on mobile");
    assert.equal(await page.locator('button[data-info-mode="clear"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#multiCardControls #multiInfoToggle").count(), 0, "card information visibility should stay out of lineup expression");
    assert.equal(await page.locator("#cardStyleSection #multiInfoToggle").count(), 1, "card information visibility should be discoverable in card settings");
    assert.equal(await page.locator('button[data-info-mode="silhouette"]').isDisabled(), true, "silhouette stays disabled before cutouts");
    assert.match(await page.locator("#infoModeHint").textContent(), /모든 캐릭터의 배경 제거/);

    await page.locator("#resetButton").click();
    await page.waitForFunction(() => document.activeElement?.id === "resetStylesButton");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "resetButton", "reset menu Escape restores trigger focus");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const persistentReset = await page.evaluate(() => {
      const header = document.querySelector(".inspector-header");
      const reset = document.querySelector("#resetButton");
      const rail = document.querySelector(".rail");
      const headerRect = header?.getBoundingClientRect();
      const resetRect = reset?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      const resetStyle = reset ? getComputedStyle(reset) : null;
      return {
        headerPosition: header ? getComputedStyle(header).position : "",
        headerTop: headerRect?.top ?? -1,
        headerBottom: headerRect?.bottom ?? -1,
        editorTabCount: document.querySelectorAll(".editor-section-nav").length,
        categoryHeadings: ["#imageSection", "#copyEditorSection", "#cardStyleSection"]
          .map((selector) => document.querySelector(`${selector} .panel-section-head h2`)?.textContent.trim()),
        resetTop: resetRect?.top ?? -1,
        resetBottom: resetRect?.bottom ?? -1,
        resetHeight: resetRect?.height ?? 0,
        railTop: railRect?.top ?? window.innerHeight,
        resetRadius: resetStyle?.borderRadius || "",
      };
    });
    assert.equal(persistentReset.headerPosition, "sticky", `mobile inspector header should stay available while scrolling: ${JSON.stringify(persistentReset)}`);
    assert.ok(persistentReset.headerTop >= 0 && persistentReset.resetTop >= 0, `reset action left the mobile viewport: ${JSON.stringify(persistentReset)}`);
    assert.equal(persistentReset.editorTabCount, 0, `mobile editor should not add a separate tab bar: ${JSON.stringify(persistentReset)}`);
    assert.deepEqual(persistentReset.categoryHeadings, ["이미지", "문구", "배경"], `mobile editor categories should remain explicit: ${JSON.stringify(persistentReset)}`);
    assert.ok(persistentReset.resetBottom <= persistentReset.railTop - 8, `reset action is covered by the mobile rail: ${JSON.stringify(persistentReset)}`);
    assert.ok(persistentReset.resetHeight >= 40, `reset action target is too small: ${JSON.stringify(persistentReset)}`);
    assert.equal(persistentReset.resetRadius, "6px", `reset action should use the shared mobile control radius: ${JSON.stringify(persistentReset)}`);

    await page.screenshot({ path: "artifacts/ui-mobile-a11y-flow-after.png", fullPage: false });
    console.log("PASS: mobile search, panel switching, lineup controls, rail clearance, and reset focus are keyboard and touch discoverable.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
