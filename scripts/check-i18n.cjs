const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const I18n = require("../models/i18n.js");

function assertDictionaryParity() {
  const index = fs.readFileSync("index.html", "utf8");
  const markerKeys = [...index.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
  for (const key of new Set(markerKeys)) {
    for (const language of I18n.supportedLanguages) {
      assert.notEqual(I18n.dictionaries[language][key], undefined, `${key} is missing in ${language}`);
    }
  }
  for (const language of I18n.supportedLanguages) {
    assert.equal(I18n.t("does.not.exist", {}, language), "does.not.exist");
  }
}

function assertLanguageDetection() {
  assert.equal(I18n.detectLanguage({ navigatorRef: { languages: ["ko-KR"], language: "ko-KR" } }), "ko");
  assert.equal(I18n.detectLanguage({ navigatorRef: { languages: ["ja-JP"], language: "ja-JP" } }), "ja");
  assert.equal(I18n.detectLanguage({ navigatorRef: { languages: ["en-US"], language: "en-US" } }), "en");
  const timezoneIntl = {
    Locale: Intl.Locale,
    DateTimeFormat: function DateTimeFormat() { return { resolvedOptions: () => ({ timeZone: "Asia/Seoul" }) }; },
  };
  assert.equal(I18n.detectLanguage({ navigatorRef: { languages: ["xx"], language: "xx" }, intlRef: timezoneIntl }), "ko");
}

async function assertBrowserLanguageFlow() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["en-US"] });
      Object.defineProperty(navigator, "language", { configurable: true, get: () => "en-US" });
    });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?i18n-check=1", { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.I18n && document.documentElement.lang));

    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator("#languageSelect").inputValue(), "en");
    assert.equal(await page.locator("#inspectorTitle").textContent(), "Style");
    assert.equal(await page.locator("#imageImportGroupTitle").textContent(), "Import photo");
    assert.equal(await page.locator("#itemSearch").getAttribute("placeholder"), "Korean, English, Japanese name or ID");
    assert.equal(await page.locator('meta[property="og:locale"]').getAttribute("content"), "en_US");
    assert.equal(await page.locator(".control-help").count(), 5, "context help should be limited to the non-obvious controls");
    assert.ok(await page.locator(".control-help-popover").evaluateAll((elements) => elements.every((element) => !element.closest("details").open)), "optional help should start collapsed");
    const importHelp = page.locator(".image-import-group .control-help");
    assert.equal(await importHelp.locator("summary").getAttribute("aria-label"), "Help");
    await importHelp.locator("summary").click();
    assert.equal(await importHelp.locator(".control-help-popover").innerText(), "The original stays safely in this browser");
    const copyHint = await page.locator("#copyEditorHint").evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, padding: style.padding, border: style.borderWidth, clip: style.clip };
    });
    assert.equal(copyHint.width, 1, `copy guidance should stay accessible without visual footprint: ${JSON.stringify(copyHint)}`);
    assert.equal(copyHint.height, 1, `copy guidance should stay accessible without visual footprint: ${JSON.stringify(copyHint)}`);
    assert.equal(copyHint.padding, "0px", `copy guidance should not add a visual panel: ${JSON.stringify(copyHint)}`);
    assert.equal(copyHint.border, "0px", `copy guidance should not add a visual panel: ${JSON.stringify(copyHint)}`);

    await page.locator("#languageSelect").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    assert.equal(await page.locator("#inspectorTitle").textContent(), "スタイル");
    assert.equal(await page.locator("#imageImportGroupTitle").textContent(), "写真を追加");
    assert.equal(await page.locator("#itemSearch").getAttribute("placeholder"), "韓国語・英語・日本語の名前またはID");
    assert.equal(await page.locator("#cutoutButton").locator("span").first().textContent(), "背景を削除");
    assert.equal(await page.locator("#exportButton").locator("span").first().textContent(), "PNGを書き出す");
    assert.equal(await importHelp.locator("summary").getAttribute("aria-label"), "ヘルプ");
    assert.equal(await page.locator('meta[property="og:locale"]').getAttribute("content"), "ja_JP");
    assert.equal(await page.locator("#boardTitle").textContent(), "新しいルック");
    await page.waitForFunction(() => localStorage.getItem("tuyeong-set-maker2-language-v1") === "ja");

    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    assert.equal(await page.locator("#languageSelect").inputValue(), "ja");
    assert.equal(await page.locator("#inspectorTitle").textContent(), "スタイル");
  } finally {
    await browser.close();
  }
}

(async () => {
  assertDictionaryParity();
  assertLanguageDetection();
  await assertBrowserLanguageFlow();
  console.log(JSON.stringify({ status: "PASS", languages: I18n.supportedLanguages }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
