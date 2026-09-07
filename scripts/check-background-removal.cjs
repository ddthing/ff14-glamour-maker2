const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { stopChild } = require("./test-process.cjs");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const emptyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==",
  "base64",
);
const port = 4198;
const baseUrl = `http://127.0.0.1:${port}`;

async function startServer() {
  const child = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", CUTOUT_SERVICE_URL: "http://127.0.0.1:9/remove" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const startup = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("background removal test server startup timeout")), 5000);
    child.once("error", reject);
    child.stdout.once("data", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  try {
    await startup;
    return child;
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    const moduleResponse = await page.request.get(`${baseUrl}/models/background-removal.js`);
    assert.equal(moduleResponse.status(), 200, "browser model adapter must be publicly served");
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.TuyeongSetMaker2BackgroundRemoval?.removeInBrowser === "function");

    await page.evaluate((bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      window.TuyeongSetMaker2BackgroundRemoval = Object.freeze({
        removeInBrowser: async () => ({ blob, tier: "test browser fallback" }),
      });
    }, [...fixturePng]);
    await page.locator("#imageInput").setInputFiles({ name: "browser-fallback.png", mimeType: "image/png", buffer: fixturePng });
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");

    await page.evaluate(() => {
      const originalUpdate = characterAssetVault.update;
      window.restoreAssetUpdate = () => { characterAssetVault.update = originalUpdate; };
      characterAssetVault.update = async (key, value) => {
        if (value?.cutoutBlob) throw new Error("simulated storage failure");
        return originalUpdate(key, value);
      };
    });
    await page.locator("#cutoutButton").click();
    await page.waitForFunction(() => !document.querySelector("#cutoutButton").disabled);
    assert.equal(await page.locator("#imageState").getAttribute("data-state"), "original", "failed asset writes must not apply an unpersisted cutout");
    await page.evaluate(() => window.restoreAssetUpdate());

    await page.locator("#cutoutButton").click();
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "cutout");
    assert.match(await page.locator("#imageState").textContent(), /배경 제거됨/);
    assert.match(await page.locator("[role=status]").last().textContent(), /test browser fallback/);

    await page.locator("#cutoutButton").click();
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");
    await page.evaluate((bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      window.TuyeongSetMaker2BackgroundRemoval = Object.freeze({
        removeInBrowser: async () => ({ blob, tier: "test empty result" }),
      });
    }, [...emptyPng]);
    await page.locator("#cutoutButton").click();
    await page.waitForFunction(() => !document.querySelector("#cutoutButton").disabled);
    assert.equal(await page.locator("#imageState").getAttribute("data-state"), "original", "an empty result must leave the source image intact");
    assert.match(await page.locator("[role=status]").last().textContent(), /빈 결과|비어|실패/);
    assert.deepEqual(pageErrors, []);
    console.log("PASS: browser background-removal adapter is served and API-unavailable fallback applies a cutout.");
  } finally {
    await browser.close();
    await stopChild(server);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
