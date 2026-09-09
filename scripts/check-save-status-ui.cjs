const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://127.0.0.1:4173/?save-status-ui-check=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#saveStatus");

    assert.equal(await page.locator(".rail-save-status #saveStatus").count(), 1, "save status should live in the navigation rail");
    assert.equal(await page.locator(".topbar #saveStatus").count(), 0, "save status should not occupy the header");
    assert.equal(await page.locator(".topbar #saveRetryButton").count(), 0, "retry should not occupy the header");
    assert.equal(await page.locator("#railSiteNavigation").count(), 1, "site information should live in the navigation rail");
    assert.equal(await page.locator("#railSiteNavigation .rail-site-menu-nav a").count(), 6, "the card maker and all site pages should remain reachable from the rail");
    assert.equal(await page.locator(".app-site-footer").count(), 0, "site navigation should not push the card preview downward");
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("aria-label"), "저장 상태");
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("title"), "자동 저장");

    const desktop = await page.evaluate(() => {
      const group = document.querySelector("#saveStatusGroup").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        visible: getComputedStyle(document.querySelector("#saveStatusGroup")).display !== "none",
        withinViewport: group.left >= 0 && group.right <= window.innerWidth && group.top >= 0 && group.bottom <= window.innerHeight,
      };
    });
    assert.equal(desktop.overflow, false, "desktop layout should not overflow horizontally");
    assert.equal(desktop.visible, true, "navigation rail should expose the save status");
    assert.equal(desktop.withinViewport, true, `desktop save status should remain in view: ${JSON.stringify(desktop)}`);

    const readRailVisuals = () => page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        const marker = element?.querySelector(".tool-key");
        if (!element || !marker) return null;
        const markerRect = marker.getBoundingClientRect();
        const elementStyle = getComputedStyle(element);
        const markerStyle = getComputedStyle(marker);
        return {
          element: {
            background: elementStyle.backgroundColor,
            borderWidth: elementStyle.borderWidth,
            borderStyle: elementStyle.borderStyle,
            borderRadius: elementStyle.borderRadius,
            boxShadow: elementStyle.boxShadow,
          },
          marker: {
            width: markerRect.width,
            height: markerRect.height,
            display: markerStyle.display,
            fontFamily: markerStyle.fontFamily,
            fontSize: markerStyle.fontSize,
            fontWeight: markerStyle.fontWeight,
            lineHeight: markerStyle.lineHeight,
            letterSpacing: markerStyle.letterSpacing,
            borderWidth: markerStyle.borderWidth,
            borderStyle: markerStyle.borderStyle,
            borderRadius: markerStyle.borderRadius,
            padding: markerStyle.padding,
          },
        };
      };
      return {
        mode: read("#styleTab"),
        site: read("#railSiteNavigation > summary"),
      };
    });
    const desktopRail = await readRailVisuals();
    assert.deepEqual(desktopRail.mode.marker, desktopRail.site.marker, `mode and site rail markers drifted on desktop: ${JSON.stringify(desktopRail)}`);

    await page.locator("#railSiteNavigation > summary").click();
    await page.waitForTimeout(220);
    const desktopOpenRail = await readRailVisuals();
    assert.deepEqual(desktopOpenRail.mode.element, desktopOpenRail.site.element, `open site rail control does not match the active mode control: ${JSON.stringify(desktopOpenRail)}`);
    await page.locator("#railSiteNavigation > summary").click();
    await page.waitForTimeout(220);

    await page.evaluate(() => setSaveStatus(I18n.t("status.saving"), false));
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("data-state"), "saving");
    assert.equal(await page.locator("#saveRetryButton").getAttribute("hidden"), "");

    await page.evaluate(() => setSaveStatus(I18n.t("status.saveFailed"), true));
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("data-state"), "failed");
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("data-failed"), "true");
    assert.equal(await page.locator("#saveRetryButton").getAttribute("hidden"), null, "retry should appear only when saving fails");

    await page.evaluate(() => setSaveStatus(I18n.t("status.saved"), false));
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("data-state"), "saved");
    assert.equal(await page.locator("#saveRetryButton").getAttribute("hidden"), "", "retry should hide after recovery");
    await page.screenshot({ path: "artifacts/ui-save-status-rail.png", fullPage: false });

    await page.setViewportSize({ width: 320, height: 800 });
    const mobile = await page.evaluate(() => {
      const group = document.querySelector("#saveStatusGroup").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        visible: getComputedStyle(document.querySelector("#saveStatusGroup")).display !== "none",
        withinViewport: group.left >= 0 && group.right <= window.innerWidth && group.top >= 0 && group.bottom <= window.innerHeight,
      };
    });
    assert.equal(mobile.overflow, false, "mobile layout should not overflow horizontally");
    assert.equal(mobile.visible, true, "save status should remain available on mobile");
    assert.equal(mobile.withinViewport, true, `mobile save status should remain in view: ${JSON.stringify(mobile)}`);
    const mobileRail = await readRailVisuals();
    assert.deepEqual(mobileRail.mode.marker, mobileRail.site.marker, `mode and site rail markers drifted on mobile: ${JSON.stringify(mobileRail)}`);
    await page.screenshot({ path: "artifacts/ui-save-status-rail-mobile.png", fullPage: false });

    await page.locator("#railSiteNavigation > summary").click();
    await page.waitForTimeout(220);
    assert.equal(await page.locator("#railSiteNavigation").getAttribute("open"), "", "site information menu should open from the rail");
    assert.equal(await page.locator("#railSiteNavigation .rail-site-menu").isVisible(), true, "site information menu should be visible on mobile");
    const mobileOpenRail = await readRailVisuals();
    assert.deepEqual(mobileOpenRail.mode.element, mobileOpenRail.site.element, `open site rail control does not match the active mode control on mobile: ${JSON.stringify(mobileOpenRail)}`);
    const siteMenu = await page.locator("#railSiteNavigation .rail-site-menu").boundingBox();
    assert.ok(siteMenu && siteMenu.x >= 0 && siteMenu.x + siteMenu.width <= 320 && siteMenu.y >= 0, `site information menu should fit the mobile viewport: ${JSON.stringify(siteMenu)}`);
    await page.screenshot({ path: "artifacts/ui-site-menu-rail-mobile.png", fullPage: false });

    await page.evaluate(() => document.body.classList.add("image-placement-mode"));
    assert.equal(await page.locator("#saveStatus").isVisible(), true, "focused image placement should retain save feedback");
    assert.equal(await page.locator("#languageSelect").isVisible(), false, "focused image placement should still hide unrelated global actions");
    await page.evaluate(() => document.body.classList.remove("image-placement-mode"));

    console.log(JSON.stringify({ status: "PASS", desktop, mobile }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
