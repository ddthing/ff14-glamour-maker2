const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const remoteFontPattern = "**/pretendardvariable-dynamic-subset.min.css";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route(remoteFontPattern, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 200, contentType: "text/css", body: "@font-face { font-family: DelayedPretendard; src: local sans-serif; }" });
    });
    const startedAt = Date.now();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const domContentLoadedMs = Date.now() - startedAt;
    assert.ok(domContentLoadedMs < 800, `remote font blocked the app shell for ${domContentLoadedMs}ms`);
    assert.equal(await page.locator("#canvasBoard").isVisible(), true, "app shell did not render while font was delayed");

    await page.evaluate(() => {
      window.__draftWriteCount = 0;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function measuredDraftWrite(key, value) {
        if (key === "tuyeong-set-maker2-draft-v3") window.__draftWriteCount += 1;
        return originalSetItem.call(this, key, value);
      };
      const input = document.querySelector("#shadowRange");
      for (let index = 0; index < 40; index += 1) {
        input.value = String((index * 7) % 71);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(350);
    const draftWrites = await page.evaluate(() => ({
      count: window.__draftWriteCount,
      shadowStrength: JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3"))?.shadow?.strength,
    }));
    assert.ok(draftWrites.count <= 2, `rapid style input wrote ${draftWrites.count} drafts instead of batching`);
    assert.equal(draftWrites.shadowStrength, 60, "batched draft should contain the final input value");
    console.log(`PASS: delayed remote font keeps the app interactive (${domContentLoadedMs}ms) and rapid input batches draft writes (${draftWrites.count}).`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
