const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const expected = {
  paper: { variable: "#111111", color: "rgb(17, 17, 17)" },
  mist: { variable: "#111111", color: "rgb(17, 17, 17)" },
  pearl: { variable: "#111111", color: "rgb(17, 17, 17)" },
  rose: { variable: "#111111", color: "rgb(17, 17, 17)" },
  tide: { variable: "#111111", color: "rgb(17, 17, 17)" },
  dusk: { variable: "#111111", color: "rgb(17, 17, 17)" },
  ink: { variable: "#ffffff", color: "rgb(255, 255, 255)" },
  charcoal: { variable: "#ffffff", color: "rgb(255, 255, 255)" },
};
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");
    await page.locator('[data-cast-count="3"]').click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "3");
    await page.locator("#imageInput").setInputFiles([
      { name: "silhouette-one.png", mimeType: "image/png", buffer: fixturePng },
      { name: "silhouette-two.png", mimeType: "image/png", buffer: fixturePng },
      { name: "silhouette-three.png", mimeType: "image/png", buffer: fixturePng },
    ]);
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap img").length === 3);
    await page.evaluate(() => {
      state.characters.slice(0, 3).forEach((character) => { character.cutout = true; });
      itemRecordCache.set("999999", {
        id: "999999",
        slot: "head",
        names: { ko: "대비 테스트 장비", en: "Silhouette Contrast Fixture", ja: "シルエット検証装備" },
      });
      getSelectedLook().outfits.slice(0, 3).forEach((outfit) => { outfit.head = "999999"; });
      state.multiInfoMode = "silhouette";
      renderAll();
    });
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.infoMode === "silhouette");

    for (const background of Object.keys(expected)) {
      await page.locator(`#backdropGrid [data-background="${background}"]`).click();
      const snapshot = await page.evaluate(() => {
        const board = document.querySelector("#canvasBoard");
        const column = board?.querySelector(".multi-info-column");
        const style = column ? getComputedStyle(column) : null;
        const result = {
          variable: board?.style.getPropertyValue("--silhouette-info-color").trim() || "",
          color: style?.color || "",
          halo: style?.textShadow || "",
        };
        return result;
      });
      assert.equal(snapshot.variable, expected[background].variable, `silhouette CSS variable did not follow ${background}`);
      assert.equal(snapshot.color, expected[background].color, `silhouette copy did not follow ${background}`);
      assert.notEqual(snapshot.halo, "none", `silhouette copy lost its inverse readability halo on ${background}`);
    }

    await page.evaluate(() => {
      window.__silhouetteExportTextCalls = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.__silhouetteExportOriginalFillText = original;
      CanvasRenderingContext2D.prototype.fillText = function captureSilhouetteText(text, ...args) {
        if (String(text).includes("대비 테스트 장비")) {
          window.__silhouetteExportTextCalls.push({ fillStyle: this.fillStyle, shadowColor: this.shadowColor });
        }
        return original.call(this, text, ...args);
      };
    });
    for (const [background, expectedTheme] of [["paper", expected.paper], ["charcoal", expected.charcoal]]) {
      await page.locator(`#backdropGrid [data-background="${background}"]`).click();
      await page.evaluate(() => { window.__silhouetteExportTextCalls = []; });
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#exportButton").click();
      const download = await downloadPromise;
      await download.cancel();
      await page.waitForFunction(() => !document.querySelector("#exportButton")?.hasAttribute("aria-busy"));
      const exportCalls = await page.evaluate(() => window.__silhouetteExportTextCalls);
      const expectedFill = expectedTheme.variable.toLowerCase();
      assert.equal(exportCalls.length, 3, `${background} PNG should paint one primary info line per character`);
      assert.ok(exportCalls.every(({ fillStyle }) => [expectedFill, expectedTheme.color.replace(/\s/g, "").toLowerCase()].includes(String(fillStyle).replace(/\s/g, "").toLowerCase())), `${background} PNG info copy used the wrong foreground: ${JSON.stringify(exportCalls)}`);
      assert.ok(exportCalls.every(({ shadowColor }) => shadowColor && shadowColor !== "transparent"), `${background} PNG info copy lost its inverse halo`);
    }
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.fillText = window.__silhouetteExportOriginalFillText;
    });
    console.log("PASS: silhouette preview copy switches to black/white by background and keeps an inverse readability halo.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
