const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?two-person-info-rails=1");
    await page.waitForSelector("#canvasBoard");
    await page.locator('[data-cast-count="2"]').click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.cast === "2");
    await page.locator("#collagePreset").click();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.backgroundPattern === "collage");

    const snapshot = await page.evaluate(() => {
      const board = document.querySelector("#canvasBoard");
      const rails = [...board.querySelectorAll(".board-gear-rail")];
      rails.forEach((rail, index) => {
        rail.querySelector(".board-gear-rail-items").innerHTML = `
          <button class="board-gear-item" type="button">
            <div class="gear-tile-copy"><span>${index ? "몸통" : "머리"}</span><strong>구식 주물 프라이팬</strong><small>예시 보조명</small></div>
          </button>`;
      });
      const boardRect = board.getBoundingClientRect();
      const readRail = (rail) => {
        const rect = rail.getBoundingClientRect();
        const copy = rail.querySelector(".gear-tile-copy");
        const item = rail.querySelector(".board-gear-item");
        const style = getComputedStyle(copy);
        return {
          left: rect.left - boardRect.left,
          top: rect.top - boardRect.top,
          width: rect.width,
          height: rect.height,
          marginLeft: (rect.left - boardRect.left) / boardRect.width,
          marginRight: (boardRect.right - rect.right) / boardRect.width,
          textAlign: style.textAlign,
          alignItems: style.alignItems,
          itemPosition: item ? getComputedStyle(item).position : "",
        };
      };
      return {
        board: { width: boardRect.width, height: boardRect.height },
        rails: rails.map(readRail),
        expectedRails: typeof CardLayout?.infoRails === "function" ? CardLayout.infoRails({ characterCount: 2 }) : null,
      };
    });
    await page.locator("#canvasBoard").screenshot({ path: "artifacts/two-person-info-rails.png" });

    assert.equal(snapshot.rails.length, 2, "two-person card must render two information rails");
    assert.ok(snapshot.rails[0].marginLeft >= 0.055, `left information rail is still too close to the card edge: ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.rails[1].marginRight >= 0.055, `right information rail is still too close to the card edge: ${JSON.stringify(snapshot)}`);
    assert.equal(snapshot.rails[0].textAlign, "left", "left rail copy should align to its left start edge");
    assert.equal(snapshot.rails[0].alignItems, "flex-start", "left rail copy should use its left start edge");
    assert.equal(snapshot.rails[1].textAlign, "right", "right rail copy should align to its right end edge");
    assert.equal(snapshot.rails[1].alignItems, "flex-end", "right rail copy should use its right end edge");
    assert.ok(snapshot.rails.every((rail) => rail.itemPosition === "relative"), `collage rail items must own their slot tab positioning context: ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.expectedRails, "CardLayout must own the two-person information rail geometry");

    const scaleX = snapshot.board.width / 1200;
    const scaleY = snapshot.board.height / 675;
    snapshot.expectedRails.forEach((expected, index) => {
      const actual = snapshot.rails[index];
      const drift = Math.max(
        Math.abs(actual.left - expected.x * scaleX),
        Math.abs(actual.top - expected.y * scaleY),
        Math.abs(actual.width - expected.width * scaleX),
        Math.abs(actual.height - expected.height * scaleY),
      );
      assert.ok(drift <= 2.5, `preview rail ${index + 1} drifted from shared CardLayout by ${drift.toFixed(2)}px: ${JSON.stringify({ actual, expected })}`);
    });

    const exportSnapshot = await page.evaluate(async () => {
      const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
      const makeImage = () => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `data:image/png;base64,${imageData}`;
      });
      const calls = [];
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function fillTextProbe(text, x, y) {
        calls.push({ text, x, y, textAlign: this.textAlign });
        return originalFillText.call(this, text, x, y);
      };
      try {
        await CardPng.render({
          state: {
            characters: [
              { cutout: false, imageFit: "contain", zoom: 100, panX: 0, panY: 0 },
              { cutout: false, imageFit: "contain", zoom: 100, panX: 0, panY: 0 },
            ],
            characterCount: 2,
            backgroundPattern: "none",
            backgroundTexture: "none",
            multiInfoEnabled: true,
            multiInfoMode: "clear",
            singleLayout: "info-left",
            outline: { width: 0 },
            shadow: { x: 0, y: 0, blur: 0, strength: 0 },
          },
          dimensions: { layoutWidth: 1200, layoutHeight: 675, exportWidth: 2400, exportHeight: 1350 },
          exportTheme: { radius: 12, panel: "#fff", panelBorder: "#ddd", muted: "#999", text: "#111", infoShadow: "transparent" },
          background: { solid: "#fff", pattern: ["#000", "#fff"] },
          patternStars: [],
          images: await Promise.all([makeImage(), makeImage()]),
          copyLayout: [],
          gear: [
            [{ slotName: "머리", name: "왼쪽 정보", secondaryName: "" }],
            [{ slotName: "몸통", name: "오른쪽 정보", secondaryName: "" }],
          ],
          outlineColor: "#000",
        });
        return {
          rails: CardLayout.infoRails({ characterCount: 2 }),
          calls: calls.filter(({ text }) => ["머리", "왼쪽 정보", "몸통", "오른쪽 정보"].includes(text)),
        };
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
    });
    const leftExportText = exportSnapshot.calls.filter(({ text }) => ["머리", "왼쪽 정보"].includes(text));
    const rightExportText = exportSnapshot.calls.filter(({ text }) => ["몸통", "오른쪽 정보"].includes(text));
    const exportPadding = Math.max(10, Math.round(exportSnapshot.rails[0].width * 0.045));
    assert.ok(leftExportText.length >= 2 && leftExportText.every(({ textAlign, x }) => textAlign === "left" && x === exportSnapshot.rails[0].x + exportPadding), `PNG left rail copy is not left-anchored: ${JSON.stringify(exportSnapshot)}`);
    assert.ok(rightExportText.length >= 2 && rightExportText.every(({ textAlign, x }) => textAlign === "right" && x === exportSnapshot.rails[1].x + exportSnapshot.rails[1].width - exportPadding), `PNG right rail copy is not right-anchored: ${JSON.stringify(exportSnapshot)}`);
    console.log(JSON.stringify({ status: "PASS", rails: snapshot.rails, expectedRails: snapshot.expectedRails }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
