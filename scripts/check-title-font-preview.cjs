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
    const optionLabels = (await page.locator("#titleFontSelect option").allTextContents()).map((label) => label.trim());
    assert.deepEqual(optionLabels, [...optionLabels].sort((left, right) => left.localeCompare(right, "ko-KR") || left.localeCompare(right)), "title font select must be 가나다순");

    for (const requested of requestedFonts) {
      await page.locator("#titleFontSelect").selectOption(requested.value);
      let result;
      try {
        result = await page.evaluate(async ({ value, family }) => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const title = document.querySelector("#boardTitle");
          const titleCopy = captureExportCopy().find((copy) => copy.lines.some((line) => line.text.includes("새 제목 폰트")));
          return {
            selected: document.querySelector("#titleFontSelect")?.value,
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
