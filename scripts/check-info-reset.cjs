const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

async function indexedAssetCount(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open("tuyeong-set-maker2-assets-v1", 1);
    request.onerror = () => resolve(-1);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("character-assets")) {
        database.close();
        resolve(0);
        return;
      }
      const transaction = database.transaction("character-assets", "readonly");
      const countRequest = transaction.objectStore("character-assets").count();
      countRequest.onsuccess = () => { database.close(); resolve(countRequest.result); };
      countRequest.onerror = () => { database.close(); resolve(-1); };
    };
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);
    await page.addInitScript(() => localStorage.clear());
    await page.route("**/api/background-removal", (route) => route.fulfill({ status: 200, contentType: "image/png", body: fixturePng }));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");

    await page.locator('[data-cast-count="3"]').click();
    await page.waitForSelector("#multiCardControls:not([hidden])");
    assert.equal(await page.locator("#castSelectionSummary").textContent(), "캐릭터 01 · 3인");
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info-mode"), "clear");
    assert.equal(await page.locator("#multiCardControls #multiInfoToggle").count(), 0, "card information visibility should not be mixed into lineup expression");
    assert.equal(await page.locator("#cardStyleSection #multiInfoToggle").count(), 1, "card information visibility should live in card settings");
    assert.equal(await page.locator("[data-info-density]").count(), 0, "summary/full information density control should be removed");
    assert.equal(await page.locator("button[data-info-mode=silhouette]").isDisabled(), true);
    assert.match(await page.locator("#infoModeHint").textContent(), /모든 캐릭터.*배경 제거/);

    await page.locator("#cardStyleSection .card-display-switch").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info"), "false");
    await page.locator("#cardStyleSection .card-display-switch").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info"), "true");

    await page.locator("#cardTitleInput").fill("사용자 제목");
    await page.locator("#cardSubtitleInput").fill("사용자 설명");
    await page.locator("[data-pattern=stars]").click();
    await page.locator("#resetButton").click();
    assert.equal(await page.locator("#resetButton").getAttribute("aria-expanded"), "true");
    await page.locator("#resetStylesButton").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-background-pattern"), "none");
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info-mode"), "clear");
    assert.equal(await page.locator("#boardTitle").textContent(), "사용자 제목");
    assert.equal(await page.locator("#boardSubtitle").textContent(), "사용자 설명");
    assert.equal(await page.locator("#resetButton").evaluate((element) => document.activeElement === element), true);

    await page.locator("#imageInput").setInputFiles([0, 1, 2].map((index) => ({
      name: `silhouette-${index + 1}.png`,
      mimeType: "image/png",
      buffer: fixturePng,
    })));
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap .character-figure img").length === 3);
    for (const index of [0, 1, 2]) {
      await page.locator(`[data-character-select="${index}"]`).click();
      await page.locator("#cutoutButton").click();
      await page.waitForFunction((value) => document.querySelector(`.character-figure[data-character-index="${value}"]`)?.dataset.cutout === "true", index);
    }
    assert.equal(await page.locator("button[data-info-mode=silhouette]").isDisabled(), false);
    assert.match(await page.locator("#infoModeHint").textContent(), /선택할 수/);
    await page.locator("button[data-info-mode=silhouette]").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info-mode"), "silhouette");
    assert.ok(await indexedAssetCount(page) >= 3, "fixture uploads should be present before card reset");

    await page.locator("#cardTitleInput").fill("초기화 전 제목");
    await page.locator("#cardSubtitleInput").fill("초기화 전 설명");
    await page.locator('[data-cast-count="5"]').click();
    await page.locator("[data-pattern=stars]").click();
    await page.locator("#resetButton").click();
    await page.locator("#resetCardButton").click();
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-cast"), "1");
    assert.equal(await page.locator("#boardTitle").textContent(), "새로운 룩");
    assert.equal(await page.locator("#boardSubtitle").textContent(), "");
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-background-pattern"), "none");
    assert.equal(await page.locator("#canvasBoard").getAttribute("data-info-mode"), "clear");
    assert.equal(await page.locator("#imageState").getAttribute("data-state"), "empty");
    assert.ok(await indexedAssetCount(page) >= 3, "undo must retain referenced images until the history is released");
    assert.equal(await page.locator("#undoButton").getAttribute("aria-disabled"), "false");
    assert.equal(await page.locator("#resetButton").evaluate((element) => document.activeElement === element), true);

    await page.locator("#libraryToggleButton").click();
    await page.locator("#addLookButton").click();
    assert.equal(await page.locator(".look-list-item").count(), 2, "LOOK BOOK should retain explicit user-created looks until workspace reset");
    await page.evaluate(() => {
      localStorage.setItem("glamour-atelier-background-presets-v2", JSON.stringify([{ id: "preset-check", name: "검증 프리셋" }]));
      localStorage.setItem("glamour-atelier-draft-v2", "legacy-data");
    });
    await page.locator("#resetButton").click();
    await page.locator("#resetWorkspaceButton").click();
    assert.equal(await page.locator("#deleteWorkspaceDialog").isVisible(), true);
    await page.locator("#cancelWorkspaceDelete").click();
    assert.equal(await page.locator(".look-list-item").count(), 2, "cancel must retain the workspace");
    await page.locator("#resetButton").click();
    await page.locator("#resetWorkspaceButton").click();
    await page.evaluate(() => { document.querySelector('#itemSearch').value = '이전 검색'; document.querySelector('#lookSearch').value = '이전 룩'; });
    await page.locator("#confirmWorkspaceDelete").click();
    await page.waitForFunction(() => document.querySelectorAll(".look-list-item").length === 1);
    assert.equal(await page.locator("#boardTitle").textContent(), "새로운 룩");
    assert.equal(await page.locator("#imageState").getAttribute("data-state"), "empty");
    assert.equal(await page.locator("#castSelector button").count(), 1);
    assert.equal(await page.locator('#itemSearch').inputValue(), '');
    assert.equal(await page.locator('#lookSearch').inputValue(), '');
    const storage = await page.evaluate(() => Object.fromEntries([
      "tuyeong-set-maker2-draft-v3",
      "glamour-atelier-draft-v2",
      "tuyeong-set-maker2-background-presets-v2",
      "tuyeong-set-maker2-ui-v2",
      "glamour-atelier-background-presets-v2",
      "glamour-atelier-ui-v2",
    ].map((key) => [key, localStorage.getItem(key)])));
    assert.equal(storage["tuyeong-set-maker2-draft-v3"], null, "full reset must not immediately recreate a draft");
    assert.equal(storage["glamour-atelier-draft-v2"], null, "full reset must remove legacy drafts too");
    assert.equal(storage["tuyeong-set-maker2-background-presets-v2"], null, "full reset must remove saved presets");
    assert.equal(storage["glamour-atelier-background-presets-v2"], null, "full reset must remove legacy saved presets too");
    assert.deepEqual(JSON.parse(storage["tuyeong-set-maker2-ui-v2"]), { libraryCollapsed: true, canvasViewZoom: 100 });
    assert.equal(storage["glamour-atelier-ui-v2"], null, "full reset must remove legacy UI preferences too");
    assert.equal(await indexedAssetCount(page), 0, "full reset must clear the IndexedDB image vault");

    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator("#resetButton").click();
    const mobileMenu = await page.evaluate(() => {
      const rect = document.querySelector("#resetMenu").getBoundingClientRect();
      return { right: rect.right, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.equal(mobileMenu.overflow, false);
    assert.ok(mobileMenu.right <= 320);
    await page.screenshot({ path: "artifacts/ui-info-reset-after.png", fullPage: false });
    console.log("PASS: lineup expression readiness, scoped reset behavior, LOOK BOOK persistence, and full local workspace deletion are verified.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
