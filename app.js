const { create: defaultLookEditor, capture: captureEditorState, normalize: normaliseLookEditor,
  emptyCharacter: createEmptyCharacter, emptyCharacters: createEmptyCharacters,
  normalizeCharacter: ensureCharacterImageState } = LookEditor;

const backgrounds = {
  dusk: {
    solid: "#eee5d7",
    pattern: ["#686879", "#f8f6ff"],
    label: "황혼",
  },
  linen: {
    solid: "#f4eee4",
    pattern: ["#8e7883", "#fffaf3"],
    label: "리넨",
  },
  tide: {
    solid: "#b2ccd0",
    pattern: ["#385d68", "#e8f6f7"],
    label: "물빛",
  },
  ink: {
    solid: "#343543",
    pattern: ["#d8d7ef", "#777c9c"],
    label: "먹빛",
  },
  rose: {
    solid: "#e5cbc7",
    pattern: ["#835869", "#ffe9eb"],
    label: "장미",
  },
  pearl: {
    solid: "#f8f3ef",
    pattern: ["#71819c", "#ffffff"],
    label: "진주빛",
  },
  paper: { solid: "#f7f5f0", pattern: ["#858594", "#ffffff"], label: "종이" },
  mist: { solid: "#e7eff2", pattern: ["#648091", "#f8fdff"], label: "미스트" },
  charcoal: { solid: "#25262b", pattern: ["#dddbea", "#747481"], label: "차콜" },
};

const titleTypography = TitleTypography.create();
const titleFonts = titleTypography.fonts;
const titleFontOrder = titleTypography.fontOrder;
const defaultTitleFont = titleTypography.defaultFont;
const defaultTitleWeight = titleTypography.defaultWeight;

function getTitleFontConfig(fontKey = state?.titleFont) {
  return titleTypography.config(fontKey);
}

function normaliseTitleWeight(fontKey, weight) {
  return titleTypography.normalizeWeight(fontKey, weight);
}

function getTitleWeightOptions(fontKey) {
  return titleTypography.weightOptions(fontKey);
}

function populateTitleFontSelect() {
  const select = $("#titleFontSelect");
  if (!select || select.dataset.ready === "true") return;
  titleFontOrder.forEach((fontKey) => {
    const option = document.createElement("option");
    option.value = fontKey;
    option.textContent = titleFonts[fontKey].label;
    option.style.fontFamily = titleFonts[fontKey].family;
    select.appendChild(option);
  });
  select.dataset.ready = "true";
}

function syncTitleFontControls() {
  populateTitleFontSelect();
  const select = $("#titleFontSelect");
  const weightRow = $("#titleWeightRow");
  const optionsHost = $("#titleWeightOptions");
  if (!select || !weightRow || !optionsHost) return;
  if (!titleFonts[state.titleFont]) state.titleFont = defaultTitleFont;
  const config = getTitleFontConfig(state.titleFont);
  state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? config.weights[config.weights.length - 1]);
  select.value = state.titleFont;
  optionsHost.style.setProperty("--weight-preview-font", config.family);
  const options = getTitleWeightOptions(state.titleFont);
  weightRow.hidden = options.length === 0;
  const hadWeightFocus = optionsHost.contains(document.activeElement);
  optionsHost.innerHTML = options.map(({ weight, label }) => `
    <button class="title-weight-option${weight === state.titleWeight ? " is-selected" : ""}" type="button" data-title-weight="${weight}" role="radio" aria-checked="${weight === state.titleWeight}" aria-label="${escapeHtml(`${label} ${weight}`)}">
      <span style="font-weight:${weight}">가</span><small>${escapeHtml(label)}</small>
    </button>
  `).join("");
  if (hadWeightFocus) optionsHost.querySelector('[aria-checked="true"]')?.focus();
}

// Kept only to migrate drafts created before background presets existed.
// These values never appear in the editor or in the new preset library.
const legacyStyleRecipes = {
  "quiet-paper": {
    background: "paper",
    backgroundPattern: "none",
    backgroundTexture: "none",
  },
  "blue-bitmap": {
    background: "tide",
    backgroundPattern: "bitmap",
    backgroundTexture: "none",
  },
  "soft-pixel": {
    background: "pearl",
    backgroundPattern: "stars",
    backgroundTexture: "grain",
  },
  "scrapbook-pop": {
    background: "rose",
    backgroundPattern: "halftone",
    backgroundTexture: "grain",
  },
};

function getExportTheme() {
  const isDark = ["ink", "charcoal"].includes(state.background);
  const ink = isDark ? "#f7f3ed" : "#263238";
  const panelBase = isDark ? "#1d2228" : "#fffaf4";
  const panelBorder = isDark ? rgba("#f7f3ed", 0.24) : rgba("#263238", 0.18);
  return {
    header: rgba(panelBase, 0.92),
    headerBorder: panelBorder,
    panel: rgba(panelBase, 0.96),
    panelBorder,
    text: ink,
    muted: isDark ? rgba("#f7f3ed", 0.62) : rgba("#263238", 0.6),
    infoShadow: rgba(panelBase, 0.9),
    radius: 10,
  };
}

// One filled five-point star is shared by the live preview and PNG export.
// Keeping one geometry prevents the preview and downloaded card from drifting.
const patternStars = [
  { x: 6, y: 8, size: 4.6, rotate: -4, tone: "ink", opacity: 0.62 },
  { x: 18, y: 18, size: 3, rotate: 5, tone: "light", opacity: 0.68 },
  { x: 33, y: 9, size: 3.8, rotate: -3, tone: "ink", opacity: 0.5 },
  { x: 49, y: 17, size: 3.4, rotate: 4, tone: "light", opacity: 0.58 },
  { x: 68, y: 8, size: 4.8, rotate: -5, tone: "ink", opacity: 0.58 },
  { x: 86, y: 18, size: 3.5, rotate: 6, tone: "light", opacity: 0.66 },
  { x: 96, y: 7, size: 2.8, rotate: -2, tone: "ink", opacity: 0.48 },
  { x: 9, y: 31, size: 3.4, rotate: 4, tone: "light", opacity: 0.52 },
  { x: 25, y: 37, size: 4.5, rotate: -5, tone: "ink", opacity: 0.54 },
  { x: 42, y: 29, size: 2.9, rotate: 2, tone: "light", opacity: 0.5 },
  { x: 59, y: 35, size: 3.8, rotate: -4, tone: "ink", opacity: 0.48 },
  { x: 76, y: 30, size: 4.2, rotate: 5, tone: "light", opacity: 0.6 },
  { x: 92, y: 39, size: 3.1, rotate: -3, tone: "ink", opacity: 0.46 },
  { x: 5, y: 55, size: 3.8, rotate: -5, tone: "ink", opacity: 0.52 },
  { x: 19, y: 48, size: 2.8, rotate: 4, tone: "light", opacity: 0.5 },
  { x: 35, y: 56, size: 3.3, rotate: -2, tone: "ink", opacity: 0.44 },
  { x: 52, y: 47, size: 4.4, rotate: 5, tone: "light", opacity: 0.62 },
  { x: 70, y: 55, size: 3.5, rotate: -4, tone: "ink", opacity: 0.5 },
  { x: 87, y: 50, size: 4.1, rotate: 3, tone: "light", opacity: 0.56 },
  { x: 97, y: 61, size: 2.7, rotate: -5, tone: "ink", opacity: 0.44 },
  { x: 8, y: 76, size: 4.6, rotate: -5, tone: "light", opacity: 0.64 },
  { x: 25, y: 68, size: 3, rotate: 4, tone: "ink", opacity: 0.46 },
  { x: 43, y: 78, size: 3.7, rotate: -3, tone: "light", opacity: 0.56 },
  { x: 61, y: 70, size: 4.8, rotate: 5, tone: "ink", opacity: 0.56 },
  { x: 78, y: 80, size: 3, rotate: -4, tone: "light", opacity: 0.48 },
  { x: 93, y: 73, size: 4.2, rotate: 4, tone: "ink", opacity: 0.52 },
  { x: 18, y: 92, size: 3.5, rotate: 3, tone: "ink", opacity: 0.5 },
  { x: 38, y: 88, size: 4.1, rotate: -4, tone: "light", opacity: 0.58 },
  { x: 56, y: 94, size: 3, rotate: 5, tone: "ink", opacity: 0.44 },
  { x: 74, y: 90, size: 4.6, rotate: -3, tone: "light", opacity: 0.6 },
  { x: 90, y: 94, size: 3.4, rotate: 4, tone: "ink", opacity: 0.48 },
];

const backgroundPatternOptions = new Set(["none", "dots", "stars", "halftone", "bitmap"]);
const backgroundTextureOptions = new Set(["none", "grain"]);
const draftStorageKey = "glamour-atelier-draft-v3";
const uiPreferencesStorageKey = "glamour-atelier-ui-v2";
const backgroundPresetStorageKey = "glamour-atelier-background-presets-v2";
const legacyStorageKeys = [
  "glamour-atelier-draft-v1",
  "glamour-atelier-draft-v2",
  "glamour-atelier-ui-v1",
  "glamour-atelier-background-presets-v1",
];
const backgroundPresetLimit = 18;
const backgroundPatternLabels = Object.freeze({
  none: "패턴 없음",
  dots: "도트",
  stars: "별",
  halftone: "하프톤",
  bitmap: "비트맵",
});
const backgroundTextureLabels = Object.freeze({ none: "질감 없음", grain: "그레인" });
let backgroundPresets = [];
let backgroundPresetCreateOpen = false;
const backgroundPresetModel = BackgroundPresets.create({
  backgrounds,
  patternLabels: backgroundPatternLabels,
  textureLabels: backgroundTextureLabels,
  patterns: backgroundPatternOptions,
  textures: backgroundTextureOptions,
  limit: backgroundPresetLimit,
  idFactory: () => `background-${createAssetKey()}`,
});

function getBackgroundSelection(source = state) {
  return backgroundPresetModel.selection(source);
}

function getBackgroundSelectionSignature(source = state) {
  return backgroundPresetModel.signature(source);
}

function describeBackgroundSelection(source = state) {
  return backgroundPresetModel.describe(source);
}

function loadBackgroundPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(backgroundPresetStorageKey) || "[]");
    backgroundPresets = backgroundPresetModel.load(saved);
  } catch {
    backgroundPresets = [];
  }
}

function saveBackgroundPresets() {
  try {
    localStorage.setItem(backgroundPresetStorageKey, JSON.stringify(backgroundPresets));
  } catch {
    // The editor remains usable when browser storage is unavailable.
  }
}

function renderBackgroundPresets() {
  const list = $("#backgroundPresetList");
  const empty = $("#backgroundPresetEmpty");
  const count = $("#backgroundPresetCount");
  if (!list) return;
  const currentSignature = getBackgroundSelectionSignature();
  list.innerHTML = backgroundPresets.map((preset) => {
    const background = backgrounds[preset.background];
    const selected = getBackgroundSelectionSignature(preset) === currentSignature;
    return `<article class="background-preset-item${selected ? " is-current" : ""}">
      <button class="background-preset-apply" type="button" data-background-preset-id="${escapeHtml(preset.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(`${preset.name} 배경 프리셋 적용`)}">
        <span class="background-preset-preview" data-pattern="${preset.backgroundPattern}" data-texture="${preset.backgroundTexture}" style="--preset-bg:${background.solid};--preset-ink:${background.pattern[0]};--preset-light:${background.pattern[1]}" aria-hidden="true"></span>
        <span class="background-preset-copy"><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(describeBackgroundSelection(preset))}</small></span>
      </button>
      <button class="background-preset-delete" type="button" data-background-preset-delete="${escapeHtml(preset.id)}" aria-label="${escapeHtml(`${preset.name} 프리셋 삭제`)}"><span aria-hidden="true">×</span></button>
    </article>`;
  }).join("");
  list.hidden = backgroundPresets.length === 0;
  if (empty) empty.hidden = backgroundPresets.length > 0;
  if (count) count.textContent = backgroundPresets.length ? `${backgroundPresets.length}` : "";
}

function setBackgroundPresetFormOpen(open) {
  backgroundPresetCreateOpen = Boolean(open);
  const form = $("#backgroundPresetForm");
  const trigger = $("#saveBackgroundPresetButton");
  if (form) form.hidden = !backgroundPresetCreateOpen;
  if (trigger) {
    trigger.setAttribute("aria-expanded", String(backgroundPresetCreateOpen));
    trigger.textContent = backgroundPresetCreateOpen ? "취소" : "＋ 저장";
  }
  if (backgroundPresetCreateOpen) {
    const input = $("#backgroundPresetName");
    if (input) {
      input.value = "";
      window.requestAnimationFrame(() => input.focus());
    }
  }
}

function saveCurrentBackgroundPreset() {
  const input = $("#backgroundPresetName");
  const selection = getBackgroundSelection();
  const name = input?.value.trim().slice(0, 28) || describeBackgroundSelection(selection);
  const result = backgroundPresetModel.add(backgroundPresets, selection, name);
  if (!result) {
    showToast("같은 배경 조합이 이미 저장되어 있습니다.");
    input?.focus();
    return false;
  }
  backgroundPresets = result.list;
  saveBackgroundPresets();
  setBackgroundPresetFormOpen(false);
  renderBackgroundPresets();
  renderStyles({ refreshInfo: false, refreshPattern: false });
  showToast(`${name} 배경 프리셋을 저장했습니다.`);
  return true;
}

function applyBackgroundPreset(id) {
  const preset = backgroundPresetModel.find(backgroundPresets, id);
  if (!preset) return;
  recordHistory();
  state.background = preset.background;
  state.backgroundPattern = preset.backgroundPattern;
  state.backgroundTexture = preset.backgroundTexture;
  renderStyles();
  saveState();
  showToast(`${preset.name} 배경 프리셋을 적용했습니다.`);
}

function deleteBackgroundPreset(id) {
  const preset = backgroundPresetModel.find(backgroundPresets, id);
  if (!preset) return;
  backgroundPresets = backgroundPresetModel.remove(backgroundPresets, id);
  saveBackgroundPresets();
  renderBackgroundPresets();
  showToast(`${preset.name} 프리셋을 삭제했습니다.`);
}

// The editor receives item records from the server search adapter. Keeping a
// built-in catalog here made the first render look finished with fabricated
// outfits and caused test data to leak into production drafts.
const itemRecordCache = new Map();
const itemSearchState = {
  timer: null,
  mode: "idle",
};
const itemSearch = ItemSearch.create({ fetch: (...args) => fetch(...args) });

const outfitSlots = ["head", "body", "hands", "legs", "feet"];
const outfitSlotNamesByLanguage = {
  ko: { head: "머리", body: "몸통", hands: "손", legs: "다리", feet: "발", weapon: "무기" },
  en: { head: "Head", body: "Body", hands: "Hands", legs: "Legs", feet: "Feet", weapon: "Weapon" },
  ja: { head: "頭", body: "胴", hands: "手", legs: "脚", feet: "足", weapon: "武器" },
};
const outfitSlotNames = outfitSlotNamesByLanguage.ko;
const outfitSlotVisualLabelsByLanguage = {
  ko: { head: "모자", body: "티셔츠", hands: "장갑", legs: "바지", feet: "신발", weapon: "무기" },
  en: { head: "Hat", body: "Top", hands: "Gloves", legs: "Pants", feet: "Shoes", weapon: "Weapon" },
  ja: { head: "帽子", body: "トップス", hands: "手袋", legs: "パンツ", feet: "靴", weapon: "武器" },
};
const outfitSlotVisualLabels = outfitSlotVisualLabelsByLanguage.ko;
function getOutfitSlotName(slot, language = state.language) {
  return outfitSlotNamesByLanguage[language]?.[slot] || outfitSlotNames[slot] || "장비";
}

function getOutfitSlotVisualLabel(slot, language = state.language) {
  return outfitSlotVisualLabelsByLanguage[language]?.[slot] || outfitSlotVisualLabels[slot] || "장비";
}

function createOutfit(itemIds = []) {
  const outfit = Object.fromEntries(outfitSlots.map((slot) => [slot, null]));
  itemIds.forEach((itemId) => {
    const item = getItem(itemId);
    if (item && outfitSlots.includes(item.slot)) outfit[item.slot] = item.id;
  });
  return outfit;
}

function createOutfits(itemIds, variants = []) {
  return Array.from({ length: 5 }, (_, index) => createOutfit(variants[index] || itemIds));
}

function cloneOutfits(outfits) {
  return (outfits || []).map((outfit) => ({ ...outfit }));
}

function outfitToItemIds(outfit) {
  return outfitSlots.map((slot) => outfit?.[slot]).filter(Boolean);
}

function ensureLookOutfits(look) {
  if (!Array.isArray(look.outfits) || !look.outfits.length) {
    look.outfits = createOutfits(look.itemIds || []);
  }
  while (look.outfits.length < 5) {
    look.outfits.push(createOutfit(look.itemIds || []));
  }
  look.outfits = look.outfits.slice(0, 5).map((outfit) => ({ ...createOutfit(), ...outfit }));
  look.itemIds = outfitToItemIds(look.outfits[0]);
  return look.outfits;
}

function getLookOutfits(look = getSelectedLook()) {
  return ensureLookOutfits(look);
}

function getCharacterOutfit(characterIndex = state.selectedCharacter, look = getSelectedLook()) {
  const outfits = getLookOutfits(look);
  return outfits[characterIndex] || outfits[0] || createOutfit();
}

function getCharacterItemIds(characterIndex = state.selectedCharacter, look = getSelectedLook()) {
  return outfitToItemIds(getCharacterOutfit(characterIndex, look));
}

function createBlankLook(number = 1, id = `look-${number}`) {
  return {
    id,
    title: "새로운 룩",
    subtitle: "",
    itemIds: [],
    outfits: createOutfits([]),
    background: "paper",
    backgroundPattern: "none",
    backgroundTexture: "none",
    titleFont: defaultTitleFont,
    titleWeight: defaultTitleWeight,
    outline: { color: "#f1dfbb", width: 0 },
    titleOutline: { color: "#ffffff", width: 0 },
  };
}


let looks = [createBlankLook(1, "look-1")];
const deletedLooks = [];
let lookCopyInProgress = false;
looks.forEach(ensureLookOutfits);
let defaultLookSnapshots = new Map();

function createLookResetSnapshot(look, index = 0) {
  const blank = createBlankLook(index + 1, look?.id || `look-${index + 1}`);
  return {
    title: blank.title,
    subtitle: blank.subtitle,
    outfits: cloneOutfits(blank.outfits),
    background: blank.background,
    backgroundPattern: blank.backgroundPattern,
    backgroundTexture: blank.backgroundTexture,
  };
}

function captureDefaultLookSnapshots() {
  defaultLookSnapshots = new Map(looks.map((look, index) => [look.id, createLookResetSnapshot(look, index)]));
}

captureDefaultLookSnapshots();

const state = {
  language: "ko",
  selectedLookId: "look-1",
  activeSlot: "head",
  activePanel: "stylePanel",
  characterCount: 1,
  selectedCharacter: 0,
  characters: createEmptyCharacters(),
  background: "paper",
  multiInfoEnabled: true,
  multiInfoMode: "fade",
  infoDensity: "summary",
  titleFont: defaultTitleFont,
  titleWeight: defaultTitleWeight,
  singleRatio: "portrait",
  singleLayout: "info-left",
  backgroundPattern: "none",
  backgroundTexture: "none",
  cutout: false,
  outline: { color: "#f1dfbb", width: 0 },
  titleOutline: { color: "#ffffff", width: 0 },
  shadow: { strength: 20, x: 8, y: 12, blur: 24 },
  zoom: 100,
  panX: 0,
  panY: 0,
  imageFit: "contain",
  imageSrc: "",
  originalSrc: "",
  fileName: "사진 미선택",
  fileMeta: "PNG · JPG · WebP · 여러 장 선택 가능",
  history: [],
  redo: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  board: $("#canvasBoard"),
  sceneBackground: $("#sceneBackground"),
  portraitWrap: $("#portraitWrap"),
  scenePattern: $("#scenePattern"),
  multiInfoLayer: $("#multiInfoLayer"),
  sourceThumb: $("#sourceThumb"),
  sourceThumbFrame: $("#sourceThumbFrame"),
  sourceFileName: $("#sourceFileName"),
  sourceFileMeta: $("#sourceFileMeta"),
  imageState: $("#imageState"),
  imagePlacementSummary: $("#imagePlacementSummary"),
  imageEditorDialog: $("#imageEditorDialog"),
  openImageEditorButton: $("#openImageEditorButton"),
  closeImageEditorButton: $("#closeImageEditorButton"),
  cancelImageEditorButton: $("#cancelImageEditorButton"),
  applyImageEditorButton: $("#applyImageEditorButton"),
  boardTitle: $("#boardTitle"),
  boardSubtitle: $("#boardSubtitle"),
  cardTitleInput: $("#cardTitleInput"),
  cardSubtitleInput: $("#cardSubtitleInput"),
  cardTitleCount: $("#cardTitleCount"),
  cardSubtitleCount: $("#cardSubtitleCount"),
  inspectorTitle: $("#inspectorTitle"),
  castSelectionSummary: $("#castSelectionSummary"),
  libraryToggleButton: $("#libraryToggleButton"),
  lookList: $("#lookList"),
  itemSearch: $("#itemSearch"),
  itemCharacterSelector: $("#itemCharacterSelector"),
  itemsSummaryTitle: $("#itemsSummaryTitle"),
  equipmentList: $("#equipmentList"),
  catalogResults: $("#catalogResults"),
  languageSelect: $("#languageSelect"),
  outlineRange: $("#outlineRange"),
  outlineValue: $("#outlineValue"),
  titleOutlineRange: $("#titleOutlineRange"),
  titleOutlineValue: $("#titleOutlineValue"),
  shadowRange: $("#shadowRange"),
  shadowValue: $("#shadowValue"),
  zoomRange: $("#zoomRange"),
  panXRange: $("#panXRange"),
  panYRange: $("#panYRange"),
  panXReadout: $("#panXReadout"),
  panYReadout: $("#panYReadout"),
  centerImageButton: $("#centerImageButton"),
  zoomReadout: $("#zoomReadout"),
  toast: $("#toast"),
  imageInput: $("#imageInput"),
};

let toastTimer;
let styleAdvancedOpen = false;
const uiPreferences = { libraryCollapsed: true };
let imageEditorOpen = false;
let imageEditorSnapshot = null;
let imageEditorDirty = false;
let imageEditorReturnFocus = null;
let boardTitleResizeObserver = null;

const panelLabels = {
  stylePanel: "꾸미기",
  itemsPanel: "장비",
};
const editorNavigation = EditorNavigation.create({
  panels: Object.keys(panelLabels),
  defaultPanel: "stylePanel",
});

function restoreUiPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(uiPreferencesStorageKey) || "null");
    uiPreferences.libraryCollapsed = saved ? Boolean(saved.libraryCollapsed) : true;
  } catch {
    uiPreferences.libraryCollapsed = true;
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(uiPreferencesStorageKey, JSON.stringify({ libraryCollapsed: uiPreferences.libraryCollapsed }));
  } catch {
    // The workspace remains usable when browser storage is unavailable.
  }
}

function purgeLegacyStorage() {
  legacyStorageKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage may be disabled; the editor can still start with blank state.
    }
  });
}

function syncLibraryPanel() {
  const collapsed = uiPreferences.libraryCollapsed;
  document.body.classList.toggle("library-collapsed", collapsed);
  const library = document.getElementById("lookLibrary");
  if (library) library.inert = collapsed;
  const button = elements.libraryToggleButton;
  if (!button) return;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "LOOK BOOK 펼치기" : "LOOK BOOK 접기");
  button.title = collapsed ? "LOOK BOOK 펼치기" : "LOOK BOOK 접기";
  const key = button.querySelector(".tool-key");
  const label = button.querySelector("small");
  if (key) key.textContent = collapsed ? "›" : "‹";
  if (label) label.textContent = collapsed ? "LOOK BOOK 펼치기" : "LOOK BOOK 접기";
}

function toggleLibraryPanel() {
  uiPreferences.libraryCollapsed = !uiPreferences.libraryCollapsed;
  syncLibraryPanel();
  saveUiPreferences();
}

function getSelectedLook() {
  return looks.find((look) => look.id === state.selectedLookId) || looks[0];
}

function syncStateIntoLook(look = getSelectedLook()) {
  if (!look) return;
  look.editor = captureEditorState(state);
  look.background = backgrounds[state.background] ? state.background : "paper";
  look.backgroundPattern = backgroundPatternOptions.has(state.backgroundPattern) ? state.backgroundPattern : "none";
  look.backgroundTexture = backgroundTextureOptions.has(state.backgroundTexture) ? state.backgroundTexture : "none";
  look.titleFont = titleFonts[state.titleFont] ? state.titleFont : defaultTitleFont;
  look.titleWeight = normaliseTitleWeight(look.titleFont, state.titleWeight ?? defaultTitleWeight);
  look.outline = { ...state.outline };
  look.titleOutline = { ...state.titleOutline };
  look.outfits = cloneOutfits(getLookOutfits(look));
  look.itemIds = outfitToItemIds(look.outfits[0]);
}

function getItem(itemId) {
  return itemRecordCache.get(String(itemId)) || null;
}

function registerItemRecords(items = []) {
  items.forEach((item) => {
    if (!item?.id || !item?.slot || !item?.names) return;
    const id = String(item.id);
    const previous = itemRecordCache.get(id) || {};
    itemRecordCache.set(id, {
      ...previous,
      ...item,
      id,
      names: { ...(previous.names || {}), ...item.names },
      meta: { ...(previous.meta || {}), ...(item.meta || {}) },
    });
  });
}

const localizedItemNameRequests = new Map();

function ensureItemLanguageName(item, language) {
  const itemId = String(item?.id || "");
  const requestKey = `${language}:${itemId}`;
  if (!itemId || item?.names?.[language] || !/^\d+$/.test(itemId)) return Promise.resolve(false);
  if (localizedItemNameRequests.has(requestKey)) return localizedItemNameRequests.get(requestKey);
  const request = (async () => {
    try {
      const params = new URLSearchParams({ q: itemId, slot: item.slot, language });
      const response = await fetch(`/api/items/search?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) return false;
      const localizedItem = (payload.results || []).find((result) => String(result.id) === itemId);
      if (!localizedItem?.names?.[language]) return false;
      registerItemRecords([localizedItem]);
      return true;
    } catch {
      return false;
    } finally {
      localizedItemNameRequests.delete(requestKey);
    }
  })();
  localizedItemNameRequests.set(requestKey, request);
  return request;
}

async function hydrateEnglishItemNames(items = []) {
  const operationEpoch = workspaceEpoch;
  const lookId = state.selectedLookId;
  const uniqueItems = Array.from(new Map(items.filter(Boolean).map((item) => [String(item.id), item])).values());
  const languages = state.language === "en" ? ["en"] : [state.language, "en"];
  const results = await Promise.all(
    uniqueItems.flatMap((item) => languages.map((language) => ensureItemLanguageName(item, language))),
  );
  if (operationEpoch !== workspaceEpoch || lookId !== state.selectedLookId) return;
  if (!results.some(Boolean)) return;
  renderEquipment();
  renderMultiInfo();
  saveState();
}

function hydrateCurrentLookEnglishNames() {
  const look = getSelectedLook();
  const items = state.characters
    .slice(0, state.characterCount)
    .flatMap((_, index) => getCharacterItemIds(index, look).map(getItem));
  void hydrateEnglishItemNames(items);
}

function getItemName(item, language = state.language) {
  if (!item) return "아이템을 연결하세요";
  return item.names?.[language] || item.names?.ko || item.names?.en || item.names?.ja || `아이템 ${item.id}`;
}

function getSecondaryItemName(item, language = state.language) {
  if (!item || !["ko", "ja"].includes(language)) return "";
  const primaryName = getItemName(item, language);
  const englishName = String(item.names?.en || "").trim();
  return englishName && englishName !== primaryName ? englishName : "";
}

function getItemMeta(item, language = state.language) {
  if (!item) return "아이템을 검색해 연결";
  return item.meta?.[language] || item.meta?.ko || item.meta?.en || item.meta?.ja || "장비";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderCatalogIcon(item) {
  return renderEquipmentIcon(item?.slot);
}

function renderEquipmentIcon(slot) {
  const label = escapeHtml(getOutfitSlotVisualLabel(slot));
  if (!outfitSlots.includes(slot)) return label;
  return `<svg class="outfit-icon" aria-hidden="true" focusable="false"><use href="assets/icons/equipment.svg#${slot}"></use></svg><span>${label}</span>`;
}

const characterAssetResolvers = {
  hero: (character) => character?.src || character?.originalSrc || "",
  gear: (character) => character?.originalSrc || character?.src || "",
  source: (character) => character?.originalSrc || character?.src || "",
};

function resolveCharacterAsset(character, role = "hero") {
  const resolver = characterAssetResolvers[role] || characterAssetResolvers.hero;
  return resolver(character);
}

function getCanvasRatio() {
  return state.characterCount === 1 && state.singleRatio === "portrait" ? "portrait" : "landscape";
}

function getBackgroundSurfaceCss(background) {
  return background.solid;
}

function restoreBackgroundStyle(pattern, legacyMotif = "none", texture = "none") {
  const legacyPatterns = {
    ascii: "dots",
    y2k: "stars",
    geometry: "halftone",
    gradient: "none",
    grain: "none",
  };
  let restoredPattern = legacyPatterns[pattern] || pattern;
  let restoredTexture = texture;

  // Older drafts stored grain as a pattern and stars as a separate motif.
  if (pattern === "grain") restoredTexture = "grain";
  if (legacyMotif === "stars" && (!restoredPattern || restoredPattern === "none")) restoredPattern = "stars";

  state.backgroundPattern = backgroundPatternOptions.has(restoredPattern) ? restoredPattern : "none";
  state.backgroundTexture = backgroundTextureOptions.has(restoredTexture) ? restoredTexture : "none";
}

function getExportDimensions() {
  return getCanvasRatio() === "portrait"
    ? { layoutWidth: 1080, layoutHeight: 1350, exportWidth: 2160, exportHeight: 2700 }
    : { layoutWidth: 1200, layoutHeight: 675, exportWidth: 2400, exportHeight: 1350 };
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value.length === 3 ? value.split("").map((char) => char + char).join("") : value, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

const characterAssetVault = ImageAssets.create({ indexedDB: window.indexedDB });

let assetCleanupTimer;
let workspaceEpoch = 0;
const pendingAssetWrites = new Set();
async function writeCharacterAsset(key, value) {
  const write = characterAssetVault.update(key, value);
  pendingAssetWrites.add(write);
  try { return await write; }
  finally { pendingAssetWrites.delete(write); }
}
const assetUrls = new Set();
function createAssetUrl(blob) {
  const url = URL.createObjectURL(blob); assetUrls.add(url); return url;
}
function scheduleAssetCleanup() {
  clearTimeout(assetCleanupTimer);
  assetCleanupTimer = setTimeout(() => {
    if (exportInProgress || lookCopyInProgress || pendingAssetWrites.size || $("#cutoutButton")?.classList.contains("is-processing")) { scheduleAssetCleanup(); return; }
    const snapshots = [state, ...state.history, ...state.redo,
      ...[...looks, ...deletedLooks.map(entry => entry.look)].flatMap(look => [look.editor, ...(look.history || []), ...(look.redo || [])])];
    const characters = snapshots.flatMap(snapshot => snapshot?.characters || []);
    const liveKeys = new Set(characters.map(character => character.assetKey).filter(Boolean));
    const liveUrls = new Set(characters.flatMap(character => [character.src, character.originalSrc]));
    for (const url of assetUrls) if (!liveUrls.has(url)) { revokeObjectUrl(url); assetUrls.delete(url); }
    void characterAssetVault.prune(liveKeys).catch(() => {});
  }, 1000);
}

function createAssetKey() {
  return window.crypto?.randomUUID?.() || `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function revokeObjectUrl(url) {
  if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function revokeCharacterAssets(characters = state.characters) {
  characters.forEach((character) => {
    revokeObjectUrl(character?.src);
    revokeObjectUrl(character?.originalSrc);
  });
}

function clamp(value, min, max, fallback = min) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(max, Math.max(min, numericValue)) : fallback;
}


function getCharacterImageState(character) {
  return ensureCharacterImageState(character || state.characters[0]) || {
    imageFit: "contain",
    zoom: 100,
    panX: 0,
    panY: 0,
  };
}

function updateSelectedImageState(nextState = {}) {
  const character = getCharacterImageState(state.characters[state.selectedCharacter]);
  Object.assign(character, nextState);
  ensureCharacterImageState(character);
  state.zoom = character.zoom;
  state.panX = character.panX;
  state.panY = character.panY;
  state.imageFit = character.imageFit;
  return character;
}

function isImagePlacementChanged(snapshot = imageEditorSnapshot) {
  if (!snapshot) return false;
  return state.zoom !== snapshot.zoom || state.panX !== snapshot.panX || state.panY !== snapshot.panY || state.imageFit !== snapshot.imageFit;
}

function syncImagePlacementSummary() {
  if (elements.imagePlacementSummary) {
    const placement = state.panX === 0 && state.panY === 0 ? "기본 위치" : "사용자 지정";
    elements.imagePlacementSummary.textContent = `${state.zoom}% · ${placement}`;
  }
}

function openImageEditor() {
  if (!elements.imageEditorDialog || imageEditorOpen) return;
  imageEditorSnapshot = createSnapshot();
  imageEditorDirty = false;
  imageEditorReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : elements.openImageEditorButton;
  imageEditorOpen = true;
  elements.imageEditorDialog.querySelector("details")?.removeAttribute("open");
  document.body.classList.add("image-placement-mode");
  elements.imageEditorDialog.hidden = false;
  elements.openImageEditorButton?.setAttribute("aria-expanded", "true");
  elements.portraitWrap?.setAttribute("aria-label", "이미지 배치 편집 중. 선택한 캐릭터를 드래그하거나 방향키로 이동하세요.");
  syncImagePlacementSummary();
  window.requestAnimationFrame(() => {
    const selectedFigure = elements.portraitWrap?.querySelector(`.character-figure[data-character-index="${state.selectedCharacter}"]`);
    selectedFigure?.setAttribute("aria-describedby", "imageEditorDescription");
    selectedFigure?.focus({ preventScroll: true });
  });
}

function finishImageEditor(apply) {
  if (!imageEditorOpen) return;
  const changed = isImagePlacementChanged();
  if (apply) {
    if (changed) {
      recordHistory(imageEditorSnapshot);
      saveState();
    }
  } else if (changed && imageEditorSnapshot) {
    const { zoom, panX, panY, imageFit } = imageEditorSnapshot;
    updateSelectedImageState({ zoom, panX, panY, imageFit });
    renderStyles({ refreshInfo: false, refreshPattern: false });
  }
  imageEditorOpen = false;
  imageEditorDirty = false;
  imageEditorSnapshot = null;
  document.body.classList.remove("image-placement-mode");
  elements.imageEditorDialog.hidden = true;
  elements.openImageEditorButton?.setAttribute("aria-expanded", "false");
  elements.portraitWrap?.setAttribute("aria-label", "캐릭터 배치 영역");
  elements.portraitWrap?.classList.remove("is-dragging");
  elements.portraitWrap?.querySelector(".character-figure[aria-describedby=\"imageEditorDescription\"]")?.removeAttribute("aria-describedby");
  imageEditorReturnFocus?.focus?.({ preventScroll: true });
  imageEditorReturnFocus = null;
  if (apply && changed) showToast("이미지 배치를 적용했습니다.");
}

async function restoreCharacterAssets(savedCharacters = [], characters = state.characters) {
  const restoreJobs = characters.map(async (character, index) => {
    const saved = savedCharacters[index];
    if (!saved?.assetKey) return;
    character.assetKey = saved.assetKey;
    character.fileName = saved.fileName || character.fileName;
    character.fileMeta = saved.fileMeta || character.fileMeta;
    character.cutout = Boolean(saved.cutout);
    try {
      const record = await characterAssetVault.read(saved.assetKey);
      if (!record?.originalBlob) {
        character.cutout = false;
        character.src = character.originalSrc;
        return;
      }
      const originalUrl = createAssetUrl(record.originalBlob);
      const cutoutUrl = record.cutoutBlob ? createAssetUrl(record.cutoutBlob) : "";
      revokeObjectUrl(character.originalSrc);
      revokeObjectUrl(character.src);
      character.originalSrc = originalUrl;
      character.src = character.cutout && cutoutUrl ? cutoutUrl : originalUrl;
    } catch {
      character.cutout = false;
      character.src = character.originalSrc;
    }
  });
  await Promise.all(restoreJobs);
  syncSelectedCharacter();
}


function serializeLook(look) {
  return {
    id: String(look.id),
    title: typeof look.title === "string" ? look.title : "새로운 룩",
    subtitle: typeof look.subtitle === "string" ? look.subtitle : "",
    outfits: cloneOutfits(getLookOutfits(look)),
    background: backgrounds[look.background] ? look.background : "paper",
    backgroundPattern: backgroundPatternOptions.has(look.backgroundPattern) ? look.backgroundPattern : "none",
    backgroundTexture: backgroundTextureOptions.has(look.backgroundTexture) ? look.backgroundTexture : "none",
    titleFont: titleFonts[look.titleFont] ? look.titleFont : defaultTitleFont,
    titleWeight: normaliseTitleWeight(look.titleFont || defaultTitleFont, look.titleWeight ?? defaultTitleWeight),
    outline: { ...(look.outline || { color: "#f1dfbb", width: 0 }) },
    titleOutline: { ...(look.titleOutline || { color: "#ffffff", width: 0 }) },
    editor: { ...(look.editor || defaultLookEditor()), characters: (look.editor?.characters || createEmptyCharacters()).map(({ src, originalSrc, ...character }) => character) },
  };
}

function saveState() {
  const look = getSelectedLook();
  syncStateIntoLook(look);
  const snapshot = {
    version: 3,
    looks: looks.map(serializeLook),
    title: look.title,
    subtitle: look.subtitle,
    background: state.background,
    cutout: state.cutout,
    outline: state.outline,
    titleOutline: state.titleOutline,
    shadow: state.shadow,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    language: state.language,
    selectedLookId: state.selectedLookId,
    characterCount: state.characterCount,
    selectedCharacter: state.selectedCharacter,
    outfits: cloneOutfits(getLookOutfits(look)),
    catalogItems: Array.from(itemRecordCache.values()).filter((item) => /^\d+$/.test(String(item.id))),
    multiInfoEnabled: state.multiInfoEnabled,
    multiInfoMode: state.multiInfoMode,
    infoDensity: state.infoDensity,
    titleFont: state.titleFont,
    titleWeight: state.titleWeight,
    singleRatio: state.singleRatio,
    singleLayout: state.singleLayout,
    backgroundPattern: state.backgroundPattern,
    backgroundTexture: state.backgroundTexture,
    characters: state.characters.map((character) => ({
      assetKey: character.assetKey || null,
      fileName: character.fileName,
      fileMeta: character.fileMeta,
      cutout: Boolean(character.cutout),
      imageFit: character.imageFit || "contain",
      zoom: Number.isFinite(character.zoom) ? character.zoom : 100,
      panX: Number.isFinite(character.panX) ? character.panX : 0,
      panY: Number.isFinite(character.panY) ? character.panY : 0,
    })),
  };
  try {
    localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    setSaveStatus("이 브라우저에 저장됨");
    scheduleAssetCleanup();
  } catch {
    setSaveStatus("저장 실패 · 브라우저 저장 공간을 확인하세요", true);
  }
}

function setSaveStatus(message, failed = false) {
  const status = document.getElementById("saveStatus");
  if (status) { status.textContent = message; status.dataset.failed = String(failed); }
}

function syncHistoryControls() {
  [["undoButton", state.history], ["redoButton", state.redo]].forEach(([id, history]) => {
    const button = document.getElementById(id);
    button.setAttribute("aria-disabled", String(history.length === 0));
    button.classList.toggle("is-muted", history.length === 0);
  });
}

function recordHistory(snapshot = createSnapshot()) {
  state.history.push(snapshot);
  if (state.history.length > 25) state.history.shift();
  state.redo = [];
  syncHistoryControls();
}

function createSnapshot() {
  const look = getSelectedLook();
  return {
    title: look.title,
    subtitle: look.subtitle,
    background: state.background,
    cutout: state.cutout,
    outline: { ...state.outline },
    titleOutline: { ...state.titleOutline },
    shadow: { ...state.shadow },
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    characterCount: state.characterCount,
    selectedCharacter: state.selectedCharacter,
    activeSlot: state.activeSlot,
    outfits: cloneOutfits(getLookOutfits(look)),
    multiInfoEnabled: state.multiInfoEnabled,
    multiInfoMode: state.multiInfoMode,
    infoDensity: state.infoDensity,
    titleFont: state.titleFont,
    titleWeight: state.titleWeight,
    singleRatio: state.singleRatio,
    singleLayout: state.singleLayout,
    backgroundPattern: state.backgroundPattern,
    backgroundTexture: state.backgroundTexture,
    imageFit: state.imageFit,
    characters: state.characters.map((character) => ({ ...character })),
  };
}

function restoreSnapshot(snapshot) {
  const look = getSelectedLook();
  if (typeof snapshot.title === "string") look.title = snapshot.title;
  if (typeof snapshot.subtitle === "string") look.subtitle = snapshot.subtitle;
  state.background = snapshot.background;
  state.cutout = snapshot.cutout;
  state.outline = { ...snapshot.outline };
  state.titleOutline = { ...snapshot.titleOutline };
  state.shadow = { ...snapshot.shadow };
  state.zoom = snapshot.zoom;
  state.panX = snapshot.panX;
  state.panY = snapshot.panY;
  if (snapshot.characterCount) state.characterCount = snapshot.characterCount;
  if (Number.isInteger(snapshot.selectedCharacter)) state.selectedCharacter = Math.min(state.characterCount - 1, Math.max(0, snapshot.selectedCharacter));
  if (snapshot.activeSlot) state.activeSlot = snapshot.activeSlot;
  if (typeof snapshot.multiInfoEnabled === "boolean") state.multiInfoEnabled = snapshot.multiInfoEnabled;
  if (snapshot.multiInfoMode) state.multiInfoMode = snapshot.multiInfoMode;
  if (snapshot.infoDensity) state.infoDensity = snapshot.infoDensity;
  if (snapshot.titleFont && titleFonts[snapshot.titleFont]) state.titleFont = snapshot.titleFont;
  if (Number.isFinite(snapshot.titleWeight)) state.titleWeight = normaliseTitleWeight(state.titleFont, snapshot.titleWeight);
  if (snapshot.singleRatio) state.singleRatio = snapshot.singleRatio;
  if (snapshot.singleLayout) state.singleLayout = snapshot.singleLayout;
  restoreBackgroundStyle(snapshot.backgroundPattern, snapshot.backgroundMotif, snapshot.backgroundTexture);
  if (snapshot.imageFit) state.imageFit = snapshot.imageFit;
  if (Array.isArray(snapshot.characters)) {
    state.characters = snapshot.characters.map((character) => ({ ...character }));
    syncSelectedCharacter();
  }
  if (Array.isArray(snapshot.outfits)) {
    look.outfits = cloneOutfits(snapshot.outfits);
    ensureLookOutfits(look);
  }
  renderAll();
  saveState();
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    showToast("되돌릴 변경이 아직 없습니다.");
    return;
  }
  state.redo.push(createSnapshot());
  restoreSnapshot(previous);
  showToast("마지막 변경을 되돌렸습니다.");
}

function redo() {
  const next = state.redo.pop();
  if (!next) {
    showToast("다시 실행할 변경이 없습니다.");
    return;
  }
  state.history.push(createSnapshot());
  restoreSnapshot(next);
  showToast("변경을 다시 실행했습니다.");
}

function currentLookIndex() {
  return Math.max(0, looks.findIndex((look) => look.id === state.selectedLookId));
}

function normaliseInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function updateCopyEditorCount(input, output) {
  if (!input || !output) return;
  output.textContent = `${Array.from(input.value || "").length} / ${input.maxLength}`;
}

function resizeCopyEditorField(input) {
  if (!(input instanceof HTMLTextAreaElement)) return;
  input.style.height = "auto";
  const nextHeight = Math.min(Math.max(input.scrollHeight, 68), 180);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > 180 ? "auto" : "hidden";
}

function fitBoardTitle() {
  const title = elements.boardTitle;
  const titleBlock = title?.parentElement;
  if (!(title instanceof HTMLElement) || !(titleBlock instanceof HTMLElement)) return;

  title.style.removeProperty("font-size");
  title.removeAttribute("data-title-fit");
  const availableWidth = titleBlock.clientWidth;
  if (!availableWidth || !title.textContent?.trim()) return;

  const previous = {
    width: title.style.width,
    maxWidth: title.style.maxWidth,
    overflow: title.style.overflow,
    whiteSpace: title.style.whiteSpace,
  };
  title.style.width = "max-content";
  title.style.maxWidth = "none";
  title.style.overflow = "visible";
  title.style.whiteSpace = "nowrap";
  const naturalWidth = title.getBoundingClientRect().width;
  title.style.width = previous.width;
  title.style.maxWidth = previous.maxWidth;
  title.style.overflow = previous.overflow;
  title.style.whiteSpace = previous.whiteSpace;

  if (naturalWidth > availableWidth) {
    const baseSize = Number.parseFloat(getComputedStyle(title).fontSize) || 24;
    const readableFloor = Math.max(12, Math.min(18, availableWidth / 24));
    const fittedSize = Math.max(readableFloor, baseSize * (availableWidth / naturalWidth));
    title.style.fontSize = `${fittedSize}px`;
    if (naturalWidth * (fittedSize / baseSize) > availableWidth + 1) title.dataset.titleFit = "wrap";
  }
}

function syncCopyEditorFields() {
  const look = getSelectedLook();
  const title = look.title || "새로운 룩";
  const subtitle = look.subtitle || "";
  if (elements.cardTitleInput) {
    if (document.activeElement !== elements.cardTitleInput) elements.cardTitleInput.value = title;
    updateCopyEditorCount(elements.cardTitleInput, elements.cardTitleCount);
    resizeCopyEditorField(elements.cardTitleInput);
  }
  if (elements.cardSubtitleInput) {
    if (document.activeElement !== elements.cardSubtitleInput) elements.cardSubtitleInput.value = subtitle;
    updateCopyEditorCount(elements.cardSubtitleInput, elements.cardSubtitleCount);
    resizeCopyEditorField(elements.cardSubtitleInput);
  }
}

function renderLook() {
  const look = getSelectedLook();
  elements.boardTitle.textContent = look.title || "새로운 룩";
  elements.boardSubtitle.textContent = look.subtitle || "";
  elements.boardSubtitle.dataset.empty = String(!look.subtitle);
  fitBoardTitle();
  syncCopyEditorFields();
  document.title = `글래머 아틀리에 | ${look.title}`;
  $$(".look-list-item").forEach((button) => {
    const selected = button.dataset.lookId === state.selectedLookId;
    button.classList.toggle("is-current", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function renderLookList() {
  if (!elements.lookList) return;
  const query = $("#lookSearch")?.value.trim().toLowerCase() || "";
  const active = document.activeElement;
  const focusedLookId = active?.closest?.(".look-list-item")?.dataset.lookId || null;
  elements.lookList.innerHTML = looks.map((look, index) => {
    const selected = look.id === state.selectedLookId;
    const title = look.title || "새로운 룩";
    const searchable = `${title} ${look.subtitle || ""}`.toLowerCase();
    const hidden = Boolean(query) && !searchable.includes(query);
    return `<button class="look-list-item${selected ? " is-current" : ""}" type="button" data-look-id="${escapeHtml(look.id)}"${selected ? ' aria-current="page"' : ""}${hidden ? " hidden" : ""}>
      <span class="look-list-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="look-list-copy"><strong>${escapeHtml(title)}</strong></span>
    </button>`;
  }).join("");
  $$(".look-list-item").forEach((button) => button.addEventListener("click", () => selectLook(button.dataset.lookId)));
  if (focusedLookId) [...elements.lookList.querySelectorAll(".look-list-item")]
    .find((button) => button.dataset.lookId === focusedLookId)?.focus({ preventScroll: true });
}

function syncSelectedCharacter() {
  const character = getCharacterImageState(state.characters[state.selectedCharacter] || state.characters[0]);
  state.imageSrc = character.src;
  state.originalSrc = character.originalSrc;
  state.fileName = character.fileName;
  state.fileMeta = character.fileMeta;
  state.cutout = Boolean(character.cutout);
  state.zoom = character.zoom;
  state.panX = character.panX;
  state.panY = character.panY;
  state.imageFit = character.imageFit;
}

function syncCharacterSelectionUI() {
  $$(".character-figure").forEach((button) => {
    const selected = Number(button.dataset.characterIndex) === state.selectedCharacter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$('[data-character-select], [data-item-character]').forEach((button) => {
    const index = Number(button.dataset.characterSelect ?? button.dataset.itemCharacter);
    const selected = index === state.selectedCharacter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (elements.castSelectionSummary) {
    elements.castSelectionSummary.textContent = `캐릭터 ${String(state.selectedCharacter + 1).padStart(2, "0")} · ${state.characterCount}인`;
  }
}

function selectCharacter(index) {
  const nextIndex = Math.min(state.characterCount - 1, Math.max(0, Number(index) || 0));
  state.selectedCharacter = nextIndex;
  syncSelectedCharacter();
  syncCharacterSelectionUI();
  renderStyles();
  renderSourcePanel();
  renderEquipment();
  renderCatalog();
}

// Replacing a selector must preserve the user's keyboard position, not focus body.
function replaceCharacterButtons(container, keyAttribute, markup) {
  const active = document.activeElement;
  const focusedKey = container.contains(active) ? active.getAttribute(keyAttribute) : null;
  container.innerHTML = markup;
  if (focusedKey !== null) {
    const replacement = [...container.querySelectorAll(`button[${keyAttribute}]`)]
      .find((button) => button.getAttribute(keyAttribute) === focusedKey);
    (replacement || container.querySelector('[aria-pressed="true"]'))?.focus({ preventScroll: true });
  }
}

function renderItemCharacterSelector() {
  if (!elements.itemCharacterSelector) return;
  replaceCharacterButtons(elements.itemCharacterSelector, "data-item-character", state.characters.slice(0, state.characterCount).map((character, index) => {
    const selected = index === state.selectedCharacter;
    const source = resolveCharacterAsset(character, "hero");
    return `<button class="item-character-button${selected ? " is-selected" : ""}" type="button" data-item-character="${index}" aria-label="캐릭터 ${index + 1} 장비 편집" aria-pressed="${selected}">
      <span class="item-character-thumb${source ? "" : " is-empty"}">${source ? `<img src="${escapeHtml(source)}" alt="" />` : `<span class="item-character-empty" aria-hidden="true">이미지 없음</span>`}</span>
      <span class="item-character-copy"><strong>캐릭터 ${String(index + 1).padStart(2, "0")}</strong></span>
    </button>`;
  }).join(""));
  $$('[data-item-character]').forEach((button) => button.addEventListener("click", () => selectCharacter(button.dataset.itemCharacter)));
}

function renderCast() {
  elements.board.dataset.cast = String(state.characterCount);
  if (state.selectedCharacter >= state.characterCount) state.selectedCharacter = state.characterCount - 1;
  syncSelectedCharacter();
  replaceCharacterButtons(elements.portraitWrap, "data-character-index", state.characters.slice(0, state.characterCount).map((character, index) => {
    const source = resolveCharacterAsset(character, "hero");
    return `
    <button class="character-figure${index === state.selectedCharacter ? " is-selected" : ""}${source ? "" : " is-empty"}" type="button" data-character-index="${index}" data-cutout="${Boolean(character.cutout)}" data-empty="${!source}" aria-pressed="${index === state.selectedCharacter}" aria-label="캐릭터 ${index + 1} ${source ? "선택" : "사진 선택"}">
      ${source ? `<img src="${escapeHtml(source)}" alt="룩북 캐릭터 ${index + 1}" draggable="false" />` : `<span class="character-empty-placeholder" aria-hidden="true"><small class="character-empty-kicker">캐릭터 ${String(index + 1).padStart(2, "0")}</small><span class="character-empty-mark">＋</span><strong>이미지 슬롯</strong><small>사진을 배치할 영역</small></span>`}
    </button>
  `;
  }).join(""));
  replaceCharacterButtons($("#castSelector"), "data-character-select", state.characters.slice(0, state.characterCount).map((character, index) => `
    ${(() => {
      const source = resolveCharacterAsset(character, "hero");
      return `<button class="${index === state.selectedCharacter ? "is-selected" : ""}${source ? "" : " is-empty"}" type="button" data-character-select="${index}" aria-pressed="${index === state.selectedCharacter}" aria-label="캐릭터 ${index + 1} 편집">
      ${source ? `<img src="${escapeHtml(source)}" alt="" />` : `<span class="cast-empty-thumb" aria-hidden="true">＋</span>`}<span>${String(index + 1).padStart(2, "0")}</span>
    </button>`;
    })()}
  `).join(""));
  if (elements.castSelectionSummary) {
    elements.castSelectionSummary.textContent = `캐릭터 ${String(state.selectedCharacter + 1).padStart(2, "0")} · ${state.characterCount}인`;
  }
  renderItemCharacterSelector();
  $$('[data-cast-count]').forEach((button) => {
    const selected = Number(button.dataset.castCount) === state.characterCount;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  $$(".character-figure").forEach((button) => button.addEventListener("click", (event) => {
    const characterIndex = Number(button.dataset.characterIndex);
    if (imageEditorOpen && characterIndex !== state.selectedCharacter) {
      event.preventDefault();
      return;
    }
    if (button.dataset.empty === "true") {
      selectCharacter(characterIndex);
      elements.imageInput?.click();
      return;
    }
    selectCharacter(characterIndex);
  }));
  $$('[data-character-select]').forEach((button) => button.addEventListener("click", () => selectCharacter(Number(button.dataset.characterSelect))));
}

function renderSourcePanel() {
  const hasImage = Boolean(state.imageSrc);
  if (hasImage) {
    elements.sourceThumb.src = state.imageSrc;
    elements.sourceThumb.alt = "현재 이미지 미리보기";
  } else {
    elements.sourceThumb.removeAttribute("src");
    elements.sourceThumb.alt = "사진 미선택";
  }
  elements.sourceThumbFrame?.classList.toggle("is-empty", !hasImage);
  elements.sourceThumbFrame?.closest(".portrait-source-card")?.classList.toggle("is-empty", !hasImage);
  elements.sourceFileName.textContent = hasImage ? state.fileName : "사진 미선택";
  if (elements.sourceFileMeta) elements.sourceFileMeta.textContent = hasImage ? (state.fileMeta || "원본 이미지") : "PNG · JPG · WebP · 여러 장 선택 가능";
  if (elements.imageState) {
    elements.imageState.textContent = !hasImage ? "이미지 없음" : state.cutout ? "배경 제거됨" : "원본";
    elements.imageState.dataset.state = !hasImage ? "empty" : state.cutout ? "cutout" : "original";
  }
  elements.sourceThumbFrame?.classList.toggle("is-cutout", state.cutout);
  if (elements.openImageEditorButton) {
    elements.openImageEditorButton.disabled = !hasImage;
    elements.openImageEditorButton.title = hasImage ? "카드에서 이미지 크기와 위치를 조정" : "이미지를 먼저 추가하세요";
  }
  const cutoutButton = $("#cutoutButton");
  if (cutoutButton && !cutoutButton.classList.contains("is-processing")) {
    cutoutButton.disabled = !hasImage;
    cutoutButton.title = hasImage ? "원본을 보존하고 배경을 제거합니다" : "이미지를 먼저 추가하세요";
  }
  $$('button[data-image-fit]').forEach((button) => {
    const selected = button.dataset.imageFit === state.imageFit;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderBoardGear() {
  const look = getSelectedLook();
  const renderGearItem = (itemId, index, characterIndex, { showCharacter = false } = {}) => {
    const item = getItem(itemId);
    if (!item) return "";
    const slotName = getOutfitSlotName(item.slot);
    const primaryName = getItemName(item);
    const secondaryName = getSecondaryItemName(item);
    const characterLabel = showCharacter ? `캐릭터 ${String(characterIndex + 1).padStart(2, "0")} · ` : "";
    return `<button class="board-gear-item gear-slot-${item.slot}" data-character-index="${characterIndex}" data-gear-index="${index}" data-card-slot="${item.slot}" type="button" aria-label="캐릭터 ${characterIndex + 1} ${escapeHtml(`${slotName} ${primaryName} 편집`)}">
      <div class="gear-tile-copy"><span class="gear-slot-label">${characterLabel}${escapeHtml(slotName)}</span><strong>${escapeHtml(primaryName)}</strong>${secondaryName ? `<small class="gear-item-secondary">${escapeHtml(secondaryName)}</small>` : ""}</div>
    </button>`;
  };
  const boardGearList = $("#boardGearList");
  if (state.characterCount === 2) {
    boardGearList.innerHTML = [0, 1].map((characterIndex) => {
      const items = getCharacterItemIds(characterIndex, look);
      const railSide = characterIndex === 0 ? "left" : "right";
      return `<section class="board-gear-rail board-gear-rail--${railSide}" data-gear-character="${characterIndex}" aria-label="캐릭터 ${String(characterIndex + 1).padStart(2, "0")} 장비 정보">
        <div class="board-gear-rail-items">${items.map((itemId, index) => renderGearItem(itemId, index, characterIndex)).join("")}</div>
      </section>`;
    }).join("");
  } else {
    boardGearList.innerHTML = getCharacterItemIds(state.selectedCharacter, look)
      .map((itemId, index) => renderGearItem(itemId, index, state.selectedCharacter, { showCharacter: state.characterCount > 1 }))
      .join("");
  }
  $$("#boardGearList [data-card-slot]").forEach((button) => button.addEventListener("click", () => {
    const characterIndex = Number(button.dataset.characterIndex);
    if (Number.isInteger(characterIndex) && characterIndex !== state.selectedCharacter) selectCharacter(characterIndex);
    state.activeSlot = button.dataset.cardSlot;
    openPanel("itemsPanel");
    renderEquipment();
    renderCatalog();
    window.requestAnimationFrame(() => {
      elements.itemSearch.focus();
      ensureMobileControlVisible(elements.itemSearch);
    });
  }));
}

function renderMultiInfo() {
  const isLineup = state.characterCount >= 3;
  const visible = isLineup && state.multiInfoEnabled;
  elements.multiInfoLayer.hidden = !visible;
  elements.multiInfoLayer.innerHTML = visible ? state.characters.slice(0, state.characterCount).map((character, index) => {
    const items = getCharacterItemIds(index).map(getItem).filter(Boolean);
    const shownItems = state.infoDensity === "summary" ? items.slice(0, 3) : items;
    const itemNames = items.map((item) => getItemName(item)).filter(Boolean);
    const accessibleItems = itemNames.length ? `: ${itemNames.join(", ")}` : "";
    return `<button class="multi-info-column${index === state.selectedCharacter ? " is-selected" : ""}" type="button" data-info-character="${index}" aria-label="${escapeHtml(`캐릭터 ${index + 1} 장비 편집${accessibleItems}`)}">
      <span class="multi-info-items">${shownItems.map((item) => {
        const secondaryName = getSecondaryItemName(item);
        return `<span class="multi-info-item"><span>${escapeHtml(getItemName(item))}</span>${secondaryName ? `<small>${escapeHtml(secondaryName)}</small>` : ""}</span>`;
      }).join("")}${state.infoDensity === "summary" && items.length > 3 ? `<small class="multi-info-more">+${items.length - 3} ITEMS</small>` : ""}</span>
    </button>`;
  }).join("") : "";
  $$('[data-info-character]').forEach((button) => button.addEventListener("click", () => {
    selectCharacter(button.dataset.infoCharacter);
    openPanel("itemsPanel");
    window.requestAnimationFrame(() => elements.itemCharacterSelector.querySelector('[aria-pressed="true"]')?.focus());
  }));
}

function renderPattern() {
  elements.scenePattern.dataset.pattern = state.backgroundPattern;
  elements.scenePattern.dataset.texture = state.backgroundTexture;
  elements.scenePattern.removeAttribute("data-motif");
  elements.scenePattern.removeAttribute("data-intensity");
  const stars = state.backgroundPattern === "stars" ? patternStars : [];
  elements.scenePattern.innerHTML = stars.map(({ x, y, size, rotate, tone, opacity }) =>
    `<i class="pattern-motif pattern-motif--star pattern-motif--${tone}" style="--x:${x}%;--y:${y}%;--size:${size}cqw;--rotate:${rotate}deg;--motif-opacity:${opacity}"><span></span></i>`
  ).join("");
}

function renderStyles({ refreshInfo = true, refreshPattern = true } = {}) {
  const background = backgrounds[state.background] || backgrounds.dusk;
  if (!titleFonts[state.titleFont]) state.titleFont = defaultTitleFont;
  state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? defaultTitleWeight);
  const backgroundCss = getBackgroundSurfaceCss(background);
  elements.board.style.setProperty("--board-bg", backgroundCss);
  elements.board.style.setProperty("--pattern-ink", background.pattern[0]);
  elements.board.style.setProperty("--pattern-light", background.pattern[1]);
  const patternOpacity = {
    none: 0,
    dots: 0.16,
    stars: 0.2,
    halftone: 0.2,
    bitmap: 0.18,
  };
  elements.board.style.setProperty("--pattern-opacity", patternOpacity[state.backgroundPattern] ?? 0);
  elements.board.dataset.background = state.background;
  elements.board.dataset.backgroundPattern = state.backgroundPattern;
  elements.board.dataset.backgroundTexture = state.backgroundTexture;
  elements.board.removeAttribute("data-background-motif");
  elements.sceneBackground.style.background = backgroundCss;
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const allCutout = activeCharacters.every((character) => character.cutout);
  const cutoutCount = activeCharacters.filter((character) => character.cutout).length;
  const sourceMode = allCutout ? "cutout" : cutoutCount === 0 ? "original" : "mixed";
  const silhouetteReady = activeCharacters.length > 0 && allCutout;
  if (!silhouetteReady && state.multiInfoMode === "silhouette") state.multiInfoMode = "fade";
  const infoModeHint = $("#infoModeHint");
  if (infoModeHint) {
    infoModeHint.textContent = silhouetteReady
      ? "모든 캐릭터의 배경 제거가 끝났습니다. 실루엣을 선택할 수 있어요."
      : "실루엣은 모든 캐릭터의 배경 제거가 끝나면 사용할 수 있어요.";
    infoModeHint.dataset.ready = String(silhouetteReady);
  }
  elements.board.dataset.cutout = String(allCutout);
  elements.board.dataset.info = String(state.characterCount >= 3 && state.multiInfoEnabled);
  elements.board.dataset.infoMode = state.multiInfoMode;
  elements.board.dataset.sourceMode = sourceMode;
  elements.board.dataset.titleFont = state.titleFont;
  // Background presets own only the three background axes. Keep card
  // typography, geometry, and information notes on one stable visual system.
  elements.board.dataset.style = "custom";
  elements.board.dataset.ratio = getCanvasRatio();
  elements.board.dataset.singleLayout = state.singleLayout;
  const titleFontConfig = getTitleFontConfig(state.titleFont);
  elements.board.style.setProperty("--card-title-font", titleFontConfig.family);
  elements.board.style.setProperty("--card-title-weight", String(state.titleWeight));
  const titleOutlineWidth = clamp(Number(state.titleOutline?.width), 0, 6, 0);
  const titleOutlineColor = /^#[0-9a-f]{6}$/i.test(state.titleOutline?.color || "") ? state.titleOutline.color : "#ffffff";
  state.titleOutline = { color: titleOutlineColor, width: titleOutlineWidth };
  elements.board.style.setProperty("--title-outline-width", `${titleOutlineWidth}px`);
  elements.board.style.setProperty("--title-outline-color", titleOutlineColor);
  elements.portraitWrap.style.setProperty("--portrait-scale", 1);
  elements.portraitWrap.style.setProperty("--pan-x", "0px");
  elements.portraitWrap.style.setProperty("--pan-y", "0px");

  const outlineOpacity = state.outline.width === 0 ? 0 : 0.78;
  const outlineShadows = [
    [state.outline.width, 0],
    [-state.outline.width, 0],
    [0, state.outline.width],
    [0, -state.outline.width],
  ].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${rgba(state.outline.color, outlineOpacity)})`).join(" ");
  const shadowOpacity = state.shadow.strength / 100;
  const shadow = `drop-shadow(${state.shadow.x}px ${state.shadow.y}px ${state.shadow.blur}px rgba(10, 11, 18, ${shadowOpacity}))`;
  $$("#portraitWrap img").forEach((image, index) => {
    const character = getCharacterImageState(activeCharacters[index]);
    const cutout = image.closest(".character-figure")?.dataset.cutout === "true";
    const baseFilter = cutout ? `${outlineShadows} ${shadow}`.trim() : "";
    const infoTreatment = state.characterCount >= 3 && state.multiInfoEnabled
      ? state.multiInfoMode === "silhouette" && cutout ? "brightness(0) opacity(.68)" : "grayscale(.82) saturate(.35) contrast(.86) brightness(1.08)"
      : "";
    image.style.objectFit = character.imageFit;
    image.style.transform = `translate(${character.panX}px, ${character.panY}px) scale(${character.zoom / 100})`;
    image.style.filter = `${baseFilter} ${infoTreatment}`.trim() || "none";
  });

  elements.outlineRange.value = state.outline.width;
  elements.outlineValue.textContent = `${String(state.outline.width).padStart(2, "0")} px`;
  if (elements.titleOutlineRange) {
    elements.titleOutlineRange.value = String(titleOutlineWidth);
    updateRangeProgress(elements.titleOutlineRange);
    elements.titleOutlineRange.setAttribute("aria-valuetext", titleOutlineWidth ? `${titleOutlineWidth} px` : "없음");
  }
  if (elements.titleOutlineValue) elements.titleOutlineValue.textContent = titleOutlineWidth ? `${titleOutlineWidth} px` : "없음";
  elements.shadowRange.value = state.shadow.strength;
  elements.shadowValue.textContent = `${state.shadow.strength}%`;
  elements.zoomReadout.textContent = `${state.zoom}%`;
  if (elements.zoomRange) {
    elements.zoomRange.value = String(state.zoom);
    updateRangeProgress(elements.zoomRange);
    elements.zoomRange.setAttribute("aria-valuetext", `${state.zoom}%`);
  }
  if (elements.panXRange) {
    elements.panXRange.value = String(state.panX);
    updateRangeProgress(elements.panXRange);
  }
  if (elements.panYRange) {
    elements.panYRange.value = String(state.panY);
    updateRangeProgress(elements.panYRange);
  }
  if (elements.panXReadout) elements.panXReadout.textContent = formatImageOffset(state.panX);
  if (elements.panYReadout) elements.panYReadout.textContent = formatImageOffset(state.panY);
  elements.outlineRange.style.setProperty("--range-progress", `${(state.outline.width / 8) * 100}%`);
  elements.shadowRange.style.setProperty("--range-progress", `${(state.shadow.strength / 70) * 100}%`);
  $$(".color-swatch").forEach((swatch) => swatch.classList.toggle("is-selected", swatch.dataset.color === state.outline.color));
  $$(".title-outline-swatch").forEach((swatch) => {
    const selected = swatch.dataset.titleOutlineColor === state.titleOutline.color;
    swatch.classList.toggle("is-selected", selected);
    swatch.setAttribute("aria-checked", String(selected));
  });
  $$(".backdrop-swatch").forEach((swatch) => swatch.classList.toggle("is-selected", swatch.dataset.background === state.background));
  $$(".direction-pad button").forEach((button) => button.classList.toggle("is-selected", button.dataset.shadow === shadowDirection()));
  $("#cutoutButton").classList.toggle("is-highlighted", state.cutout);
  $("#cutoutButton span:first-child").textContent = state.cutout ? "원본으로 복원" : "배경 제거";
  renderSourcePanel();
  syncImagePlacementSummary();
  $("#multiInfoToggle").checked = state.multiInfoEnabled;
  syncTitleFontControls();
  const backgroundCurrentLabel = $("#backgroundCurrentLabel");
  if (backgroundCurrentLabel) {
    const currentPreset = backgroundPresets.find((preset) => getBackgroundSelectionSignature(preset) === getBackgroundSelectionSignature());
    backgroundCurrentLabel.textContent = currentPreset ? `내 프리셋 · ${currentPreset.name}` : describeBackgroundSelection();
    backgroundCurrentLabel.dataset.custom = String(!currentPreset);
  }
  const advancedToggle = $("#styleAdvancedToggle");
  if (advancedToggle) {
    advancedToggle.setAttribute("aria-expanded", String(styleAdvancedOpen));
    advancedToggle.querySelector(".style-advanced-icon").textContent = styleAdvancedOpen ? "－" : "＋";
  }
  $$('[data-style-advanced]').forEach((section) => { section.hidden = !styleAdvancedOpen; });
  $("#singleRatioRow").hidden = state.characterCount !== 1;
  $("#singleLayoutRow").hidden = state.characterCount !== 1;
  $$('button[data-single-ratio]').forEach((button) => {
    const selected = button.dataset.singleRatio === state.singleRatio;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$('button[data-single-layout]').forEach((button) => {
    const selected = button.dataset.singleLayout === state.singleLayout;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$('button[data-info-mode]').forEach((button) => {
    const unavailable = button.dataset.infoMode === "silhouette" && !silhouetteReady;
    button.disabled = unavailable;
    button.title = unavailable ? "모든 캐릭터의 배경을 먼저 제거하세요" : "";
    button.setAttribute("aria-disabled", String(unavailable));
    const selected = button.dataset.infoMode === state.multiInfoMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$('button[data-info-density]').forEach((button) => {
    const selected = button.dataset.infoDensity === state.infoDensity;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$('button[data-pattern]').forEach((button) => {
    const selected = button.dataset.pattern === state.backgroundPattern;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  $$('button[data-texture]').forEach((button) => {
    const selected = button.dataset.texture === state.backgroundTexture;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  $$('[role="radiogroup"] [role="radio"]').forEach((button) => {
    const selected = button.classList.contains("is-selected");
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $$(".color-swatch, .direction-pad button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
  });
  renderBackgroundPresets();
  $("#multiCardControls").hidden = state.characterCount < 3;
  const dimensions = getExportDimensions();
  const exportReady = activeCharacters.length > 0 && activeCharacters.every((character) => Boolean(resolveCharacterAsset(character, "hero")));
  const exportButton = $("#exportButton");
  // Keep the action focusable while the blank workspace is being prepared.
  // aria-disabled communicates why it cannot run without removing it from
  // the keyboard route; downloadComposition() owns the same guard.
  exportButton.disabled = false;
  exportButton.setAttribute("aria-disabled", String(!exportReady));
  exportButton.title = exportReady
    ? `${dimensions.exportWidth} × ${dimensions.exportHeight} 고화질로 저장`
    : "이미지를 모두 추가하면 PNG로 저장할 수 있습니다";
  if (refreshPattern) renderPattern();
  if (refreshInfo) renderMultiInfo();
  fitBoardTitle();
}

function shadowDirection() {
  const x = state.shadow.x;
  const y = state.shadow.y;
  if (x === 0 && y === 0) return "n";
  return `${y < 0 ? "n" : y > 0 ? "s" : ""}${x < 0 ? "w" : x > 0 ? "e" : ""}` || "s";
}

function renderEquipment() {
  const look = getSelectedLook();
  const outfit = getCharacterOutfit(state.selectedCharacter, look);
  const characterLabel = `캐릭터 ${String(state.selectedCharacter + 1).padStart(2, "0")}`;
  if (elements.itemsSummaryTitle) elements.itemsSummaryTitle.textContent = characterLabel;
  elements.equipmentList.innerHTML = outfitSlots.map((slot) => {
    const item = getItem(outfit[slot]);
    const selected = slot === state.activeSlot;
    const itemName = item ? getItemName(item) : "아이템을 연결하세요";
    const secondaryName = item ? getSecondaryItemName(item) : "";
    const itemMeta = [getOutfitSlotName(slot), secondaryName || (!item ? "아이템을 검색해 연결" : "")].filter(Boolean).join(" · ");
    const visualLabel = getOutfitSlotVisualLabel(slot);
    return `<button class="equipment-row${selected ? " is-selected" : ""}${item ? "" : " is-empty"}" data-slot="${slot}" type="button" aria-pressed="${selected}" aria-label="${escapeHtml(`${visualLabel} (${getOutfitSlotName(slot)}) 슬롯 ${item ? itemName : "아이템 연결"}`)}">
      <span class="equipment-icon" aria-hidden="true">${renderEquipmentIcon(slot)}</span>
      <span class="equipment-copy"><strong>${escapeHtml(itemName)}</strong><span>${escapeHtml(itemMeta)}</span></span>
      <span class="equipment-check">${item ? "변경" : "연결"}</span>
    </button>`;
  }).join("");
  $$(".equipment-row").forEach((row) => row.addEventListener("click", () => {
    state.activeSlot = row.dataset.slot;
    renderEquipment();
    renderCatalog();
    window.requestAnimationFrame(() => {
      elements.itemSearch.focus();
      ensureMobileControlVisible(elements.itemSearch);
    });
  }));
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  renderBoardGear();
}

function renderCatalogMessage(message, detail = "") {
  const loading = message.includes("검색하는 중");
  $("#catalogStatus").textContent = [message, detail].filter(Boolean).join(" ");
  elements.catalogResults.setAttribute("aria-busy", String(loading));
  elements.catalogResults.innerHTML = `${loading ? '<span class="catalog-progress" aria-hidden="true"></span>' : ""}<div class="empty-results"><strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</div>`;
}

function renderCatalogResults(results, { notice = "" } = {}) {
  $("#catalogStatus").textContent = `${results.length}개의 검색 결과. ${notice}`;
  elements.catalogResults.setAttribute("aria-busy", "false");
  const resultMarkup = results.length ? results.map((item) => {
    const secondaryName = getSecondaryItemName(item);
    return `<button class="catalog-result" data-item-id="${escapeHtml(item.id)}" type="button"><span class="catalog-result-icon">${renderCatalogIcon(item)}</span><span class="catalog-result-copy"><strong>${escapeHtml(getItemName(item))}</strong><span>${escapeHtml(secondaryName || getOutfitSlotName(item.slot))}</span></span><span class="catalog-result-action" aria-hidden="true">＋</span></button>`;
  }).join("") : `<div class="empty-results"><strong>일치하는 장비가 없습니다.</strong></div>`;
  elements.catalogResults.innerHTML = `${notice ? `<div class="catalog-results-notice" role="status">${escapeHtml(notice)}</div>` : ""}${resultMarkup}`;
  $$(".catalog-result").forEach((button) => button.addEventListener("click", () => { void linkItem(button.dataset.itemId); }));
}

function renderCatalog() {
  window.clearTimeout(itemSearchState.timer);
  return itemSearch.search({ query: elements.itemSearch.value, slot: state.activeSlot, language: state.language }, result => {
    itemSearchState.mode = result.kind;
    if (result.kind === "idle") {
      elements.catalogResults.innerHTML = "";
      elements.catalogResults.setAttribute("aria-busy", "false");
      $("#catalogStatus").textContent = "";
    } else if (result.kind === "short") {
      renderCatalogMessage("두 글자 이상 입력하세요.");
    } else if (result.kind === "loading") {
      renderCatalogMessage("장비 목록을 검색하는 중…");
    } else if (result.kind === "results") {
      registerItemRecords(result.results);
      renderCatalogResults(result.results, {
        notice: result.source === "stale" ? "연결이 불안정해 이전에 확인한 결과를 표시합니다." : "",
      });
    } else {
      renderCatalogMessage("아이템 검색에 연결할 수 없습니다.", "네트워크 연결을 확인한 뒤 다시 시도해주세요.");
    }
  });
}
function scheduleCatalogSearch() {
  window.clearTimeout(itemSearchState.timer);
  // Invalidate immediately, not after debounce: old results must not be selectable.
  itemSearch.cancel();
  elements.catalogResults.innerHTML = "";
  elements.catalogResults.setAttribute("aria-busy", "false");
  $("#catalogStatus").textContent = "";
  if (!elements.itemSearch.value.trim()) {
    void renderCatalog();
    return;
  }
  itemSearchState.timer = window.setTimeout(() => { void renderCatalog(); }, 280);
}

async function linkItem(itemId) {
  const look = getSelectedLook();
  const newItem = getItem(itemId);
  if (!newItem) return;
  recordHistory();
  const outfit = getCharacterOutfit(state.selectedCharacter, look);
  outfit[newItem.slot] = itemId;
  ensureLookOutfits(look);
  state.activeSlot = newItem.slot;
  renderEquipment();
  renderCatalog();
  showToast(`${getItemName(newItem)}을(를) ${getItemMeta(newItem)}에 연결했습니다.`);
  saveState();
  window.requestAnimationFrame(() => {
    elements.itemSearch.focus();
    ensureMobileControlVisible(elements.itemSearch);
  });
  await hydrateEnglishItemNames([newItem]);
}

function normaliseSavedLook(value, index) {
  const id = typeof value?.id === "string" && value.id.trim() ? value.id.trim().slice(0, 80) : `look-${index + 1}`;
  const look = createBlankLook(index + 1, id);
  look.title = typeof value?.title === "string" ? value.title.trim().slice(0, 64) || "새로운 룩" : "새로운 룩";
  look.subtitle = typeof value?.subtitle === "string" ? value.subtitle.trim().slice(0, 160) : "";
  look.background = backgrounds[value?.background] ? value.background : "paper";
  look.backgroundPattern = backgroundPatternOptions.has(value?.backgroundPattern) ? value.backgroundPattern : "none";
  look.backgroundTexture = backgroundTextureOptions.has(value?.backgroundTexture) ? value.backgroundTexture : "none";
  look.titleFont = titleFonts[value?.titleFont] ? value.titleFont : defaultTitleFont;
  look.titleWeight = normaliseTitleWeight(look.titleFont, value?.titleWeight ?? defaultTitleWeight);
  look.outline = {
    color: /^#[0-9a-f]{6}$/i.test(value?.outline?.color || "") ? value.outline.color : "#f1dfbb",
    width: clamp(value?.outline?.width, 0, 8, 0),
  };
  look.titleOutline = {
    color: /^#[0-9a-f]{6}$/i.test(value?.titleOutline?.color || "") ? value.titleOutline.color : "#ffffff",
    width: clamp(value?.titleOutline?.width, 0, 6, 0),
  };
  look.outfits = Array.isArray(value?.outfits) ? cloneOutfits(value.outfits) : createOutfits([]);
  look.editor = value?.editor ? normaliseLookEditor(value.editor) : null;
  ensureLookOutfits(look);
  return look;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.version !== 3) {
      localStorage.removeItem(draftStorageKey);
      return null;
    }
    if (Array.isArray(saved.catalogItems)) registerItemRecords(saved.catalogItems);
    const savedLooks = Array.isArray(saved.looks) && saved.looks.length
      ? saved.looks.map(normaliseSavedLook)
      : [createBlankLook(1, "look-1")];
    const seenIds = new Set();
    looks = savedLooks.filter((look) => {
      if (seenIds.has(look.id)) return false;
      seenIds.add(look.id);
      return true;
    });
    if (!looks.length) looks = [createBlankLook(1, "look-1")];
    looks.forEach(ensureLookOutfits);
    captureDefaultLookSnapshots();
    state.selectedLookId = looks.some((look) => look.id === saved.selectedLookId) ? saved.selectedLookId : looks[0].id;
    const look = getSelectedLook();
    const legacyStyle = legacyStyleRecipes[saved.stylePreset] || legacyStyleRecipes[saved.styleTheme];
    look.title = typeof saved.title === "string" && looks.length === 1 ? saved.title.trim().slice(0, 64) || look.title : look.title;
    look.subtitle = typeof saved.subtitle === "string" && looks.length === 1 ? saved.subtitle.trim().slice(0, 160) : look.subtitle;
    if (saved.background && backgrounds[saved.background]) state.background = saved.background;
    else state.background = look.background || legacyStyle?.background || "paper";
    if (typeof saved.cutout === "boolean") state.cutout = saved.cutout;
    if (saved.outline) state.outline = { ...state.outline, ...saved.outline };
    if (saved.titleOutline) state.titleOutline = { ...state.titleOutline, ...saved.titleOutline };
    if (saved.shadow) state.shadow = { ...state.shadow, ...saved.shadow };
    if (typeof saved.zoom === "number") state.zoom = saved.zoom;
    if (typeof saved.panX === "number") state.panX = saved.panX;
    if (typeof saved.panY === "number") state.panY = saved.panY;
    if (["contain", "cover"].includes(saved.imageFit)) state.imageFit = saved.imageFit;
    if (["ko", "en", "ja"].includes(saved.language)) state.language = saved.language;
    if (typeof saved.multiInfoEnabled === "boolean") state.multiInfoEnabled = saved.multiInfoEnabled;
    if (["fade", "silhouette"].includes(saved.multiInfoMode)) state.multiInfoMode = saved.multiInfoMode;
    if (["summary", "full"].includes(saved.infoDensity)) state.infoDensity = saved.infoDensity;
    if (titleFonts[saved.titleFont]) state.titleFont = saved.titleFont;
    else if (titleFonts[look.titleFont]) state.titleFont = look.titleFont;
    if (Number.isFinite(saved.titleWeight)) state.titleWeight = normaliseTitleWeight(state.titleFont, saved.titleWeight);
    else state.titleWeight = normaliseTitleWeight(state.titleFont, look.titleWeight);
    if (["portrait", "landscape"].includes(saved.singleRatio)) state.singleRatio = saved.singleRatio;
    if (["info-left", "info-right"].includes(saved.singleLayout)) state.singleLayout = saved.singleLayout;
    restoreBackgroundStyle(
      saved.backgroundPattern ?? look.backgroundPattern ?? legacyStyle?.backgroundPattern,
      saved.backgroundMotif,
      saved.backgroundTexture ?? look.backgroundTexture ?? legacyStyle?.backgroundTexture,
    );
    if (Number.isInteger(saved.characterCount)) state.characterCount = Math.min(5, Math.max(1, saved.characterCount));
    if (Number.isInteger(saved.selectedCharacter)) state.selectedCharacter = Math.min(state.characterCount - 1, Math.max(0, saved.selectedCharacter));
    if (Array.isArray(saved.characters)) {
      saved.characters.slice(0, 5).forEach((savedCharacter, index) => {
        const character = state.characters[index];
        if (!character || !savedCharacter) return;
        character.assetKey = savedCharacter.assetKey || null;
        if (savedCharacter.assetKey) {
          character.fileName = savedCharacter.fileName || character.fileName;
          character.fileMeta = savedCharacter.fileMeta || character.fileMeta;
        }
        character.cutout = Boolean(savedCharacter.cutout);
        character.imageFit = ["contain", "cover"].includes(savedCharacter.imageFit) ? savedCharacter.imageFit : "contain";
        if (Number.isFinite(savedCharacter.zoom)) character.zoom = savedCharacter.zoom;
        if (Number.isFinite(savedCharacter.panX)) character.panX = savedCharacter.panX;
        if (Number.isFinite(savedCharacter.panY)) character.panY = savedCharacter.panY;
      });
    }
    const selectedCharacter = state.characters[state.selectedCharacter];
    const selectedSavedCharacter = saved.characters?.[state.selectedCharacter];
    if (selectedCharacter && selectedSavedCharacter && !Number.isFinite(selectedSavedCharacter.zoom)) {
      selectedCharacter.zoom = state.zoom;
      selectedCharacter.panX = state.panX;
      selectedCharacter.panY = state.panY;
      selectedCharacter.imageFit = state.imageFit;
    }
    if (Array.isArray(saved.outfits) && !Array.isArray(saved.looks)) {
      look.outfits = cloneOutfits(saved.outfits);
      ensureLookOutfits(look);
    }
    syncSelectedCharacter();
    return saved;
  } catch {
    // A malformed local draft should never prevent the editor from opening.
    return null;
  }
}

function renderAll() {
  syncHistoryControls();
  renderLook();
  renderLookList();
  renderCast();
  renderStyles();
  renderEquipment();
  renderCatalog();
  renderSourcePanel();
  hydrateCurrentLookEnglishNames();
}

function selectLook(id) {
  const nextLook = looks.find((look) => look.id === id);
  if (!nextLook || nextLook.id === state.selectedLookId) return;
  syncStateIntoLook(getSelectedLook());
  getSelectedLook().history = state.history;
  getSelectedLook().redo = state.redo;
  state.selectedLookId = nextLook.id;
  const editor = nextLook.editor || defaultLookEditor();
  Object.assign(state, editor, { characters: editor.characters.map(character => ({ ...character })), shadow: { ...editor.shadow } });
  state.background = backgrounds[nextLook.background] ? nextLook.background : "paper";
  restoreBackgroundStyle(nextLook.backgroundPattern, nextLook.backgroundMotif, nextLook.backgroundTexture);
  state.titleFont = titleFonts[nextLook.titleFont] ? nextLook.titleFont : defaultTitleFont;
  state.titleWeight = normaliseTitleWeight(state.titleFont, nextLook.titleWeight ?? defaultTitleWeight);
  state.outline = { ...state.outline, ...(nextLook.outline || {}) };
  state.titleOutline = { ...state.titleOutline, ...(nextLook.titleOutline || {}) };
  styleAdvancedOpen = false;
  state.activeSlot = "head";
  state.selectedCharacter = 0;
  state.history = nextLook.history || [];
  state.redo = nextLook.redo || [];
  syncSelectedCharacter();
  renderAll();
  saveState();
}

function cycleLook(direction) {
  if (looks.length < 2) return;
  const index = currentLookIndex();
  const nextIndex = (index + direction + looks.length) % looks.length;
  selectLook(looks[nextIndex].id);
}

function updateRangeProgress(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  input.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
}

function formatImageOffset(value) {
  const offset = Math.round(Number(value) || 0);
  return offset === 0 ? "0 px" : `${offset > 0 ? "+" : "−"}${Math.abs(offset)} px`;
}

async function handleImageFile(file, characterIndex = state.selectedCharacter, { render = true, notify = true } = {}) {
  const operationEpoch = workspaceEpoch;
  if (!file || !file.type.startsWith("image/")) {
    if (notify) showToast("PNG, JPG 또는 WebP 이미지를 선택해주세요.");
    return false;
  }
  if (file.size > 16 * 1024 * 1024) {
    if (notify) showToast("이미지 한 장은 16MB 이하만 사용할 수 있습니다.");
    return false;
  }
  const targetIndex = clamp(Number(characterIndex) || 0, 0, state.characters.length - 1);
  const character = getCharacterImageState(state.characters[targetIndex] || state.characters[0]);
  // Each original is immutable while cards or undo history may reference it.
  const assetKey = createAssetKey();
  const url = createAssetUrl(file);
  state.characters[targetIndex] = {
    ...character,
    src: url,
    originalSrc: url,
    assetKey,
    fileName: file.name,
    fileMeta: `${Math.round(file.size / 1024)} KB · 원본`,
    cutout: false,
    imageFit: "contain",
    zoom: 100,
    panX: 0,
    panY: 0,
  };
  if (targetIndex === state.selectedCharacter) syncSelectedCharacter();
  if (render) renderAll();
  try {
    await writeCharacterAsset(assetKey, { originalBlob: file, cutoutBlob: null });
    if (operationEpoch !== workspaceEpoch) return false;
  } catch {
    if (operationEpoch !== workspaceEpoch) return false;
    setSaveStatus("이미지 저장 실패 · 새로고침 전에 다시 추가하세요", true);
    if (notify) showToast("이미지는 불러왔지만 새로고침 후 복원하지 못할 수 있습니다.");
    return false;
  }
  if (render) saveState();
  if (notify) showToast("이미지를 불러왔습니다.");
  return true;
}

async function handleImageFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, 5);
  if (!files.length) return;
  const operationEpoch = workspaceEpoch;
  const lookId = state.selectedLookId;
  recordHistory();
  const startIndex = state.selectedCharacter;
  const capacity = state.characters.length - startIndex;
  const queuedFiles = files.slice(0, capacity);
  if (queuedFiles.length > 1) state.characterCount = Math.max(state.characterCount, startIndex + queuedFiles.length);
  // Assign the whole batch to its originating look before yielding to card navigation.
  const imports = queuedFiles.map((file, offset) =>
    handleImageFile(file, startIndex + offset, { render: false, notify: false }));
  state.selectedCharacter = startIndex;
  syncSelectedCharacter();
  renderAll();
  saveState();
  const importedCount = (await Promise.all(imports)).filter(Boolean).length;
  if (operationEpoch !== workspaceEpoch || lookId !== state.selectedLookId) return;
  if (!importedCount) {
    showToast("불러올 수 있는 PNG, JPG 또는 WebP 이미지가 없습니다.");
    return;
  }
  showToast(importedCount > 1 ? `${importedCount}장의 이미지를 캐릭터 슬롯에 배치했습니다.` : "이미지를 불러왔습니다.");
}

function resetSelectedImagePlacement({ notify = true } = {}) {
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ imageFit: "contain", zoom: 100, panX: 0, panY: 0 });
  renderStyles({ refreshInfo: false, refreshPattern: false });
  if (!imageEditorOpen) saveState();
  if (notify && !imageEditorOpen) showToast("선택한 이미지를 프레임에 맞췄습니다.");
}

function resetSelectedImagePosition({ notify = true } = {}) {
  if (state.panX === 0 && state.panY === 0) return;
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ panX: 0, panY: 0 });
  renderStyles({ refreshInfo: false, refreshPattern: false });
  if (!imageEditorOpen) saveState();
  if (notify && !imageEditorOpen) showToast("이미지를 카드 중앙에 맞췄습니다.");
}

function nudgeSelectedImage(direction) {
  const offsets = {
    up: [0, -12],
    right: [12, 0],
    down: [0, 12],
    left: [-12, 0],
  };
  const [deltaX, deltaY] = offsets[direction] || [0, 0];
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ panX: state.panX + deltaX, panY: state.panY + deltaY });
  renderStyles({ refreshInfo: false, refreshPattern: false });
  if (!imageEditorOpen) saveState();
}

function changeSelectedImageZoom(delta) {
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ zoom: clamp(state.zoom + delta, 70, 180) });
  renderStyles({ refreshInfo: false, refreshPattern: false });
  if (!imageEditorOpen) saveState();
}

async function quickCutout() {
  if ($("#cutoutButton").disabled) return;
  const targetCharacter = state.characters[state.selectedCharacter];
  if (!resolveCharacterAsset(targetCharacter, "source")) {
    showToast("이미지를 먼저 추가하세요.");
    return;
  }
  if (state.cutout) {
    recordHistory();
    const character = state.characters[state.selectedCharacter];
    character.src = character.originalSrc;
    character.fileMeta = character.fileMeta.replace(/[^·]*배경\s*제거$/, "원본");
    character.cutout = false;
    syncSelectedCharacter();
    renderCast();
    renderStyles({ refreshInfo: false, refreshPattern: false });
    renderSourcePanel();
    saveState();
    showToast("원본 이미지로 복원했습니다.");
    return;
  }
  const button = $("#cutoutButton");
  const targetIndex = state.selectedCharacter;
  const sourceUrl = targetCharacter.originalSrc;
  const targetLookId = state.selectedLookId;
  const isCurrentSource = () => state.selectedLookId === targetLookId
    && state.characters[targetIndex] === targetCharacter
    && targetCharacter.originalSrc === sourceUrl;
  const label = button.querySelector("span:first-child");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.classList.add("is-processing");
  label.textContent = "배경을 분리하는 중 · 원본 유지";

  const finishProcessing = () => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("is-processing");
    label.textContent = state.cutout ? "원본으로 복원" : "배경 제거";
  };

  try {
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error("원본 이미지를 읽지 못했습니다.");
    const sourceBlob = await sourceResponse.blob();
    let resultBlob;
    let processingTier = "";
    let serverError = null;
    try {
      const serverResponse = await fetch("/api/background-removal", {
        method: "POST",
        headers: { "Content-Type": sourceBlob.type || "image/png" },
        body: sourceBlob,
      });
      if (serverResponse.ok) {
        resultBlob = await serverResponse.blob();
        processingTier = "GPU 서버";
      } else {
        const detail = await serverResponse.json().catch(() => ({}));
        const canUseBrowserFallback = serverResponse.status >= 500
          || [
            "cutout_service_not_configured",
            "cutout_service_unavailable",
            "cutout_service_timeout",
            "cutout_service_error",
            "cutout_invalid_response",
          ].includes(detail.code);
        if (!canUseBrowserFallback) {
          serverError = new Error(detail.error || "배경 제거 서버가 이미지를 처리하지 못했습니다.");
        }
      }
    } catch {
      // Continue to the browser model when the optional API is unavailable.
    }
    if (!resultBlob && serverError) throw serverError;
    if (!resultBlob) {
      if (!globalThis.GlamourBackgroundRemoval?.removeInBrowser) throw new Error("브라우저 배경 제거 모듈을 불러오지 못했습니다.");
      label.textContent = "브라우저 모델 준비 중 · 첫 실행은 다운로드가 필요합니다";
      const browserResult = await globalThis.GlamourBackgroundRemoval.removeInBrowser(sourceBlob, {
        onProgress: (progress) => {
          if (progress.status === "progress" && Number.isFinite(progress.progress)) {
            label.textContent = `브라우저 모델 준비 중 · ${Math.round(progress.progress)}%`;
          }
        },
      });
      resultBlob = browserResult.blob;
      processingTier = browserResult.tier;
    }
    const resultUrl = createAssetUrl(resultBlob);
    let image;
    try {
      image = await loadCanvasImage(resultUrl);
      assertVisibleCutoutImage(image);
    } catch (error) {
      URL.revokeObjectURL(resultUrl);
      throw error;
    }
    if (!isCurrentSource()) {
      URL.revokeObjectURL(resultUrl);
      showToast("원본이나 작업 상태가 바뀌어 배경 제거 결과를 적용하지 않았습니다.");
      return;
    }
    recordHistory();
    Object.assign(targetCharacter, {
      src: resultUrl,
      fileMeta: `${image.naturalWidth} × ${image.naturalHeight} · 배경 제거`,
      cutout: true,
    });
    syncSelectedCharacter();
    renderCast();
    renderStyles();
    renderSourcePanel();
    try {
      await writeCharacterAsset(targetCharacter.assetKey, { cutoutBlob: resultBlob });
      if (!isCurrentSource()) return;
      saveState();
    } catch {
      showToast("배경제거는 완료됐지만 브라우저 저장에 실패했습니다.");
      return;
    }
    showToast(`배경 제거 완료 · ${image.naturalWidth} × ${image.naturalHeight} 원본 해상도${processingTier ? ` · ${processingTier}` : ""}`);
  } catch (error) {
    showToast(error.message || "이미지를 처리하지 못했습니다.");
  } finally {
    finishProcessing();
  }
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function assertVisibleCutoutImage(image) {
  const width = Math.max(1, Math.min(256, image.naturalWidth || image.width || 1));
  const height = Math.max(1, Math.min(256, image.naturalHeight || image.height || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("배경 제거 결과를 확인할 수 없습니다.");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let maxAlpha = 0;
  for (let index = 3; index < pixels.length; index += 4) maxAlpha = Math.max(maxAlpha, pixels[index]);
  if (maxAlpha <= 8) throw new Error("배경 제거 모델이 빈 결과를 반환했습니다.");
}

let exportInProgress = false;
function exportRevision() {
  return JSON.stringify([workspaceEpoch, state.selectedLookId, state.language, createSnapshot()]);
}
function captureExportCopy() {
  const board = elements.board.getBoundingClientRect();
  const scale = getExportDimensions().layoutWidth / board.width;
  return [elements.boardTitle, elements.boardSubtitle].filter(Boolean).map(element => {
    const style = getComputedStyle(element);
    const lines = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      for (let index = 0; index < node.length; index++) {
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        let line = lines.find(item => Math.abs(item.top - rect.top) < 1);
        if (!line) { line = { text: "", top: rect.top, x: (rect.left - board.left) * scale, y: (rect.top - board.top) * scale, height: rect.height * scale }; lines.push(line); }
        line.text += node.textContent[index];
      }
    }
    return { lines, font: `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`,
      color: style.color, stroke: element === elements.boardTitle ? state.titleOutline.width * scale : 0,
      strokeColor: state.titleOutline.color, letterSpacing: (parseFloat(style.letterSpacing) || 0) * scale };
  });
}
async function downloadComposition(event, snapshot = { ...state, characters: state.characters.map(character => ({ ...character })), titleOutline: { ...state.titleOutline }, outline: { ...state.outline }, shadow: { ...state.shadow } }) {
  if (exportInProgress) return;
  const state = snapshot;
  const look = { ...getSelectedLook(), outfits: cloneOutfits(getLookOutfits(getSelectedLook())) };
  const dimensions = getExportDimensions();
  const exportTheme = getExportTheme();
  const gear = state.characters.map((character, index) => getCharacterItemIds(index, look).map(getItem).filter(Boolean).map(item => ({
    name: getItemName(item, state.language), secondaryName: getSecondaryItemName(item, state.language),
    slotName: getOutfitSlotName(item.slot, state.language),
  })));
  const revision = exportRevision();
  const assertUnchanged = () => {
    if (revision !== exportRevision()) throw new Error("편집 내용이 변경되었습니다. 현재 카드에서 PNG 내보내기를 다시 눌러주세요.");
  };
  const exportButton = $("#exportButton");
  try {
    const activeCharacters = state.characters.slice(0, state.characterCount);
    const missingCharacterIndex = activeCharacters.findIndex((character) => !resolveCharacterAsset(character, "hero"));
    if (missingCharacterIndex >= 0) {
      showToast(state.characterCount === 1
        ? "PNG로 저장하려면 이미지를 먼저 추가하세요."
        : `캐릭터 ${missingCharacterIndex + 1}의 이미지를 먼저 추가하세요.`);
      return;
    }
    const titleFontConfig = getTitleFontConfig(state.titleFont);
    state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? defaultTitleWeight);
    const fontLoad = typeof document.fonts?.load === "function"
      ? document.fonts.load(`${state.titleWeight} 64px ${titleFontConfig.family}`)
      : Promise.resolve();
    exportInProgress = true;
    exportButton.setAttribute("aria-busy", "true");
    exportButton.textContent = "PNG 준비 중…";
    const fontReady = await Promise.race([fontLoad.then(() => true), new Promise(resolve => window.setTimeout(() => resolve(false), 8000))]);
    if (!fontReady) throw new Error("서체 준비 시간이 초과되었습니다. 연결을 확인하거나 기본 서체로 다시 시도해주세요.");
    assertUnchanged();
    fitBoardTitle();
    const copyLayout = captureExportCopy();
    const images = await Promise.all(activeCharacters.map((character) => loadCanvasImage(resolveCharacterAsset(character, "hero"))));
    assertUnchanged();
    const outputBlob = await CardPng.render({ state, dimensions, exportTheme,
      background: backgrounds[state.background], patternStars, images, copyLayout, gear,
      outlineColor: rgba(state.outline.color, 0.8) });
    assertUnchanged();
    const extension = "png";
    const link = document.createElement("a");
    link.download = `${look.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "glamour-look"}.${extension}`;
    const objectUrl = URL.createObjectURL(outputBlob);
    link.href = objectUrl;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast(`PNG를 내보냈습니다 · ${dimensions.exportWidth} × ${dimensions.exportHeight} px`);
  } catch (error) {
    showToast(error.message || "내보낼 이미지를 준비하지 못했습니다.");
  } finally {
    exportInProgress = false;
    exportButton.removeAttribute("aria-busy");
    exportButton.textContent = "PNG 내보내기 ↗";
  }
}

function resetStyles() {
  recordHistory();
  state.background = "paper";
  state.backgroundPattern = "none";
  state.backgroundTexture = "none";
  const character = state.characters[state.selectedCharacter];
  character.src = character.originalSrc;
  character.fileMeta = character.fileMeta.replace(" · 배경 제거", " · 원본");
  character.cutout = false;
  syncSelectedCharacter();
  state.outline = { color: "#f1dfbb", width: 0 };
  state.titleOutline = { color: "#ffffff", width: 0 };
  state.shadow = { strength: 20, x: 8, y: 12, blur: 24 };
  state.zoom = 100;
  state.panX = 0;
  state.panY = 0;
  state.imageFit = "contain";
  character.zoom = 100;
  character.panX = 0;
  character.panY = 0;
  character.imageFit = "contain";
  state.multiInfoEnabled = true;
  state.multiInfoMode = "fade";
  state.infoDensity = "summary";
  state.titleFont = defaultTitleFont;
  state.titleWeight = defaultTitleWeight;
  state.singleRatio = "portrait";
  state.singleLayout = "info-left";
  styleAdvancedOpen = false;
  renderAll();
  saveState();
  showToast("스타일과 현재 이미지 배치를 기본값으로 되돌렸습니다.");
}

function setResetMenuOpen(open, { focusFirst = false } = {}) {
  const button = $("#resetButton");
  const menu = $("#resetMenu");
  if (!button || !menu) return;
  const nextOpen = Boolean(open);
  menu.hidden = !nextOpen;
  button.setAttribute("aria-expanded", String(nextOpen));
  if (nextOpen && focusFirst) window.requestAnimationFrame(() => menu.querySelector('[role="menuitem"]')?.focus());
}

function resetCardData() {
  const look = getSelectedLook();
  const defaults = defaultLookSnapshots.get(look.id) || createLookResetSnapshot(look, looks.indexOf(look));
  recordHistory();
  // Keep assets reachable through undo. Full workspace deletion is permanent.
  look.title = defaults.title;
  look.subtitle = defaults.subtitle;
  look.outfits = cloneOutfits(defaults.outfits);
  ensureLookOutfits(look);
  state.background = defaults.background;
  restoreBackgroundStyle(defaults.backgroundPattern, undefined, defaults.backgroundTexture);
  state.multiInfoEnabled = true;
  state.multiInfoMode = "fade";
  state.infoDensity = "summary";
  state.titleFont = defaultTitleFont;
  state.titleWeight = defaultTitleWeight;
  state.singleRatio = "portrait";
  state.singleLayout = "info-left";
  state.characterCount = 1;
  state.selectedCharacter = 0;
  state.activeSlot = "head";
  state.characters = createEmptyCharacters();
  state.outline = { color: "#f1dfbb", width: 0 };
  state.titleOutline = { color: "#ffffff", width: 0 };
  state.shadow = { strength: 20, x: 8, y: 12, blur: 24 };
  state.zoom = 100;
  state.panX = 0;
  state.panY = 0;
  state.imageFit = "contain";
  state.cutout = false;
  styleAdvancedOpen = false;
  syncSelectedCharacter();
  const activePanel = state.activePanel;
  renderAll();
  openPanel(activePanel);
  saveState();
  showToast("현재 카드를 비웠습니다. 되돌리기로 복원할 수 있어요.");
}

async function resetWorkspace() {
  workspaceEpoch += 1;
  clearTimeout(assetCleanupTimer);
  const activePanel = state.activePanel;
  if (imageEditorOpen) finishImageEditor(false);
  try {
    // A late upload must never recreate an asset after permanent deletion.
    await Promise.allSettled([...pendingAssetWrites]);
    await characterAssetVault.clear();
  } catch {
    showToast("이미지 보관함을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    return false;
  }
  looks.forEach(look => revokeCharacterAssets(look.editor?.characters || []));
  revokeCharacterAssets();
  for (const url of assetUrls) revokeObjectUrl(url);
  assetUrls.clear();
  let storageFailed = false;
  [draftStorageKey, ...legacyStorageKeys, uiPreferencesStorageKey, backgroundPresetStorageKey].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      storageFailed = true;
    }
  });
  itemRecordCache.clear();
  itemSearch.clear();
  localizedItemNameRequests.clear();
  elements.itemSearch.value = "";
  $("#lookSearch").value = "";
  backgroundPresets = [];
  backgroundPresetCreateOpen = false;
  looks = [createBlankLook(1, "look-1")];
  deletedLooks.length = 0;
  looks.forEach(ensureLookOutfits);
  captureDefaultLookSnapshots();
  Object.assign(state, {
    language: "ko",
    selectedLookId: "look-1",
    activeSlot: "head",
    characterCount: 1,
    selectedCharacter: 0,
    characters: createEmptyCharacters(),
    background: "paper",
    multiInfoEnabled: true,
    multiInfoMode: "fade",
    infoDensity: "summary",
    titleFont: defaultTitleFont,
    titleWeight: defaultTitleWeight,
    singleRatio: "portrait",
    singleLayout: "info-left",
    backgroundPattern: "none",
    backgroundTexture: "none",
    cutout: false,
    outline: { color: "#f1dfbb", width: 0 },
    titleOutline: { color: "#ffffff", width: 0 },
    shadow: { strength: 20, x: 8, y: 12, blur: 24 },
    zoom: 100,
    panX: 0,
    panY: 0,
    imageFit: "contain",
    imageSrc: "",
    originalSrc: "",
    fileName: "사진 미선택",
    fileMeta: "PNG · JPG · WebP · 여러 장 선택 가능",
    history: [],
    redo: [],
  });
  uiPreferences.libraryCollapsed = true;
  styleAdvancedOpen = false;
  syncLibraryPanel();
  saveUiPreferences();
  syncSelectedCharacter();
  renderAll();
  openPanel(activePanel);
  if (storageFailed) {
    setSaveStatus("일부 설정 삭제 실패 · 브라우저 저장 권한을 확인하세요", true);
    showToast("이미지는 삭제했지만 일부 설정을 지우지 못했습니다. 저장 권한을 확인하고 다시 시도해주세요.");
  } else {
    setSaveStatus("빈 작업공간 · 이 브라우저에 자동 저장");
    showToast("이 브라우저의 LOOK BOOK, 이미지, 프리셋을 모두 삭제했습니다.");
  }
  return !storageFailed;
}

function ensureMobileControlVisible(element) {
  if (!element || window.innerWidth > 920) return;
  window.requestAnimationFrame(() => {
    const rail = document.querySelector(".rail");
    if (!rail || getComputedStyle(rail).display === "none") return;
    const railTop = rail.getBoundingClientRect().top;
    const rect = element.getBoundingClientRect();
    const safeTop = 8;
    const safeBottom = railTop - 12;
    if (rect.top < safeTop || rect.bottom > safeBottom) {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    }
  });
}

function setMobileLookSearchOpen(open, { focus = false } = {}) {
  const toggle = $("#mobileLookSearchToggle");
  const field = $("#lookSearchField");
  const input = $("#lookSearch");
  if (!toggle || !field || !input) return;
  const isMobile = window.innerWidth <= 920;
  const nextOpen = isMobile && Boolean(open);
  field.classList.toggle("is-mobile-open", nextOpen);
  document.body.classList.toggle("mobile-look-search-open", nextOpen);
  toggle.setAttribute("aria-expanded", String(nextOpen));
  if (nextOpen && focus) {
    window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      ensureMobileControlVisible(input);
    });
  }
}

function openPanel(panelId) {
  const nextPanel = editorNavigation.panel(panelId);
  state.activePanel = nextPanel;
  $$(".mode-tab").forEach((tab) => {
    const active = tab.dataset.panel === nextPanel;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $$(".inspector-panel").forEach((panel) => {
    const active = panel.id === nextPanel;
    panel.classList.toggle("is-hidden", !active);
    panel.hidden = !active;
  });
  if (elements.inspectorTitle) elements.inspectorTitle.textContent = panelLabels[nextPanel];
  if (nextPanel === "itemsPanel") ensureMobileControlVisible(elements.itemSearch);
}

function initialiseInteractions() {
  initialiseLookManager();
  $$(".look-list-item").forEach((button) => button.addEventListener("click", () => selectLook(button.dataset.lookId)));
  $("#previousLook").addEventListener("click", () => cycleLook(-1));
  $("#nextLook").addEventListener("click", () => cycleLook(1));
  $("#lookSearch").addEventListener("input", renderLookList);
  $("#mobileLookSearchToggle")?.addEventListener("click", () => {
    const open = !$("#lookSearchField")?.classList.contains("is-mobile-open");
    setMobileLookSearchOpen(open, { focus: open });
  });
  elements.libraryToggleButton.addEventListener("click", toggleLibraryPanel);
  $("#imageInput").addEventListener("change", (event) => {
    void handleImageFiles(event.target.files);
    event.target.value = "";
  });
  $$('[data-cast-count]').forEach((button) => button.addEventListener("click", () => {
    const nextCount = Number(button.dataset.castCount);
    if (nextCount === state.characterCount) return;
    recordHistory();
    state.characterCount = nextCount;
    if (state.selectedCharacter >= nextCount) state.selectedCharacter = nextCount - 1;
    renderAll();
    saveState();
    showToast(`${nextCount}인 룩북 레이아웃으로 재배치했습니다.`);
  }));
  $("#multiInfoToggle").addEventListener("change", (event) => { recordHistory(); state.multiInfoEnabled = event.target.checked; renderStyles(); saveState(); });
  $$('button[data-info-mode]').forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    recordHistory();
    state.multiInfoMode = button.dataset.infoMode;
    renderStyles();
    saveState();
  }));
  $$('button[data-info-density]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.infoDensity = button.dataset.infoDensity; renderStyles(); saveState(); }));
  $("#styleAdvancedToggle").addEventListener("click", () => {
    styleAdvancedOpen = !styleAdvancedOpen;
    renderStyles();
  });
  $$('button[data-pattern]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.backgroundPattern = button.dataset.pattern; renderStyles(); saveState(); }));
  $$('button[data-texture]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.backgroundTexture = button.dataset.texture; renderStyles(); saveState(); }));
  $("#saveBackgroundPresetButton").addEventListener("click", () => setBackgroundPresetFormOpen(!backgroundPresetCreateOpen));
  $("#backgroundPresetCancel").addEventListener("click", () => setBackgroundPresetFormOpen(false));
  $("#backgroundPresetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentBackgroundPreset();
  });
  $("#backgroundPresetList").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-background-preset-delete]");
    if (deleteButton) {
      deleteBackgroundPreset(deleteButton.dataset.backgroundPresetDelete);
      return;
    }
    const applyButton = event.target.closest("[data-background-preset-id]");
    if (applyButton) applyBackgroundPreset(applyButton.dataset.backgroundPresetId);
  });
  $$('button[data-single-ratio]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.singleRatio = button.dataset.singleRatio; renderStyles(); saveState(); showToast(button.dataset.singleRatio === "portrait" ? "1인 카드를 세로 4:5로 바꿨습니다." : "1인 카드를 가로 16:9로 바꿨습니다."); }));
  $$('button[data-single-layout]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.singleLayout = button.dataset.singleLayout; renderStyles(); saveState(); }));
  $("#titleFontSelect").addEventListener("change", (event) => {
    recordHistory();
    state.titleFont = titleFonts[event.target.value] ? event.target.value : defaultTitleFont;
    state.titleWeight = getTitleFontConfig(state.titleFont).weights.at(-1);
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  });
  $("#titleWeightOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-title-weight]");
    if (!button || Number(button.dataset.titleWeight) === state.titleWeight) return;
    recordHistory();
    state.titleWeight = normaliseTitleWeight(state.titleFont, Number(button.dataset.titleWeight));
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  });
  document.addEventListener("keydown", (event) => {
    const radio = event.target.closest('[role="radio"]');
    const group = radio?.closest('[role="radiogroup"]');
    if (!group || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const radios = [...group.querySelectorAll('[role="radio"]')].filter((button) => !button.disabled);
    const index = editorNavigation.nextIndex(radios.indexOf(radio), event.key, radios.length);
    if (index < 0) return;
    radios[index].focus();
    radios[index].click();
  });
  $("#canvasBoard").addEventListener("dragover", (event) => { event.preventDefault(); elements.board.classList.add("is-drop-target"); });
  $("#canvasBoard").addEventListener("dragleave", () => elements.board.classList.remove("is-drop-target"));
  $("#canvasBoard").addEventListener("drop", (event) => { event.preventDefault(); elements.board.classList.remove("is-drop-target"); void handleImageFiles(event.dataTransfer.files); });
  const imageDropZone = $("#imageDropZone");
  imageDropZone.addEventListener("click", () => elements.imageInput.click());
  imageDropZone.addEventListener("dragover", (event) => { event.preventDefault(); imageDropZone.classList.add("is-drop-target"); });
  imageDropZone.addEventListener("dragleave", () => imageDropZone.classList.remove("is-drop-target"));
  imageDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    imageDropZone.classList.remove("is-drop-target");
    void handleImageFiles(event.dataTransfer.files);
  });
  let dragState = null;
  elements.portraitWrap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const figure = event.target.closest(".character-figure");
    const targetIndex = Number(figure?.dataset.characterIndex);
    if (imageEditorOpen && Number.isInteger(targetIndex) && targetIndex !== state.selectedCharacter) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (figure?.dataset.empty === "true") return;
    if (Number.isInteger(targetIndex) && targetIndex !== state.selectedCharacter) selectCharacter(targetIndex);
    dragState = { startX: event.clientX, startY: event.clientY, panX: state.panX, panY: state.panY, moved: false, editorMode: imageEditorOpen };
    elements.portraitWrap.setPointerCapture(event.pointerId);
    elements.portraitWrap.classList.add("is-dragging");
  });
  elements.portraitWrap.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    if (dragState.editorMode && !imageEditorOpen) {
      elements.portraitWrap.classList.remove("is-dragging");
      dragState = null;
      return;
    }
    if (!dragState.moved && (Math.abs(event.clientX - dragState.startX) > 2 || Math.abs(event.clientY - dragState.startY) > 2)) {
      if (imageEditorOpen) imageEditorDirty = true;
      else recordHistory();
      dragState.moved = true;
    }
    if (!dragState.moved) return;
    updateSelectedImageState({
      panX: dragState.panX + event.clientX - dragState.startX,
      panY: dragState.panY + event.clientY - dragState.startY,
    });
    renderStyles({ refreshInfo: false, refreshPattern: false });
  });
  const finishDrag = (event) => {
    if (!dragState) return;
    if (elements.portraitWrap.hasPointerCapture(event.pointerId)) elements.portraitWrap.releasePointerCapture(event.pointerId);
    elements.portraitWrap.classList.remove("is-dragging");
    if (dragState.moved && !imageEditorOpen) saveState();
    dragState = null;
  };
  elements.portraitWrap.addEventListener("pointerup", finishDrag);
  elements.portraitWrap.addEventListener("pointercancel", finishDrag);
  elements.portraitWrap.addEventListener("keydown", (event) => {
    const directions = { ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down" };
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!directions[event.key] && !["+", "=", "-", "_", "0"].includes(event.key)) return;
    const figure = event.target.closest(".character-figure");
    if (!figure) return;
    const characterIndex = Number(figure.dataset.characterIndex);
    if (characterIndex !== state.selectedCharacter) selectCharacter(characterIndex);
    if (directions[event.key]) {
      event.preventDefault();
      nudgeSelectedImage(directions[event.key]);
      return;
    }
    if (["+", "="].includes(event.key)) {
      event.preventDefault();
      changeSelectedImageZoom(10);
    } else if (["-", "_"].includes(event.key)) {
      event.preventDefault();
      changeSelectedImageZoom(-10);
    } else if (event.key === "0") {
      event.preventDefault();
      resetSelectedImagePlacement();
    }
  });
  $("#cutoutButton").addEventListener("click", quickCutout);
  $("#fitImageButton").addEventListener("click", () => resetSelectedImagePlacement());
  $$('button[data-image-fit]').forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.imageFit === state.imageFit) return;
    if (imageEditorOpen) imageEditorDirty = true;
    else recordHistory();
    updateSelectedImageState({ imageFit: button.dataset.imageFit });
    renderStyles({ refreshInfo: false, refreshPattern: false });
    if (!imageEditorOpen) saveState();
  }));
  $$('[data-image-nudge]').forEach((button) => button.addEventListener("click", () => nudgeSelectedImage(button.dataset.imageNudge)));
  const bindHistoryRange = (input, update) => {
    let editing = false;
    input.addEventListener("input", () => {
      if (!editing) {
        if (imageEditorOpen) imageEditorDirty = true;
        else recordHistory();
      }
      editing = true;
      update(Number(input.value));
      renderStyles({ refreshInfo: false, refreshPattern: false });
      updateRangeProgress(input);
      if (!imageEditorOpen) saveState();
    });
    input.addEventListener("change", () => { editing = false; });
    input.addEventListener("blur", () => { editing = false; });
  };
  bindHistoryRange(elements.zoomRange, value => { updateSelectedImageState({ zoom: value }); });
  bindHistoryRange(elements.panXRange, value => { updateSelectedImageState({ panX: value }); });
  bindHistoryRange(elements.panYRange, value => { updateSelectedImageState({ panY: value }); });
  bindHistoryRange($("#outlineRange"), value => { state.outline.width = value; });
  bindHistoryRange(elements.titleOutlineRange, value => { state.titleOutline.width = value; });
  bindHistoryRange($("#shadowRange"), value => { state.shadow.strength = value; });
  $$(".color-swatch").forEach((swatch) => swatch.addEventListener("click", () => { recordHistory(); state.outline.color = swatch.dataset.color; renderStyles(); saveState(); }));
  $$(".title-outline-swatch").forEach((swatch) => swatch.addEventListener("click", () => {
    if (swatch.dataset.titleOutlineColor === state.titleOutline.color) return;
    recordHistory();
    state.titleOutline.color = swatch.dataset.titleOutlineColor;
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  }));
  $$(".backdrop-swatch").forEach((swatch) => swatch.addEventListener("click", () => { recordHistory(); state.background = swatch.dataset.background; renderStyles(); saveState(); }));
  $$(".direction-pad button").forEach((button) => button.addEventListener("click", () => {
    recordHistory();
    const direction = button.dataset.shadow;
    const directions = { nw: [-12, -18], n: [0, -18], ne: [12, -18], w: [-16, 0], e: [16, 0], sw: [-12, 18], s: [0, 18], se: [12, 18] };
    [state.shadow.x, state.shadow.y] = directions[direction];
    renderStyles();
    saveState();
  }));
  $("#zoomIn").addEventListener("click", () => changeSelectedImageZoom(10));
  $("#zoomOut").addEventListener("click", () => changeSelectedImageZoom(-10));
  elements.centerImageButton.addEventListener("click", () => resetSelectedImagePosition());
  elements.openImageEditorButton.addEventListener("click", openImageEditor);
  elements.closeImageEditorButton.addEventListener("click", () => finishImageEditor(false));
  elements.cancelImageEditorButton.addEventListener("click", () => finishImageEditor(false));
  elements.applyImageEditorButton.addEventListener("click", () => finishImageEditor(true));
  $("#focusCanvasButton").addEventListener("click", (event) => {
    const focused = document.body.classList.toggle("canvas-focus-mode");
    event.currentTarget.setAttribute("aria-pressed", String(focused));
    event.currentTarget.setAttribute("aria-label", focused ? "일반 보기" : "캔버스 크게 보기");
    event.currentTarget.title = focused ? "일반 보기" : "캔버스 크게 보기";
  });
  $("#undoButton").addEventListener("click", undo);
  $("#redoButton").addEventListener("click", redo);
  $("#resetButton").addEventListener("click", () => {
    const menu = $("#resetMenu");
    setResetMenuOpen(Boolean(menu?.hidden), { focusFirst: Boolean(menu?.hidden) });
  });
  $("#resetStylesButton").addEventListener("click", () => {
    setResetMenuOpen(false);
    resetStyles();
    $("#resetButton")?.focus({ preventScroll: true });
  });
  $("#resetCardButton").addEventListener("click", () => {
    setResetMenuOpen(false);
    resetCardData();
    $("#resetButton")?.focus({ preventScroll: true });
  });
  $("#resetWorkspaceButton").addEventListener("click", () => {
    setResetMenuOpen(false);
    $("#deleteWorkspaceDialog").showModal();
    $("#cancelWorkspaceDelete").focus();
  });
  $("#cancelWorkspaceDelete").addEventListener("click", () => $("#deleteWorkspaceDialog").close());
  $("#deleteWorkspaceDialog").addEventListener("close", () => $("#resetButton").focus({ preventScroll: true }));
  $("#confirmWorkspaceDelete").addEventListener("click", async () => {
    const button = $("#confirmWorkspaceDelete"); button.disabled = true; button.textContent = "삭제 중…";
    try {
      const completed = await resetWorkspace();
      if (completed) $("#deleteWorkspaceDialog").close();
    }
    finally { button.disabled = false; button.textContent = "모두 삭제"; }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest(".reset-control") && !$("#resetMenu")?.hidden) setResetMenuOpen(false);
    if (!event.target.closest(".look-search-control") && $("#lookSearchField")?.classList.contains("is-mobile-open")) setMobileLookSearchOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const action = editorNavigation.escapeAction({
      dialogOpen: Boolean(document.querySelector("dialog[open]")),
      resetOpen: !$("#resetMenu")?.hidden,
      mobileSearchOpen: $("#lookSearchField")?.classList.contains("is-mobile-open"),
    });
    if (action === "ignore" || action === "none") return;
    if (action === "close-reset") {
      event.preventDefault();
      setResetMenuOpen(false);
      $("#resetButton")?.focus({ preventScroll: true });
      return;
    }
    if (action === "close-search") {
      event.preventDefault();
      setMobileLookSearchOpen(false);
      $("#mobileLookSearchToggle")?.focus({ preventScroll: true });
    }
  });
  $("#exportButton").addEventListener("click", downloadComposition);
  $("#itemSearch").addEventListener("input", scheduleCatalogSearch);
  elements.languageSelect.addEventListener("change", (event) => {
    state.language = event.currentTarget.value;
    renderEquipment();
    renderCatalog();
    renderMultiInfo();
    hydrateCurrentLookEnglishNames();
    saveState();
  });
  $$(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => openPanel(tab.dataset.panel));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$(".mode-tab");
      const nextIndex = editorNavigation.nextIndex(tabs.indexOf(tab), event.key, tabs.length);
      if (nextIndex < 0) return;
      const next = tabs[nextIndex];
      openPanel(next.dataset.panel);
      next.focus();
    });
  });
  $("#addLookButton").addEventListener("click", addLook);
  const bindInlineCardField = (element, field, fallback = "") => {
    let editSnapshot;
    element.addEventListener("focus", () => {
      editSnapshot = createSnapshot();
      element.dataset.editStart = getSelectedLook()[field] || "";
      element.dataset.editing = "true";
    });
    element.addEventListener("input", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(element.textContent || "");
      look[field] = value || fallback;
      if (field === "title") fitBoardTitle();
      if (field === "title") {
        document.title = `글래머 아틀리에 | ${look.title}`;
        renderLookList();
      }
    });
    element.addEventListener("keydown", (event) => {
      if (field === "title" && event.key === "Enter") {
        event.preventDefault();
        element.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const look = getSelectedLook();
        look[field] = element.dataset.editStart || fallback;
        element.textContent = look[field];
        element.blur();
      }
    });
    element.addEventListener("blur", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(element.textContent || "");
      look[field] = value || fallback;
      if (editSnapshot && look[field] !== editSnapshot[field]) recordHistory(editSnapshot);
      editSnapshot = null;
      element.dataset.editing = "false";
      renderLook();
      saveState();
    });
  };
  bindInlineCardField(elements.boardTitle, "title", "새로운 룩");
  bindInlineCardField(elements.boardSubtitle, "subtitle");
  const bindCopyEditorField = (input, count, field, fallback = "") => {
    let editSnapshot;
    input.addEventListener("focus", () => {
      editSnapshot = createSnapshot();
      input.dataset.editStart = getSelectedLook()[field] || "";
    });
    input.addEventListener("input", () => {
      const look = getSelectedLook();
      look[field] = input.value;
      elements.boardTitle.textContent = look.title || "새로운 룩";
      elements.boardSubtitle.textContent = look.subtitle || "";
      elements.boardSubtitle.dataset.empty = String(!look.subtitle);
      if (field === "title") fitBoardTitle();
      if (field === "title") {
        document.title = `글래머 아틀리에 | ${look.title || "새로운 룩"}`;
        renderLookList();
      }
      updateCopyEditorCount(input, count);
      resizeCopyEditorField(input);
    });
    input.addEventListener("keydown", (event) => {
      if (field === "title" && event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const look = getSelectedLook();
        look[field] = input.dataset.editStart || fallback;
        input.value = look[field];
        input.blur();
      }
    });
    input.addEventListener("blur", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(input.value);
      look[field] = value || fallback;
      if (editSnapshot && look[field] !== editSnapshot[field]) recordHistory(editSnapshot);
      editSnapshot = null;
      renderLook();
      saveState();
    });
  };
  bindCopyEditorField(elements.cardTitleInput, elements.cardTitleCount, "title", "새로운 룩");
  bindCopyEditorField(elements.cardSubtitleInput, elements.cardSubtitleCount, "subtitle");
  const titleBlock = elements.boardTitle?.parentElement;
  if (titleBlock instanceof HTMLElement && "ResizeObserver" in window) {
    boardTitleResizeObserver?.disconnect();
    boardTitleResizeObserver = new ResizeObserver(() => window.requestAnimationFrame(fitBoardTitle));
    boardTitleResizeObserver.observe(titleBlock);
  }
  // ResizeObserver delivery can lag one frame during a mobile viewport
  // change. Fit synchronously on resize as a guard so a stale desktop size
  // never paints an ellipsis while the card is narrowing.
  window.addEventListener("resize", fitBoardTitle, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(fitBoardTitle);
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    if (imageEditorOpen && event.key === "Escape") {
      event.preventDefault();
      finishImageEditor(false);
      return;
    }
    if (imageEditorOpen && (event.metaKey || event.ctrlKey)) { event.preventDefault(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveState(); showToast("저장했습니다."); }
    const editingCardCopy = event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.matches("input, textarea, select"));
    if (!editingCardCopy && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (document.body.classList.contains("canvas-focus-mode")) $("#focusCanvasButton").click();
      uiPreferences.libraryCollapsed = false;
      syncLibraryPanel();
      saveUiPreferences();
      setMobileLookSearchOpen(true, { focus: window.innerWidth <= 920 });
      if (window.innerWidth > 920) $("#lookSearch").focus();
    }
  });
}

function addLook() {
  const number = looks.length + 1;
  const id = `look-${createAssetKey()}`;
  const look = createBlankLook(number, id);
  looks.push(look);
  captureDefaultLookSnapshots();
  $("#lookSearch").value = "";
  selectLook(id);
  showToast("새 룩을 만들었습니다.");
}

function initialiseLookManager() {
  const dialog = $("#lookManagerDialog");
  const input = $("#lookNameInput");
  const status = $("#lookManagerStatus");
  const duplicate = $("#duplicateLookButton");
  const restore = $("#restoreDeletedLookButton");
  const update = () => {
    input.value = getSelectedLook().title || "새로운 룩";
    input.setCustomValidity("");
    dialog.querySelectorAll('form button, form input, #deleteLookButton').forEach(control => { control.disabled = lookCopyInProgress; });
    duplicate.disabled = lookCopyInProgress;
    duplicate.textContent = lookCopyInProgress ? "복제 중…" : "복제";
    duplicate.setAttribute("aria-busy", String(lookCopyInProgress));
    restore.disabled = lookCopyInProgress || !deletedLooks.length;
    restore.textContent = deletedLooks.length ? `삭제 취소 (${deletedLooks.length})` : "삭제 취소";
  };
  $("#manageLookButton").addEventListener("click", () => {
    setMobileLookSearchOpen(false);
    status.textContent = "";
    update();
    dialog.showModal();
    if (!lookCopyInProgress) { input.focus(); input.select(); }
  });
  $("#closeLookManager").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => $("#manageLookButton").focus({ preventScroll: true }));
  $("#renameLookForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = normaliseInlineText(input.value).slice(0, 64);
    if (!title) { input.setCustomValidity("룩 이름을 입력해주세요."); input.reportValidity(); return; }
    if (getSelectedLook().title !== title) {
      recordHistory();
      getSelectedLook().title = title;
      $("#lookSearch").value = "";
      renderAll();
      saveState();
    }
    dialog.close();
    showToast("룩 이름과 카드 제목을 변경했습니다.");
  });
  input.addEventListener("input", () => input.setCustomValidity(""));
  duplicate.addEventListener("click", async () => {
    if (lookCopyInProgress) return;
    syncStateIntoLook();
    const source = getSelectedLook();
    const snapshot = structuredClone({ ...serializeLook(source), editor: source.editor });
    const epoch = workspaceEpoch;
    const isCurrent = () => epoch === workspaceEpoch && looks.includes(source);
    lookCopyInProgress = true;
    status.textContent = "사진과 편집 내용을 복제하고 있습니다.";
    update();
    try {
      await Promise.all([...pendingAssetWrites]);
      if (!isCurrent()) return;
      const copy = await LookBook.copy(snapshot, { createId: createAssetKey,
        readAsset: characterAssetVault.read, writeAsset: writeCharacterAsset, isCurrent });
      if (!copy || !isCurrent()) return;
      looks.splice(looks.indexOf(source) + 1, 0, copy);
      captureDefaultLookSnapshots();
      $("#lookSearch").value = "";
      if (state.selectedLookId === source.id) selectLook(copy.id);
      else { renderLookList(); saveState(); }
      dialog.close();
      showToast("독립된 사진과 편집 내용을 가진 복사본을 만들었습니다.");
    } catch (error) {
      if (isCurrent()) {
        status.textContent = error.message || "복제하지 못했습니다. 브라우저 저장 공간을 확인해주세요.";
        if (!dialog.open) showToast(status.textContent);
      }
    } finally {
      lookCopyInProgress = false;
      update();
      scheduleAssetCleanup();
    }
  });
  $("#deleteLookButton").addEventListener("click", () => {
    if (lookCopyInProgress) return;
    const source = getSelectedLook();
    const index = looks.indexOf(source);
    syncStateIntoLook(source);
    source.history = state.history;
    source.redo = state.redo;
    deletedLooks.push({ look: source, index });
    let next = looks[index + 1] || looks[index - 1];
    if (!next) { next = createBlankLook(1, `look-${createAssetKey()}`); looks.push(next); }
    selectLook(next.id);
    looks.splice(looks.indexOf(source), 1);
    captureDefaultLookSnapshots();
    $("#lookSearch").value = "";
    renderAll();
    saveState();
    update();
    status.textContent = `“${source.title}”을 삭제했습니다. 삭제 취소로 복원할 수 있습니다.`;
    restore.focus();
  });
  restore.addEventListener("click", () => {
    if (lookCopyInProgress || !deletedLooks.length) return;
    const { look, index } = deletedLooks.pop();
    looks.splice(Math.min(index, looks.length), 0, look);
    captureDefaultLookSnapshots();
    $("#lookSearch").value = "";
    selectLook(look.id);
    update();
    status.textContent = `“${look.title}”을 복원했습니다.`;
    input.focus();
  });
}

async function bootstrap() {
  purgeLegacyStorage();
  restoreUiPreferences();
  syncLibraryPanel();
  loadBackgroundPresets();
  const savedDraft = loadDraft();
  const selectedLook = getSelectedLook();
  // Legacy v3 shared images can only be assigned reliably to the selected look.
  if (!selectedLook.editor) selectedLook.editor = captureEditorState(state);
  for (const look of looks) {
    look.editor ||= defaultLookEditor();
    await restoreCharacterAssets(look.editor.characters, look.editor.characters);
  }
  Object.assign(state, selectedLook.editor);
  syncSelectedCharacter();
  initialiseInteractions();
  document.querySelectorAll("[data-editor-section]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-editor-section]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    const section = document.getElementById(button.dataset.editorSection);
    section?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }));
  const preview = document.querySelector(".canvas-column");
  new ResizeObserver(() => document.documentElement.style.setProperty("--preview-height", `${preview.getBoundingClientRect().height}px`)).observe(preview);
  renderAll();
  openPanel(state.activePanel);
  scheduleAssetCleanup();
}

void bootstrap();

