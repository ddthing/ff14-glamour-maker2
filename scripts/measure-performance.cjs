const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
const largeImagePath = path.join(__dirname, "..", "artifacts", "background-benchmark", "inspyrenet", "ffxiv-blue-front.png", "ffxiv-blue-front_rgba.png");
const largeImage = fs.existsSync(largeImagePath) ? fs.readFileSync(largeImagePath) : fixturePng;

function buildItemResults() {
  return Array.from({ length: 250 }, (_, index) => ({
    id: String(9100000 + index),
    slot: "head",
    iconUrl: index === 0 ? "https://xivapi.com/i/9100/9100000.png" : "",
    names: { ko: `성능 측정 장비 ${index}`, en: `Performance Fixture ${index}` },
    meta: { ko: "머리 · 측정" },
  }));
}

const itemResults = buildItemResults();
const probeInit = () => {
  localStorage.clear();
  window.__perf = { calls: {}, storage: [], longTasks: [] };
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function measuredSetItem(key, value) {
    const start = performance.now();
    try {
      return originalSetItem.call(this, key, value);
    } finally {
      window.__perf.storage.push({ key, bytes: String(value).length, duration: performance.now() - start });
    }
  };
  if ("PerformanceObserver" in window) {
    try {
      new PerformanceObserver((list) => {
        window.__perf.longTasks.push(...list.getEntries().map((entry) => ({ duration: entry.duration, name: entry.name })));
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long-task entries are not available in every headless runtime.
    }
  }
};

async function waitForFrames(page, count = 3) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function instrument(page) {
  const names = [
    "renderAll",
    "renderStyles",
    "renderEquipment",
    "renderBoardGear",
    "renderCatalog",
    "renderCatalogResults",
    "renderPattern",
    "renderMultiInfo",
    "renderSourcePanel",
    "fitBoardTitle",
    "saveState",
    "hydrateCurrentLookEnglishNames",
  ];
  await page.evaluate((functionNames) => {
    for (const name of functionNames) {
      const original = window[name];
      if (typeof original !== "function" || original.__perfWrapped) continue;
      const wrapped = function performanceWrappedFunction(...args) {
        const start = performance.now();
        const record = { duration: 0, async: false };
        const finish = () => {
          record.duration = performance.now() - start;
          (window.__perf.calls[name] ||= []).push(record);
        };
        try {
          const result = original.apply(this, args);
          if (result && typeof result.then === "function") {
            record.async = true;
            return result.then((value) => { finish(); return value; }, (error) => { finish(); throw error; });
          }
          finish();
          return result;
        } catch (error) {
          finish();
          throw error;
        }
      };
      wrapped.__perfWrapped = true;
      window[name] = wrapped;
    }
    window.__perf.instrumentedFunctions = functionNames.filter((name) => typeof window[name] === "function");
  }, names);
}

async function resetProbe(page) {
  await page.evaluate(() => {
    window.__perf.calls = {};
    window.__perf.storage = [];
    window.__perf.longTasks = [];
  });
}

async function readProbe(page) {
  return page.evaluate(() => {
    const summarize = (entries = []) => {
      const durations = entries.map((entry) => entry.duration).sort((a, b) => a - b);
      const percentile = (ratio) => durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * ratio))] : 0;
      return {
        count: durations.length,
        totalMs: durations.reduce((sum, value) => sum + value, 0),
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        maxMs: durations.at(-1) || 0,
      };
    };
    const calls = Object.fromEntries(Object.entries(window.__perf.calls).map(([name, entries]) => [name, summarize(entries)]));
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => /cdn\.jsdelivr|fonts|\.woff2?|pretendard/i.test(entry.name))
      .map((entry) => ({ name: entry.name, duration: entry.duration, startTime: entry.startTime, transferSize: entry.transferSize }))
      .sort((left, right) => right.duration - left.duration);
    const paints = performance.getEntriesByType("paint").map((entry) => ({ name: entry.name, startTime: entry.startTime }));
    return {
      functions: calls,
      storage: {
        count: window.__perf.storage.length,
        totalMs: window.__perf.storage.reduce((sum, entry) => sum + entry.duration, 0),
        bytes: window.__perf.storage.reduce((sum, entry) => sum + entry.bytes, 0),
      },
      longTasks: window.__perf.longTasks,
      instrumentedFunctions: window.__perf.instrumentedFunctions,
      resources,
      paints,
      navigation: navigation ? {
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        domInteractiveMs: navigation.domInteractive,
        loadEventMs: navigation.loadEventEnd,
        transferSize: navigation.transferSize,
      } : null,
    };
  });
}

async function createScenario(browser, { items = false, blockRemoteFont = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(probeInit);
  const page = await context.newPage();
  if (blockRemoteFont) {
    await page.route("**/pretendardvariable-dynamic-subset.min.css", (route) => route.abort());
  }
  if (items) {
    await page.route("**/api/items/search*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "live", results: itemResults }),
    }));
    await page.route("https://xivapi.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: fixturePng }));
  }
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#canvasBoard");
  await waitForFrames(page);
  await instrument(page);
  return { context, page };
}

async function measureStyleBurst(page, count = 40) {
  return page.evaluate(async (eventCount) => {
    const input = document.querySelector("#shadowRange");
    const start = performance.now();
    for (let index = 0; index < eventCount; index += 1) {
      input.value = String((index * 7) % 71);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return performance.now() - start;
  }, count);
}

async function measureSearch(page) {
  return page.evaluate(async () => {
    const input = document.querySelector("#itemSearch");
    const start = performance.now();
    input.value = "성능";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    while (document.querySelectorAll(".catalog-result").length < 250) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return performance.now() - start;
  });
}

async function runInitialLoad(browser, { blockRemoteFont = false } = {}) {
  const { context, page } = await createScenario(browser, { blockRemoteFont });
  try {
    await waitForFrames(page, 5);
    return { scenario: blockRemoteFont ? "initial-load-remote-font-blocked" : "initial-load", ...(await readProbe(page)) };
  } finally {
    await context.close();
  }
}

async function runStyleInput(browser) {
  const { context, page } = await createScenario(browser);
  try {
    await page.locator("#styleTab").click();
    await resetProbe(page);
    const burstMs = await measureStyleBurst(page);
    await waitForFrames(page);
    return { scenario: "40-style-input-events", burstMs, ...(await readProbe(page)) };
  } finally {
    await context.close();
  }
}

async function runCatalog(browser) {
  const { context, page } = await createScenario(browser, { items: true });
  try {
    await page.locator("#itemsTab").click();
    await resetProbe(page);
    const searchMs = await measureSearch(page);
    const searchProbe = await readProbe(page);
    await resetProbe(page);
    const linkMs = await page.evaluate(async () => {
      const start = performance.now();
      document.querySelector(".catalog-result")?.click();
      while (!document.querySelector('.equipment-remove[data-remove-slot="head"]')) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return performance.now() - start;
    });
    await waitForFrames(page);
    return {
      scenario: "catalog-250-results",
      searchMs,
      search: searchProbe,
      linkMs,
      link: await readProbe(page),
    };
  } finally {
    await context.close();
  }
}

async function runCharacterFilter(browser) {
  const { context, page } = await createScenario(browser);
  try {
    await page.locator('[data-cast-count="5"]').click();
    await page.locator("#imageInput").setInputFiles(Array.from({ length: 5 }, (_, index) => ({
      name: `perf-${index + 1}.png`,
      mimeType: "image/png",
      buffer: largeImage,
    })));
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap .character-figure img").length === 5);
    await page.waitForFunction(() => typeof pendingAssetWrites !== "undefined" && pendingAssetWrites.size === 0);
    await page.evaluate(() => {
      state.characters.slice(0, 5).forEach((character) => { character.cutout = true; });
      state.multiInfoEnabled = true;
      state.multiInfoMode = "silhouette";
      renderStyles();
    });
    await resetProbe(page);
    const fiveCharacterMs = await measureStyleBurst(page);
    const fiveCharacter = await readProbe(page);
    await page.locator('[data-cast-count="1"]').click();
    await page.waitForFunction(() => document.querySelectorAll("#portraitWrap .character-figure img").length === 1);
    await resetProbe(page);
    const oneCharacterMs = await measureStyleBurst(page);
    const oneCharacter = await readProbe(page);
    return { scenario: "one-vs-five-character-filter", oneCharacterMs, oneCharacter, fiveCharacterMs, fiveCharacter };
  } finally {
    await context.close();
  }
}

async function runDraftScaling(browser) {
  const { context, page } = await createScenario(browser);
  try {
    const measurements = [];
    for (const targetSize of [1, 25, 100, 250]) {
      await page.evaluate((size) => {
        while (looks.length < size) {
          const index = looks.length + 1;
          looks.push(createBlankLook(index, `perf-look-${index}`));
        }
      }, targetSize);
      await resetProbe(page);
      const saveBurstMs = await page.evaluate(() => {
        const start = performance.now();
        for (let index = 0; index < 10; index += 1) saveState();
        return performance.now() - start;
      });
      measurements.push({ targetSize, saveBurstMs, probe: await readProbe(page) });
    }
    return { scenario: "save-state-scaling", measurements };
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const results = [];
    results.push(await runInitialLoad(browser));
    results.push(await runInitialLoad(browser, { blockRemoteFont: true }));
    for (const runner of [runStyleInput, runCatalog, runCharacterFilter, runDraftScaling]) results.push(await runner(browser));
    const outputPath = path.join(__dirname, "..", "artifacts", "performance-baseline.json");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2));
    console.log(JSON.stringify({ outputPath, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
