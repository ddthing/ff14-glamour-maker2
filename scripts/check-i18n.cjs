const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const I18n = require("../models/i18n.js");
const featureCopyKeys = [
  "equipment.eyebrow", "equipment.extraTitle", "equipment.extraCount", "equipment.addGroup", "equipment.edit",
  "equipment.add", "equipment.save", "equipment.update", "equipment.cancel", "equipment.remove", "equipment.removeAria",
  "equipment.groupLabel", "equipment.slotLabel", "equipment.manualName", "equipment.manualNamePlaceholder", "equipment.manualNameHint",
  "equipment.nameEnglish", "equipment.nameJapanese", "equipment.note", "equipment.notePlaceholder", "equipment.multilingual",
  "equipment.catalogSearch", "equipment.catalogSearchPlaceholder", "equipment.catalogSearchHint", "equipment.manualOnly", "equipment.empty",
  "equipment.cardVisible", "equipment.cardVisibleAria", "equipment.sourceCatalog", "equipment.sourceManual", "equipment.maxReached",
  "equipment.added", "equipment.updated", "equipment.removed", "equipment.requiredName", "equipment.selectedCount",
  "composition.title", "composition.layer", "composition.layerAria", "composition.infoFront", "composition.personFront",
  "composition.protectText", "composition.protectHint", "composition.infoGap", "composition.infoGapAria",
  "composition.personFrontUnavailable", "composition.focusHint", "sheet.actions", "sheet.selected", "sheet.allActive",
  "sheet.selectedHint", "sheet.allHint", "sheet.preparingSelected", "sheet.preparingAll", "sheet.savedSelectedPng",
  "sheet.savedSelectedZip", "sheet.savedAllZip", "sheet.empty", "sheet.changed", "sheet.error",
];

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
  for (const key of featureCopyKeys) {
    const values = I18n.supportedLanguages.map((language) => I18n.dictionaries[language][key]);
    assert.ok(values.every((value) => typeof value === "string" && value.length > 0), `${key} must have copy in every language`);
    const variables = values.map((value) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort());
    assert.deepEqual(variables[1], variables[0], `${key} interpolation variables differ in English`);
    assert.deepEqual(variables[2], variables[0], `${key} interpolation variables differ in Japanese`);
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

function assertLanguageApplicationUsesOneTraversal() {
  function elementWithAttributes(attributes = {}) {
    const values = new Map(Object.entries(attributes));
    const dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([name]) => name.startsWith("data-"))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    return {
      dataset,
      textContent: "",
      hasAttribute: (name) => values.has(name),
      getAttribute: (name) => values.has(name) ? values.get(name) : null,
      setAttribute: (name, value) => values.set(name, String(value)),
      attribute: (name) => values.get(name) ?? null,
    };
  }

  const localizedText = elementWithAttributes({ "data-i18n": "mode.style" });
  const ariaLabel = elementWithAttributes({ "data-i18n-aria-label": "language.label" });
  const title = elementWithAttributes({ "data-i18n-title": "export.label" });
  const placeholder = elementWithAttributes({ "data-i18n-placeholder": "item.searchPlaceholder" });
  const alt = elementWithAttributes({ "data-i18n-alt": "language.label" });
  const valueText = elementWithAttributes({ "data-i18n-aria-valuetext": "range.none" });
  const content = elementWithAttributes({ "data-i18n-content": "meta.locale" });
  const languageLabel = elementWithAttributes({ "data-i18n-lang-label": "language.label" });
  const elements = [localizedText, ariaLabel, title, placeholder, alt, valueText, content, languageLabel];
  let selector = "";
  let queryCount = 0;
  const documentElement = elementWithAttributes();
  const root = {
    documentElement,
    contains: (element) => elements.includes(element),
    querySelectorAll: (value) => {
      queryCount += 1;
      selector = value;
      return elements;
    },
  };

  assert.equal(I18n.apply(root, "en"), "en");
  assert.equal(queryCount, 1, `language apply should query translated nodes once, received ${queryCount}`);
  assert.equal(selector, [
    "[data-i18n]",
    "[data-i18n-aria-label]",
    "[data-i18n-title]",
    "[data-i18n-placeholder]",
    "[data-i18n-alt]",
    "[data-i18n-aria-valuetext]",
    "[data-i18n-content]",
    "[data-i18n-lang-label]",
  ].join(", "));
  assert.equal(documentElement.attribute("lang"), "en");
  assert.equal(localizedText.textContent, "Style");
  assert.equal(ariaLabel.attribute("aria-label"), "Language");
  assert.equal(title.attribute("title"), "Export PNG");
  assert.equal(placeholder.attribute("placeholder"), "Korean, English, Japanese name or ID");
  assert.equal(alt.attribute("alt"), "Language");
  assert.equal(valueText.attribute("aria-valuetext"), "None");
  assert.equal(content.attribute("content"), "en_US");
  assert.equal(languageLabel.textContent, "Language");
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

    await page.locator("#languageSelect").selectOption("ja", { force: true });
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
  assertLanguageApplicationUsesOneTraversal();
  await assertBrowserLanguageFlow();
  console.log(JSON.stringify({ status: "PASS", languages: I18n.supportedLanguages }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
