const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const longTitle = "퍼퓸뼈뼈와 함께 걷는 겨울빛 투영세트메이커2의 긴 룩 제목";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#canvasBoard");

    await page.locator("#cardTitleInput").fill(longTitle);
    await page.waitForFunction((value) => document.querySelector("#boardTitle")?.textContent === value, longTitle);
    const titleLayout = await page.locator("#boardTitle").evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rectWidth: rect.width,
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
        whiteSpace: style.whiteSpace,
        overflow: style.overflow,
      };
    });
    assert.ok(titleLayout.scrollWidth <= titleLayout.clientWidth + 1, `title is clipped: ${JSON.stringify(titleLayout)}`);
    assert.ok(titleLayout.fontSize >= 12, `title was shrunk below the readable floor: ${JSON.stringify(titleLayout)}`);
    await page.screenshot({ path: "artifacts/ui-editor-layout-after.png", fullPage: false });

    for (const width of [447, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator(".inspector").evaluate((element) => { element.scrollTop = 0; });
      await page.waitForTimeout(80);
      const narrowTitle = await page.locator("#boardTitle").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        fontSize: parseFloat(getComputedStyle(element).fontSize),
        fit: element.dataset.titleFit || "single-line",
        whiteSpace: getComputedStyle(element).whiteSpace,
        overflow: getComputedStyle(element).overflow,
      }));
      assert.ok(narrowTitle.scrollWidth <= narrowTitle.clientWidth + 1, `title is clipped at ${width}px: ${JSON.stringify(narrowTitle)}`);
      if (narrowTitle.fit === "wrap") {
        assert.equal(narrowTitle.whiteSpace, "normal", `wrapped title still uses a single-line white-space rule at ${width}px`);
        assert.notEqual(narrowTitle.overflow, "hidden", `wrapped title is still clipped at ${width}px`);
      }
      const headerLayout = await page.evaluate(() => {
        const inspector = document.querySelector(".inspector");
        const header = document.querySelector(".inspector-header");
        const title = document.querySelector(".inspector-title-row h1");
        const headerRect = header?.getBoundingClientRect();
        const titleRect = title?.getBoundingClientRect();
        const style = header ? getComputedStyle(header) : null;
        return {
          headerHeight: headerRect?.height || 0,
          inspectorTop: inspector?.getBoundingClientRect().top || 0,
          inspectorHeight: inspector?.getBoundingClientRect().height || 0,
          inspectorScrollTop: inspector?.scrollTop || 0,
          headerBottom: headerRect?.bottom || 0,
          titleBottom: titleRect?.bottom || 0,
          bottomGap: headerRect && titleRect ? headerRect.bottom - titleRect.bottom - parseFloat(style?.borderBottomWidth || "0") : 0,
          headerBorder: style?.borderBottomWidth || "0px",
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      assert.ok(headerLayout.bottomGap >= 12, `inspector title is too close to the header boundary at ${width}px: ${JSON.stringify(headerLayout)}`);
      assert.equal(headerLayout.overflow, false, `inspector overflows at ${width}px`);
      if (width === 320) await page.screenshot({ path: "artifacts/ui-editor-layout-mobile-after.png", fullPage: false });
    }
    console.log("PASS: editor title and inspector header layout remain readable across narrow widths.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
