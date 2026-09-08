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
      window.__liveStyleRenderCalls = 0;
      const originalRenderStyles = window.renderStyles;
      window.renderStyles = (...args) => {
        window.__liveStyleRenderCalls += 1;
        return originalRenderStyles(...args);
      };
      window.__liveStyleControlCalls = Object.fromEntries([
        "renderSourcePanel",
        "renderBackgroundPresets",
        "syncTitleFontControls",
        "syncTitleAlignmentControls",
        "syncCopyColorControls",
      ].map((name) => [name, 0]));
      for (const name of Object.keys(window.__liveStyleControlCalls)) {
        const original = window[name];
        window[name] = (...args) => {
          window.__liveStyleControlCalls[name] += 1;
          return original(...args);
        };
      }
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
      liveStyleRenderCalls: window.__liveStyleRenderCalls,
      liveStyleControlCalls: window.__liveStyleControlCalls,
    }));
    assert.ok(draftWrites.count <= 2, `rapid style input wrote ${draftWrites.count} drafts instead of batching`);
    assert.ok(draftWrites.liveStyleRenderCalls >= 1 && draftWrites.liveStyleRenderCalls <= 4, `rapid style input should coalesce visual renders, received ${draftWrites.liveStyleRenderCalls}`);
    assert.equal(draftWrites.shadowStrength, 60, "batched draft should contain the final input value");
    assert.deepEqual(draftWrites.liveStyleControlCalls, {
      renderSourcePanel: 0,
      renderBackgroundPresets: 0,
      syncTitleFontControls: 0,
      syncTitleAlignmentControls: 0,
      syncCopyColorControls: 0,
    }, `live style input rebuilt unrelated controls: ${JSON.stringify(draftWrites.liveStyleControlCalls)}`);
    const catalogScope = await page.evaluate(() => {
      state.activePanel = "stylePanel";
      elements.itemSearch.value = "";
      elements.catalogResults.innerHTML = '<span data-catalog-scope-sentinel="true"></span>';
      renderAll();
      return Boolean(elements.catalogResults.querySelector('[data-catalog-scope-sentinel="true"]'));
    });
    assert.equal(catalogScope, true, "style-only refresh should not rebuild an empty item catalog");
    const largeDraft = await page.evaluate(async () => {
      while (looks.length < 250) {
        const index = looks.length + 1;
        looks.push(createBlankLook(index, `perf-look-${index}`));
      }
      await saveState();
      const pointer = JSON.parse(localStorage.getItem("tuyeong-set-maker2-draft-v3"));
      const persisted = JSON.parse(await draftStorage.read("tuyeong-set-maker2-draft-v3"));
      return { pointer, version: persisted.version, lookCount: persisted.looks.length };
    });
    assert.equal(largeDraft.pointer.storage, "indexeddb", "large drafts should not block on localStorage payload writes");
    assert.equal(largeDraft.pointer.payloadType, "structured", "large drafts should use IndexedDB structured cloning");
    assert.equal(largeDraft.version, 3);
    assert.equal(largeDraft.lookCount, 250);
    const coalescedSaveCalls = await page.evaluate(async () => {
      const originalWriteValue = draftStorage.writeValue;
      let writeValueCalls = 0;
      draftStorage.writeValue = (...args) => {
        writeValueCalls += 1;
        return originalWriteValue(...args);
      };
      try {
        const writes = Array.from({ length: 10 }, () => saveState());
        looks[0].title = "동시 저장 최신 상태";
        await Promise.all(writes);
        const persisted = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
        return { writeValueCalls, title: persisted?.looks?.[0]?.title };
      } finally {
        draftStorage.writeValue = originalWriteValue;
      }
    });
    assert.equal(coalescedSaveCalls.writeValueCalls, 1, `same-task saves should coalesce to one draft write, received ${coalescedSaveCalls.writeValueCalls}`);
    assert.equal(coalescedSaveCalls.title, "동시 저장 최신 상태", `coalesced saves must persist the latest synchronous state: ${JSON.stringify(coalescedSaveCalls)}`);
    const inFlightSave = await page.evaluate(async () => {
      const originalWriteValue = draftStorage.writeValue;
      let writeValueCalls = 0;
      let releaseFirstWrite;
      const firstWriteGate = new Promise((resolve) => { releaseFirstWrite = resolve; });
      draftStorage.writeValue = (...args) => {
        writeValueCalls += 1;
        const write = originalWriteValue(...args);
        return writeValueCalls === 1 ? write.then((value) => firstWriteGate.then(() => value)) : write;
      };
      try {
        const first = saveState({ immediate: true });
        looks[0].title = "진행 중 최신 상태";
        const second = saveState();
        releaseFirstWrite();
        await Promise.all([first, second]);
        const persisted = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
        return { writeValueCalls, title: persisted?.looks?.[0]?.title };
      } finally {
        draftStorage.writeValue = originalWriteValue;
      }
    });
    assert.equal(inFlightSave.writeValueCalls, 2, `a state change during an active write should schedule one latest follow-up, received ${inFlightSave.writeValueCalls}`);
    assert.equal(inFlightSave.title, "진행 중 최신 상태", `active-write follow-up must persist the latest state: ${JSON.stringify(inFlightSave)}`);
    const saveStatusTruth = await page.evaluate(async () => {
      const originalWriteValue = draftStorage.writeValue;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      draftStorage.writeValue = () => gate;
      try {
        const pending = saveState({ immediate: true });
        const during = {
          text: document.querySelector("#saveStatus")?.textContent || "",
          retryHidden: document.querySelector("#saveRetryButton")?.hidden ?? true,
        };
        release();
        await pending;
        return {
          language: state.language,
          during,
          after: document.querySelector("#saveStatus")?.textContent || "",
          retryHiddenAfter: document.querySelector("#saveRetryButton")?.hidden ?? true,
        };
      } finally {
        draftStorage.writeValue = originalWriteValue;
      }
    });
    assert.equal(saveStatusTruth.during.text, await page.evaluate((language) => I18n.t("status.saving", {}, language), saveStatusTruth.language));
    assert.equal(saveStatusTruth.during.retryHidden, true, "retry should stay hidden while a save is in flight");
    assert.equal(saveStatusTruth.after, await page.evaluate((language) => I18n.t("status.saved", {}, language), saveStatusTruth.language));
    assert.equal(saveStatusTruth.retryHiddenAfter, true, "retry should hide after a successful save");
    const flushedPendingSave = await page.evaluate(async () => {
      const originalWriteValue = draftStorage.writeValue;
      let writeValueCalls = 0;
      draftStorage.writeValue = (...args) => {
        writeValueCalls += 1;
        return originalWriteValue(...args);
      };
      try {
        const pending = saveState();
        const beforeFlush = writeValueCalls;
        flushScheduledSaveState();
        const duringFlush = writeValueCalls;
        await pending;
        return { beforeFlush, duringFlush, writeValueCalls };
      } finally {
        draftStorage.writeValue = originalWriteValue;
      }
    });
    assert.equal(flushedPendingSave.beforeFlush, 0, `deferred save should not start before the flush boundary: ${JSON.stringify(flushedPendingSave)}`);
    assert.equal(flushedPendingSave.duringFlush, 1, `flush should start a pending save immediately: ${JSON.stringify(flushedPendingSave)}`);
    assert.equal(flushedPendingSave.writeValueCalls, 1, `flush should not duplicate the pending save: ${JSON.stringify(flushedPendingSave)}`);
    console.log(`PASS: delayed remote font keeps the app interactive (${domContentLoadedMs}ms) and rapid input batches draft writes (${draftWrites.count}).`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
