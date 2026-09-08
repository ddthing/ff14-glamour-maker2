const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const publicPages = ["terms", "privacy", "guide", "contact", "support"];
const languages = ["ko", "en", "ja"];
const viewports = [320, 375, 390, 430, 768, 1024, 1280];
const publicGapCases = [
  { page: "privacy", before: ".public-notice", after: ".public-section" },
  { page: "contact", before: ".public-grid", after: ".public-section" },
  { page: "support", before: ".support-callout", after: ".public-section" },
];

function browserLaunchOptions() {
  const configuredExecutable = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const chromeExecutable = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (configuredExecutable || fs.existsSync(chromeExecutable)) {
    return { headless: true, executablePath: configuredExecutable || chromeExecutable };
  }
  return { headless: true, channel: "msedge" };
}

async function waitForPublicPage(page, language) {
  await page.waitForSelector("#pageLanguageSelect");
  if (await page.locator("#pageLanguageSelect").inputValue() !== language) {
    await page.locator("#pageLanguageSelect").selectOption(language);
  }
  await page.waitForFunction((expectedLanguage) => document.documentElement.lang === expectedLanguage, language);
}

async function assertPublicLayout(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const gaps = [];
  try {
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 844 });
      for (const language of languages) {
        for (const publicPage of publicPages) {
          await page.goto(`${baseUrl}/${publicPage}/?layout-contracts=1`, { waitUntil: "networkidle" });
          await waitForPublicPage(page, language);
          const metrics = await page.evaluate(({ publicPage, width }) => {
            const overflow = {
              document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              body: document.body.scrollWidth - document.body.clientWidth,
            };
            const gapCase = publicPage === "privacy"
              ? { before: ".public-notice", after: ".public-section" }
              : publicPage === "contact"
                ? { before: ".public-grid", after: ".public-section" }
                : publicPage === "support"
                  ? { before: ".support-callout", after: ".public-section" }
                  : null;
            if (!gapCase) return { overflow, gap: null };
            const before = document.querySelector(gapCase.before);
            const after = document.querySelector(gapCase.after);
            if (!before || !after) return { overflow, gap: null };
            const beforeRect = before.getBoundingClientRect();
            const afterRect = after.getBoundingClientRect();
            return {
              overflow,
              gap: afterRect.top - beforeRect.bottom,
              width,
            };
          }, { publicPage, width });

          assert.ok(metrics.overflow.document <= 0 && metrics.overflow.body <= 0,
            `${publicPage}/${language}/${width}px has horizontal overflow: ${JSON.stringify(metrics)}`);
          const gapCase = publicGapCases.find((candidate) => candidate.page === publicPage);
          if (gapCase) {
            const minimumGap = width <= 620 ? 24 : 30;
            assert.ok(metrics.gap >= minimumGap,
              `${publicPage}/${language}/${width}px block gap is too small: ${JSON.stringify(metrics)}`);
            gaps.push({ publicPage, language, width, gap: metrics.gap });
          }
        }
      }
    }
  } finally {
    await page.close();
  }
  return gaps;
}

async function assertTwoPersonTitle(browser) {
  const measurements = [];
  for (const width of [1440, 1024, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await page.addInitScript(() => localStorage.clear());
      await page.goto(`${baseUrl}/?two-person-title-layout=1`, { waitUntil: "networkidle" });
      await page.waitForSelector("#canvasBoard");
      await page.locator('[data-cast-count="2"]').click();
      await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "2");
      await page.locator("#cardTitleInput").fill("정렬 검수");
      await page.locator("#cardTitleInput").blur();

      const defaultMetric = await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard").getBoundingClientRect();
        const block = document.querySelector(".board-title-block").getBoundingClientRect();
        const title = document.querySelector("#boardTitle");
        const range = document.createRange();
        range.selectNodeContents(title);
        const text = range.getBoundingClientRect();
        const copy = captureExportCopy().find((entry) => entry.lines.length > 0);
        return {
          boardCenter: (board.left + board.right) / 2,
          blockCenter: (block.left + block.right) / 2,
          textCenter: (text.left + text.right) / 2,
          textAlign: getComputedStyle(title).textAlign,
          exportAlign: copy?.textAlign,
          exportAnchor: copy?.lines[0]?.x,
          layoutCenter: getExportDimensions().layoutWidth / 2,
          selectedCenter: document.querySelector('[data-floating-align="center"]')?.getAttribute("aria-checked"),
        };
      });
      assert.equal(defaultMetric.textAlign, "center",
        `two-person auto alignment should default to card center: ${JSON.stringify(defaultMetric)}`);
      assert.equal(defaultMetric.exportAlign, "center",
        `two-person auto alignment should reach PNG copy: ${JSON.stringify(defaultMetric)}`);
      assert.equal(defaultMetric.selectedCenter, "true",
        `two-person auto alignment control should select center: ${JSON.stringify(defaultMetric)}`);
      assert.ok(Math.abs(defaultMetric.blockCenter - defaultMetric.boardCenter) <= 0.75,
        `two-person default title box is not card-centered at ${width}px: ${JSON.stringify(defaultMetric)}`);
      assert.ok(Math.abs(defaultMetric.textCenter - defaultMetric.boardCenter) <= 2,
        `two-person default title is not card-centered at ${width}px: ${JSON.stringify(defaultMetric)}`);
      assert.ok(Math.abs(defaultMetric.exportAnchor - defaultMetric.layoutCenter) <= 2,
        `two-person default PNG title is not card-centered at ${width}px: ${JSON.stringify(defaultMetric)}`);

      for (const alignment of ["left", "center", "right"]) {
        await page.locator(`[data-floating-align="${alignment}"]`).click();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const metric = await page.evaluate((expectedAlignment) => {
          const board = document.querySelector("#canvasBoard").getBoundingClientRect();
          const header = document.querySelector(".board-editorial-header").getBoundingClientRect();
          const block = document.querySelector(".board-title-block").getBoundingClientRect();
          const title = document.querySelector("#boardTitle");
          const range = document.createRange();
          range.selectNodeContents(title);
          const text = range.getBoundingClientRect();
          const copy = captureExportCopy().find((entry) => entry.lines.length > 0);
          const line = copy?.lines[0];
          const layoutCenter = getExportDimensions().layoutWidth / 2;
          return {
            expectedAlignment,
            boardCenter: (board.left + board.right) / 2,
            headerCenter: (header.left + header.right) / 2,
            blockCenter: (block.left + block.right) / 2,
            blockLeft: block.left,
            blockRight: block.right,
            textLeft: text.left,
            textCenter: (text.left + text.right) / 2,
            textRight: text.right,
            textAlign: getComputedStyle(title).textAlign,
            exportAlign: copy?.textAlign,
            exportAnchor: line?.x,
            layoutCenter,
          };
        }, alignment);

        assert.ok(Math.abs(metric.headerCenter - metric.boardCenter) <= 0.75,
          `two-person header is not card-centered at ${width}px: ${JSON.stringify(metric)}`);
        assert.ok(Math.abs(metric.blockCenter - metric.boardCenter) <= 0.75,
          `two-person title box is not card-centered at ${width}px: ${JSON.stringify(metric)}`);
        assert.equal(metric.textAlign, alignment,
          `two-person ${alignment} alignment did not reach the card copy: ${JSON.stringify(metric)}`);
        assert.equal(metric.exportAlign, alignment,
          `two-person ${alignment} alignment did not reach PNG copy: ${JSON.stringify(metric)}`);
        if (alignment === "left") {
          assert.ok(metric.textLeft - metric.blockLeft <= 4,
            `two-person left copy is not relative to its card box: ${JSON.stringify(metric)}`);
        } else if (alignment === "center") {
          assert.ok(Math.abs(metric.textCenter - metric.boardCenter) <= 2,
            `two-person center copy is not relative to the card: ${JSON.stringify(metric)}`);
          assert.ok(Math.abs(metric.exportAnchor - metric.layoutCenter) <= 2,
            `two-person centered PNG copy is not relative to the card: ${JSON.stringify(metric)}`);
        } else {
          assert.ok(metric.blockRight - metric.textRight <= 4,
            `two-person right copy is not relative to its card box: ${JSON.stringify(metric)}`);
        }
        measurements.push({ width, ...metric });
      }
    } finally {
      await page.close();
    }
  }
  return measurements;
}

(async () => {
  const browser = await chromium.launch(browserLaunchOptions());
  try {
    const gaps = await assertPublicLayout(browser);
    const title = await assertTwoPersonTitle(browser);
    console.log(JSON.stringify({ status: "PASS", publicGapChecks: gaps.length, twoPersonChecks: title.length }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
