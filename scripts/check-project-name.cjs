const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";
const oldKeys = {
  draft: "glamour-atelier-draft-v3",
  ui: "glamour-atelier-ui-v2",
};
const currentKeys = {
  draft: "tuyeong-set-maker2-draft-v3",
  ui: "tuyeong-set-maker2-ui-v2",
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(({ oldKeys }) => {
      localStorage.clear();
      localStorage.setItem(oldKeys.draft, JSON.stringify({ version: 3, looks: [{ id: "legacy-look", title: "이전 룩" }] }));
      localStorage.setItem(oldKeys.ui, JSON.stringify({ libraryCollapsed: false }));
    }, { oldKeys });
    await page.goto(`${baseUrl}/?project-name-check=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvasBoard");

    const branding = await page.evaluate(({ oldKeys, currentKeys }) => ({
      title: document.title,
      wordmark: document.querySelector(".wordmark-copy strong")?.textContent,
      tagline: document.querySelector(".wordmark-copy small")?.textContent,
      wordmarkLabel: document.querySelector(".wordmark")?.getAttribute("aria-label"),
      mainLabel: document.querySelector("main")?.getAttribute("aria-label"),
      siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
      applicationName: document.querySelector('meta[name="application-name"]')?.getAttribute("content"),
      favicon: document.querySelector('link[rel="icon"]')?.getAttribute("href") ?? null,
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null,
      oldStorage: Object.fromEntries(Object.values(oldKeys).map((key) => [key, localStorage.getItem(key)])),
      currentStorage: Object.fromEntries(Object.values(currentKeys).map((key) => [key, localStorage.getItem(key)])),
    }), { oldKeys, currentKeys });
    assert.equal(branding.title, "투영세트메이커 02 · 룩북 | 이전 룩");
    assert.equal(branding.wordmark, "투영세트메이커");
    assert.equal(branding.tagline, "02 · 룩북");
    assert.equal(branding.wordmarkLabel, "투영세트메이커 02 · 룩북 홈");
    assert.equal(branding.mainLabel, "투영세트메이커 02 · 룩북 편집기");
    assert.equal(branding.siteName, "투영세트메이커");
    assert.equal(branding.applicationName, "투영세트메이커2");
    assert.equal(branding.favicon, "assets/icons/favicon-02.svg");
    assert.equal(branding.manifest, "site.webmanifest");
    assert.deepEqual(branding.currentStorage[currentKeys.ui], JSON.stringify({ libraryCollapsed: false }));
    assert.ok(branding.currentStorage[currentKeys.draft]);
    assert.deepEqual(Object.values(branding.oldStorage), [null, null]);

    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector(".wordmark-copy strong")?.textContent === "Glamour Set Maker");
    const englishBranding = await page.evaluate(() => ({
      title: document.title,
      wordmark: document.querySelector(".wordmark-copy strong")?.textContent,
      tagline: document.querySelector(".wordmark-copy small")?.textContent,
      wordmarkLabel: document.querySelector(".wordmark")?.getAttribute("aria-label"),
      mainLabel: document.querySelector("main")?.getAttribute("aria-label"),
      siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
    }));
    assert.equal(englishBranding.wordmark, "Glamour Set Maker");
    assert.equal(englishBranding.tagline, "02 · LOOKBOOK");
    assert.equal(englishBranding.wordmarkLabel, "Glamour Set Maker 02 · Lookbook home");
    assert.equal(englishBranding.mainLabel, "Glamour Set Maker 02 · Lookbook editor");
    assert.equal(englishBranding.siteName, "Glamour Set Maker");
    assert.match(englishBranding.title, /^Glamour Set Maker 02 · LOOKBOOK \|/);

    await page.locator("#languageSelect").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja" && document.querySelector(".wordmark-copy strong")?.textContent === "ミラプリセットメーカー");
    const japaneseBranding = await page.evaluate(() => ({
      title: document.title,
      wordmark: document.querySelector(".wordmark-copy strong")?.textContent,
      tagline: document.querySelector(".wordmark-copy small")?.textContent,
      wordmarkLabel: document.querySelector(".wordmark")?.getAttribute("aria-label"),
      mainLabel: document.querySelector("main")?.getAttribute("aria-label"),
      siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
    }));
    assert.equal(japaneseBranding.wordmark, "ミラプリセットメーカー");
    assert.equal(japaneseBranding.tagline, "02 · ルックブック");
    assert.equal(japaneseBranding.wordmarkLabel, "ミラプリセットメーカー 02 · ルックブック ホーム");
    assert.equal(japaneseBranding.mainLabel, "ミラプリセットメーカー 02 · ルックブック エディター");
    assert.equal(japaneseBranding.siteName, "ミラプリセットメーカー");
    assert.match(japaneseBranding.title, /^ミラプリセットメーカー 02 · ルックブック \|/);

    const databaseMigration = await page.evaluate(async () => {
      const oldDatabaseName = "glamour-atelier-assets-v1";
      const currentDatabaseName = "tuyeong-set-maker2-assets-v1";
      const assetKey = "project-name-migration-check";
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(oldDatabaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("character-assets", { keyPath: "assetKey" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("character-assets", "readwrite");
          transaction.objectStore("character-assets").put({ assetKey, originalBlob: new Blob(["legacy image"]) });
          transaction.oncomplete = () => { database.close(); resolve(); };
          transaction.onerror = () => { database.close(); reject(transaction.error); };
        };
      });

      const vault = ImageAssets.create({ indexedDB, legacyDatabaseNames: [oldDatabaseName] });
      const record = await vault.read(assetKey);
      const currentRecord = await new Promise((resolve, reject) => {
        const request = indexedDB.open(currentDatabaseName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("character-assets", "readonly");
          const getRequest = transaction.objectStore("character-assets").get(assetKey);
          getRequest.onsuccess = () => { database.close(); resolve(getRequest.result || null); };
          getRequest.onerror = () => { database.close(); reject(getRequest.error); };
        };
      });
      return {
        recordKey: record?.assetKey,
        recordText: await record?.originalBlob?.text(),
        promotedKey: currentRecord?.assetKey,
        promotedText: await currentRecord?.originalBlob?.text(),
      };
    });
    assert.deepEqual(databaseMigration, {
      recordKey: "project-name-migration-check",
      recordText: "legacy image",
      promotedKey: "project-name-migration-check",
      promotedText: "legacy image",
    });
    console.log("PASS: shared series branding, local-storage migration, and IndexedDB image migration are aligned.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
