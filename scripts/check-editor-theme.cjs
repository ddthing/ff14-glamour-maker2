const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const themeStorageKey = "glamour-maker2-editor-theme-v1";
const testSessionKey = "__editor_theme_acceptance_initialized__";
const testSystemKey = "__editor_theme_acceptance_system_dark__";
const testUrl = process.env.TEST_BASE_URL || "http://localhost:4173";

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
    pngChunk("IDAT", require("node:zlib").deflateSync(raw)),
    pngChunk("IEND"),
  ]);
}

async function openThemePage(browser, { systemDark = false, blockPreferenceStorage = false } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await page.addInitScript(({ initialSystemDark, preferenceKey, sessionKey, systemKey, blockStorage }) => {
    if (sessionStorage.getItem(sessionKey) !== "true") {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(sessionKey, "true");
      sessionStorage.setItem(systemKey, String(initialSystemDark));
    }

    let dark = sessionStorage.getItem(systemKey) === "true";
    const media = "(prefers-color-scheme: dark)";
    const originalMatchMedia = window.matchMedia.bind(window);
    const listeners = new Set();
    const mediaQuery = {
      media,
      get matches() { return dark; },
      addEventListener(type, callback) { if (type === "change") listeners.add(callback); },
      removeEventListener(type, callback) { if (type === "change") listeners.delete(callback); },
      addListener(callback) { listeners.add(callback); },
      removeListener(callback) { listeners.delete(callback); },
      dispatchEvent(event) { listeners.forEach((callback) => callback.call(mediaQuery, event)); return true; },
    };
    window.matchMedia = (query) => query === media ? mediaQuery : originalMatchMedia(query);
    window.__setSystemThemeDark = (nextDark) => {
      dark = Boolean(nextDark);
      sessionStorage.setItem(systemKey, String(dark));
      mediaQuery.dispatchEvent({ type: "change", matches: dark, media });
    };

    if (blockStorage) {
      const nativeGetItem = Storage.prototype.getItem;
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === preferenceKey) throw new DOMException("Theme preference storage is blocked", "SecurityError");
        return nativeGetItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === preferenceKey) throw new DOMException("Theme preference storage is blocked", "SecurityError");
        return nativeSetItem.call(this, key, value);
      };
    }
  }, {
    initialSystemDark: systemDark,
    preferenceKey: themeStorageKey,
    sessionKey: testSessionKey,
    systemKey: testSystemKey,
    blockStorage: blockPreferenceStorage,
  });

  const separator = testUrl.includes("?") ? "&" : "?";
  await page.goto(`${testUrl}${separator}editor-theme-check=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.EditorTheme?.clearPreference
    && document.querySelector("#canvasBoard")
    && document.querySelector("#editorThemeToggle")
    && document.querySelector("#canvasBoard").dataset.cast === "1",
  ));
  return page;
}

async function waitForTheme(page, theme) {
  await page.waitForFunction((value) => document.documentElement.dataset.editorTheme === value, theme);
  assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-pressed"), String(theme === "dark"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setSystemTheme(page, dark, expectedTheme = dark ? "dark" : "light") {
  await page.evaluate((value) => window.__setSystemThemeDark(value), dark);
  await waitForTheme(page, expectedTheme);
}

async function captureCardStyle(page) {
  return page.evaluate(() => {
    const board = document.querySelector("#canvasBoard");
    const title = document.querySelector("#boardTitle");
    const subtitle = document.querySelector("#boardSubtitle");
    const scene = document.querySelector("#sceneBackground");
    const rect = board.getBoundingClientRect();
    const computed = (element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        filter: style.filter,
      };
    };
    return {
      board: computed(board),
      title: computed(title),
      subtitle: computed(subtitle),
      scene: computed(scene),
      boardSize: { width: rect.width, height: rect.height },
      ratio: board.dataset.ratio,
      cast: board.dataset.cast,
    };
  });
}

async function capturePng(page) {
  const priorCount = await page.evaluate(() => window.__editorThemePngs.length);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await downloadPromise;
  await download.cancel();
  await page.waitForFunction((count) => window.__editorThemePngs.length > count, priorCount);
  await page.waitForFunction(() => !document.querySelector("#exportButton")?.hasAttribute("aria-busy"));
  return page.evaluate(async () => {
    const blob = window.__editorThemePngs.at(-1);
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return {
      type: blob.type,
      size: blob.size,
      sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    };
  });
}

async function capturePreview(page, filename) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.locator("#canvasBoard").screenshot({
    path: filename,
    animations: "disabled",
  });
}

async function comparePreviewInterior(page, lightImage, darkImage, inset = 8) {
  return page.evaluate(async ({ light, dark, edgeInset }) => {
    const decode = async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const lightPixels = await decode(light);
    const darkPixels = await decode(dark);
    if (lightPixels.width !== darkPixels.width || lightPixels.height !== darkPixels.height) {
      return { sameSize: false, lightSize: [lightPixels.width, lightPixels.height], darkSize: [darkPixels.width, darkPixels.height] };
    }
    const countDiff = (left, top, right, bottom) => {
      let changedPixels = 0;
      let maxDelta = 0;
      let minX = lightPixels.width;
      let minY = lightPixels.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const offset = (y * lightPixels.width + x) * 4;
          let delta = 0;
          for (let channel = 0; channel < 4; channel += 1) {
            delta = Math.max(delta, Math.abs(lightPixels.pixels[offset + channel] - darkPixels.pixels[offset + channel]));
          }
          if (delta > 0) {
            changedPixels += 1;
            maxDelta = Math.max(maxDelta, delta);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return {
        changedPixels,
        maxDelta,
        bounds: changedPixels ? { minX, minY, maxX, maxY } : null,
      };
    };
    const full = countDiff(0, 0, lightPixels.width, lightPixels.height);
    const interior = countDiff(edgeInset, edgeInset, lightPixels.width - edgeInset, lightPixels.height - edgeInset);
    return {
      sameSize: true,
      width: lightPixels.width,
      height: lightPixels.height,
      excludedEdgePixels: full.changedPixels - interior.changedPixels,
      full,
      interior,
    };
  }, {
    light: lightImage.toString("base64"),
    dark: darkImage.toString("base64"),
    edgeInset: inset,
  });
}

async function darkContrastSnapshot(page) {
  return page.evaluate(() => {
    function rgba(value) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }
    function blend(foreground, backdrop) {
      const alpha = foreground[3] / 255;
      return [0, 1, 2].map((index) => Math.round(foreground[index] * alpha + backdrop[index] * (1 - alpha)))
        .concat(255);
    }
    function luminance([red, green, blue]) {
      const linear = [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    function effectiveBackground(element) {
      const chain = [];
      for (let node = element; node; node = node.parentElement) chain.push(node);
      let background = [255, 255, 255, 255];
      chain.reverse().forEach((node) => {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) background = blend(color, background);
      });
      return background;
    }
    function contrast(selector) {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true, ratio: 0 };
      const foreground = rgba(getComputedStyle(element).color);
      const background = effectiveBackground(element);
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return {
        selector,
        text: element.textContent.trim(),
        foreground,
        background,
        ratio: (lighter + 0.05) / (darker + 0.05),
      };
    }
    return [
      contrast("#sourceFileName"),
      contrast("#sourceFileMeta"),
      contrast("#exportButton"),
      contrast("#imagePlacementGroupTitle"),
      contrast(".image-fit-row > span"),
      contrast("button[data-image-fit='contain']"),
      contrast("button[data-image-fit='cover']"),
      contrast("#openImageEditorButton"),
    ];
  });
}

async function clearWorkspace(page) {
  await page.locator("#resetButton").click();
  await page.locator("#resetWorkspaceButton").click();
  await page.waitForFunction(() => document.querySelector("#deleteWorkspaceDialog")?.open === true);
  await page.locator("#confirmWorkspaceDelete").click();
}

(async () => {
  fs.mkdirSync(path.join(__dirname, "..", "artifacts"), { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const darkSystemPage = await openThemePage(browser, { systemDark: true });
    await waitForTheme(darkSystemPage, "dark");
    assert.equal(await darkSystemPage.evaluate(() => localStorage.getItem("glamour-maker2-editor-theme-v1")), null, "system dark should not create an explicit preference");
    await darkSystemPage.close();

    const page = await openThemePage(browser, { systemDark: false });
    await waitForTheme(page, "light");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-label"), "화면 테마: 라이트. 어두운 화면으로 전환");
    await setSystemTheme(page, true);
    await setSystemTheme(page, false);

    await page.locator("#editorThemeToggle").click();
    await waitForTheme(page, "dark");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), themeStorageKey), "dark", "toggle should persist its explicit choice");
    await setSystemTheme(page, false, "dark");
    await waitForTheme(page, "dark");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.EditorTheme && document.querySelector("#canvasBoard")));
    await waitForTheme(page, "dark");
    await setSystemTheme(page, false, "dark");
    await waitForTheme(page, "dark");

    await page.locator("#languageSelect").selectOption("ko", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("aria-label"), "화면 테마: 다크. 밝은 화면으로 전환");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("title"), "밝은 화면으로 전환");
    await page.locator("#languageSelect").selectOption("en", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("#editorThemeToggle")?.getAttribute("aria-label") === "Editor theme: Dark. Switch to light mode");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("title"), "Switch to light mode");
    await page.locator("#languageSelect").selectOption("ja", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "ja" && document.querySelector("#editorThemeToggle")?.getAttribute("aria-label") === "画面テーマ: ダーク. ライトモードに切り替え");
    assert.equal(await page.locator("#editorThemeToggle").getAttribute("title"), "ライトモードに切り替え");
    await page.locator("#languageSelect").selectOption("ko", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "ko");

    await page.locator("#editorThemeToggle").click();
    await waitForTheme(page, "light");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), themeStorageKey), "light");
    await setSystemTheme(page, true, "light");
    await waitForTheme(page, "light");
    await page.locator("#imageInput").setInputFiles({
      name: "theme-swatch.png",
      mimeType: "image/png",
      buffer: makeSyntheticPng(),
    });
    await page.waitForFunction(() => (
      document.querySelector("#sourceFileName")?.textContent.includes("theme-swatch.png")
      && document.querySelector("#portraitWrap img")?.naturalWidth === 16
      && pendingAssetWrites.size === 0
    ));
    await page.locator("#cardTitleInput").fill("Theme Invariant");
    await page.locator("#cardTitleInput").blur();
    await page.waitForFunction(() => document.querySelector("#canvasBoard")?.dataset.copyRendered === "true");
    await page.evaluate(async () => { await document.fonts.ready; });
    assert.equal(await page.locator("#exportButton").isEnabled(), true, "PNG export should be enabled after importing the synthetic image");
    await page.evaluate(() => {
      window.__editorThemePngs = [];
      const render = CardPng.render;
      CardPng.render = async (...args) => {
        const blob = await render(...args);
        window.__editorThemePngs.push(blob);
        return blob;
      };
    });

    const lightCardStyle = await captureCardStyle(page);
    const lightPng = await capturePng(page);
    const lightPreview = await capturePreview(page, path.join(__dirname, "..", "artifacts", "editor-theme-card-light.png"));
    assert.equal(lightPng.type, "image/png");

    await page.locator("#editorThemeToggle").click();
    await waitForTheme(page, "dark");
    await setSystemTheme(page, false, "dark");
    await waitForTheme(page, "dark");
    const darkCardStyle = await captureCardStyle(page);
    const darkPng = await capturePng(page);
    const darkPreview = await capturePreview(page, path.join(__dirname, "..", "artifacts", "editor-theme-card-dark.png"));
    await page.screenshot({ path: path.join(__dirname, "..", "artifacts", "editor-theme-dark.png"), fullPage: true, animations: "disabled" });
    assert.deepEqual(darkCardStyle, lightCardStyle, "editor theme should not change card-level computed paint");
    const previewDiff = await comparePreviewInterior(page, lightPreview, darkPreview);
    assert.equal(previewDiff.sameSize, true, `light/dark card screenshot sizes should match: ${JSON.stringify(previewDiff)}`);
    assert.deepEqual(
      { type: darkPng.type, size: darkPng.size, sha256: darkPng.sha256 },
      { type: lightPng.type, size: lightPng.size, sha256: lightPng.sha256 },
      "exported PNG bytes should be identical across editor themes",
    );
    assert.equal(previewDiff.interior.changedPixels, 0, `card preview interior should be pixel-identical across editor themes (8px edge excluded): ${JSON.stringify(previewDiff)}`);

    const contrast = await darkContrastSnapshot(page);
    const contrastFailures = contrast.filter((entry) => entry.missing || entry.ratio < 4.5);
    assert.deepEqual(contrastFailures, [], `dark editor surfaces need readable source text, export action, frame labels and controls: ${JSON.stringify(contrast)}`);
    await page.locator("#undoButton").focus();
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.id === "editorThemeToggle")) break;
    }
    const themeFocus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return { id: element.id, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
    });
    assert.equal(themeFocus.id, "editorThemeToggle", `keyboard sequence should reach the theme control: ${JSON.stringify(themeFocus)}`);
    assert.ok(themeFocus.outlineStyle !== "none" && Number.parseFloat(themeFocus.outlineWidth) >= 2, `theme control needs a visible keyboard focus ring: ${JSON.stringify(themeFocus)}`);

    await page.setViewportSize({ width: 320, height: 820 });
    await page.waitForTimeout(80);
    const mobileOverflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth,
    }));
    assert.ok(mobileOverflow.document <= 1 && mobileOverflow.body <= 1, `320px theme view should not overflow horizontally: ${JSON.stringify(mobileOverflow)}`);
    await page.screenshot({ path: path.join(__dirname, "..", "artifacts", "editor-theme-dark-mobile.png"), fullPage: true, animations: "disabled" });
    await page.close();

    const blockedStoragePage = await openThemePage(browser, { blockPreferenceStorage: true });
    await waitForTheme(blockedStoragePage, "light");
    await blockedStoragePage.locator("#editorThemeToggle").click();
    await waitForTheme(blockedStoragePage, "dark");
    await setSystemTheme(blockedStoragePage, false, "dark");
    await waitForTheme(blockedStoragePage, "dark");
    const blockedRead = await blockedStoragePage.evaluate((key) => {
      try { return localStorage.getItem(key); } catch { return "blocked"; }
    }, themeStorageKey);
    assert.equal(blockedRead, "blocked", "fixture should deny only theme preference storage");
    await blockedStoragePage.close();

    const clearedPage = await openThemePage(browser, { systemDark: false });
    await clearedPage.locator("#editorThemeToggle").click();
    await waitForTheme(clearedPage, "dark");
    assert.equal(await clearedPage.evaluate((key) => localStorage.getItem(key), themeStorageKey), "dark");
    await clearWorkspace(clearedPage);
    await clearedPage.waitForFunction(() => document.querySelector("#deleteWorkspaceDialog")?.open === false);
    await waitForTheme(clearedPage, "light");
    assert.equal(await clearedPage.evaluate((key) => localStorage.getItem(key), themeStorageKey), null, "workspace clear should remove the explicit theme choice");
    await clearedPage.close();

    const deniedRemovalPage = await openThemePage(browser, { systemDark: false });
    await deniedRemovalPage.locator("#editorThemeToggle").click();
    await waitForTheme(deniedRemovalPage, "dark");
    await deniedRemovalPage.evaluate((key) => {
      const nativeRemoveItem = Storage.prototype.removeItem;
      window.__deniedThemeRemovals = 0;
      Storage.prototype.removeItem = function (storageKey) {
        if (storageKey === key) {
          window.__deniedThemeRemovals += 1;
          throw new DOMException("Theme preference removal denied", "SecurityError");
        }
        return nativeRemoveItem.call(this, storageKey);
      };
    }, themeStorageKey);
    await clearWorkspace(deniedRemovalPage);
    await deniedRemovalPage.waitForFunction(() => (
      document.querySelector("#saveStatusGroup")?.dataset.state === "failed"
      && document.querySelector("#toast")?.textContent.trim().length > 0
    ));
    await waitForTheme(deniedRemovalPage, "light");
    assert.equal(await deniedRemovalPage.evaluate((key) => localStorage.getItem(key), themeStorageKey), "dark", "denied removal should leave the saved preference for the next load");
    assert.ok((await deniedRemovalPage.evaluate(() => window.__deniedThemeRemovals)) > 0, "workspace clear should attempt to clear the theme preference");
    assert.match(await deniedRemovalPage.locator("#saveStatus").textContent(), /일부 설정|some settings|一部の設定/u, "partial deletion warning should remain in the save status");
    assert.match(await deniedRemovalPage.locator("#toast").textContent(), /일부 설정|some settings|一部の設定/u, "partial deletion warning should remain in the live toast");
    await deniedRemovalPage.close();

    const minimumContrast = Math.min(...contrast.map(({ ratio }) => ratio));
    console.log(`PASS: system theme, persistence, localization, storage-denial recovery, reset warning, focus and mobile fit; dark minimum text contrast=${minimumContrast.toFixed(2)}:1; preview=${previewDiff.width}x${previewDiff.height}, edge diff=${previewDiff.excludedEdgePixels}, interior diff=${previewDiff.interior.changedPixels}; PNG=${lightPng.size} bytes, SHA-256 ${lightPng.sha256}.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
