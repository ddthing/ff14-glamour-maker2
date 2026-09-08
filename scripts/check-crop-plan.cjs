const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const patterns = ["none", "dots", "stars", "halftone", "bitmap", "collage", "scrapbook"];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`${process.env.TEST_BASE_URL || "http://localhost:4173"}/?crop-plan-check=1`);
    await page.waitForSelector("#canvasBoard");
    await page.locator("#imageInput").setInputFiles({ name: "crop-plan.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#portraitWrap img")?.complete);

    const observed = [];
    for (const ratio of ["portrait", "landscape"]) {
      for (const pattern of patterns) {
        await page.evaluate(({ nextRatio, nextPattern }) => {
          state.characterCount = 1;
          state.singleRatio = nextRatio;
          state.backgroundPattern = nextPattern;
          state.selectedCharacter = 0;
          const character = state.characters[0];
          character.cutout = true;
          character.imageFit = "contain";
          character.focalPoint = null;
          syncSelectedCharacter();
          renderAll();
        }, { nextRatio: ratio, nextPattern: pattern });
        await page.waitForFunction((nextRatio) => document.querySelector("#canvasBoard")?.dataset.ratio === nextRatio, ratio);
        const containPosition = await page.locator("#portraitWrap img").getAttribute("style");
        const containComputed = await page.locator("#portraitWrap img").evaluate((image) => getComputedStyle(image).objectPosition);
        assert.equal(containComputed, "50% 100%", `${pattern}/${ratio} cutout contain must stay grounded`);

        const positions = await page.evaluate(() => {
          const character = state.characters[0];
          character.imageFit = "cover";
          character.focalPoint = null;
          renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
          const fallback = getComputedStyle(document.querySelector("#portraitWrap img")).objectPosition;
          character.focalPoint = { x: 0.27, y: 0.31 };
          renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
          const explicit = getComputedStyle(document.querySelector("#portraitWrap img")).objectPosition;
          return { fallback, explicit };
        });
        assert.equal(positions.fallback, "50% 38%", `${pattern}/${ratio} cutout cover must use the safe upper focus`);
        assert.equal(positions.explicit, "27% 31%", `${pattern}/${ratio} explicit focal point drifted`);
        observed.push({ pattern, ratio, containComputed, containPosition, ...positions });
      }
    }
    console.log(JSON.stringify({ status: "PASS", cases: observed.length, patterns }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
