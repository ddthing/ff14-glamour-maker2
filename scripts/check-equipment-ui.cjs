const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

const draftStorageKey = "tuyeong-set-maker2-draft-v3";

async function addManualExtra(page, { group, slot, name, english, japanese, note = "" }) {
  await page.locator(`[data-add-extra-group="${group}"]`).click();
  await page.locator("#extraEntryGroupSelect").selectOption(group);
  await page.locator("#extraEntrySlotSelect").selectOption(slot);
  await page.locator("#extraEntryNameInput").fill(name);
  const namesDetails = page.locator("#extraEntryMore");
  if (!(await namesDetails.evaluate((element) => element.open))) {
    await namesDetails.locator("summary").click();
  }
  const englishInput = page.locator("#extraEntryEnglishInput");
  const japaneseInput = page.locator("#extraEntryJapaneseInput");
  if (await englishInput.isVisible()) await englishInput.fill(english);
  if (await japaneseInput.isVisible()) await japaneseInput.fill(japanese);
  await page.locator("#extraEntryNoteInput").fill(note);
  await page.locator("#extraEntrySaveButton").click();
  await page.waitForFunction(({ group, name }) => {
    const section = document.querySelector(`[data-extra-group="${group}"]`);
    return Boolean(section && [...section.querySelectorAll(".extra-equipment-row")].some((row) => row.textContent.includes(name)));
  }, { group, name });
  return page.locator(`[data-extra-group="${group}"] .extra-equipment-row`)
    .filter({ hasText: name })
    .getAttribute("data-extra-id");
}

async function readSavedLook(page, index = 0) {
  await page.evaluate(async () => { await draftAutosave.flush(); });
  const look = await page.evaluate(async ({ key, lookIndex }) => {
    const saved = await draftStorage.readValue(key);
    return saved?.looks?.[lookIndex] || null;
  }, { key: draftStorageKey, lookIndex: index });
  if (look) return look;
  const diagnostic = await page.evaluate(async (key) => ({
    rawPointer: JSON.parse(localStorage.getItem(key) || "null"),
    saved: await draftStorage.readValue(key).catch((error) => ({ error: error.message })),
    runtimeCount: getSelectedLook()?.extraEquipment?.[0]?.length,
    saveStatus: document.querySelector("#saveStatus")?.textContent || "",
    writeErrors: window.__equipmentDraftWriteErrors || [],
    snapshotError: (() => {
      try { createDraftSnapshot(); return ""; }
      catch (error) { return String(error?.stack || error); }
    })(),
  }), draftStorageKey);
  throw new Error(`DraftStorage returned no look after autosave flush: ${JSON.stringify(diagnostic)}`);
}

async function waitForSavedLook(page, predicate) {
  await page.evaluate(async () => { await draftAutosave.flush(); });
  await page.waitForFunction(async ({ key, expected }) => {
    const saved = await draftStorage.readValue(key);
    const look = saved?.looks?.[0];
    if (!look) return false;
    if (expected.kind === "extra-count") return look.extraEquipment?.[expected.character]?.length === expected.count;
    if (expected.kind === "core-visibility") return look.cardVisibility?.[expected.character]?.[expected.slot] === expected.visible;
    if (expected.kind === "extra-visibility") {
      return look.extraEquipment?.[expected.character]?.find((entry) => entry.id === expected.id)?.showOnCard === expected.visible;
    }
    if (expected.kind === "composition") {
      return Object.entries(expected.fields).every(([field, value]) => look.cardComposition?.[field] === value);
    }
    return false;
  }, { key: draftStorageKey, expected: predicate }, { timeout: 8000 });
  return readSavedLook(page);
}

function storedZipNames(buffer) {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1, "downloaded ZIP has an end-of-directory record");
  const count = view.getUint16(endOffset + 10, true);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const names = [];
  let offset = view.getUint32(endOffset + 16, true);
  for (let index = 0; index < count; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50, "downloaded ZIP has a valid central directory");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    names.push(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.addInitScript(() => {
      const resetKey = "__equipmentUiFreshTest";
      if (sessionStorage.getItem(resetKey)) return;
      localStorage.clear();
      sessionStorage.setItem(resetKey, "1");
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForFunction(() => typeof DraftSchema !== "undefined" && typeof getSelectedLook === "function");
    assert.deepEqual(pageErrors.map((error) => error.message), [], "classic model scripts should load without global lexical collisions");
    await page.evaluate(() => {
      const writeValue = draftStorage.writeValue.bind(draftStorage);
      draftStorage.writeValue = (...args) => writeValue(...args).catch((error) => {
        window.__equipmentDraftWriteErrors ||= [];
        window.__equipmentDraftWriteErrors.push(String(error?.message || error));
        throw error;
      });
    });
    await page.locator('[data-cast-count="3"]').click();
    await page.locator("#itemsTab").click();
    await page.waitForSelector("#itemsPanel");

    const initial = await page.evaluate(() => {
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      const characters = [...document.querySelectorAll(".item-character-button")].map((element) => ({
        box: box(element),
        pressed: element.getAttribute("aria-pressed"),
      }));
      const rows = [...document.querySelectorAll(".equipment-row")].map((element) => ({
        box: box(element),
        pressed: element.getAttribute("aria-pressed"),
        action: box(element.querySelector(".equipment-check")),
        actionRadius: getComputedStyle(element.querySelector(".equipment-check")).borderRadius,
      }));
      return {
        characters,
        rows,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });

    assert.equal(initial.characters.length, 3, "character selector should expose all active characters");
    assert.ok(initial.characters.every(({ box }) => box.height >= 44), `character target rhythm drifted: ${JSON.stringify(initial.characters)}`);
    assert.equal(initial.characters.filter(({ pressed }) => pressed === "true").length, 1, "character selection is ambiguous");
    assert.equal(initial.rows.length, 5, "equipment list should expose all five outfit slots");
    assert.ok(initial.rows.every(({ box }) => box.height >= 52), `equipment row rhythm drifted: ${JSON.stringify(initial.rows)}`);
    assert.ok(initial.rows.every(({ action }) => action.height >= 26 && action.width >= 27), `equipment action pill is too small: ${JSON.stringify(initial.rows)}`);
    assert.ok(initial.rows.every(({ actionRadius }) => actionRadius === "999px"), "equipment action should use the shared compact pill shape");
    assert.equal(initial.rows.filter(({ pressed }) => pressed === "true").length, 1, "slot selection is ambiguous");
    assert.equal(initial.overflow, false, "equipment panel introduces horizontal overflow");

    const fulfillIcon = (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: fixturePng,
    });
    await page.route("https://xivapi.com/i/**", fulfillIcon);
    await page.route("https://v2.xivapi.com/api/asset**", fulfillIcon);

    let releaseSearch;
    const searchPending = new Promise((resolve) => { releaseSearch = resolve; });
    await page.route("**/api/items/search*", async (route) => {
      await searchPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: Array.from({ length: 250 }, (_, index) => index === 0
            ? { id: "9000001", slot: "head", iconUrl: "https://xivapi.com/i/900000/900001.png", names: { ko: "검증용 장비", en: "UI check item" }, meta: { ko: "머리 · 검증" } }
            : { id: String(9000001 + index), slot: "head", names: { ko: `검증용 장비 ${index}` }, meta: { ko: "머리 · 검증" } }),
        }),
      });
    });

    await page.locator("#itemSearch").fill("검증");
    await page.waitForSelector(".catalog-progress");
    const loading = await page.evaluate(() => ({
      animation: getComputedStyle(document.querySelector(".catalog-progress")).animationName,
      busy: document.querySelector("#catalogResults").getAttribute("aria-busy"),
    }));
    assert.equal(loading.animation, "catalog-progress", "catalog loading state has no visible progress motion");
    assert.equal(loading.busy, "true", "catalog loading state lost aria-busy");

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".catalog-progress").evaluate((element) => getComputedStyle(element).animationName), "none", "catalog motion ignores reduced-motion");
    releaseSearch();
    await page.waitForSelector('.catalog-result[data-item-id="9000001"]');
    const boundedCatalog = await page.evaluate(() => ({
      renderedCount: document.querySelectorAll(".catalog-result").length,
      status: document.querySelector("#catalogStatus")?.textContent || "",
    }));
    assert.ok(boundedCatalog.renderedCount <= 24, `catalog DOM should stay bounded for oversized responses: ${JSON.stringify(boundedCatalog)}`);
    assert.match(boundedCatalog.status, /250|24/, "bounded catalog should expose its result window to assistive technology");
    await page.waitForFunction(() => document.querySelector('.catalog-result[data-item-id="9000001"] .item-image')?.naturalWidth > 0);
    const catalogImage = await page.locator('.catalog-result[data-item-id="9000001"] .item-image').evaluate((image) => ({
      src: image.getAttribute("src"),
      loading: image.getAttribute("loading"),
      naturalWidth: image.naturalWidth,
      fallback: image.closest(".catalog-result-icon")?.classList.contains("is-image-fallback"),
    }));
    assert.equal(catalogImage.src, "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F900000%2F900001.tex&format=png", "catalog results should use the current item asset when one is available");
    assert.equal(catalogImage.loading, "eager", "visible catalog item images must not be deferred behind the scroll container");
    assert.ok(catalogImage.naturalWidth > 0, `catalog item image did not load: ${JSON.stringify(catalogImage)}`);
    assert.equal(catalogImage.fallback, false, "a loaded item image must not expose the slot glyph fallback");

    const loadingModes = await page.evaluate(() => {
      const results = Array.from({ length: 10 }, (_, index) => ({
        id: index === 0 ? "9000001" : String(9000100 + index),
        slot: "head",
        iconUrl: `https://xivapi.com/i/900000/${String(index === 0 ? 900001 : 900010 + index).padStart(6, "0")}.png`,
        names: { ko: `지연 로드 검증 ${index}` },
        meta: { ko: "머리 · 검증" },
      }));
      renderCatalogResults(results);
      return [...document.querySelectorAll(".catalog-result .item-image")].map((image) => image.loading);
    });
    assert.deepEqual(loadingModes.slice(0, 8), Array(8).fill("eager"), "the first catalog viewport should load item icons immediately");
    assert.deepEqual(loadingModes.slice(8), ["lazy", "lazy"], "catalog icons past the first viewport should be deferred");
    await page.unroute("**/api/items/search*");

    await page.locator('.catalog-result[data-item-id="9000001"]').click();
    await page.waitForFunction(async () => {
      const snapshot = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
      return snapshot?.catalogItems?.length === 1;
    }, null, { timeout: 8000 });

    await page.waitForFunction(() => document.querySelector('.equipment-row[data-slot="head"] .item-image')?.naturalWidth > 0);
    const linked = await page.evaluate(() => {
      const row = document.querySelector('.equipment-row[data-slot="head"]');
      const image = row?.querySelector(".item-image");
      return {
        image: image?.getAttribute("src") || "",
        naturalWidth: image?.naturalWidth || 0,
        fallback: row?.querySelector(".equipment-icon")?.classList.contains("is-image-fallback") || false,
        removeCount: document.querySelectorAll('.equipment-remove[data-remove-slot="head"]').length,
        removeLabel: document.querySelector('.equipment-remove[data-remove-slot="head"]')?.getAttribute("aria-label") || "",
        cardItemImages: document.querySelectorAll('#canvasBoard img[src*="xivapi.com"]').length,
      };
    });
    assert.equal(linked.image, "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F900000%2F900001.tex&format=png", "assigned equipment should show the current item asset");
    assert.ok(linked.naturalWidth > 0, `assigned equipment image did not load: ${JSON.stringify(linked)}`);
    assert.equal(linked.fallback, false, "assigned equipment should not show the slot glyph when its image loaded");
    assert.equal(linked.removeCount, 1, "assigned equipment should expose a remove button");
    assert.match(linked.removeLabel, /제거/, "remove button should describe the destructive action");
    assert.equal(linked.cardItemImages, 0, "item images must stay out of the composition card");

    await page.locator('[data-core-visibility="head"]').uncheck();
    await page.waitForFunction(async () => {
      const saved = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
      return saved?.looks?.[0]?.cardVisibility?.[0]?.head === false;
    });
    await page.locator("#undoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardVisibility[0].head === true);
    await page.locator("#redoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardVisibility[0].head === false);

    await page.screenshot({ path: "artifacts/ui-equipment-panel-item-image.png", fullPage: true });
    await page.locator('.equipment-remove[data-remove-slot="head"]').click();
    await page.waitForFunction(() => document.querySelector('.equipment-row[data-slot="head"]')?.classList.contains("is-empty"));
    const removed = await page.evaluate(() => {
      const row = document.querySelector('.equipment-row[data-slot="head"]');
      return {
        empty: row?.classList.contains("is-empty"),
        image: row?.querySelector(".item-image")?.getAttribute("src") || "",
        removeCount: document.querySelectorAll('.equipment-remove[data-remove-slot="head"]').length,
        outfitValue: getSelectedLook()?.outfits?.[0]?.head ?? null,
        savedCatalogSize: getPersistedItemRecords().length,
      };
    });
    assert.equal(removed.empty, true, "remove should clear the assigned equipment row");
    assert.equal(removed.image, "", "removed equipment should no longer render its item image");
    assert.equal(removed.removeCount, 0, "remove action should disappear after clearing the slot");
    assert.equal(removed.outfitValue, null, "remove should persist an empty outfit slot");
    assert.equal(removed.savedCatalogSize, 0, "unreferenced item records should be dropped after removal");

    await page.setViewportSize({ width: 320, height: 800 });
    const mobileCatalogFlow = await page.locator("#catalogResults").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
    assert.equal(mobileCatalogFlow.maxHeight, "none", `mobile catalog must not be capped: ${JSON.stringify(mobileCatalogFlow)}`);
    assert.equal(mobileCatalogFlow.overflowY, "visible", `mobile catalog must stay in document flow: ${JSON.stringify(mobileCatalogFlow)}`);
    assert.equal(mobileCatalogFlow.scrollHeight, mobileCatalogFlow.clientHeight, `mobile catalog created a nested scroll surface: ${JSON.stringify(mobileCatalogFlow)}`);
    await page.evaluate(() => window.scrollTo(0, Math.max(0, document.querySelector("#catalogResults").offsetTop - 72)));
    await page.screenshot({ path: "artifacts/ui-equipment-panel-mobile-flow.png", fullPage: false });

    const result = await page.evaluate(() => {
      const action = document.querySelector(".catalog-result-action");
      const rect = action.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        radius: getComputedStyle(action).borderRadius,
        hidden: action.getAttribute("aria-hidden"),
      };
    });
    assert.ok(result.width >= 32 && result.height >= 32, `catalog action target is too small: ${JSON.stringify(result)}`);
    assert.equal(result.radius, "999px", "catalog action should share the compact pill shape");
    assert.equal(result.hidden, "true", "catalog action glyph should stay decorative in the accessibility tree");

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "equipment panel overflows at 320px");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "artifacts/ui-equipment-panel-after.png", fullPage: true });

    await page.locator("#itemsTab").click();
    await page.locator("#languageSelect").selectOption("ko");
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    assert.equal(await page.locator(".character-figure.is-empty").count(), 3, "gear-sheet coverage should start without character photos");

    const manualExtras = [];
    manualExtras.push(await addManualExtra(page, {
      group: "accessories", slot: "earrings", name: "테스트 귀걸이", english: "Test earrings", japanese: "テストピアス", note: "다국어 메모",
    }));
    const facewearId = await addManualExtra(page, {
      group: "facewear", slot: "facewear", name: "테스트 얼굴 장식", english: "Facewear UI Check", japanese: "テストフェイスウェア",
    });
    manualExtras.push(facewearId);
    manualExtras.push(await addManualExtra(page, {
      group: "fashion", slot: "fashion", name: "테스트 패션소품", english: "Test fashion item", japanese: "テストファッション",
    }));
    const customNames = [];
    for (let index = 1; index <= 7; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const name = `추가 장비 ${suffix}`;
      const id = await addManualExtra(page, {
        group: "custom", slot: "custom", name, english: `Visible gear ${suffix}`, japanese: `追加装備 ${suffix}`,
      });
      manualExtras.push(id);
      customNames.push(name);
    }
    assert.equal(manualExtras.length, 10, "manual accessory, facewear, fashion and seven custom entries should be registered");
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 10 });
    let persistedLook = await readSavedLook(page);
    await page.waitForFunction(() => document.querySelector("#saveStatusGroup")?.dataset.state === "saved");
    assert.equal(await page.locator("#saveStatusGroup").getAttribute("data-state"), "saved", "equipment edits should finish a real autosave before reload");
    assert.equal(persistedLook.extraEquipment[0].length, 10);
    const storedFacewear = persistedLook.extraEquipment[0].find((entry) => entry.id === facewearId);
    assert.deepEqual(storedFacewear.names, { ko: "테스트 얼굴 장식", en: "Facewear UI Check", ja: "テストフェイスウェア" });
    assert.equal(storedFacewear.slot, "facewear");
    assert.equal(storedFacewear.source, "manual");
    assert.equal(storedFacewear.itemId, null, "manual UI entries must not fabricate catalog references");

    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction((id) => document.documentElement.lang === "en"
      && document.querySelector(`#extraEquipmentGroups [data-extra-id="${id}"]`)?.textContent.includes("Facewear UI Check"), facewearId);
    assert.match(await page.locator(`#extraEquipmentGroups [data-extra-id="${facewearId}"]`).textContent(), /Facewear UI Check/, "English labels should use their saved English name");
    await page.locator("#languageSelect").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    assert.match(await page.locator(`#extraEquipmentGroups [data-extra-id="${facewearId}"]`).textContent(), /テストフェイスウェア/, "Japanese labels should use their saved Japanese name");

    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    const englishOnlyName = "English-only entry";
    const englishOnlyId = await addManualExtra(page, {
      group: "custom", slot: "custom", name: englishOnlyName, english: "", japanese: "",
    });
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 11 });
    persistedLook = await readSavedLook(page);
    const englishOnly = persistedLook.extraEquipment[0].find((entry) => entry.id === englishOnlyId);
    assert.deepEqual(englishOnly.names, { ko: "", en: englishOnlyName, ja: "" }, "an English-only manual name should remain in its entered locale");

    await page.locator("#languageSelect").selectOption("ko");
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    await page.locator(`[data-edit-extra="${englishOnlyId}"]`).click();
    await page.waitForFunction((id) => document.querySelector("#extraEntryEditor")?.open === true
      && document.querySelector("#extraEntryNameInput")?.lang === "ko"
      && document.querySelector("#extraEntryNameInput")?.value === ""
      && Boolean(document.querySelector(`[data-edit-extra="${id}"]`)), englishOnlyId);
    await page.locator("#extraEntrySaveButton").click();
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 11 });
    persistedLook = await readSavedLook(page);
    const englishOnlyAfterKoSave = persistedLook.extraEquipment[0].find((entry) => entry.id === englishOnlyId);
    assert.deepEqual(englishOnlyAfterKoSave.names, { ko: "", en: englishOnlyName, ja: "" }, "opening and saving an EN-only entry under KO must not copy the fallback name into KO");

    await page.locator(`[data-edit-extra="${facewearId}"]`).click();
    await page.waitForFunction(() => document.querySelector("#extraEntryEditor")?.open === true
      && document.querySelector("#extraEntryNameInput")?.lang === "ko"
      && document.querySelector("#extraEntryNameInput")?.value === "테스트 얼굴 장식");
    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en"
      && document.querySelector("#extraEntryNameInput")?.lang === "ko"
      && document.querySelector("#extraEntryNameInput")?.value === "테스트 얼굴 장식");
    await page.locator("#extraEntrySaveButton").click();
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 11 });
    persistedLook = await readSavedLook(page);
    const facewearAfterLocaleSwitch = persistedLook.extraEquipment[0].find((entry) => entry.id === facewearId);
    assert.deepEqual(facewearAfterLocaleSwitch.names, { ko: "테스트 얼굴 장식", en: "Facewear UI Check", ja: "テストフェイスウェア" }, "switching the app locale while editing must not reassign the stale primary text");

    await page.locator(`[data-edit-extra="${facewearId}"]`).click();
    await page.waitForFunction(() => document.querySelector("#extraEntryEditor")?.open === true
      && document.querySelector("#extraEntryNameInput")?.lang === "en"
      && document.querySelector("#extraEntryNameInput")?.value === "Facewear UI Check");
    await page.locator("#extraEntryNameInput").fill("Edited Facewear English");
    await page.locator("#extraEntrySaveButton").click();
    await page.waitForFunction(async (id) => {
      const saved = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
      const entry = saved?.looks?.[0]?.extraEquipment?.[0]?.find((item) => item.id === id);
      return entry?.names?.en === "Edited Facewear English";
    }, facewearId);
    persistedLook = await readSavedLook(page);
    const editedFacewear = persistedLook.extraEquipment[0].find((entry) => entry.id === facewearId);
    assert.deepEqual(editedFacewear.names, { ko: "테스트 얼굴 장식", en: "Edited Facewear English", ja: "テストフェイスウェア" }, "editing the primary English name should win over the hidden optional English field");
    await page.locator("#languageSelect").selectOption("ko");
    await page.waitForFunction(() => document.documentElement.lang === "ko");

    const catalogNameByLanguage = {
      ko: "카탈로그 귀걸이",
      en: "Catalog earrings hydrated",
      ja: "カタログイヤリング",
    };
    const catalogSearchRequests = [];
    await page.route("**/api/items/search*", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") || "";
      const language = url.searchParams.get("language") || "ko";
      const slot = url.searchParams.get("slot") || "";
      catalogSearchRequests.push({ query, language, slot });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: query === "9009090"
            ? [{ id: "9009090", slot: "earrings", names: { [language]: catalogNameByLanguage[language] }, meta: { [language]: `Earrings · ${language}` } }]
            : [],
        }),
      });
    });
    await page.locator('[data-add-extra-group="accessories"]').click();
    await page.locator("#extraEntryGroupSelect").selectOption("accessories");
    await page.locator("#extraEntrySlotSelect").selectOption("earrings");
    await page.locator("#extraItemSearch").fill("9009090");
    await page.waitForSelector('.extra-catalog-results [data-extra-item-id="9009090"]');
    await page.locator('.extra-catalog-results [data-extra-item-id="9009090"]').click();
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 12 });
    await page.waitForFunction(async () => {
      const saved = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
      const item = saved?.catalogItems?.find((entry) => String(entry.id) === "9009090");
      return item?.names?.en === "Catalog earrings hydrated" && item?.names?.ja === "カタログイヤリング";
    }, null, { timeout: 10000 });
    assert.ok(catalogSearchRequests.some(({ query, language, slot }) => query === "9009090" && language === "en" && slot === "earrings"), "adding a locale-only catalog result should request its English name");
    assert.ok(catalogSearchRequests.some(({ query, language, slot }) => query === "9009090" && language === "ja" && slot === "earrings"), "adding a locale-only catalog result should request its Japanese name");
    persistedLook = await readSavedLook(page);
    const catalogExtra = persistedLook.extraEquipment[0].find((entry) => entry.itemId === 9009090);
    assert.ok(catalogExtra, "catalog accessory should retain its real item ID");
    assert.equal(catalogExtra.source, "catalog");
    const catalogExtraId = catalogExtra.id;
    await page.locator("#languageSelect").selectOption("en");
    await page.waitForFunction((id) => document.documentElement.lang === "en"
      && document.querySelector(`#extraEquipmentGroups [data-extra-id="${id}"]`)?.textContent.includes("Catalog earrings hydrated"), catalogExtraId);
    await page.locator("#languageSelect").selectOption("ja");
    await page.waitForFunction((id) => document.documentElement.lang === "ja"
      && document.querySelector(`#extraEquipmentGroups [data-extra-id="${id}"]`)?.textContent.includes("カタログイヤリング"), catalogExtraId);
    await page.locator("#languageSelect").selectOption("ko");
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    await page.locator(`[data-edit-extra="${catalogExtraId}"]`).click();
    await page.waitForFunction((id) => document.querySelector("#extraEntryEditor")?.open === true
      && document.querySelector("#extraEntryNameInput")?.lang === "ko"
      && document.querySelector("#extraEntryNameInput")?.value === "카탈로그 귀걸이"
      && Boolean(document.querySelector(`[data-extra-id="${id}"]`)), catalogExtraId);
    await page.locator("#extraEntryNameInput").fill("사용자 수정 귀걸이");
    await page.locator("#extraEntrySaveButton").click();
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 12 });
    persistedLook = await readSavedLook(page);
    const editedCatalogExtra = persistedLook.extraEquipment[0].find((entry) => entry.id === catalogExtraId);
    assert.equal(editedCatalogExtra.source, "catalog", "editing a catalog label should retain its catalog source");
    assert.equal(editedCatalogExtra.itemId, 9009090, "editing a catalog label should retain its real item ID");
    assert.equal(editedCatalogExtra.names.ko, "사용자 수정 귀걸이");
    const catalogProjection = await page.evaluate((id) => {
      const look = getSelectedLook();
      return Equipment.entriesFor({
        look,
        characterIndex: 0,
        coreItems: getPersistedItemRecords(),
        language: "ko",
      }).find((entry) => entry.id === id);
    }, catalogExtraId);
    assert.equal(catalogProjection.name, "사용자 수정 귀걸이", "entry-local text should override the canonical catalog label");
    assert.equal(catalogProjection.names.en, "Catalog earrings hydrated", "blank entry locales should still hydrate from ItemRecords");
    assert.match(await page.locator(`#extraEquipmentGroups [data-extra-id="${catalogExtraId}"]`).textContent(), /사용자 수정 귀걸이/);

    const firstHiddenId = manualExtras.at(-1);
    const firstHiddenName = customNames.at(-1);
    await page.locator(`[data-extra-visibility="${firstHiddenId}"]`).uncheck();
    await waitForSavedLook(page, { kind: "extra-visibility", character: 0, id: firstHiddenId, visible: false });
    await page.locator("#undoButton").click();
    await page.waitForFunction((id) => getSelectedLook().extraEquipment[0].find((entry) => entry.id === id)?.showOnCard === true, firstHiddenId);
    await page.locator("#redoButton").click();
    await page.waitForFunction((id) => getSelectedLook().extraEquipment[0].find((entry) => entry.id === id)?.showOnCard === false, firstHiddenId);
    await waitForSavedLook(page, { kind: "extra-visibility", character: 0, id: firstHiddenId, visible: false });

    await page.locator('[data-item-character="1"]').click();
    await page.waitForFunction(() => document.querySelector('[data-item-character="1"]')?.getAttribute("aria-pressed") === "true");
    persistedLook = await readSavedLook(page);
    assert.equal(persistedLook.extraEquipment[1].length, 0, "switching characters should reveal an independent empty extra list");
    const secondCharacterId = await addManualExtra(page, {
      group: "custom", slot: "custom", name: "두 번째 캐릭터 장비", english: "Second character gear", japanese: "二人目の装備",
    });
    await waitForSavedLook(page, { kind: "extra-count", character: 1, count: 1 });
    await page.locator('[data-core-visibility="head"]').uncheck();
    await waitForSavedLook(page, { kind: "core-visibility", character: 1, slot: "head", visible: false });
    await page.locator('[data-item-character="2"]').click();
    await page.waitForFunction(() => document.querySelector('[data-item-character="2"]')?.getAttribute("aria-pressed") === "true");
    const thirdCharacterId = await addManualExtra(page, {
      group: "custom", slot: "custom", name: "세 번째 캐릭터 장비", english: "Third character gear", japanese: "三人目の装備",
    });
    await waitForSavedLook(page, { kind: "extra-count", character: 2, count: 1 });
    await page.locator('[data-item-character="0"]').click();
    await page.waitForFunction(() => document.querySelector('[data-item-character="0"]')?.getAttribute("aria-pressed") === "true");
    persistedLook = await readSavedLook(page);
    assert.equal(persistedLook.extraEquipment[0].length, 12, "switching back should restore the first character's independent entries");
    assert.equal(persistedLook.extraEquipment[1][0].id, secondCharacterId);
    assert.equal(persistedLook.extraEquipment[2][0].id, thirdCharacterId);
    assert.equal(persistedLook.cardVisibility[0].head, false, "core card visibility should persist per character");
    assert.equal(persistedLook.cardVisibility[1].head, false);
    assert.equal(persistedLook.cardVisibility[2].head, true, "a different character's untouched core visibility should remain selected");

    await page.locator("#styleTab").click();
    const noOpGapState = await page.locator("#infoGapRange").evaluate((slider) => {
      const sendPointer = (type, pointerId, buttons) => slider.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: "mouse",
        button: 0,
        buttons,
      }));
      slider.focus();
      sendPointer("pointerdown", 901, 1);
      slider.blur();
      const afterBlur = compositionGapHistoryActive;
      sendPointer("pointerdown", 902, 1);
      sendPointer("pointerup", 902, 0);
      const afterPointerUp = compositionGapHistoryActive;
      sendPointer("pointerdown", 903, 1);
      sendPointer("pointercancel", 903, 0);
      const afterPointerCancel = compositionGapHistoryActive;
      slider.focus();
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      slider.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      const afterEndpointKey = compositionGapHistoryActive;
      return {
        value: Number(slider.value),
        afterBlur,
        afterPointerUp,
        afterPointerCancel,
        afterEndpointKey,
      };
    });
    assert.equal(noOpGapState.value, 0, "no-op slider interactions should leave the gap at its lower endpoint");
    assert.equal(noOpGapState.afterBlur, false, "blurring a no-op gap gesture should not leave an undo transaction active");
    assert.equal(noOpGapState.afterPointerUp, false, "pointerup after a no-op gap gesture should close its undo transaction");
    assert.equal(noOpGapState.afterPointerCancel, false, "pointercancel after a no-op gap gesture should close its undo transaction");
    assert.equal(noOpGapState.afterEndpointKey, false, "an endpoint key with no value change should not leave an undo transaction active");

    await page.locator("#itemsTab").click();
    const undoProbeName = "되돌리기 추가";
    const undoProbeId = await addManualExtra(page, {
      group: "custom", slot: "custom", name: undoProbeName, english: "Undo probe", japanese: "取り消しテスト",
    });
    await waitForSavedLook(page, { kind: "extra-count", character: 0, count: 13 });
    persistedLook = await readSavedLook(page);
    assert.equal(persistedLook.extraEquipment[0].length, 13);
    await page.locator("#undoButton").click();
    await page.waitForFunction((id) => !getSelectedLook().extraEquipment[0].some((entry) => entry.id === id), undoProbeId);
    await page.locator("#redoButton").click();
    await page.waitForFunction((id) => getSelectedLook().extraEquipment[0].some((entry) => entry.id === id), undoProbeId);

    await page.locator("#styleTab").click();
    await page.locator(".composition-protect-toggle").click();
    await page.waitForFunction(() => getSelectedLook().cardComposition.protectText === false);
    await page.locator("#undoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardComposition.protectText === true);
    await page.locator("#redoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardComposition.protectText === false);
    await page.locator("#infoGapRange").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => getSelectedLook().cardComposition.infoGap === 1);
    await page.locator("#undoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardComposition.infoGap === 0);
    assert.equal(await page.evaluate((id) => getSelectedLook().extraEquipment[0].some((entry) => entry.id === id), undoProbeId), true, "undoing a gap edit must preserve the extra registered between the no-op gesture and real edit");
    await page.locator("#redoButton").click();
    await page.waitForFunction(() => getSelectedLook().cardComposition.infoGap === 1);
    assert.equal(await page.evaluate((id) => getSelectedLook().extraEquipment[0].some((entry) => entry.id === id), undoProbeId), true, "redoing the gap edit must not merge history with the intervening extra registration");
    await waitForSavedLook(page, { kind: "composition", fields: { protectText: false, infoGap: 1 } });

    const visibleNames = [
      "테스트 귀걸이", "테스트 얼굴 장식", "테스트 패션소품",
      ...customNames.slice(0, -1), englishOnlyName, "사용자 수정 귀걸이", undoProbeName, "두 번째 캐릭터 장비", "세 번째 캐릭터 장비",
    ];
    const cardEntries = await page.evaluate(() => ({
      custom: document.querySelector("#canvasBoard")?.dataset.compositionCustom,
      items: [...document.querySelectorAll("#boardGearList .board-gear-item")].map((element) => ({
        character: Number(element.dataset.characterIndex),
        text: element.textContent,
      })),
      layer: document.querySelector("#canvasBoard")?.dataset.compositionLayer,
      countHint: document.querySelector("#compositionCountHint")?.textContent || "",
    }));
    assert.equal(cardEntries.custom, "true", `many equipment entries should use the adaptive card plan: ${JSON.stringify(cardEntries)}`);
    assert.ok(cardEntries.items.length > 8, `the card should render more than eight selected items: ${JSON.stringify(cardEntries.items)}`);
    assert.ok(cardEntries.items.some(({ character }) => character === 0) && cardEntries.items.some(({ character }) => character === 1) && cardEntries.items.some(({ character }) => character === 2), "selected entries from every active character should stay on the card");
    assert.ok(visibleNames.every((name) => cardEntries.items.some(({ text }) => text.includes(name))), `the card omitted a selected entry beyond the first eight: ${JSON.stringify(cardEntries.items)}`);
    assert.equal(cardEntries.items.some(({ text }) => text.includes(firstHiddenName)), false, "an explicitly hidden extra should not render on the card");
    assert.match(cardEntries.countHint, /14/, "the composition count should include every selected extra across active characters");

    const storedBeforeReload = await readSavedLook(page);
    assert.equal(storedBeforeReload.extraEquipment[0].find((entry) => entry.id === firstHiddenId).showOnCard, false);
    assert.equal(storedBeforeReload.extraEquipment[0].find((entry) => entry.id === undoProbeId).names.en, "Undo probe");
    assert.equal(storedBeforeReload.extraEquipment[1][0].names.ja, "二人目の装備");
    assert.equal(storedBeforeReload.cardComposition.infoGap, 1);
    await page.evaluate(async () => {
      getSelectedLook().cardComposition.layer = "person-front";
      await saveState({ immediate: true });
    });
    await waitForSavedLook(page, { kind: "composition", fields: { layer: "person-front", protectText: false, infoGap: 1 } });
    await page.reload();
    await page.locator("#itemsTab").waitFor();
    await page.locator("#styleTab").click();
    await page.waitForFunction(() => {
      const requested = getSelectedLook().cardComposition.layer;
      const personFront = document.querySelector('[data-composition-layer="person-front"]');
      const hint = document.querySelector("#compositionLayerHint");
      return requested === "person-front"
        && personFront?.disabled === true
        && hint?.hidden === false
        && document.querySelector("#canvasBoard")?.dataset.compositionLayer === "info-front"
        && document.querySelectorAll(".character-figure.is-empty").length === 3;
    }, null, { timeout: 8000 });
    persistedLook = await readSavedLook(page);
    assert.equal(persistedLook.cardComposition.layer, "person-front", "the unavailable preference should remain stored for when photos are available");
    assert.equal(persistedLook.cardComposition.protectText, false);
    assert.equal(persistedLook.cardComposition.infoGap, 1);
    assert.deepEqual(persistedLook.extraEquipment.map((entries) => entries.length), [13, 1, 1, 0, 0], "autosave/reload should restore all active per-character entries and keep spare characters empty");
    const hydratedCatalogRecords = await page.evaluate(async () => {
      const saved = await draftStorage.readValue("tuyeong-set-maker2-draft-v3");
      return saved?.catalogItems?.filter((entry) => String(entry.id) === "9009090") || [];
    });
    assert.equal(hydratedCatalogRecords.length, 1, "a referenced catalog extra should remain in the local catalog cache after reload");
    assert.deepEqual(hydratedCatalogRecords[0].names, {
      ko: "카탈로그 귀걸이", en: "Catalog earrings hydrated", ja: "カタログイヤリング",
    }, "the requested-locale catalog extra should retain hydrated EN/JA names across reload");

    await page.locator("#itemsTab").click();
    await page.locator('[data-item-character="2"]').click();
    await page.waitForFunction(() => document.querySelector('[data-item-character="2"]')?.getAttribute("aria-pressed") === "true");
    await page.evaluate(() => {
      window.__gearSheetText = [];
      window.__gearSheetImageDraws = 0;
      const prototype = CanvasRenderingContext2D.prototype;
      const fillText = prototype.fillText;
      const drawImage = prototype.drawImage;
      prototype.fillText = function (text, ...args) {
        if (this.canvas.width === 2160 && this.canvas.height === 2700) window.__gearSheetText.push(String(text));
        return fillText.call(this, text, ...args);
      };
      prototype.drawImage = function (...args) {
        if (this.canvas.width === 2160 && this.canvas.height === 2700) window.__gearSheetImageDraws += 1;
        return drawImage.apply(this, args);
      };
    });
    const artifactsDir = path.resolve(__dirname, "../artifacts");
    fs.mkdirSync(artifactsDir, { recursive: true });
    const selectedSheetPath = path.join(artifactsDir, "equipment-selected-sheet.png");
    const [selectedSheetDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportSelectedGearSheet").click(),
    ]);
    assert.match(selectedSheetDownload.suggestedFilename(), /\.png$/i, "selected-character gear export should download a PNG");
    await selectedSheetDownload.saveAs(selectedSheetPath);
    const selectedSheetBytes = fs.readFileSync(selectedSheetPath);
    assert.equal(selectedSheetBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "selected gear sheet should be a valid PNG even with no photo");
    let sheetDiagnostics = await page.evaluate(() => ({ text: window.__gearSheetText.join("\n"), imageDraws: window.__gearSheetImageDraws }));
    assert.match(sheetDiagnostics.text, /세 번째 캐릭터 장비/, "selected-character gear-sheet export should include the selected character's entry");
    assert.equal(sheetDiagnostics.imageDraws, 0, "gear-sheet export should not require a portrait image");

    const allSheetsPath = path.join(artifactsDir, "equipment-all-sheets.zip");
    await page.evaluate(() => { window.__gearSheetText = []; window.__gearSheetImageDraws = 0; });
    const [allSheetsDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportAllGearSheets").click(),
    ]);
    assert.match(allSheetsDownload.suggestedFilename(), /\.zip$/i, "all-active-character export should download a ZIP");
    await allSheetsDownload.saveAs(allSheetsPath);
    const archiveNames = storedZipNames(fs.readFileSync(allSheetsPath));
    const characterFolders = new Set(archiveNames
      .filter((name) => /\.png$/i.test(name))
      .map((name) => name.match(/character-(\d{2})\//)?.[1])
      .filter(Boolean));
    assert.deepEqual([...characterFolders].sort(), ["01", "02", "03"], `all active characters should export even without portraits: ${JSON.stringify(archiveNames)}`);
    sheetDiagnostics = await page.evaluate(() => ({ text: window.__gearSheetText.join("\n"), imageDraws: window.__gearSheetImageDraws }));
    assert.match(sheetDiagnostics.text, new RegExp(firstHiddenName), "ZIP gear sheets should include hidden extra entries");
    assert.match(sheetDiagnostics.text, /두 번째 캐릭터 장비/, "ZIP should contain the second character's registered equipment");
    assert.match(sheetDiagnostics.text, /세 번째 캐릭터 장비/, "ZIP should contain the third character's registered equipment");
    assert.equal(sheetDiagnostics.imageDraws, 0, "all-sheet ZIP export should succeed without any portrait draws");

    assert.deepEqual(pageErrors.map((error) => error.message), [], "equipment registration, localization and export should not emit browser runtime errors");

    console.log("PASS: equipment rows, accessories/facewear/fashion registration, localization, per-character visibility/history/autosave, uncapped multi-person card items, opaque-person fallback, and photo-free gear-sheet exports.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
