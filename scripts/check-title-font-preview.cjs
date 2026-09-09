const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const requestedFonts = [
  { value: "wild-gak", family: "KIMWILDgag-Bold" },
  { value: "cafe24-classic-type", family: "Cafe24ClassicType" },
  { value: "sinchon-rhapsody", family: "SinchonRhapsody" },
  { value: "shouting", family: "Shouting" },
  { value: "goryeong-strawberry", family: "GoryeongStrawberry" },
  { value: "maru-minya-hangul", family: "x12y12pxMaruMinyaHangul" },
  { value: "dos-pilgi", family: "DosHandwriting" },
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?title-font-preview=1", { waitUntil: "networkidle" });
    await page.waitForSelector("#canvasBoard");
    await page.locator("#cardTitleInput").fill("새 제목 폰트의 미리보기와 저장 경로 확인");
    await page.locator("#cardTitleInput").blur();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.copyRendered === "true");
    const optionLabels = (await page.locator("#textEditorFontSelect option").allTextContents()).map((label) => label.trim());
    assert.deepEqual(optionLabels, [...optionLabels].sort((left, right) => left.localeCompare(right, "ko-KR") || left.localeCompare(right)), "title font select must be 가나다순");

    await page.evaluate(() => {
      window.__fontLoadDescriptors = [];
      window.__releaseFontLoad = null;
      window.__fontLoadNative = document.fonts.load.bind(document.fonts);
      document.fonts.load = (descriptor) => new Promise((resolve) => {
        window.__fontLoadDescriptors.push(descriptor);
        window.__releaseFontLoad = () => resolve([]);
      });
      window.__fontDrawCount = 0;
      window.__fontDrawNative = CardCopy.draw;
      CardCopy.draw = (...args) => {
        window.__fontDrawCount += 1;
        return window.__fontDrawNative(...args);
      };
    });
    const drawsBeforeFontChange = await page.evaluate(() => window.__fontDrawCount);
    await page.locator("#textEditorFontSelect").selectOption("ridibatang");
    await page.waitForTimeout(100);
    const pendingFont = await page.evaluate(() => ({
      descriptor: window.__fontLoadDescriptors.at(-1) || "",
      drawCount: window.__fontDrawCount,
      pending: document.querySelector("#canvasBoard")?.dataset.copyFontPending || "",
      titleFamily: getComputedStyle(document.querySelector("#boardTitle")).fontFamily,
    }));
    assert.match(pendingFont.descriptor, /Ridibatang/, `title font readiness was not requested: ${JSON.stringify(pendingFont)}`);
    assert.equal(pendingFont.drawCount, drawsBeforeFontChange, "the shared preview must not paint the fallback font while the selected font is loading");
    assert.equal(pendingFont.pending, "true", "the card should expose a font-pending state while the selected font is loading");
    assert.match(pendingFont.titleFamily, /Ridibatang/, `the semantic card title did not receive the selected font: ${JSON.stringify(pendingFont)}`);
    await page.evaluate(() => window.__releaseFontLoad?.());
    await page.waitForFunction((before) => document.querySelector("#canvasBoard")?.dataset.copyFontPending !== "true" && window.__fontDrawCount > before, drawsBeforeFontChange);
    await page.evaluate(() => {
      document.fonts.load = window.__fontLoadNative;
      CardCopy.draw = window.__fontDrawNative;
    });

    for (const requested of requestedFonts) {
      await page.locator("#textEditorFontSelect").selectOption(requested.value);
      let result;
      try {
        result = await page.evaluate(async ({ value, family }) => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const title = document.querySelector("#boardTitle");
          const titleCopy = captureExportCopy().find((copy) => copy.lines.some((line) => line.text.includes("새 제목 폰트")));
          return {
            selected: document.querySelector("#textEditorFontSelect")?.value,
            titleFamily: getComputedStyle(title).fontFamily,
            exportedFamily: titleCopy?.font || "",
            copyRendered: document.querySelector("#canvasBoard")?.dataset.copyRendered,
            family,
            value,
          };
        }, requested);
      } catch (error) {
        throw new Error(`${requested.value} (${requested.family}) font verification failed: ${error.message}`);
      }

      assert.equal(result.selected, requested.value, `${requested.value} was not selected`);
      assert.match(result.titleFamily, new RegExp(requested.family.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")), `${requested.value} did not reach the title preview`);
      assert.match(result.exportedFamily, new RegExp(requested.family.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")), `${requested.value} did not reach the measured PNG copy layout`);
      assert.equal(result.copyRendered, "true", `${requested.value} did not redraw the shared copy preview`);
    }

    console.log(`PASS: ${requestedFonts.length} new title fonts reach both the card preview and the shared PNG copy measurement.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
