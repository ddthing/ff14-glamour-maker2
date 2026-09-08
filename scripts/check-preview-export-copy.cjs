const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const title = "투영세트메이커2 미리보기와 PNG가 같은 글자 렌더러를 사용하는지 확인하는 제목";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?copy-parity-check=1");
    await page.waitForSelector("#canvasBoard");

    assert.equal(await page.locator("#boardCopyCanvas").count(), 1, "preview needs the shared copy canvas layer");
    assert.equal(await page.locator("#boardCopyright").textContent(), "© SQUARE ENIX", "every card needs the official copyright notice");
    assert.equal(await page.evaluate(() => typeof CardCopy !== "undefined" ? typeof CardCopy.draw : "undefined"), "function", "CardCopy must be available to preview and export");
    const pngSource = fs.readFileSync(require("node:path").join(__dirname, "..", "models", "card-png.js"), "utf8");
    assert.match(pngSource, /CardCopy\.draw\(context, copyLayout\)/, "PNG must use the shared copy renderer");

    await page.locator("#cardTitleInput").fill(title);
    await page.locator("#cardTitleInput").blur();
    await page.locator('[data-title-align="center"]').click();
    await page.locator("#copyEditorAdvanced summary").click();
    await page.locator("#titleOutlineRange").scrollIntoViewIfNeeded();
    await page.locator("#titleOutlineRange").fill("3");
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.copyRendered === "true");

    const preview = await page.evaluate(() => {
      const canvas = document.querySelector("#boardCopyCanvas");
      const context = canvas.getContext("2d");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted += 1;
      const titleElement = document.querySelector("#boardTitle");
      const style = getComputedStyle(titleElement);
      return {
        width: canvas.width,
        height: canvas.height,
        painted,
        text: titleElement.textContent,
        copyright: document.querySelector("#boardCopyright")?.textContent?.trim() || "",
        color: style.color,
        opacity: style.opacity,
        filter: style.filter,
      };
    });
    assert.deepEqual({ width: preview.width, height: preview.height }, { width: 2160, height: 2700 });
    assert.ok(preview.painted > 0, "shared preview canvas should contain rendered copy");
    assert.equal(preview.text, title, "accessible DOM title must remain intact while its visual copy is canvas-rendered");
    assert.equal(preview.copyright, "© SQUARE ENIX", "copyright notice must remain present in the accessible card DOM");
    assert.match(preview.color, /rgb\(/, "DOM color must remain available to export measurement");
    assert.equal(preview.opacity, "1", "DOM copy must remain exposed to assistive technology and export measurement");
    assert.match(preview.filter, /opacity\(0\)/i, "DOM glyphs should be visually hidden behind the shared canvas copy");

    await page.locator("#imageInput").setInputFiles({ name: "copy-parity.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#portraitWrap img")?.naturalWidth > 0);
    await page.evaluate(() => {
      window.__copyDrawCalls = [];
      const original = CardCopy.draw;
      CardCopy.draw = (context, layout) => {
        window.__copyDrawCalls.push(layout.map((copy) => ({
          textAlign: copy.textAlign,
          font: copy.font,
          lines: copy.lines.map((line) => ({ text: line.text, x: line.x, y: line.y, height: line.height })),
        })));
        return original(context, layout);
      };
      const originalRender = CardPng.render;
      window.__copyParityBlobs = {};
      window.__copyParitySkipExportCopy = false;
      CardPng.render = async (...args) => {
        const previousDraw = CardCopy.draw;
        if (window.__copyParitySkipExportCopy) CardCopy.draw = () => {};
        try {
          const blob = await originalRender(...args);
          window.__copyParityBlobs[window.__copyParitySkipExportCopy ? "base" : "withCopy"] = blob;
          return blob;
        } finally {
          CardCopy.draw = previousDraw;
        }
      };
    });
    await page.locator("#titleOutlineRange").scrollIntoViewIfNeeded();
    await page.locator("#titleOutlineRange").fill("2");
    await page.waitForFunction(() => window.__copyDrawCalls.length >= 1);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    await downloadPromise;
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
    const drawCalls = await page.evaluate(() => window.__copyDrawCalls);
    assert.ok(drawCalls.length >= 2, `preview and PNG should both call CardCopy.draw: ${drawCalls.length}`);
    assert.ok(drawCalls.at(-1).some((copy) => copy.lines.some((line) => line.text === "© SQUARE ENIX")), "PNG copy layout must include the official copyright notice");
    assert.deepEqual(drawCalls.at(-1), drawCalls.at(-2), "preview and PNG should consume the same measured copy layout");

    await page.evaluate(() => { window.__copyParitySkipExportCopy = true; });
    const baseDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    await baseDownloadPromise;
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
    const pixelParity = await page.evaluate(async () => {
      const decode = async (blob) => {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return { canvas, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
      };
      const withCopy = await decode(window.__copyParityBlobs.withCopy);
      const base = await decode(window.__copyParityBlobs.base);
      const copyCanvas = document.querySelector("#boardCopyCanvas");
      const copyContext = copyCanvas.getContext("2d", { willReadFrequently: true });
      const copyPixels = copyContext.getImageData(0, 0, copyCanvas.width, copyCanvas.height).data;
      const composite = document.createElement("canvas");
      composite.width = base.canvas.width;
      composite.height = base.canvas.height;
      const compositeContext = composite.getContext("2d", { willReadFrequently: true });
      compositeContext.drawImage(base.canvas, 0, 0);
      compositeContext.drawImage(copyCanvas, 0, 0);
      const expected = compositeContext.getImageData(0, 0, composite.width, composite.height).data;
      let paintedPixels = 0;
      let mismatchedPixels = 0;
      let maxDelta = 0;
      for (let index = 0; index < copyPixels.length; index += 4) {
        if (copyPixels[index + 3] === 0) continue;
        paintedPixels += 1;
        let pixelMismatch = false;
        for (let channel = 0; channel < 4; channel += 1) {
          const delta = Math.abs(expected[index + channel] - withCopy.pixels[index + channel]);
          maxDelta = Math.max(maxDelta, delta);
          if (delta > 1) pixelMismatch = true;
        }
        if (pixelMismatch) mismatchedPixels += 1;
      }
      return { width: withCopy.canvas.width, height: withCopy.canvas.height, paintedPixels, mismatchedPixels, maxDelta };
    });
    assert.deepEqual({ width: pixelParity.width, height: pixelParity.height }, { width: 2160, height: 2700 });
    assert.ok(pixelParity.paintedPixels > 0, "pixel parity needs a painted preview copy layer");
    assert.equal(pixelParity.mismatchedPixels, 0, `preview copy pixels differ from the exported copy layer (${pixelParity.mismatchedPixels}, max delta ${pixelParity.maxDelta})`);
    console.log(`PASS: preview and PNG share one copy renderer, layout, and raster output (${pixelParity.paintedPixels} painted pixels).`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
