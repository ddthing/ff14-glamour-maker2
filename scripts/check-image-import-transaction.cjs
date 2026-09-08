const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4173";

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#canvasBoard");
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const failedPage = await openPage(browser);
    const failedImport = await failedPage.evaluate(async () => {
      const originalUpdate = characterAssetVault.update;
      characterAssetVault.update = async () => { throw new Error("simulated image storage failure"); };
      try {
        const result = await handleImageFile(new File(["fixture"], "failed.png", { type: "image/png" }));
        const character = state.characters[0];
        return {
          result,
          assetKey: character.assetKey || null,
          source: character.src || "",
          imageState: document.querySelector("#imageState")?.dataset.state || "",
          assetUrlCount: assetUrls.size,
          draft: localStorage.getItem(draftStorageKey),
        };
      } finally {
        characterAssetVault.update = originalUpdate;
      }
    });
    assert.equal(failedImport.result, false, "a failed image write must report failure");
    assert.equal(failedImport.assetKey, null, "a failed image write must not leave an asset key in state");
    assert.equal(failedImport.source, "", "a failed image write must not leave a Blob URL in state");
    assert.equal(failedImport.imageState, "empty", "a failed image write must restore the empty image state");
    assert.equal(failedImport.assetUrlCount, 0, "a failed image write must revoke its temporary Blob URL");
    assert.equal(failedImport.draft, null, "a failed image write must not create a draft");
    await failedPage.close();

    const pendingPage = await openPage(browser);
    const pendingImport = await pendingPage.evaluate(async () => {
      const originalUpdate = characterAssetVault.update;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      characterAssetVault.update = (...args) => gate.then(() => originalUpdate(...args));
      try {
        const importDone = handleImageFiles([
          new File(["fixture-a"], "pending-a.png", { type: "image/png" }),
          new File(["fixture-b"], "pending-b.png", { type: "image/png" }),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 80));
        const beforeCommit = localStorage.getItem(draftStorageKey);
        release();
        await importDone;
        const saved = JSON.parse(localStorage.getItem(draftStorageKey) || "null");
        return {
          beforeCommit,
          savedCharacters: saved?.characters?.slice(0, 2).map((character) => ({
            assetKey: character.assetKey || null,
            fileName: character.fileName,
          })) || [],
        };
      } finally {
        characterAssetVault.update = originalUpdate;
      }
    });
    assert.equal(pendingImport.beforeCommit, null, "multi-image import must not persist before asset writes commit");
    assert.equal(pendingImport.savedCharacters.length, 2, "multi-image import should persist both committed characters");
    assert.ok(pendingImport.savedCharacters.every((character) => character.assetKey), "committed image records need asset keys");
    assert.deepEqual(pendingImport.savedCharacters.map((character) => character.fileName), ["pending-a.png", "pending-b.png"]);
    const imageDecodeHints = await pendingPage.evaluate(() => ({
      card: [...document.querySelectorAll("#portraitWrap .character-figure img")].map((image) => ({ loading: image.loading, decoding: image.decoding })),
      castSelector: [...document.querySelectorAll("#castSelector img")].map((image) => ({ loading: image.loading, decoding: image.decoding })),
      itemSelector: [...document.querySelectorAll("#itemCharacterSelector img")].map((image) => ({ loading: image.loading, decoding: image.decoding })),
    }));
    assert.ok(imageDecodeHints.card.length === 2 && imageDecodeHints.card.every(({ loading, decoding }) => loading === "eager" && decoding === "async"), `card images need async decoding hints: ${JSON.stringify(imageDecodeHints)}`);
    assert.ok([...imageDecodeHints.castSelector, ...imageDecodeHints.itemSelector].every(({ loading, decoding }) => loading === "lazy" && decoding === "async"), `thumbnail images need lazy async decoding hints: ${JSON.stringify(imageDecodeHints)}`);
    await pendingPage.close();

    const cancelPage = await openPage(browser);
    await cancelPage.evaluate(async () => {
      await handleImageFile(new File(["old"], "old.png", { type: "image/png" }));
    });
    const cancelledImport = await cancelPage.evaluate(async () => {
      const originalUpdate = characterAssetVault.update;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      characterAssetVault.update = (...args) => gate.then(() => originalUpdate(...args));
      try {
        const replacementDone = handleImageFile(new File(["replacement"], "replacement.png", { type: "image/png" }));
        await new Promise((resolve) => setTimeout(resolve, 40));
        removeCharacterImage(0);
        release();
        return await replacementDone;
      } finally {
        characterAssetVault.update = originalUpdate;
      }
    });
    assert.equal(cancelledImport, false, "removing a character should invalidate its pending replacement");
    assert.deepEqual(await cancelPage.evaluate(() => ({
      assetKey: state.characters[0].assetKey || null,
      source: state.characters[0].src || "",
      imageState: document.querySelector("#imageState")?.dataset.state || "",
    })), { assetKey: null, source: "", imageState: "empty" });
    await cancelPage.close();
    console.log("PASS: failed and pending image imports commit only after storage succeeds and leave no orphaned preview state.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
