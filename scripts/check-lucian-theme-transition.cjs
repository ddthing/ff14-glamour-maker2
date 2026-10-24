const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { deflateSync } = require("node:zlib");

const storageKey = "glamour-maker2-editor-theme-v1";
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function makeSyntheticPng(width = 16, height = 24) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      raw[offset] = x < width / 2 ? 235 : 37;
      raw[offset + 1] = y < height / 2 ? 105 : 184;
      raw[offset + 2] = (x + y) % 2 ? 72 : 214;
      raw[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND"),
  ]);
}

async function openThemePage(browser, { reducedMotion = "no-preference", unsupportedViewTransitions = false } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 1,
    reducedMotion,
  });
  await page.addInitScript(({ key, unsupported }) => {
    localStorage.clear();
    sessionStorage.clear();
    let systemDark = false;
    const media = "(prefers-color-scheme: dark)";
    const originalMatchMedia = window.matchMedia.bind(window);
    const listeners = new Set();
    const systemMedia = {
      media,
      get matches() { return systemDark; },
      addEventListener(type, callback) { if (type === "change") listeners.add(callback); },
      removeEventListener(type, callback) { if (type === "change") listeners.delete(callback); },
      addListener(callback) { listeners.add(callback); },
      removeListener(callback) { listeners.delete(callback); },
      dispatchEvent(event) { listeners.forEach((callback) => callback.call(systemMedia, event)); return true; },
    };
    window.matchMedia = (query) => query === media ? systemMedia : originalMatchMedia(query);
    window.__setSystemThemeDark = (value) => {
      systemDark = Boolean(value);
      systemMedia.dispatchEvent({ type: "change", matches: systemDark, media });
    };

    const nativeStartViewTransition = document.startViewTransition?.bind(document);
    window.__viewTransitionCalls = 0;
    window.__lastThemeTransition = null;
    if (unsupported) {
      Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
    } else if (nativeStartViewTransition) {
      document.startViewTransition = (callback, options) => {
        window.__viewTransitionCalls += 1;
        const transition = nativeStartViewTransition(callback, options);
        window.__lastThemeTransition = transition;
        return transition;
      };
    }
    window.__themePreferenceKey = key;
  }, { key: storageKey, unsupported: unsupportedViewTransitions });

  const separator = baseUrl.includes("?") ? "&" : "?";
  await page.goto(`${baseUrl}${separator}lucian-theme-transition-check=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.EditorTheme?.clearPreference
    && document.querySelector("#canvasBoard")?.dataset.cast === "1"
    && document.querySelector("#editorThemeToggle"),
  ));
  await page.waitForFunction(() => [...document.styleSheets].some((sheet) => sheet.href?.includes("lucian-theme-transition.css")));
  assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-pressed"), "false");
  return page;
}

async function waitForTheme(page, theme) {
  await page.waitForFunction((value) => document.documentElement.dataset.editorTheme === value, theme);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function installPngCapture(page) {
  await page.evaluate(() => {
    window.__lucianPngBlobs = [];
    const render = CardPng.render;
    CardPng.render = async (...args) => {
      const blob = await render(...args);
      window.__lucianPngBlobs.push(blob);
      return blob;
    };
  });
}

async function capturePngHash(page) {
  const priorCount = await page.evaluate(() => window.__lucianPngBlobs.length);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await downloadPromise;
  await download.cancel();
  await page.waitForFunction((count) => window.__lucianPngBlobs.length > count, priorCount);
  await page.waitForFunction(() => !document.querySelector("#exportButton")?.hasAttribute("aria-busy"));
  return page.evaluate(async () => {
    const blob = window.__lucianPngBlobs.at(-1);
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return {
      type: blob.type,
      size: blob.size,
      sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    };
  });
}

async function clickAndInspectReveal(page, { nextTheme, input = "pointer", screenshot = "" } = {}) {
  const trigger = page.locator("#editorThemeToggle");
  const origin = await trigger.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  });
  if (input === "keyboard") {
    await trigger.focus();
    await page.keyboard.press("Enter");
  } else {
    await trigger.click();
  }
  await page.waitForFunction((value) => (
    document.documentElement.dataset.editorTheme === value
    && document.documentElement.classList.contains("u219-theme-transition")
    && window.__lastThemeTransition
  ), nextTheme);
  await page.evaluate(async () => { await window.__lastThemeTransition.ready; });
  const reveal = await page.evaluate(() => {
    const root = document.documentElement;
    const newSnapshot = getComputedStyle(root, "::view-transition-new(root)");
    const oldSnapshot = getComputedStyle(root, "::view-transition-old(root)");
    return {
      direction: root.classList.contains("u219-theme-transition--dark") ? "dark" : "light",
      directionClasses: [...root.classList].filter((name) => ["u219-theme-transition--dark", "u219-theme-transition--light"].includes(name)),
      originX: root.style.getPropertyValue("--u219-origin-x"),
      originY: root.style.getPropertyValue("--u219-origin-y"),
      radius: Number.parseInt(root.style.getPropertyValue("--u219-reveal-radius"), 10),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      newAnimation: newSnapshot.animationName,
      newDuration: newSnapshot.animationDuration,
      newClipPath: newSnapshot.clipPath,
      oldAnimation: oldSnapshot.animationName,
    };
  });
  assert.equal(reveal.direction, nextTheme);
  assert.deepEqual(reveal.directionClasses, [`u219-theme-transition--${nextTheme}`], "only the latest reveal direction may remain active");
  assert.equal(reveal.originX, `${origin.x}px`, "reveal x should use the trigger's visual center");
  assert.equal(reveal.originY, `${origin.y}px`, "reveal y should use the trigger's visual center");
  const farthestX = Math.max(origin.x, reveal.viewportWidth - origin.x);
  const farthestY = Math.max(origin.y, reveal.viewportHeight - origin.y);
  assert.ok(reveal.radius >= Math.hypot(farthestX, farthestY), `circle should cover the viewport corners: ${JSON.stringify(reveal)}`);
  if (nextTheme === "dark") {
    assert.equal(reveal.newAnimation, "u219-theme-circle-grow");
    assert.equal(reveal.newDuration, "0.7s");
    assert.match(reveal.newClipPath, /circle\(/u);
  } else {
    assert.equal(reveal.oldAnimation, "u219-theme-circle-shrink");
    assert.equal(reveal.oldAnimation === reveal.newAnimation, false);
  }
  if (screenshot) {
    await page.waitForTimeout(110);
    await page.screenshot({ path: path.join(__dirname, "..", "artifacts", screenshot), animations: "allow" });
  }
  return { transition: reveal, object: true };
}

async function waitForRevealCleanup(page, theme) {
  await page.evaluate(async () => {
    try { await window.__lastThemeTransition.finished; } catch { /* replaced transitions may be aborted */ }
  });
  await page.waitForFunction((value) => (
    document.documentElement.dataset.editorTheme === value
    && !document.documentElement.classList.contains("u219-theme-transition")
    && !document.documentElement.style.getPropertyValue("--u219-origin-x")
  ), theme);
}

(async () => {
  fs.mkdirSync(path.join(__dirname, "..", "artifacts"), { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await openThemePage(browser);
    const viewTransitionsSupported = await page.evaluate(() => typeof document.startViewTransition === "function");
    assert.equal(viewTransitionsSupported, true, "the animation acceptance case needs native View Transitions support");
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.locator("#imageInput").setInputFiles({
      name: "transition-swatch.png",
      mimeType: "image/png",
      buffer: makeSyntheticPng(),
    });
    await page.waitForFunction(() => (
      document.querySelector("#sourceFileName")?.textContent.includes("transition-swatch.png")
      && document.querySelector("#portraitWrap img")?.naturalWidth === 16
      && pendingAssetWrites.size === 0
    ));
    await page.locator("#cardTitleInput").fill("Theme Transition");
    await page.locator("#cardTitleInput").blur();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.copyRendered === "true");
    await page.evaluate(async () => { await document.fonts.ready; });
    await installPngCapture(page);
    const pngBefore = await capturePngHash(page);
    assert.equal(pngBefore.type, "image/png");

    await clickAndInspectReveal(page, { nextTheme: "dark", screenshot: "lucian-219-dark-reveal.png" });
    await waitForRevealCleanup(page, "dark");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("#editorThemeToggleMark").innerHTML(), /<path/u, "dark state should use Lucian's moon SVG");

    const pngDark = await capturePngHash(page);
    assert.deepEqual(pngDark, pngBefore, "dark reveal must not alter the exported PNG bytes");

    await clickAndInspectReveal(page, { nextTheme: "light", input: "keyboard", screenshot: "lucian-219-light-return.png" });
    await waitForRevealCleanup(page, "light");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-pressed"), "false");
    assert.match(await page.locator("#editorThemeToggleMark").innerHTML(), /<circle/u, "light state should use Lucian's sun SVG");
    assert.equal(await page.locator("#canvasBoard").count(), 1, "theme transition must keep the live editor DOM single-instance");
    const pngLight = await capturePngHash(page);
    assert.deepEqual(pngLight, pngBefore, "light return must preserve the exported PNG bytes");

    const rapidStart = await page.evaluate(() => window.__viewTransitionCalls);
    await page.evaluate(() => {
      const button = document.querySelector("#editorThemeToggle");
      button.click();
      button.click();
    });
    await page.waitForFunction((count) => (
      window.__viewTransitionCalls === count + 2
      && document.documentElement.classList.contains("u219-theme-transition")
    ), rapidStart);
    const rapidDirection = await page.evaluate(() => [...document.documentElement.classList]
      .filter((name) => ["u219-theme-transition--dark", "u219-theme-transition--light"].includes(name)));
    assert.deepEqual(rapidDirection, ["u219-theme-transition--light"], "the last rapid toggle should own the sole direction class");
    await waitForRevealCleanup(page, "light");
    assert.equal(await page.evaluate(() => window.__viewTransitionCalls), rapidStart + 2, "rapid toggles should each create a transition request");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), "light", "the latest of rapid toggles should own persisted state");
    assert.equal(pageErrors.length, 0, `rapid transitions should not emit browser errors: ${JSON.stringify(pageErrors)}`);

    await page.locator("#editorThemeToggle").click();
    await page.waitForFunction(() => document.documentElement.dataset.editorTheme === "dark" && document.documentElement.classList.contains("u219-theme-transition"));
    await page.evaluate(() => window.EditorTheme.clearPreference());
    await waitForTheme(page, "light");
    await page.waitForTimeout(760);
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-pressed"), "false", "clearPreference should cancel a pending reveal back to system light");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), null);
    assert.equal(await page.locator("#canvasBoard").count(), 1);
    assert.equal(pageErrors.length, 0, `cancelled transition should not emit browser errors: ${JSON.stringify(pageErrors)}`);
    await page.close();

    const reducedPage = await openThemePage(browser, { reducedMotion: "reduce" });
    await reducedPage.locator("#editorThemeToggle").click();
    await waitForTheme(reducedPage, "dark");
    assert.equal(await reducedPage.evaluate(() => window.__viewTransitionCalls), 0, "reduced motion should use an instant theme change");
    assert.equal(await reducedPage.evaluate(() => document.documentElement.classList.contains("u219-theme-transition")), false);
    await reducedPage.close();

    const unsupportedPage = await openThemePage(browser, { unsupportedViewTransitions: true });
    await unsupportedPage.locator("#editorThemeToggle").click();
    await waitForTheme(unsupportedPage, "dark");
    assert.equal(await unsupportedPage.evaluate(() => document.documentElement.classList.contains("u219-theme-transition")), false, "unsupported browsers should not leave reveal classes behind");
    assert.equal(await unsupportedPage.locator("#editorThemeToggle").getAttribute("aria-pressed"), "true");
    await unsupportedPage.close();

    console.log(`PASS: native circle grow/shrink (700ms), button-center pointer/keyboard origin, rapid-toggle/cancel cleanup, reduced-motion and unsupported fallbacks, plus unchanged PNG bytes (${pngBefore.sha256}).`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
