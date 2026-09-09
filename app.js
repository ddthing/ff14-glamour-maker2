const { create: defaultLookEditor, capture: captureEditorState, normalize: normaliseLookEditor,
  emptyCharacter: createEmptyCharacter, emptyCharacters: createEmptyCharacters,
  normalizeCharacter: ensureCharacterImageState } = LookEditor;

const customBackgroundDefault = "#f7f5f0";

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
  custom: { solid: customBackgroundDefault, pattern: ["#858594", "#ffffff"], label: "직접 지정" },
};

const titleTypography = TitleTypography.create();
const titleFonts = titleTypography.fonts;
const titleFontOrder = titleTypography.fontOrder;
const defaultTitleFont = titleTypography.defaultFont;
const defaultTitleWeight = titleTypography.defaultWeight;
const titleFontSizeMin = 8;
const titleFontSizeMax = 72;
const titleFontSizeStep = 1;
const defaultTitleFontSize = 16;
const subtitleFontSizeMin = 6;
const subtitleFontSizeMax = 48;
const subtitleFontSizeStep = 1;
const defaultSubtitleFontSize = 10;
const defaultSubtitleWeight = 400;

function normaliseTitleFontSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultTitleFontSize;
  const stepped = Math.round(numeric / titleFontSizeStep) * titleFontSizeStep;
  return Math.min(titleFontSizeMax, Math.max(titleFontSizeMin, stepped));
}

function normaliseSubtitleFontSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultSubtitleFontSize;
  const stepped = Math.round(numeric / subtitleFontSizeStep) * subtitleFontSizeStep;
  return Math.min(subtitleFontSizeMax, Math.max(subtitleFontSizeMin, stepped));
}

function normaliseTitleBoolean(value) {
  return value === true || value === "true";
}

function getTitleFontConfig(fontKey = state?.titleFont) {
  return titleTypography.config(fontKey);
}

function normaliseTitleWeight(fontKey, weight) {
  return titleTypography.normalizeWeight(fontKey, weight);
}

function getTitleWeightOptions(fontKey) {
  return titleTypography.weightOptions(fontKey);
}

const copyEditorStyleFields = Object.freeze({
  title: Object.freeze({ font: "titleFont", weight: "titleWeight", fontSize: "titleFontSize", italic: "titleItalic", underline: "titleUnderline", uppercase: "titleUppercase", color: "titleColor" }),
  subtitle: Object.freeze({ font: "subtitleFont", weight: "subtitleWeight", fontSize: "subtitleFontSize", italic: "subtitleItalic", underline: "subtitleUnderline", uppercase: "subtitleUppercase", color: "subtitleColor" }),
});

function getCopyEditorTarget() {
  return elements?.board?.dataset.copyTarget === "subtitle" ? "subtitle" : "title";
}

function getCopyEditorStyle(target = getCopyEditorTarget()) {
  const nextTarget = target === "subtitle" ? "subtitle" : "title";
  const fields = copyEditorStyleFields[nextTarget];
  const fontKey = titleFonts[state[fields.font]] ? state[fields.font] : defaultTitleFont;
  const fontConfig = getTitleFontConfig(fontKey);
  const fontSize = nextTarget === "subtitle"
    ? normaliseSubtitleFontSize(state[fields.fontSize])
    : normaliseTitleFontSize(state[fields.fontSize]);
  const fallbackWeight = nextTarget === "subtitle" ? defaultSubtitleWeight : defaultTitleWeight;
  return {
    target: nextTarget,
    fields,
    fontKey,
    fontConfig,
    fontSize,
    weight: normaliseTitleWeight(fontKey, state[fields.weight] ?? fallbackWeight),
    italic: normaliseTitleBoolean(state[fields.italic]),
    underline: normaliseTitleBoolean(state[fields.underline]),
    uppercase: normaliseTitleBoolean(state[fields.uppercase]),
    color: normaliseOptionalHexColor(state[fields.color]),
  };
}

function populateTitleFontSelect() {
  $$("#titleFontSelect, #textEditorFontSelect").forEach((select) => {
    if (select.dataset.ready === "true") return;
    titleFontOrder.forEach((fontKey) => {
      const option = document.createElement("option");
      option.value = fontKey;
      option.textContent = titleFonts[fontKey].label;
      option.style.fontFamily = titleFonts[fontKey].family;
      select.appendChild(option);
    });
    select.dataset.ready = "true";
  });
}

function syncTitleFontControls() {
  populateTitleFontSelect();
  const selects = $$("#titleFontSelect, #textEditorFontSelect");
  const weightRow = $("#titleWeightRow");
  const optionsHost = $("#titleWeightOptions");
  if (!selects.length) return;
  if (!titleFonts[state.titleFont]) state.titleFont = defaultTitleFont;
  const config = getTitleFontConfig(state.titleFont);
  state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? config.weights[config.weights.length - 1]);
  selects.forEach((select) => {
    select.value = state.titleFont;
    select.style.fontFamily = config.family;
  });
  if (!weightRow || !optionsHost) return;
  optionsHost.style.setProperty("--weight-preview-font", config.family);
  const options = getTitleWeightOptions(state.titleFont);
  weightRow.hidden = options.length === 0;
  const hadWeightFocus = optionsHost.contains(document.activeElement);
  optionsHost.innerHTML = options.map(({ weight, label }) => `
    <button class="title-weight-option${weight === state.titleWeight ? " is-selected" : ""}" type="button" data-title-weight="${weight}" role="radio" aria-checked="${weight === state.titleWeight}" aria-label="${escapeHtml(`${t(`font.weight.${weight}`) || label} ${weight}`)}">
      <span style="font-weight:${weight}">${escapeHtml(t("font.sample"))}</span><small>${escapeHtml(t(`font.weight.${weight}`) || label)}</small>
    </button>
  `).join("");
  if (hadWeightFocus) optionsHost.querySelector('[aria-checked="true"]')?.focus();
}

function syncTitleAlignmentControls() {
  const controls = document.getElementById("titleAlignmentControls");
  if (!controls) return;
  const selectedAlignment = resolveTitleAlign();
  controls.querySelectorAll("[data-title-align]").forEach((button) => {
    const selected = button.dataset.titleAlign === selectedAlignment;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    button.setAttribute("aria-pressed", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

function syncCopyColorControls() {
  const titleOutlineInput = document.getElementById("titleOutlineColorInput");
  if (titleOutlineInput) titleOutlineInput.value = normaliseHexColor(state.titleOutline?.color, "#ffffff");
  const hasCustomTitleColor = Boolean(normaliseOptionalHexColor(state.titleColor));
  [document.getElementById("titleColorInput"), document.getElementById("textEditorColorInput")].forEach((input) => {
    if (!input) return;
    input.value = hasCustomTitleColor ? state.titleColor : defaultTitleColor();
    input.dataset.mode = hasCustomTitleColor ? "custom" : "auto";
  });
  [document.getElementById("titleColorAutoButton"), document.getElementById("textEditorColorAutoButton")].forEach((autoButton) => {
    if (!autoButton) return;
    autoButton.disabled = !hasCustomTitleColor;
    autoButton.setAttribute("aria-pressed", String(!hasCustomTitleColor));
  });
}

function closeTextEditorMoreMenu() {
  const button = document.getElementById("textEditorMoreButton");
  const menu = document.getElementById("textEditorMoreMenu");
  if (!button || !menu) return;
  menu.hidden = true;
  button.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-hidden", "true");
}

function toggleTextEditorMoreMenu() {
  const button = document.getElementById("textEditorMoreButton");
  const menu = document.getElementById("textEditorMoreMenu");
  if (!button || !menu || button.disabled) return;
  const open = menu.hidden;
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) document.getElementById("textEditorOutlineColorInput")?.focus({ preventScroll: true });
}

function syncTextEditorDock() {
  const dock = document.getElementById("textEditorDock");
  if (!dock) return;
  const visible = state.activePanel === "stylePanel" && !imageEditorOpen;
  dock.hidden = !visible;
  if (!visible) {
    closeTextEditorMoreMenu();
    return;
  }

  const style = getCopyEditorStyle();
  const fontSelect = document.getElementById("textEditorFontSelect");
  const boldButton = document.getElementById("textEditorBoldButton");
  const italicButton = document.getElementById("textEditorItalicButton");
  const underlineButton = document.getElementById("textEditorUnderlineButton");
  const uppercaseButton = document.getElementById("textEditorUppercaseButton");
  const colorInput = document.getElementById("textEditorColorInput");
  const colorMark = document.getElementById("textEditorColorMark");
  const outlineButton = document.getElementById("textEditorMoreButton");
  const outlineMenu = document.getElementById("textEditorMoreMenu");
  const outlineColorInput = document.getElementById("textEditorOutlineColorInput");
  const outlineColorMark = document.getElementById("textEditorOutlineColorMark");
  const outlineColorValue = document.getElementById("textEditorOutlineColorValue");
  const outlineRange = document.getElementById("textEditorOutlineRange");
  const outlineRangeValue = document.getElementById("textEditorOutlineRangeValue");
  const outlineStatusValue = document.getElementById("textEditorOutlineValue");
  const isTitleTarget = style.target === "title";
  const titleOutlineColor = normaliseHexColor(state.titleOutline?.color, "#ffffff");
  const titleOutlineWidth = clamp(Number(state.titleOutline?.width), 0, 6, 0);
  if (fontSelect) {
    fontSelect.value = style.fontKey;
    fontSelect.style.fontFamily = style.fontConfig.family;
  }
  if (boldButton) {
    const canToggleWeight = style.fontConfig.weights.length > 1;
    boldButton.disabled = !canToggleWeight;
    boldButton.setAttribute("aria-disabled", String(!canToggleWeight));
    boldButton.setAttribute("aria-pressed", String(style.weight >= 700));
  }
  [[italicButton, style.italic], [underlineButton, style.underline], [uppercaseButton, style.uppercase]].forEach(([button, active]) => {
    if (!button) return;
    button.setAttribute("aria-pressed", String(Boolean(active)));
    button.classList.toggle("is-selected", Boolean(active));
  });
  const copyColor = style.color || defaultTitleColor();
  if (colorInput) {
    colorInput.value = copyColor;
    colorInput.setAttribute("aria-label", style.target === "subtitle" ? t("copy.descriptionTextColor") : t("copy.titleTextColor"));
  }
  if (colorMark) colorMark.style.setProperty("--dock-color", copyColor);
  if (outlineButton) {
    outlineButton.disabled = !isTitleTarget;
    outlineButton.setAttribute("aria-disabled", String(!isTitleTarget));
    outlineButton.classList.toggle("is-selected", isTitleTarget && titleOutlineWidth > 0);
    const outlineLabel = t(isTitleTarget ? "copy.dockOutline" : "copy.onlyTitle");
    outlineButton.setAttribute("aria-label", outlineLabel);
    outlineButton.setAttribute("title", outlineLabel);
  }
  if (!isTitleTarget && outlineMenu && !outlineMenu.hidden) closeTextEditorMoreMenu();
  if (outlineMenu) outlineMenu.setAttribute("aria-hidden", String(!isTitleTarget || outlineMenu.hidden));
  if (outlineColorInput) {
    outlineColorInput.value = titleOutlineColor;
    outlineColorInput.setAttribute("aria-label", t("copy.titleOutlineDirect"));
  }
  if (outlineColorMark) outlineColorMark.style.setProperty("--dock-outline-color", titleOutlineColor);
  if (outlineColorValue) outlineColorValue.textContent = titleOutlineColor.toUpperCase();
  if (outlineRange) {
    outlineRange.value = String(titleOutlineWidth);
    updateRangeProgress(outlineRange);
    outlineRange.setAttribute("aria-valuetext", titleOutlineWidth ? `${titleOutlineWidth} px` : t("range.none"));
  }
  if (outlineRangeValue) outlineRangeValue.textContent = titleOutlineWidth ? `${titleOutlineWidth} px` : t("range.none");
  if (outlineStatusValue) outlineStatusValue.textContent = titleOutlineWidth ? `${titleOutlineWidth} px` : t("range.none");
  const selectedAlignment = resolveTitleAlign();
  document.querySelectorAll("[data-floating-align]").forEach((button) => {
    const selected = button.dataset.floatingAlign === selectedAlignment;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

function setCopyEditorTarget(target = "title") {
  const nextTarget = target === "subtitle" ? "subtitle" : "title";
  elements.board?.setAttribute("data-copy-target", nextTarget);
  const targetLabel = document.getElementById("copyEditorTarget");
  const translationKey = nextTarget === "subtitle" ? "copy.cardDescription" : "copy.cardTitle";
  [targetLabel, document.getElementById("textEditorDockTargetLabel")].forEach((label) => {
    if (!label) return;
    label.dataset.i18n = translationKey;
    label.textContent = t(translationKey);
  });
  syncTextEditorDock();
}

let copyFontLoadSequence = 0;
function waitForCopyFont(fontKey, fields) {
  if (typeof document.fonts?.load !== "function") return;
  const sequence = ++copyFontLoadSequence;
  const board = elements.board;
  const fontConfig = getTitleFontConfig(fontKey);
  const weight = normaliseTitleWeight(fontKey, state[fields.weight]);
  if (board) board.dataset.copyFontPending = "true";

  const ready = new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(finish, 8000);
    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    }
    try {
      Promise.resolve(document.fonts.load(`${weight} 64px ${fontConfig.family}`)).then(finish, finish);
    } catch {
      finish();
    }
  });

  ready.then(() => {
    if (sequence !== copyFontLoadSequence) return;
    if (state[fields.font] !== fontKey) {
      board?.removeAttribute("data-copy-font-pending");
      fitBoardTitle();
      scheduleCardCopyPreview();
      return;
    }
    board?.removeAttribute("data-copy-font-pending");
    fitBoardTitle();
    scheduleCardCopyPreview();
  });
}

function setCopyEditorFont(value, target = getCopyEditorTarget()) {
  const style = getCopyEditorStyle(target);
  const nextFont = titleFonts[value] ? value : defaultTitleFont;
  if (nextFont === style.fontKey) return;
  recordHistory();
  state[style.fields.font] = nextFont;
  state[style.fields.weight] = getTitleFontConfig(nextFont).weights.at(-1);
  waitForCopyFont(nextFont, style.fields);
  renderStyles({ refreshInfo: false, refreshPattern: false });
  saveState();
}

function setTitleFont(value) {
  setCopyEditorFont(value, "title");
}

function setTextEditorFont(value) {
  setCopyEditorFont(value, getCopyEditorTarget());
}

function toggleCopyEditorBold(target = getCopyEditorTarget()) {
  const style = getCopyEditorStyle(target);
  const weights = getTitleWeightOptions(style.fontKey).map(({ weight }) => weight);
  if (!weights.length) return;
  const currentWeight = style.weight;
  const nextWeight = currentWeight >= 700
    ? (weights.find((weight) => weight < 700) ?? weights[0])
    : (weights.find((weight) => weight >= 700) ?? weights.at(-1));
  if (nextWeight === currentWeight) return;
  recordHistory();
  state[style.fields.weight] = normaliseTitleWeight(style.fontKey, nextWeight);
  renderStyles({ refreshInfo: false, refreshPattern: false });
  saveState();
}

function toggleTitleBold() {
  toggleCopyEditorBold("title");
}

function toggleCopyEditorInlineStyle(styleName, target = getCopyEditorTarget()) {
  if (!["italic", "underline", "uppercase"].includes(styleName)) return;
  const style = getCopyEditorStyle(target);
  recordHistory();
  state[style.fields[styleName]] = !normaliseTitleBoolean(state[style.fields[styleName]]);
  renderStyles({ refreshInfo: false, refreshPattern: false });
  saveState();
}

function toggleTitleInlineStyle(field) {
  const styleName = { titleItalic: "italic", titleUnderline: "underline", titleUppercase: "uppercase" }[field];
  toggleCopyEditorInlineStyle(styleName, "title");
}

function toggleTextEditorBold() {
  toggleCopyEditorBold(getCopyEditorTarget());
}

function toggleTextEditorInlineStyle(styleName) {
  toggleCopyEditorInlineStyle(styleName, getCopyEditorTarget());
}

function resetCopyEditorColorToAuto(target = getCopyEditorTarget()) {
  const style = getCopyEditorStyle(target);
  if (!style.color) return;
  recordHistory();
  state[style.fields.color] = "";
  renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  saveState();
}

function resetTitleColorToAuto() {
  resetCopyEditorColorToAuto("title");
}

function resetTextEditorColorToAuto() {
  resetCopyEditorColorToAuto(getCopyEditorTarget());
}

// Kept only to migrate legacy style recipes stored inside old drafts.
// These values never appear as a second theme gallery in the editor.
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

function getBackgroundTheme(source = state) {
  const backgroundKey = backgrounds[source?.background] ? source.background : "paper";
  const base = backgrounds[backgroundKey];
  if (backgroundKey !== "custom") return base;
  const solid = normaliseHexColor(source?.customBackgroundColor, customBackgroundDefault);
  const contrast = ColorContrast.themeFor(solid);
  const muted = contrast.foreground === "#ffffff" ? "rgba(255, 255, 255, .66)" : "rgba(17, 17, 17, .66)";
  return {
    ...base,
    solid,
    pattern: [contrast.foreground, muted],
  };
}

function getExportTheme(source = state) {
  const background = getBackgroundTheme(source);
  const isDark = ColorContrast.themeFor(background.solid).foreground === "#ffffff";
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

function getSilhouetteInfoTheme(background) {
  return ColorContrast.themeFor(background?.solid);
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

const backgroundPatternOptions = new Set(["none", "dots", "stars", "halftone", "bitmap", "collage", "scrapbook"]);
const legacyBackgroundPatternAliases = Object.freeze({ index: "collage" });
const backgroundSurfaceAssets = Object.freeze({
  collage: CardMaterials.get("collage").asset,
  scrapbook: CardMaterials.get("scrapbook").asset,
});
const backgroundTextureOptions = new Set(["none", "grain"]);
const storageNamespace = "tuyeong-set-maker2";
const languagePreferenceStorageKey = `${storageNamespace}-language-v1`;
const draftStorageKey = `${storageNamespace}-draft-v3`;
const uiPreferencesStorageKey = `${storageNamespace}-ui-v2`;
const legacyStorageMigrations = [
  { source: "glamour-atelier-draft-v3", target: draftStorageKey },
  { source: "glamour-atelier-ui-v2", target: uiPreferencesStorageKey },
];
const legacyStorageKeys = [
  "glamour-atelier-draft-v1",
  "glamour-atelier-draft-v2",
  "glamour-atelier-draft-v3",
  "glamour-atelier-ui-v1",
  "glamour-atelier-ui-v2",
  "tuyeong-set-maker2-background-presets-v2",
  "glamour-atelier-background-presets-v1",
  "glamour-atelier-background-presets-v2",
];

function describeBackgroundSelection(source = state) {
  const patternLabel = source.backgroundPattern === "none"
    ? t("background.patternNone")
    : t(`pattern.${source.backgroundPattern}`);
  const textureLabel = source.backgroundTexture === "none"
    ? t("background.textureNone")
    : t(`texture.${source.backgroundTexture}`);
  return [
    source.background === "custom"
      ? t("background.customWithColor", { color: source.customBackgroundColor.toUpperCase() })
      : t(`background.${source.background}`),
    patternLabel,
    textureLabel,
  ].join(" · ");
}

// The editor receives item records from the server search adapter. Keeping a
// built-in catalog here made the first render look finished with fabricated
// outfits and caused test data to leak into production drafts.
const outfitSlots = ["head", "body", "hands", "legs", "feet"];
const itemRecordCache = ItemRecords.create({ slots: outfitSlots });
const itemSearchState = {
  timer: null,
  mode: "idle",
};
// The search API currently returns eight matches. Keep a wider safety window
// for future pagination, but never let an unexpectedly large payload create an
// unbounded DOM subtree or eager image workload in the inspector.
const catalogRenderLimit = 24;
const itemSearch = ItemSearch.create({ fetch: (...args) => fetch(...args) });

const outfitSlotNamesByLanguage = {
  ko: { head: "머리", body: "몸", hands: "손", legs: "다리", feet: "발", weapon: "무기" },
  en: { head: "Head", body: "Body", hands: "Hands", legs: "Legs", feet: "Feet", weapon: "Weapon" },
  ja: { head: "頭", body: "胴", hands: "手", legs: "脚", feet: "足", weapon: "武器" },
};
const outfitSlotNames = outfitSlotNamesByLanguage.ko;
function getOutfitSlotName(slot, language = state.language) {
  return outfitSlotNamesByLanguage[language]?.[slot] || outfitSlotNames[slot] || I18n.t("item.section", {}, language);
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

function normaliseOutfit(outfit = {}) {
  return Object.fromEntries(outfitSlots.map((slot) => {
    const value = outfit?.[slot];
    const itemId = String(value ?? "");
    return [slot, /^\d{1,32}$/.test(itemId) ? itemId : null];
  }));
}

function cloneOutfits(outfits) {
  return (outfits || []).map((outfit) => normaliseOutfit(outfit));
}

function outfitToItemIds(outfit) {
  return outfitSlots.map((slot) => outfit?.[slot]).filter(Boolean);
}

// Outfit collections are normalized at every external boundary (load, copy,
// reset, and mutation). Keep the hot read path allocation-free between those
// boundaries; WeakSet avoids adding bookkeeping fields to persisted looks.
const normalizedOutfitCollections = new WeakSet();

function ensureLookOutfits(look) {
  if (!Array.isArray(look.outfits) || !look.outfits.length) {
    look.outfits = createOutfits(look.itemIds || []);
  }
  while (look.outfits.length < 5) {
    look.outfits.push(createOutfit(look.itemIds || []));
  }
  if (look.outfits.length > 5 || !normalizedOutfitCollections.has(look.outfits)) {
    look.outfits = look.outfits.slice(0, 5).map((outfit) => normaliseOutfit(outfit));
    normalizedOutfitCollections.add(look.outfits);
  }
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
    customBackgroundColor: customBackgroundDefault,
    backgroundPattern: "none",
    backgroundTexture: "none",
    titleFont: defaultTitleFont,
    titleWeight: defaultTitleWeight,
    titleFontSize: defaultTitleFontSize,
    titleItalic: false,
    titleUnderline: false,
    titleUppercase: false,
    titleAlign: "auto",
    titleColor: "",
    subtitleFont: defaultTitleFont,
    subtitleWeight: defaultSubtitleWeight,
    subtitleFontSize: defaultSubtitleFontSize,
    subtitleItalic: false,
    subtitleUnderline: false,
    subtitleUppercase: false,
    subtitleColor: "",
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
    customBackgroundColor: blank.customBackgroundColor,
    backgroundPattern: blank.backgroundPattern,
    backgroundTexture: blank.backgroundTexture,
    titleFontSize: blank.titleFontSize,
    titleItalic: blank.titleItalic,
    titleUnderline: blank.titleUnderline,
    titleUppercase: blank.titleUppercase,
    titleAlign: blank.titleAlign,
    titleColor: blank.titleColor,
    subtitleFont: blank.subtitleFont,
    subtitleWeight: blank.subtitleWeight,
    subtitleFontSize: blank.subtitleFontSize,
    subtitleItalic: blank.subtitleItalic,
    subtitleUnderline: blank.subtitleUnderline,
    subtitleUppercase: blank.subtitleUppercase,
    subtitleColor: blank.subtitleColor,
  };
}

function captureDefaultLookSnapshots() {
  defaultLookSnapshots = new Map(looks.map((look, index) => [look.id, createLookResetSnapshot(look, index)]));
}

captureDefaultLookSnapshots();

function t(key, variables = {}, language = state?.language) {
  return I18n.t(key, variables, language || I18n.fallbackLanguage);
}

function getDocumentTitle(look = getSelectedLook()) {
  return `${t("project.name")} | ${getLookTitle(look)}`;
}

function getUserFacingError(error, fallbackKey) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (!message) return t(fallbackKey);
  if (state.language === "ko" && /[가-힣]/.test(message)) return message;
  const dictionary = I18n.dictionaries[state.language] || {};
  const isCurrentLanguageMessage = Object.values(dictionary).some((value) => value === message);
  return isCurrentLanguageMessage ? message : t(fallbackKey);
}

function readLanguagePreference() {
  try {
    const saved = localStorage.getItem(languagePreferenceStorageKey);
    return I18n.supportedLanguages.includes(saved) ? saved : "";
  } catch {
    return "";
  }
}

function getInitialLanguage() {
  return readLanguagePreference() || I18n.detectLanguage();
}

function persistLanguagePreference(language) {
  try { localStorage.setItem(languagePreferenceStorageKey, I18n.normaliseLanguage(language)); } catch {
    // The editor can still use the detected language for this session.
  }
}

function getDefaultLookTitle(language = state?.language) {
  return I18n.t("look.defaultTitle", {}, language || I18n.fallbackLanguage);
}

function isDefaultLookTitle(title) {
  return !title || String(title).trim() === "새로운 룩";
}

const state = {
  language: getInitialLanguage(),
  selectedLookId: "look-1",
  activeSlot: "head",
  activePanel: "stylePanel",
  characterCount: 1,
  selectedCharacter: 0,
  characters: createEmptyCharacters(),
  background: "paper",
  customBackgroundColor: customBackgroundDefault,
  multiInfoEnabled: true,
  multiInfoMode: "clear",
  titleFont: defaultTitleFont,
  titleWeight: defaultTitleWeight,
  titleFontSize: defaultTitleFontSize,
  titleItalic: false,
  titleUnderline: false,
    titleUppercase: false,
    titleAlign: "auto",
    titleColor: "",
    subtitleFont: defaultTitleFont,
    subtitleWeight: defaultSubtitleWeight,
    subtitleFontSize: defaultSubtitleFontSize,
    subtitleItalic: false,
    subtitleUnderline: false,
    subtitleUppercase: false,
    subtitleColor: "",
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
  focalPoint: null,
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
  boardCopyCanvas: $("#boardCopyCanvas"),
  stageComposition: document.querySelector(".stage-composition"),
  textEditorFontSelect: $("#textEditorFontSelect"),
  textEditorColorInput: $("#textEditorColorInput"),
  canvasViewZoomRange: $("#canvasViewZoomRange"),
  canvasViewZoomReadout: $("#canvasViewZoomReadout"),
  canvasViewZoomOut: $("#canvasViewZoomOut"),
  canvasViewZoomIn: $("#canvasViewZoomIn"),
  canvasViewFitButton: $("#canvasViewFitButton"),
  canvasViewFocusButton: $("#canvasViewFocusButton"),
  boardCopyright: $("#boardCopyright"),
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
  saveRetryButton: $("#saveRetryButton"),
  outlineColorInput: $("#outlineColorInput"),
  outlineColorPicker: $("#outlineColorPicker"),
  outlineColorValue: $("#outlineColorValue"),
  outlineRange: $("#outlineRange"),
  outlineValue: $("#outlineValue"),
  titleOutlineRange: $("#titleOutlineRange"),
  titleOutlineValue: $("#titleOutlineValue"),
  textEditorOutlineRange: $("#textEditorOutlineRange"),
  textEditorOutlineRangeValue: $("#textEditorOutlineRangeValue"),
  textEditorOutlineValue: $("#textEditorOutlineValue"),
  textEditorOutlineColorInput: $("#textEditorOutlineColorInput"),
  textEditorOutlineColorMark: $("#textEditorOutlineColorMark"),
  textEditorOutlineColorValue: $("#textEditorOutlineColorValue"),
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

function getLookTitle(look = getSelectedLook(), language = state.language) {
  const value = typeof look?.title === "string" ? look.title.trim() : "";
  return isDefaultLookTitle(value) ? getDefaultLookTitle(language) : value;
}

function applyPageLanguage(language = state.language) {
  state.language = I18n.normaliseLanguage(language);
  I18n.apply(document, state.language);
  document.documentElement.lang = state.language;
  document.documentElement.dataset.language = state.language;
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  if (typeof syncCanvasFocusControls === "function") syncCanvasFocusControls(document.body.classList.contains("canvas-focus-mode"));
  syncLibraryPanel();
  if (typeof openPanel === "function") openPanel(state.activePanel);
  return state.language;
}

function setExportButtonLabel(key) {
  const button = document.getElementById("exportButton");
  if (!button) return;
  const label = button.querySelector("span[data-i18n]");
  if (!label) return;
  label.dataset.i18n = key;
  label.textContent = t(key);
}

let toastTimer;
let styleAdvancedOpen = false;
const canvasViewZoomMin = 50;
const canvasViewZoomMax = 150;
const canvasViewZoomStep = 5;
const canvasViewZoomDefault = 100;
const uiPreferences = { libraryCollapsed: true, canvasViewZoom: canvasViewZoomDefault };
let imageEditorOpen = false;
let imageEditorSnapshot = null;
let imageEditorDirty = false;
let imageEditorReturnFocus = null;
let boardTitleResizeObserver = null;
let canvasViewResizeObserver = null;
let cardCopyRenderFrame = 0;
let boardTitleFitFrame = 0;
let liveStyleRenderFrame = 0;
let liveStyleRenderOptions = null;
let cutoutProcessingKey = "cutout.processing";
let cutoutProgress = null;

const panelLabels = {
  stylePanel: "mode.style",
  itemsPanel: "mode.items",
};
const editorNavigation = EditorNavigation.create({
  panels: Object.keys(panelLabels),
  defaultPanel: "stylePanel",
});

function restoreUiPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(uiPreferencesStorageKey) || "null");
    uiPreferences.libraryCollapsed = saved ? Boolean(saved.libraryCollapsed) : true;
    uiPreferences.canvasViewZoom = normaliseCanvasViewZoom(saved?.canvasViewZoom);
  } catch {
    uiPreferences.libraryCollapsed = true;
    uiPreferences.canvasViewZoom = canvasViewZoomDefault;
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(uiPreferencesStorageKey, JSON.stringify({
      libraryCollapsed: uiPreferences.libraryCollapsed,
      canvasViewZoom: uiPreferences.canvasViewZoom,
    }));
  } catch {
    // The workspace remains usable when browser storage is unavailable.
  }
}

function normaliseCanvasViewZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return canvasViewZoomDefault;
  const stepped = Math.round(numeric / canvasViewZoomStep) * canvasViewZoomStep;
  return Math.min(canvasViewZoomMax, Math.max(canvasViewZoomMin, stepped));
}

function getCanvasViewScale() {
  return normaliseCanvasViewZoom(uiPreferences.canvasViewZoom) / 100;
}

function syncCanvasViewZoomControl() {
  const zoom = normaliseCanvasViewZoom(uiPreferences.canvasViewZoom);
  uiPreferences.canvasViewZoom = zoom;
  if (elements.stageComposition) {
    const scale = zoom / 100;
    const baseHeight = elements.board?.offsetHeight || 0;
    elements.stageComposition.style.removeProperty("zoom");
    elements.stageComposition.style.transform = `scale(${scale})`;
    elements.stageComposition.style.transformOrigin = "center top";
    if (baseHeight > 0) {
      const layoutHeight = scale > 1 ? baseHeight : baseHeight * scale;
      elements.stageComposition.style.height = `${Math.ceil(layoutHeight)}px`;
      elements.stageComposition.style.marginBottom = scale > 1 ? `${Math.ceil(baseHeight * (scale - 1))}px` : "";
    }
    elements.stageComposition.dataset.viewZoom = String(zoom);
  }
  if (elements.canvasViewZoomRange) {
    elements.canvasViewZoomRange.value = String(zoom);
    updateRangeProgress(elements.canvasViewZoomRange);
    elements.canvasViewZoomRange.setAttribute("aria-valuetext", `${zoom}%`);
  }
  if (elements.canvasViewZoomReadout) elements.canvasViewZoomReadout.textContent = `${zoom}%`;
  if (elements.canvasViewZoomOut) elements.canvasViewZoomOut.disabled = zoom <= canvasViewZoomMin;
  if (elements.canvasViewZoomIn) elements.canvasViewZoomIn.disabled = zoom >= canvasViewZoomMax;
}

function setCanvasViewZoom(value, { persist = true } = {}) {
  uiPreferences.canvasViewZoom = normaliseCanvasViewZoom(value);
  syncCanvasViewZoomControl();
  if (persist) saveUiPreferences();
}

function resetCanvasViewZoom() {
  setCanvasViewZoom(canvasViewZoomDefault);
}

function syncCanvasFocusControls(focused) {
  const label = t(focused ? "canvas.normal" : "canvas.focus");
  [$("#focusCanvasButton"), elements.canvasViewFocusButton].forEach((button) => {
    if (!button) return;
    button.setAttribute("aria-pressed", String(focused));
    button.setAttribute("aria-label", label);
    button.title = label;
    button.classList.toggle("is-active", focused);
  });
}

function setCanvasFocusMode(focused) {
  document.body.classList.toggle("canvas-focus-mode", focused);
  syncCanvasFocusControls(focused);
}

function migrateLegacyStorage() {
  legacyStorageMigrations.forEach(({ source, target }) => {
    try {
      if (localStorage.getItem(target) !== null) return;
      const saved = localStorage.getItem(source);
      if (saved !== null) localStorage.setItem(target, saved);
    } catch {
      // A blocked storage area should not prevent the editor from opening.
    }
  });
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
  const libraryLabel = collapsed ? t("library.expand") : t("library.collapse");
  button.setAttribute("aria-label", libraryLabel);
  button.title = libraryLabel;
  const key = button.querySelector(".tool-key");
  const label = button.querySelector("small");
  if (key) key.textContent = collapsed ? "›" : "‹";
  if (label) label.textContent = libraryLabel;
}

function toggleLibraryPanel() {
  uiPreferences.libraryCollapsed = !uiPreferences.libraryCollapsed;
  syncLibraryPanel();
  saveUiPreferences();
}

function getSelectedLook() {
  return looks.find((look) => look.id === state.selectedLookId) || looks[0];
}

// Most saves touch only the selected look. Keep normalized snapshots for the
// other looks so a large look book does not repeatedly clone every untouched
// editor state before the draft persistence write.
const serializedLookCache = new WeakMap();

function syncStateIntoLook(look = getSelectedLook()) {
  if (!look) return;
  serializedLookCache.delete(look);
  look.editor = captureEditorState(state);
  look.background = backgrounds[state.background] ? state.background : "paper";
  look.customBackgroundColor = normaliseHexColor(state.customBackgroundColor, customBackgroundDefault);
  look.backgroundPattern = normaliseBackgroundPattern(state.backgroundPattern);
  look.backgroundTexture = backgroundTextureOptions.has(state.backgroundTexture) ? state.backgroundTexture : "none";
  look.titleFont = titleFonts[state.titleFont] ? state.titleFont : defaultTitleFont;
  look.titleWeight = normaliseTitleWeight(look.titleFont, state.titleWeight ?? defaultTitleWeight);
  look.titleFontSize = normaliseTitleFontSize(state.titleFontSize);
  look.titleItalic = normaliseTitleBoolean(state.titleItalic);
  look.titleUnderline = normaliseTitleBoolean(state.titleUnderline);
  look.titleUppercase = normaliseTitleBoolean(state.titleUppercase);
  look.titleAlign = normaliseTitleAlign(state.titleAlign);
  look.titleColor = normaliseOptionalHexColor(state.titleColor);
  look.subtitleFont = titleFonts[state.subtitleFont] ? state.subtitleFont : defaultTitleFont;
  look.subtitleWeight = normaliseTitleWeight(look.subtitleFont, state.subtitleWeight ?? defaultSubtitleWeight);
  look.subtitleFontSize = normaliseSubtitleFontSize(state.subtitleFontSize);
  look.subtitleItalic = normaliseTitleBoolean(state.subtitleItalic);
  look.subtitleUnderline = normaliseTitleBoolean(state.subtitleUnderline);
  look.subtitleUppercase = normaliseTitleBoolean(state.subtitleUppercase);
  look.subtitleColor = normaliseOptionalHexColor(state.subtitleColor);
  look.outline = normaliseOutline(state.outline, "#f1dfbb", 8);
  look.titleOutline = normaliseOutline(state.titleOutline, "#ffffff", 6);
  look.outfits = cloneOutfits(getLookOutfits(look));
  look.itemIds = outfitToItemIds(look.outfits[0]);
}

function getItem(itemId) {
  return itemRecordCache.get(String(itemId)) || null;
}

function serializeItemRecord(item) {
  return itemRecordCache.serialize(item);
}

function getPersistedItemRecords() {
  return itemRecordCache.persistedRecords(looks);
}

function registerItemRecords(items = []) {
  itemRecordCache.register(items);
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
  if (!item) return I18n.t("item.emptyName", {}, language);
  return item.names?.[language] || item.names?.ko || item.names?.en || item.names?.ja || `${I18n.t("item.section", {}, language)} ${item.id}`;
}

function getSecondaryItemName(item, language = state.language) {
  if (!item || !["ko", "ja"].includes(language)) return "";
  const primaryName = getItemName(item, language);
  const englishName = String(item.names?.en || "").trim();
  return englishName && englishName !== primaryName ? englishName : "";
}

function getItemMeta(item, language = state.language) {
  if (!item) return I18n.t("item.emptyHint", {}, language);
  return item.meta?.[language] || item.meta?.ko || item.meta?.en || item.meta?.ja || I18n.t("item.section", {}, language);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getItemImageUrl(item) {
  const value = String(item?.iconUrl || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" || !["xivapi.com", "www.xivapi.com", "v2.xivapi.com"].includes(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function renderItemImage(item, fallbackSlot = item?.slot, { loading = "eager" } = {}) {
  const imageUrl = getItemImageUrl(item);
  if (!imageUrl) return renderEquipmentIcon(fallbackSlot);
  return `<img class="item-image" src="${escapeHtml(imageUrl)}" alt="" loading="${loading === "lazy" ? "lazy" : "eager"}" decoding="async" referrerpolicy="no-referrer"><span class="item-image-fallback" aria-hidden="true">${renderEquipmentIcon(fallbackSlot)}</span>`;
}

function renderCharacterImage(source, { alt = "", loading = "lazy" } = {}) {
  if (!source) return "";
  const priority = loading === "eager" ? "eager" : "lazy";
  return `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="${priority}" decoding="async" draggable="false" />`;
}

function bindItemImageFallbacks(container) {
  container.querySelectorAll("img.item-image").forEach((image) => {
    const markFallback = () => image.closest(".equipment-icon, .catalog-result-icon")?.classList.add("is-image-fallback");
    image.addEventListener("error", markFallback, { once: true });
    // A cached failure can complete before the listener is attached after a
    // catalog re-render. Only then expose the slot glyph as a real fallback.
    if (image.complete && image.naturalWidth === 0) markFallback();
  });
}

function renderCatalogIcon(item, index = 0) {
  // The API currently returns at most eight rows. Keep those immediately
  // visible icons eager, but protect the list from eager-loading an unusually
  // large response (or a future pagination change) past the first viewport.
  return renderItemImage(item, item?.slot, { loading: index < 8 ? "eager" : "lazy" });
}

function renderEquipmentIcon(slot) {
  const label = escapeHtml(getOutfitSlotName(slot));
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
  return CardLayout.ratioFor(state.characterCount, state.singleRatio);
}

function getBackgroundSurfaceCss(background) {
  return background.solid;
}

function normaliseBackgroundPattern(value) {
  const restoredPattern = legacyBackgroundPatternAliases[value] || value;
  return backgroundPatternOptions.has(restoredPattern) ? restoredPattern : "none";
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

  state.backgroundPattern = normaliseBackgroundPattern(restoredPattern);
  state.backgroundTexture = backgroundTextureOptions.has(restoredTexture) ? restoredTexture : "none";
}

function getExportDimensions() {
  return CardLayout.dimensionsFor(state.characterCount, state.singleRatio);
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

const characterAssetVault = ImageAssets.create({
  indexedDB: window.indexedDB,
  legacyDatabaseNames: ["glamour-atelier-assets-v1"],
});
const draftStorage = DraftStorage.create({
  localStorage: window.localStorage,
  indexedDB: window.indexedDB,
  databaseName: `${storageNamespace}-drafts-v1`,
});

let assetCleanupTimer;
let workspaceEpoch = 0;
const pendingAssetWrites = new Set();
const pendingImageImports = new Map();
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
    if (exportInProgress || lookCopyInProgress || pendingAssetWrites.size || pendingImageImports.size || $("#cutoutButton")?.classList.contains("is-processing")) { scheduleAssetCleanup(); return; }
    const snapshots = [state, ...state.history, ...state.redo,
      ...[...looks, ...deletedLooks.map(entry => entry.look)].flatMap(look => [look.editor, ...(look.history || []), ...(look.redo || [])])];
    const characters = snapshots.flatMap(snapshot => snapshot?.characters || []);
    const liveKeys = new Set(characters.map(character => character.assetKey).filter(Boolean));
    const liveUrls = new Set(characters.flatMap(character => [character.src, character.originalSrc]));
    for (const url of assetUrls) if (!liveUrls.has(url)) { revokeObjectUrl(url); assetUrls.delete(url); }
    void characterAssetVault.prune(liveKeys).catch(() => {});
  }, 1000);
}

function imageImportTargetKey(look, characterIndex) {
  return `${look.id}\u0000${characterIndex}`;
}

function disposeImageImport(transaction) {
  revokeObjectUrl(transaction.nextCharacter?.src);
  assetUrls.delete(transaction.nextCharacter?.src);
  scheduleAssetCleanup();
}

function invalidatePendingImageImports({ look = null, characterIndex = null } = {}) {
  for (const [targetKey, transaction] of pendingImageImports) {
    if (look && transaction.look !== look) continue;
    if (characterIndex !== null && transaction.targetIndex !== characterIndex) continue;
    pendingImageImports.delete(targetKey);
    disposeImageImport(transaction);
  }
}

function isCurrentImageImport(transaction) {
  return transaction.operationEpoch === workspaceEpoch
    && pendingImageImports.get(transaction.targetKey) === transaction;
}

function releaseImageImport(transaction) {
  if (pendingImageImports.get(transaction.targetKey) === transaction) pendingImageImports.delete(transaction.targetKey);
}

function ensureLookEditorCharacters(look) {
  if (!look.editor || !Array.isArray(look.editor.characters)) look.editor = defaultLookEditor();
  while (look.editor.characters.length < 5) look.editor.characters.push(LookEditor.emptyCharacter());
  return look.editor.characters;
}

function commitImageImport(transaction) {
  const { look, targetIndex, nextCharacter } = transaction;
  if (getSelectedLook() === look) {
    state.characters[targetIndex] = nextCharacter;
    if (targetIndex === state.selectedCharacter) syncSelectedCharacter();
    syncStateIntoLook(look);
    return;
  }
  ensureLookEditorCharacters(look)[targetIndex] = { ...nextCharacter };
  LookEditor.normalizeCharacter(look.editor.characters[targetIndex]);
  serializedLookCache.delete(look);
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

function normaliseOutline(value, fallbackColor, maxWidth) {
  return {
    color: normaliseHexColor(value?.color, fallbackColor),
    width: clamp(value?.width, 0, maxWidth, 0),
  };
}

function normaliseHexColor(value, fallback = "") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

function normaliseOptionalHexColor(value) {
  return normaliseHexColor(value, "");
}

function normaliseTitleAlign(value) {
  return ["auto", "left", "center", "right"].includes(value) ? value : "auto";
}

function resolveTitleAlign() {
  if (state.titleAlign !== "auto") return state.titleAlign;
  if (state.characterCount === 1 && state.singleRatio === "portrait") return "center";
  if (state.characterCount >= 2) return "center";
  if (state.characterCount === 1 && state.singleLayout === "info-right") return "right";
  return "left";
}

function defaultTitleColor() {
  const background = getBackgroundTheme();
  return ColorContrast.themeFor(background.solid).foreground === "#ffffff" ? "#f7f3ed" : "#263238";
}

function serializeCharacter(character = {}) {
  const normalized = {
    ...LookEditor.emptyCharacter(),
    ...character,
    assetKey: typeof character.assetKey === "string" && character.assetKey.length <= 160 ? character.assetKey : null,
    fileName: typeof character.fileName === "string" ? character.fileName.slice(0, 160) : "이미지를 추가하세요",
    fileMeta: typeof character.fileMeta === "string" ? character.fileMeta.slice(0, 240) : "PNG, JPG 또는 WebP · 아직 선택하지 않음",
    cutout: character.cutout === true,
  };
  LookEditor.normalizeCharacter(normalized);
  return {
    assetKey: normalized.assetKey,
    fileName: normalized.fileName,
    fileMeta: normalized.fileMeta,
    cutout: normalized.cutout,
    imageFit: normalized.imageFit,
    zoom: normalized.zoom,
    panX: normalized.panX,
    panY: normalized.panY,
    focalPoint: normalized.focalPoint ? { ...normalized.focalPoint } : null,
  };
}


function getCharacterImageState(character) {
  return ensureCharacterImageState(character || state.characters[0]) || {
    imageFit: "contain",
    zoom: 100,
    panX: 0,
    panY: 0,
    focalPoint: null,
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
  state.focalPoint = character.focalPoint ? { ...character.focalPoint } : null;
  return character;
}

function isImagePlacementChanged(snapshot = imageEditorSnapshot) {
  if (!snapshot) return false;
  return state.zoom !== snapshot.zoom
    || state.panX !== snapshot.panX
    || state.panY !== snapshot.panY
    || state.imageFit !== snapshot.imageFit
    || state.focalPoint?.x !== snapshot.focalPoint?.x
    || state.focalPoint?.y !== snapshot.focalPoint?.y;
}

function syncImagePlacementSummary() {
  if (elements.imagePlacementSummary) {
    const placement = state.panX === 0 && state.panY === 0 ? t("image.defaultPosition") : t("image.customPosition");
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
  elements.portraitWrap?.setAttribute("aria-label", t("canvas.editingPlacement"));
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
    const { zoom, panX, panY, imageFit, focalPoint } = imageEditorSnapshot;
    updateSelectedImageState({ zoom, panX, panY, imageFit, focalPoint });
    renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  }
  imageEditorOpen = false;
  imageEditorDirty = false;
  imageEditorSnapshot = null;
  document.body.classList.remove("image-placement-mode");
  elements.imageEditorDialog.hidden = true;
  elements.openImageEditorButton?.setAttribute("aria-expanded", "false");
  elements.portraitWrap?.setAttribute("aria-label", t("canvas.characters"));
  elements.portraitWrap?.classList.remove("is-dragging");
  elements.portraitWrap?.querySelector(".character-figure[aria-describedby=\"imageEditorDescription\"]")?.removeAttribute("aria-describedby");
  imageEditorReturnFocus?.focus?.({ preventScroll: true });
  imageEditorReturnFocus = null;
  if (apply && changed) showToast(t("toast.placementApplied"));
}

async function restoreCharacterAssets(savedCharacters = [], characters = state.characters, { sync = true } = {}) {
  const restoreJobs = characters.map(async (character, index) => {
    const saved = savedCharacters[index];
    if (!saved?.assetKey) return;
    character.assetKey = saved.assetKey;
    character.fileName = saved.fileName || character.fileName;
    character.fileMeta = saved.fileMeta || character.fileMeta;
    character.cutout = saved.cutout === true;
    character.focalPoint = saved.focalPoint ? { ...saved.focalPoint } : null;
    LookEditor.normalizeCharacter(character);
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
  if (sync) syncSelectedCharacter();
}


function serializeLook(look) {
  const cached = serializedLookCache.get(look);
  if (cached) return cached;
  const editor = normaliseLookEditor(look.editor || defaultLookEditor());
  const serialized = {
    id: String(look.id),
    title: typeof look.title === "string" ? look.title : "새로운 룩",
    subtitle: typeof look.subtitle === "string" ? look.subtitle : "",
    outfits: cloneOutfits(getLookOutfits(look)),
    background: backgrounds[look.background] ? look.background : "paper",
    customBackgroundColor: normaliseHexColor(look.customBackgroundColor, customBackgroundDefault),
    backgroundPattern: normaliseBackgroundPattern(look.backgroundPattern),
    backgroundTexture: backgroundTextureOptions.has(look.backgroundTexture) ? look.backgroundTexture : "none",
    titleFont: titleFonts[look.titleFont] ? look.titleFont : defaultTitleFont,
    titleWeight: normaliseTitleWeight(look.titleFont || defaultTitleFont, look.titleWeight ?? defaultTitleWeight),
    titleFontSize: normaliseTitleFontSize(look.titleFontSize),
    titleItalic: normaliseTitleBoolean(look.titleItalic),
    titleUnderline: normaliseTitleBoolean(look.titleUnderline),
    titleUppercase: normaliseTitleBoolean(look.titleUppercase),
    titleAlign: normaliseTitleAlign(look.titleAlign),
    titleColor: normaliseOptionalHexColor(look.titleColor ?? look.subtitleColor),
    subtitleFont: titleFonts[look.subtitleFont] ? look.subtitleFont : defaultTitleFont,
    subtitleWeight: normaliseTitleWeight(look.subtitleFont || defaultTitleFont, look.subtitleWeight ?? defaultSubtitleWeight),
    subtitleFontSize: normaliseSubtitleFontSize(look.subtitleFontSize),
    subtitleItalic: normaliseTitleBoolean(look.subtitleItalic),
    subtitleUnderline: normaliseTitleBoolean(look.subtitleUnderline),
    subtitleUppercase: normaliseTitleBoolean(look.subtitleUppercase),
    subtitleColor: normaliseOptionalHexColor(look.subtitleColor),
    outline: normaliseOutline(look.outline, "#f1dfbb", 8),
    titleOutline: normaliseOutline(look.titleOutline, "#ffffff", 6),
    editor: { ...editor, characters: editor.characters.map(serializeCharacter) },
  };
  serializedLookCache.set(look, serialized);
  return serialized;
}

const draftSaveDebounceMs = 180;
const draftIndexedDbLookThreshold = 100;
let scheduledSaveTimer = 0;
let draftSaveSequence = 0;

function scheduleSaveState() {
  window.clearTimeout(scheduledSaveTimer);
  scheduledSaveTimer = window.setTimeout(() => {
    scheduledSaveTimer = 0;
    saveState();
  }, draftSaveDebounceMs);
}

function flushScheduledSaveState() {
  if (!scheduledSaveTimer && !draftSaveRun) return;
  if (scheduledSaveTimer) {
    window.clearTimeout(scheduledSaveTimer);
    scheduledSaveTimer = 0;
  }
  saveState({ immediate: true });
}

function createDraftSnapshot() {
  const look = getSelectedLook();
  syncStateIntoLook(look);
  return {
    version: 3,
    looks: looks.map(serializeLook),
    title: look.title,
    subtitle: look.subtitle,
    background: state.background,
    customBackgroundColor: normaliseHexColor(state.customBackgroundColor, customBackgroundDefault),
    cutout: state.cutout,
    outline: normaliseOutline(state.outline, "#f1dfbb", 8),
    titleOutline: normaliseOutline(state.titleOutline, "#ffffff", 6),
    shadow: LookEditor.normalizeShadow(state.shadow),
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    language: state.language,
    selectedLookId: state.selectedLookId,
    characterCount: state.characterCount,
    selectedCharacter: state.selectedCharacter,
    outfits: cloneOutfits(getLookOutfits(look)),
    // Search results are ephemeral. Persist only records referenced by a
    // saved outfit; otherwise every search grows the localStorage draft.
    catalogItems: getPersistedItemRecords(),
    multiInfoEnabled: state.multiInfoEnabled,
    multiInfoMode: state.multiInfoMode,
    titleFont: state.titleFont,
    titleWeight: state.titleWeight,
    titleFontSize: normaliseTitleFontSize(state.titleFontSize),
    titleItalic: normaliseTitleBoolean(state.titleItalic),
    titleUnderline: normaliseTitleBoolean(state.titleUnderline),
    titleUppercase: normaliseTitleBoolean(state.titleUppercase),
    titleAlign: normaliseTitleAlign(state.titleAlign),
    titleColor: normaliseOptionalHexColor(state.titleColor),
    subtitleFont: titleFonts[state.subtitleFont] ? state.subtitleFont : defaultTitleFont,
    subtitleWeight: normaliseTitleWeight(state.subtitleFont || defaultTitleFont, state.subtitleWeight ?? defaultSubtitleWeight),
    subtitleFontSize: normaliseSubtitleFontSize(state.subtitleFontSize),
    subtitleItalic: normaliseTitleBoolean(state.subtitleItalic),
    subtitleUnderline: normaliseTitleBoolean(state.subtitleUnderline),
    subtitleUppercase: normaliseTitleBoolean(state.subtitleUppercase),
    subtitleColor: normaliseOptionalHexColor(state.subtitleColor),
    singleRatio: state.singleRatio,
    singleLayout: state.singleLayout,
    backgroundPattern: state.backgroundPattern,
    backgroundTexture: state.backgroundTexture,
    characters: state.characters.map(serializeCharacter),
  };
}

function finishDraftSave(run, saveSequence, failed = false) {
  if (run.needsRun) {
    runDraftSave(run);
    return;
  }
  if (draftSaveRun === run) draftSaveRun = null;
  if (failed) {
    if (saveSequence === draftSaveSequence) setSaveStatus(t("status.saveFailed"), true);
  } else if (saveSequence === draftSaveSequence) {
    setSaveStatus(t("status.saved"));
    scheduleAssetCleanup();
  }
  run.resolve();
}

function runDraftSave(run) {
  run.needsRun = false;
  run.started = true;
  const saveSequence = run.latestSequence;
  let writePromise;
  setSaveStatus(t("status.saving"));
  try {
    const snapshot = createDraftSnapshot();
    writePromise = typeof draftStorage.writeValue === "function"
      ? draftStorage.writeValue(draftStorageKey, snapshot, { preferIndexedDb: looks.length >= draftIndexedDbLookThreshold })
      : draftStorage.write(draftStorageKey, JSON.stringify(snapshot));
  } catch {
    finishDraftSave(run, saveSequence, true);
    return;
  }
  return Promise.resolve(writePromise)
    .then(() => finishDraftSave(run, saveSequence))
    .catch(() => finishDraftSave(run, saveSequence, true));
}

let draftSaveRun = null;

function saveState({ immediate = false } = {}) {
  if (scheduledSaveTimer) {
    window.clearTimeout(scheduledSaveTimer);
    scheduledSaveTimer = 0;
  }
  const saveSequence = ++draftSaveSequence;
  if (draftSaveRun) {
    draftSaveRun.latestSequence = saveSequence;
    draftSaveRun.needsRun = true;
    if (immediate && !draftSaveRun.started) runDraftSave(draftSaveRun);
    return draftSaveRun.promise;
  }

  const run = {
    latestSequence: saveSequence,
    needsRun: false,
    started: false,
    promise: null,
    resolve: null,
  };
  run.promise = new Promise((resolve) => { run.resolve = resolve; });
  draftSaveRun = run;
  if (immediate) {
    runDraftSave(run);
  } else {
    queueMicrotask(() => {
      if (draftSaveRun === run && !run.started) runDraftSave(run);
    });
  }
  return run.promise;
}

function setSaveStatus(message, failed = false) {
  const status = document.getElementById("saveStatus");
  if (status) {
    status.textContent = message;
    status.dataset.failed = String(failed);
    status.title = message;
  }
  const statusGroup = document.getElementById("saveStatusGroup");
  if (statusGroup) {
    statusGroup.dataset.failed = String(failed);
    statusGroup.dataset.state = failed
      ? "failed"
      : message === t("status.saving")
        ? "saving"
        : "saved";
    statusGroup.title = message;
  }
  const retry = elements.saveRetryButton;
  if (retry) {
    retry.hidden = !failed;
    retry.disabled = !failed;
    retry.setAttribute("aria-hidden", String(!failed));
  }
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
    customBackgroundColor: normaliseHexColor(state.customBackgroundColor, customBackgroundDefault),
    cutout: state.cutout,
    outline: normaliseOutline(state.outline, "#f1dfbb", 8),
    titleOutline: normaliseOutline(state.titleOutline, "#ffffff", 6),
    shadow: LookEditor.normalizeShadow(state.shadow),
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    characterCount: state.characterCount,
    selectedCharacter: state.selectedCharacter,
    activeSlot: state.activeSlot,
    outfits: cloneOutfits(getLookOutfits(look)),
    multiInfoEnabled: state.multiInfoEnabled,
    multiInfoMode: state.multiInfoMode,
    titleFont: state.titleFont,
    titleWeight: state.titleWeight,
    titleFontSize: normaliseTitleFontSize(state.titleFontSize),
    titleItalic: normaliseTitleBoolean(state.titleItalic),
    titleUnderline: normaliseTitleBoolean(state.titleUnderline),
    titleUppercase: normaliseTitleBoolean(state.titleUppercase),
    titleAlign: normaliseTitleAlign(state.titleAlign),
    titleColor: normaliseOptionalHexColor(state.titleColor),
    subtitleFont: titleFonts[state.subtitleFont] ? state.subtitleFont : defaultTitleFont,
    subtitleWeight: normaliseTitleWeight(state.subtitleFont || defaultTitleFont, state.subtitleWeight ?? defaultSubtitleWeight),
    subtitleFontSize: normaliseSubtitleFontSize(state.subtitleFontSize),
    subtitleItalic: normaliseTitleBoolean(state.subtitleItalic),
    subtitleUnderline: normaliseTitleBoolean(state.subtitleUnderline),
    subtitleUppercase: normaliseTitleBoolean(state.subtitleUppercase),
    subtitleColor: normaliseOptionalHexColor(state.subtitleColor),
    singleRatio: state.singleRatio,
    singleLayout: state.singleLayout,
    backgroundPattern: state.backgroundPattern,
    backgroundTexture: state.backgroundTexture,
    imageFit: state.imageFit,
    focalPoint: state.focalPoint ? { ...state.focalPoint } : null,
    characters: state.characters.map((character) => ({
      ...character,
      focalPoint: character.focalPoint ? { ...character.focalPoint } : null,
    })),
  };
}

function restoreSnapshot(snapshot) {
  const look = getSelectedLook();
  invalidatePendingImageImports({ look });
  if (typeof snapshot.title === "string") look.title = snapshot.title;
  if (typeof snapshot.subtitle === "string") look.subtitle = snapshot.subtitle;
  state.background = backgrounds[snapshot.background] ? snapshot.background : "paper";
  state.customBackgroundColor = normaliseHexColor(snapshot.customBackgroundColor, customBackgroundDefault);
  state.cutout = snapshot.cutout === true;
  state.outline = normaliseOutline(snapshot.outline, "#f1dfbb", 8);
  state.titleOutline = normaliseOutline(snapshot.titleOutline, "#ffffff", 6);
  state.shadow = LookEditor.normalizeShadow(snapshot.shadow);
  const placement = LookEditor.normalizeCharacter({
    imageFit: snapshot.imageFit,
    zoom: snapshot.zoom,
    panX: snapshot.panX,
    panY: snapshot.panY,
    focalPoint: snapshot.focalPoint,
  });
  state.zoom = placement.zoom;
  state.panX = placement.panX;
  state.panY = placement.panY;
  state.imageFit = placement.imageFit;
  if (snapshot.characterCount) state.characterCount = clamp(snapshot.characterCount, 1, 5, 1) | 0;
  if (Number.isInteger(snapshot.selectedCharacter)) state.selectedCharacter = Math.min(state.characterCount - 1, Math.max(0, snapshot.selectedCharacter));
  if (snapshot.activeSlot) state.activeSlot = snapshot.activeSlot;
  if (typeof snapshot.multiInfoEnabled === "boolean") state.multiInfoEnabled = snapshot.multiInfoEnabled;
  if (["clear", "fade", "silhouette"].includes(snapshot.multiInfoMode)) state.multiInfoMode = snapshot.multiInfoMode;
  if (snapshot.titleFont && titleFonts[snapshot.titleFont]) state.titleFont = snapshot.titleFont;
  if (Number.isFinite(snapshot.titleWeight)) state.titleWeight = normaliseTitleWeight(state.titleFont, snapshot.titleWeight);
  state.titleFontSize = normaliseTitleFontSize(snapshot.titleFontSize);
  state.titleItalic = normaliseTitleBoolean(snapshot.titleItalic);
  state.titleUnderline = normaliseTitleBoolean(snapshot.titleUnderline);
  state.titleUppercase = normaliseTitleBoolean(snapshot.titleUppercase);
  state.titleAlign = normaliseTitleAlign(snapshot.titleAlign);
  state.titleColor = normaliseOptionalHexColor(snapshot.titleColor ?? snapshot.subtitleColor);
  state.subtitleFont = titleFonts[snapshot.subtitleFont] ? snapshot.subtitleFont : defaultTitleFont;
  state.subtitleWeight = normaliseTitleWeight(state.subtitleFont, snapshot.subtitleWeight ?? defaultSubtitleWeight);
  state.subtitleFontSize = normaliseSubtitleFontSize(snapshot.subtitleFontSize);
  state.subtitleItalic = normaliseTitleBoolean(snapshot.subtitleItalic);
  state.subtitleUnderline = normaliseTitleBoolean(snapshot.subtitleUnderline);
  state.subtitleUppercase = normaliseTitleBoolean(snapshot.subtitleUppercase);
  state.subtitleColor = normaliseOptionalHexColor(snapshot.subtitleColor);
  if (["portrait", "landscape"].includes(snapshot.singleRatio)) state.singleRatio = snapshot.singleRatio;
  if (["info-left", "info-right"].includes(snapshot.singleLayout)) state.singleLayout = snapshot.singleLayout;
  restoreBackgroundStyle(snapshot.backgroundPattern, snapshot.backgroundMotif, snapshot.backgroundTexture);
  if (Array.isArray(snapshot.characters)) {
    state.characters = snapshot.characters.slice(0, 5).map((character) => {
      const copy = { ...character };
      LookEditor.normalizeCharacter(copy);
      copy.cutout = character.cutout === true;
      return copy;
    });
    while (state.characters.length < 5) state.characters.push(LookEditor.emptyCharacter());
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
    showToast(t("toast.undoEmpty"));
    return;
  }
  state.redo.push(createSnapshot());
  restoreSnapshot(previous);
  showToast(t("toast.undo"));
}

function redo() {
  const next = state.redo.pop();
  if (!next) {
    showToast(t("toast.redoEmpty"));
    return;
  }
  state.history.push(createSnapshot());
  restoreSnapshot(next);
  showToast(t("toast.redo"));
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
  if (boardTitleFitFrame) {
    window.cancelAnimationFrame(boardTitleFitFrame);
    boardTitleFitFrame = 0;
  }
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
  const naturalWidth = title.getBoundingClientRect().width / getCanvasViewScale();
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

function scheduleBoardTitleFit() {
  if (boardTitleFitFrame) return;
  boardTitleFitFrame = window.requestAnimationFrame(() => {
    boardTitleFitFrame = 0;
    fitBoardTitle();
  });
}

// Range and colour inputs can emit dozens of events in one gesture. Keep the
// model update immediate for accessibility/readouts, but paint the expensive
// card image pass at most once per animation frame.
function scheduleLiveStyleRender(options = {}) {
  liveStyleRenderOptions = { ...(liveStyleRenderOptions || {}), ...options };
  if (liveStyleRenderFrame) return;
  liveStyleRenderFrame = window.requestAnimationFrame(() => {
    liveStyleRenderFrame = 0;
    const nextOptions = liveStyleRenderOptions || {};
    liveStyleRenderOptions = null;
    // Keep the scheduled path on the public render boundary. The editor is a
    // classic script, so an internal function binding would bypass any
    // instrumentation or host integration attached to window.renderStyles.
    (globalThis.renderStyles || renderStyles)(nextOptions);
  });
}

function flushLiveStyleRender(overrides = {}) {
  if (!liveStyleRenderFrame) return false;
  window.cancelAnimationFrame(liveStyleRenderFrame);
  liveStyleRenderFrame = 0;
  const nextOptions = { ...(liveStyleRenderOptions || {}), ...overrides };
  liveStyleRenderOptions = null;
  (globalThis.renderStyles || renderStyles)(nextOptions);
  return true;
}

function cancelLiveStyleRender() {
  if (liveStyleRenderFrame) window.cancelAnimationFrame(liveStyleRenderFrame);
  liveStyleRenderFrame = 0;
  liveStyleRenderOptions = null;
}

function syncCopyEditorFields() {
  const look = getSelectedLook();
  const title = getLookTitle(look);
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

function renderLook({ fitTitle = true } = {}) {
  const look = getSelectedLook();
  elements.boardTitle.textContent = getLookTitle(look);
  elements.boardSubtitle.textContent = look.subtitle || "";
  elements.boardSubtitle.dataset.empty = String(!look.subtitle);
  if (fitTitle) fitBoardTitle();
  scheduleCardCopyPreview();
  syncCopyEditorFields();
  document.title = getDocumentTitle(look);
  $$(".look-list-item").forEach((button) => {
    const selected = button.dataset.lookId === state.selectedLookId;
    button.classList.toggle("is-current", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

let renderedLookListKey = null;

function getLookListRenderKey(query = $("#lookSearch")?.value.trim().toLowerCase() || "") {
  return [query, ...looks.map((look) => `${look.id}\u0001${getLookTitle(look)}\u0001${look.subtitle || ""}`)].join("\u0002");
}

function renderLookList() {
  if (!elements.lookList) return;
  const query = $("#lookSearch")?.value.trim().toLowerCase() || "";
  const renderKey = getLookListRenderKey(query);
  if (renderedLookListKey === renderKey) return;
  const active = document.activeElement;
  const focusedLookId = active?.closest?.(".look-list-item")?.dataset.lookId || null;
  elements.lookList.innerHTML = looks.map((look, index) => {
    const selected = look.id === state.selectedLookId;
    const title = getLookTitle(look);
    const searchable = `${title} ${look.subtitle || ""}`.toLowerCase();
    const hidden = Boolean(query) && !searchable.includes(query);
    return `<button class="look-list-item${selected ? " is-current" : ""}" type="button" data-look-id="${escapeHtml(look.id)}"${selected ? ' aria-current="page"' : ""}${hidden ? " hidden" : ""}>
      <span class="look-list-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="look-list-copy"><strong>${escapeHtml(title)}</strong></span>
    </button>`;
  }).join("");
  renderedLookListKey = renderKey;
  if (focusedLookId) [...elements.lookList.querySelectorAll(".look-list-item")]
    .find((button) => button.dataset.lookId === focusedLookId)?.focus({ preventScroll: true });
}

function syncLookListTitle(look = getSelectedLook()) {
  if (!elements.lookList || !look) return;
  const query = $("#lookSearch")?.value.trim().toLowerCase() || "";
  if (query) {
    renderLookList();
    return;
  }
  const item = [...elements.lookList.querySelectorAll(".look-list-item")]
    .find((button) => button.dataset.lookId === String(look.id));
  const title = item?.querySelector(".look-list-copy strong");
  if (!title) {
    renderLookList();
    return;
  }
  title.textContent = getLookTitle(look);
  // The DOM row was updated in place. Invalidate the key so the next full
  // render can still detect the underlying title change.
  renderedLookListKey = null;
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
  state.focalPoint = character.focalPoint ? { ...character.focalPoint } : null;
}

function syncCharacterSelectionUI() {
  $$(".character-figure").forEach((button) => {
    const selected = Number(button.dataset.characterIndex) === state.selectedCharacter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $$(".character-slot").forEach((slot) => {
    slot.classList.toggle("is-selected", Number(slot.dataset.characterSlot) === state.selectedCharacter);
  });
  $$('[data-character-select], [data-item-character]').forEach((button) => {
    const index = Number(button.dataset.characterSelect ?? button.dataset.itemCharacter);
    const selected = index === state.selectedCharacter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (elements.castSelectionSummary) {
    const index = String(state.selectedCharacter + 1).padStart(2, "0");
    const countLabel = state.characterCount === 1
      ? t("cast.person.one")
      : t("cast.person.other", { count: state.characterCount });
    elements.castSelectionSummary.textContent = t("cast.summary", { index, countLabel });
  }
}

function selectCharacter(index) {
  const nextIndex = Math.min(state.characterCount - 1, Math.max(0, Number(index) || 0));
  if (nextIndex !== state.selectedCharacter) {
    elements.itemSearch.value = "";
    clearCatalogResults();
  }
  state.selectedCharacter = nextIndex;
  syncSelectedCharacter();
  syncCharacterSelectionUI();
  renderStyles();
  renderEquipment();
  if (shouldRenderCatalog()) renderCatalog();
}

function openCharacterImagePicker(index) {
  if (imageEditorOpen) return;
  selectCharacter(index);
  elements.imageInput?.click();
}

function removeCharacterImage(index = state.selectedCharacter) {
  if (imageEditorOpen) return;
  const targetIndex = Math.min(state.characterCount - 1, Math.max(0, Number(index) || 0));
  const look = getSelectedLook();
  invalidatePendingImageImports({ look, characterIndex: targetIndex });
  const character = state.characters[targetIndex];
  if (!resolveCharacterAsset(character, "source")) return;
  selectCharacter(targetIndex);
  recordHistory();
  // Keep the previous asset in history so undo remains reversible. The normal
  // cleanup pass can prune it once it is no longer reachable.
  state.characters[targetIndex] = LookEditor.emptyCharacter();
  syncSelectedCharacter();
  renderAll();
  saveState();
  showToast(t("toast.photoRemoved", { number: String(targetIndex + 1).padStart(2, "0") }));
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
    const number = String(index + 1).padStart(2, "0");
    return `<button class="item-character-button${selected ? " is-selected" : ""}" type="button" data-item-character="${index}" aria-label="${escapeHtml(t("item.characterEdit", { number }))}" aria-pressed="${selected}">
      <span class="item-character-thumb${source ? "" : " is-empty"}">${source ? renderCharacterImage(source) : `<span class="item-character-empty" aria-hidden="true">${escapeHtml(t("item.noImage"))}</span>`}</span>
      <span class="item-character-copy"><strong>${escapeHtml(t("item.summary", { number }))}</strong></span>
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
    const number = String(index + 1).padStart(2, "0");
    return `
    <div class="character-slot${index === state.selectedCharacter ? " is-selected" : ""}${source ? "" : " is-empty"}" data-character-slot="${index}">
      <button class="character-figure${index === state.selectedCharacter ? " is-selected" : ""}${source ? "" : " is-empty"}" type="button" data-character-index="${index}" data-cutout="${Boolean(character.cutout)}" data-empty="${!source}" aria-pressed="${index === state.selectedCharacter}" aria-label="${escapeHtml(source ? t("item.characterSelect", { number }) : t("item.characterAddPhoto", { number }))}">
        ${source ? renderCharacterImage(source, { alt: t("item.characterAlt", { number }), loading: "eager" }) : `<span class="character-empty-placeholder" aria-hidden="true"><small class="character-empty-kicker">${escapeHtml(t("item.summary", { number }))}</small><span class="character-empty-mark">＋</span><strong>${escapeHtml(t("item.addPhoto"))}</strong><small>${escapeHtml(t("item.cardSelect"))}</small></span>`}
      </button>
      ${source ? `<div class="character-image-actions" aria-label="${escapeHtml(t("item.photoActions", { number }))}"><button class="character-image-action" data-character-image-action="change" data-character-image-action-index="${index}" type="button" aria-label="${escapeHtml(t("item.changePhoto", { number }))}">${escapeHtml(t("item.change"))}</button><button class="character-image-action character-image-action--remove" data-character-image-action="remove" data-character-image-action-index="${index}" type="button" aria-label="${escapeHtml(t("item.removePhoto", { number }))}">${escapeHtml(t("item.removeAction"))}</button></div>` : ""}
    </div>
  `;
  }).join(""));
  replaceCharacterButtons($("#castSelector"), "data-character-select", state.characters.slice(0, state.characterCount).map((character, index) => `
    ${(() => {
      const source = resolveCharacterAsset(character, "hero");
      const number = String(index + 1).padStart(2, "0");
      return `<button class="${index === state.selectedCharacter ? "is-selected" : ""}${source ? "" : " is-empty"}" type="button" data-character-select="${index}" aria-pressed="${index === state.selectedCharacter}" aria-label="${escapeHtml(t("item.characterEdit", { number }))}">
      <span class="cast-slot-visual${source ? "" : " is-empty"}" aria-hidden="true">${source ? renderCharacterImage(source) : `<span class="cast-empty-thumb">＋</span>`}</span><span class="cast-slot-index">${String(index + 1).padStart(2, "0")}</span>
    </button>`;
    })()}
  `).join(""));
  if (elements.castSelectionSummary) {
    const index = String(state.selectedCharacter + 1).padStart(2, "0");
    const countLabel = state.characterCount === 1
      ? t("cast.person.one")
      : t("cast.person.other", { count: state.characterCount });
    elements.castSelectionSummary.textContent = t("cast.summary", { index, countLabel });
  }
  renderItemCharacterSelector();
  $$('[data-cast-count]').forEach((button) => {
    const selected = Number(button.dataset.castCount) === state.characterCount;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  $$('[data-character-image-action]').forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.characterImageActionIndex);
    if (button.dataset.characterImageAction === "remove") removeCharacterImage(index);
    else openCharacterImagePicker(index);
  }));

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

function getDisplayImageFileMeta(value, cutout = false) {
  const raw = String(value || "").trim();
  if (!raw) return cutout ? t("cutout.remove") : t("image.original");
  const prefix = raw.split("·")[0].trim();
  if (!prefix) return raw;
  return `${prefix} · ${t(cutout ? "image.backgroundRemoved" : "image.original")}`;
}

function renderSourcePanel() {
  const hasImage = Boolean(state.imageSrc);
  if (hasImage) {
    elements.sourceThumb.src = state.imageSrc;
    elements.sourceThumb.alt = t("image.currentPreview");
  } else {
    elements.sourceThumb.removeAttribute("src");
    elements.sourceThumb.alt = t("image.notSelected");
  }
  elements.sourceThumbFrame?.classList.toggle("is-empty", !hasImage);
  elements.sourceThumbFrame?.closest(".portrait-source-card")?.classList.toggle("is-empty", !hasImage);
  elements.sourceFileName.textContent = hasImage ? state.fileName : t("image.notSelected");
  if (elements.sourceFileMeta) elements.sourceFileMeta.textContent = hasImage
    ? getDisplayImageFileMeta(state.fileMeta, state.cutout)
    : t("image.fileTypes");
  if (elements.imageState) {
    elements.imageState.textContent = !hasImage ? t("image.none") : state.cutout ? t("image.backgroundRemoved") : t("image.original");
    elements.imageState.dataset.state = !hasImage ? "empty" : state.cutout ? "cutout" : "original";
  }
  elements.sourceThumbFrame?.classList.toggle("is-cutout", state.cutout);
  if (elements.openImageEditorButton) {
    elements.openImageEditorButton.disabled = !hasImage;
    elements.openImageEditorButton.title = hasImage ? t("image.editPlacementReady") : t("image.addFirst");
  }
  const cutoutButton = $("#cutoutButton");
  if (cutoutButton && !cutoutButton.classList.contains("is-processing")) {
    cutoutButton.disabled = !hasImage;
    cutoutButton.title = hasImage
      ? t(state.cutout ? "cutout.titleRestore" : "cutout.titleRemove")
      : t("image.addFirst");
    syncCutoutActionLabel();
  }
  $$('button[data-image-fit]').forEach((button) => {
    const selected = button.dataset.imageFit === state.imageFit;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function syncCutoutActionLabel() {
  const button = $("#cutoutButton");
  const label = button?.querySelector("span:first-child");
  if (!label) return;
  if (button.classList.contains("is-processing")) {
    label.textContent = Number.isFinite(cutoutProgress)
      ? t("cutout.browserProgress", { progress: cutoutProgress })
      : t(cutoutProcessingKey);
    return;
  }
  label.textContent = state.cutout ? t("cutout.restore") : t("cutout.remove");
}

function renderBoardGear() {
  const look = getSelectedLook();
  const renderGearItem = (itemId, index, characterIndex, { showCharacter = false } = {}) => {
    const item = getItem(itemId);
    if (!item) return "";
    const slotName = getOutfitSlotName(item.slot);
    const primaryName = getItemName(item);
    const secondaryName = getSecondaryItemName(item);
    const characterNumber = String(characterIndex + 1).padStart(2, "0");
    const characterLabel = showCharacter ? `${t("item.summary", { number: characterNumber })} · ` : "";
    return `<button class="board-gear-item gear-slot-${item.slot}" data-character-index="${characterIndex}" data-gear-index="${index}" data-card-slot="${item.slot}" type="button" aria-label="${escapeHtml(t("item.gearEdit", { number: characterNumber, slot: slotName, name: primaryName }))}">
      <span class="gear-note-surface" aria-hidden="true"></span><span class="gear-tile-tape" aria-hidden="true"></span><span class="gear-note-stamp" aria-hidden="true"></span>
      <div class="gear-tile-copy"><span class="gear-slot-label">${characterLabel}${escapeHtml(slotName)}</span><strong>${escapeHtml(primaryName)}</strong>${secondaryName ? `<small class="gear-item-secondary">${escapeHtml(secondaryName)}</small>` : ""}</div>
    </button>`;
  };
  const boardGearList = $("#boardGearList");
  if (state.characterCount === 2) {
    boardGearList.innerHTML = [0, 1].map((characterIndex) => {
      const items = getCharacterItemIds(characterIndex, look);
      const railSide = characterIndex === 0 ? "left" : "right";
      return `<section class="board-gear-rail board-gear-rail--${railSide}" data-gear-character="${characterIndex}" aria-label="${escapeHtml(t("item.gearInfo", { number: String(characterIndex + 1).padStart(2, "0") }))}">
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
    setActiveEquipmentSlot(button.dataset.cardSlot);
    if (Number.isInteger(characterIndex) && characterIndex !== state.selectedCharacter) selectCharacter(characterIndex);
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
    const itemNames = items.map((item) => getItemName(item)).filter(Boolean);
    const accessibleItems = itemNames.length ? `: ${itemNames.join(", ")}` : "";
    return `<button class="multi-info-column${index === state.selectedCharacter ? " is-selected" : ""}" type="button" data-info-character="${index}" aria-label="${escapeHtml(t("item.multiInfoEdit", { number: String(index + 1).padStart(2, "0"), items: accessibleItems }))}">
      <span class="multi-info-items">${items.map((item) => {
        const secondaryName = getSecondaryItemName(item);
        return `<span class="multi-info-item"><span>${escapeHtml(getItemName(item))}</span>${secondaryName ? `<small>${escapeHtml(secondaryName)}</small>` : ""}</span>`;
      }).join("")}</span>
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

function syncCustomBackgroundRecipe(background) {
  const properties = ["--recipe-ink", "--recipe-muted", "--recipe-panel", "--recipe-edge", "--recipe-shadow"];
  if (state.background !== "custom") {
    properties.forEach((property) => elements.board.style.removeProperty(property));
    return;
  }
  const isDark = ColorContrast.themeFor(background.solid).foreground === "#ffffff";
  const recipe = {
    "--recipe-ink": isDark ? "#f7f3ed" : "#263238",
    "--recipe-muted": isDark ? "rgb(247 243 237 / .62)" : "rgb(38 50 56 / .58)",
    "--recipe-panel": isDark ? "rgb(29 34 40 / .94)" : "rgb(255 252 247 / .94)",
    "--recipe-edge": isDark ? "rgb(247 243 237 / .22)" : "rgb(38 50 56 / .18)",
    "--recipe-shadow": isDark ? "rgb(9 12 16 / .28)" : "rgb(38 50 56 / .1)",
  };
  Object.entries(recipe).forEach(([property, value]) => elements.board.style.setProperty(property, value));
}

function syncCustomBackgroundControl() {
  const color = normaliseHexColor(state.customBackgroundColor, customBackgroundDefault);
  const control = $("#customBackgroundControl");
  const input = $("#customBackgroundColorInput");
  const preview = $("#customBackgroundPreview");
  const output = $("#customBackgroundColorValue");
  if (control) control.hidden = state.background !== "custom";
  if (input && input.value !== color) input.value = color;
  if (preview) preview.style.setProperty("--backdrop", color);
  if (output) {
    output.value = color;
    output.textContent = color.toUpperCase();
  }
}

function renderStyles({ refreshInfo = true, refreshPattern = true, fitTitle = true, refreshControls = true } = {}) {
  const background = getBackgroundTheme();
  const silhouetteInfoTheme = getSilhouetteInfoTheme(background);
  if (!titleFonts[state.titleFont]) state.titleFont = defaultTitleFont;
  state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? defaultTitleWeight);
  const backgroundCss = getBackgroundSurfaceCss(background);
  syncCustomBackgroundRecipe(background);
  syncCustomBackgroundControl();
  elements.board.style.setProperty("--board-bg", backgroundCss);
  elements.board.style.setProperty("--pattern-ink", background.pattern[0]);
  elements.board.style.setProperty("--pattern-light", background.pattern[1]);
  elements.board.style.setProperty("--silhouette-info-color", silhouetteInfoTheme.foreground);
  elements.board.style.setProperty("--silhouette-info-muted", silhouetteInfoTheme.muted);
  elements.board.style.setProperty("--silhouette-info-halo", silhouetteInfoTheme.halo);
  const patternOpacity = {
    none: 0,
    dots: 0.16,
    stars: 0.2,
    halftone: 0.2,
    bitmap: 0.26,
    collage: 0,
    scrapbook: 0,
  };
  elements.board.style.setProperty("--pattern-opacity", patternOpacity[state.backgroundPattern] ?? 0);
  elements.board.dataset.background = state.background;
  elements.board.dataset.backgroundPattern = state.backgroundPattern;
  elements.board.dataset.backgroundTexture = state.backgroundTexture;
  elements.board.removeAttribute("data-background-motif");
  const backgroundSurfaceAsset = backgroundSurfaceAssets[state.backgroundPattern];
  const material = CardMaterials.get(state.backgroundPattern);
  elements.board.style.setProperty("--material-surface", material ? `url(\"${material.asset}\")` : "none");
  elements.board.style.setProperty("--material-ink", material?.ink || "var(--recipe-ink, #263238)");
  elements.board.style.setProperty("--material-muted-ink", material?.mutedInk || "var(--recipe-muted, rgb(38 50 56 / .58))");
  elements.sceneBackground.style.background = backgroundSurfaceAsset
    ? `url("${backgroundSurfaceAsset}") center / cover no-repeat, ${backgroundCss}`
    : backgroundCss;
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const allCutout = activeCharacters.every((character) => character.cutout);
  const cutoutCount = activeCharacters.filter((character) => character.cutout).length;
  const sourceMode = allCutout ? "cutout" : cutoutCount === 0 ? "original" : "mixed";
  const silhouetteReady = activeCharacters.length > 0 && allCutout;
  if (!["clear", "fade", "silhouette"].includes(state.multiInfoMode)) state.multiInfoMode = "clear";
  if (!silhouetteReady && state.multiInfoMode === "silhouette") state.multiInfoMode = "clear";
  const infoModeHint = $("#infoModeHint");
  if (infoModeHint) {
    infoModeHint.textContent = silhouetteReady
      ? t("lineup.hintReady")
      : t("lineup.hintWait");
    infoModeHint.dataset.ready = String(silhouetteReady);
  }
  elements.board.dataset.cutout = String(allCutout);
  elements.board.dataset.info = String(state.characterCount >= 3 && state.multiInfoEnabled);
  elements.board.dataset.infoMode = state.multiInfoMode;
  elements.board.dataset.sourceMode = sourceMode;
  elements.board.dataset.titleFont = state.titleFont;
  // Background choices own only the three direct axes. Keep card typography,
  // geometry, and information notes on one stable visual system.
  elements.board.dataset.style = "custom";
  elements.board.dataset.ratio = getCanvasRatio();
  elements.board.dataset.singleLayout = state.singleLayout;
  const twoPersonRails = CardLayout.infoRails({ characterCount: 2 });
  const twoPersonDimensions = CardLayout.dimensionsFor(2, "landscape");
  const [leftInfoRail, rightInfoRail] = twoPersonRails;
  elements.board.style.setProperty("--two-info-rail-left", `${(leftInfoRail.x / twoPersonDimensions.layoutWidth) * 100}%`);
  elements.board.style.setProperty("--two-info-rail-right", `${((twoPersonDimensions.layoutWidth - rightInfoRail.x - rightInfoRail.width) / twoPersonDimensions.layoutWidth) * 100}%`);
  elements.board.style.setProperty("--two-info-rail-width", `${(leftInfoRail.width / twoPersonDimensions.layoutWidth) * 100}%`);
  elements.board.style.setProperty("--two-info-rail-top", `${(leftInfoRail.y / twoPersonDimensions.layoutHeight) * 100}%`);
  elements.board.style.setProperty("--two-info-rail-height", `${(leftInfoRail.height / twoPersonDimensions.layoutHeight) * 100}%`);
  elements.board.style.setProperty("--two-info-rail-gap", `${(leftInfoRail.gap / twoPersonDimensions.layoutWidth) * 100}cqw`);
  const characterFrames = CardLayout.characterFrames({
    characterCount: state.characterCount,
    singleRatio: state.singleRatio,
    singleLayout: state.singleLayout,
    characters: activeCharacters,
  });
  elements.portraitWrap.style.setProperty(
    "inset",
    CardLayout.cssInsetFor(characterFrames, state.characterCount, state.singleRatio),
    "important",
  );
  const titleFontConfig = getTitleFontConfig(state.titleFont);
  if (!titleFonts[state.subtitleFont]) state.subtitleFont = defaultTitleFont;
  const subtitleFontConfig = getTitleFontConfig(state.subtitleFont);
  state.subtitleWeight = normaliseTitleWeight(state.subtitleFont, state.subtitleWeight ?? defaultSubtitleWeight);
  state.subtitleFontSize = normaliseSubtitleFontSize(state.subtitleFontSize);
  state.subtitleItalic = normaliseTitleBoolean(state.subtitleItalic);
  state.subtitleUnderline = normaliseTitleBoolean(state.subtitleUnderline);
  state.subtitleUppercase = normaliseTitleBoolean(state.subtitleUppercase);
  state.subtitleColor = normaliseOptionalHexColor(state.subtitleColor);
  elements.board.style.setProperty("--card-title-font", titleFontConfig.family);
  elements.board.style.setProperty("--card-title-weight", String(state.titleWeight));
  state.titleFontSize = normaliseTitleFontSize(state.titleFontSize);
  state.titleItalic = normaliseTitleBoolean(state.titleItalic);
  state.titleUnderline = normaliseTitleBoolean(state.titleUnderline);
  state.titleUppercase = normaliseTitleBoolean(state.titleUppercase);
  elements.board.style.setProperty("--card-title-font-size", String(state.titleFontSize));
  elements.board.style.setProperty("--card-title-font-size-scale", `${(state.titleFontSize / defaultTitleFontSize) * 7.2}cqw`);
  elements.board.style.setProperty("--card-title-font-size-scale-lineup", `${(state.titleFontSize / defaultTitleFontSize) * 4.5}cqw`);
  elements.board.style.setProperty("--card-title-font-style", state.titleItalic ? "italic" : "normal");
  elements.board.style.setProperty("--card-title-text-decoration", state.titleUnderline ? "underline" : "none");
  elements.board.style.setProperty("--card-title-text-transform", state.titleUppercase ? "uppercase" : "none");
  const subtitleScale = state.characterCount >= 3
    ? 1.15
    : state.characterCount === 1 && state.singleRatio === "portrait"
      ? 1.5
      : 1.2;
  elements.board.style.setProperty("--card-subtitle-font", subtitleFontConfig.family);
  elements.board.style.setProperty("--card-subtitle-weight", String(state.subtitleWeight));
  elements.board.style.setProperty("--card-subtitle-font-size-scale", `${(state.subtitleFontSize / defaultSubtitleFontSize) * subtitleScale}cqw`);
  elements.board.style.setProperty("--card-subtitle-font-style", state.subtitleItalic ? "italic" : "normal");
  elements.board.style.setProperty("--card-subtitle-text-decoration", state.subtitleUnderline ? "underline" : "none");
  elements.board.style.setProperty("--card-subtitle-text-transform", state.subtitleUppercase ? "uppercase" : "none");
  elements.board.style.setProperty("--card-subtitle-color", state.subtitleColor || "var(--recipe-ink)");
  elements.board.style.setProperty("--card-subtitle-opacity", state.subtitleColor ? "1" : ".68");
  const titleOutlineWidth = clamp(Number(state.titleOutline?.width), 0, 6, 0);
  const titleOutlineColor = normaliseHexColor(state.titleOutline?.color, "#ffffff");
  state.titleOutline = { color: titleOutlineColor, width: titleOutlineWidth };
  state.titleAlign = normaliseTitleAlign(state.titleAlign);
  state.titleColor = normaliseOptionalHexColor(state.titleColor);
  elements.board.style.setProperty("--title-outline-width", `${titleOutlineWidth}px`);
  elements.board.style.setProperty("--title-outline-color", titleOutlineColor);
  elements.board.style.setProperty("--card-title-align", resolveTitleAlign());
  elements.board.style.setProperty("--card-title-color", state.titleColor || "var(--recipe-ink)");
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
    const informationMode = state.characterCount >= 3 && state.multiInfoEnabled;
    const infoTreatment = informationMode && state.multiInfoMode === "silhouette" && cutout
      ? "brightness(0) opacity(.68)"
      : informationMode && state.multiInfoMode === "fade"
        ? "grayscale(.82) saturate(.35) contrast(.86) brightness(1.08)"
        : "";
    image.style.objectFit = character.imageFit;
    const cropPlan = {
      cutout: character.cutout,
      imageFit: character.imageFit,
      focalPoint: character.focalPoint,
    };
    image.style.objectPosition = CropPlan.objectPositionFor(cropPlan);
    image.style.transformOrigin = CropPlan.transformOriginFor(cropPlan);
    image.style.transform = `translate(${character.panX}px, ${character.panY}px) scale(${character.zoom / 100})`;
    image.style.filter = `${baseFilter} ${infoTreatment}`.trim() || "none";
  });

  if (refreshControls) {
    elements.outlineRange.value = state.outline.width;
    elements.outlineValue.textContent = `${String(state.outline.width).padStart(2, "0")} px`;
    if (elements.titleOutlineRange) {
      elements.titleOutlineRange.value = String(titleOutlineWidth);
      updateRangeProgress(elements.titleOutlineRange);
      elements.titleOutlineRange.setAttribute("aria-valuetext", titleOutlineWidth ? `${titleOutlineWidth} px` : t("range.none"));
    }
    if (elements.titleOutlineValue) elements.titleOutlineValue.textContent = titleOutlineWidth ? `${titleOutlineWidth} px` : t("range.none");
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
    if (elements.outlineColorInput) elements.outlineColorInput.value = state.outline.color;
    if (elements.outlineColorValue) elements.outlineColorValue.textContent = state.outline.color.toUpperCase();
    elements.outlineRange.style.setProperty("--range-progress", `${(state.outline.width / 8) * 100}%`);
    elements.shadowRange.style.setProperty("--range-progress", `${(state.shadow.strength / 70) * 100}%`);
    const outlineSwatches = $$("#outlineSwatches .color-swatch");
    outlineSwatches.forEach((swatch) => {
      const selected = swatch.dataset.color === state.outline.color;
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-checked", String(selected));
    });
    elements.outlineColorPicker?.classList.toggle("is-selected", !outlineSwatches.some((swatch) => swatch.dataset.color === state.outline.color));
    $$(".title-outline-swatch").forEach((swatch) => {
      const selected = swatch.dataset.titleOutlineColor === state.titleOutline.color;
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-checked", String(selected));
    });
    $$(".backdrop-swatch").forEach((swatch) => {
      const selected = swatch.dataset.background === state.background;
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-checked", String(selected));
    });
    $$(".direction-pad button").forEach((button) => button.classList.toggle("is-selected", button.dataset.shadow === shadowDirection()));
    $("#cutoutButton").classList.toggle("is-highlighted", state.cutout);
    syncCutoutActionLabel();
    renderSourcePanel();
    syncImagePlacementSummary();
    $("#multiInfoToggle").checked = state.multiInfoEnabled;
    syncTitleFontControls();
    syncTitleAlignmentControls();
    syncCopyColorControls();
    syncTextEditorDock();
    const backgroundCurrentLabel = $("#backgroundCurrentLabel");
    if (backgroundCurrentLabel) {
      backgroundCurrentLabel.textContent = describeBackgroundSelection();
      backgroundCurrentLabel.dataset.custom = String(state.background === "custom");
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
      button.title = unavailable ? t("lineup.silhouetteUnavailable") : "";
      button.setAttribute("aria-disabled", String(unavailable));
      const selected = button.dataset.infoMode === state.multiInfoMode;
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
    $("#multiCardControls").hidden = state.characterCount < 3;
    $("#cardDisplaySetting").hidden = state.characterCount < 3;
    const dimensions = getExportDimensions();
    const exportReady = activeCharacters.length > 0 && activeCharacters.every((character) => Boolean(resolveCharacterAsset(character, "hero")));
    const exportButton = $("#exportButton");
    // Keep the action focusable while the blank workspace is being prepared.
    // aria-disabled communicates why it cannot run without removing it from
    // the keyboard route; downloadComposition() owns the same guard.
    exportButton.disabled = false;
    exportButton.setAttribute("aria-disabled", String(!exportReady));
    exportButton.title = exportReady
      ? t("export.titleReady", { width: dimensions.exportWidth, height: dimensions.exportHeight })
      : t("export.titleMissing");
    if (exportInProgress) setExportButtonLabel("export.preparing");
  }
  if (refreshPattern) renderPattern();
  if (refreshInfo) renderMultiInfo();
  if (fitTitle) fitBoardTitle();
  scheduleCardCopyPreview();
}

function shadowDirection() {
  const x = state.shadow.x;
  const y = state.shadow.y;
  if (x === 0 && y === 0) return "n";
  return `${y < 0 ? "n" : y > 0 ? "s" : ""}${x < 0 ? "w" : x > 0 ? "e" : ""}` || "s";
}

function focusItemSearch() {
  window.requestAnimationFrame(() => {
    elements.itemSearch.focus();
    ensureMobileControlVisible(elements.itemSearch);
  });
}

function renderEquipment() {
  const look = getSelectedLook();
  const outfit = getCharacterOutfit(state.selectedCharacter, look);
  const characterNumber = String(state.selectedCharacter + 1).padStart(2, "0");
  const characterLabel = t("item.summary", { number: characterNumber });
  if (elements.itemsSummaryTitle) elements.itemsSummaryTitle.textContent = characterLabel;
  elements.equipmentList.innerHTML = outfitSlots.map((slot) => {
    const item = getItem(outfit[slot]);
    const selected = slot === state.activeSlot;
    const itemName = item ? getItemName(item) : t("item.emptyName");
    const secondaryName = item ? getSecondaryItemName(item) : "";
    const itemMeta = [getOutfitSlotName(slot), secondaryName || (!item ? t("item.emptyHint") : "")].filter(Boolean).join(" · ");
    const hasItemImage = Boolean(getItemImageUrl(item));
    const rowLabel = item
      ? t("item.gearRow", { slot: getOutfitSlotName(slot), name: itemName })
      : t("item.emptyRow", { slot: getOutfitSlotName(slot) });
    return `<div class="equipment-row-shell">
      <button class="equipment-row${selected ? " is-selected" : ""}${item ? "" : " is-empty"}" data-slot="${slot}" type="button" aria-pressed="${selected}" aria-label="${escapeHtml(rowLabel)}">
        <span class="equipment-icon${hasItemImage ? " has-item-image" : ""}" aria-hidden="true">${renderItemImage(item, slot)}</span>
        <span class="equipment-copy"><strong>${escapeHtml(itemName)}</strong><span>${escapeHtml(itemMeta)}</span></span>
        <span class="equipment-check">${item ? t("item.change") : t("item.connect")}</span>
      </button>
      ${item ? `<button class="equipment-remove" data-remove-slot="${slot}" type="button" aria-label="${escapeHtml(t("item.remove", { slot: getOutfitSlotName(slot), name: itemName }))}">${escapeHtml(t("item.removeAction"))}</button>` : ""}
    </div>`;
  }).join("");
  elements.equipmentList.querySelectorAll(".equipment-row").forEach((row) => row.addEventListener("click", () => {
    setActiveEquipmentSlot(row.dataset.slot);
    renderEquipment();
    renderCatalog();
    focusItemSearch();
  }));
  elements.equipmentList.querySelectorAll(".equipment-remove").forEach((button) => button.addEventListener("click", () => {
    removeItem(button.dataset.removeSlot);
  }));
  bindItemImageFallbacks(elements.equipmentList);
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  renderBoardGear();
}

function renderCatalogMessage(message, detail = "", { loading = false } = {}) {
  $("#catalogStatus").textContent = [message, detail].filter(Boolean).join(" ");
  elements.catalogResults.setAttribute("aria-busy", String(loading));
  elements.catalogResults.innerHTML = `${loading ? '<span class="catalog-progress" aria-hidden="true"></span>' : ""}<div class="empty-results"><strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</div>`;
}

function renderCatalogResults(results, { notice = "" } = {}) {
  const allResults = Array.isArray(results) ? results : [];
  const visibleResults = allResults.slice(0, catalogRenderLimit);
  const isLimited = visibleResults.length < allResults.length;
  const countMessage = isLimited
    ? t("catalog.resultCountLimited", { shown: visibleResults.length, total: allResults.length })
    : t(notice ? "catalog.resultCountWithNotice" : "catalog.resultCountPlain", { count: visibleResults.length, notice });
  const limitNotice = isLimited ? t("catalog.resultLimitNotice", { shown: visibleResults.length }) : "";
  $("#catalogStatus").textContent = [countMessage, notice].filter(Boolean).join(" ");
  elements.catalogResults.setAttribute("aria-busy", "false");
  const resultMarkup = visibleResults.length ? visibleResults.map((item, index) => {
    const secondaryName = getSecondaryItemName(item);
    const hasItemImage = Boolean(getItemImageUrl(item));
    return `<button class="catalog-result" data-item-id="${escapeHtml(item.id)}" type="button"><span class="catalog-result-icon${hasItemImage ? " has-item-image" : ""}">${renderCatalogIcon(item, index)}</span><span class="catalog-result-copy"><strong>${escapeHtml(getItemName(item))}</strong><span>${escapeHtml(secondaryName || getOutfitSlotName(item.slot))}</span></span><span class="catalog-result-action" aria-hidden="true">＋</span></button>`;
  }).join("") : `<div class="empty-results"><strong>${escapeHtml(t("catalog.noMatch"))}</strong></div>`;
  const notices = [notice, limitNotice].filter(Boolean).join(" ");
  elements.catalogResults.innerHTML = `${notices ? `<div class="catalog-results-notice" role="status">${escapeHtml(notices)}</div>` : ""}${resultMarkup}`;
  bindItemImageFallbacks(elements.catalogResults);
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
      renderCatalogMessage(t("catalog.short"));
    } else if (result.kind === "loading") {
      renderCatalogMessage(t("catalog.loading"), "", { loading: true });
    } else if (result.kind === "results") {
      registerItemRecords(result.results.slice(0, catalogRenderLimit));
      renderCatalogResults(result.results, {
        notice: result.source === "stale" ? t("catalog.stale") : "",
      });
    } else {
      renderCatalogMessage(t("catalog.error"), t("catalog.errorDetail"));
    }
  });
}

function clearCatalogResults() {
  window.clearTimeout(itemSearchState.timer);
  itemSearchState.timer = 0;
  itemSearch.cancel();
  itemSearchState.mode = "idle";
  elements.catalogResults.innerHTML = "";
  elements.catalogResults.setAttribute("aria-busy", "false");
  $("#catalogStatus").textContent = "";
}

function setActiveEquipmentSlot(slot) {
  if (!outfitSlots.includes(slot)) return false;
  const changed = state.activeSlot !== slot;
  state.activeSlot = slot;
  if (changed) {
    elements.itemSearch.value = "";
    clearCatalogResults();
  }
  return changed;
}

function shouldRenderCatalog() {
  return state.activePanel === "itemsPanel" || Boolean(elements.itemSearch?.value.trim());
}

function scheduleCatalogSearch() {
  // Invalidate immediately, not after debounce: old results must not be selectable.
  clearCatalogResults();
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
  showToast(t("toast.itemLinked", { name: getItemName(newItem), meta: getItemMeta(newItem) }));
  saveState();
  focusItemSearch();
  await hydrateEnglishItemNames([newItem]);
}

function removeItem(slot) {
  if (!outfitSlots.includes(slot)) return;
  const look = getSelectedLook();
  const outfit = getCharacterOutfit(state.selectedCharacter, look);
  const itemId = outfit?.[slot];
  if (!itemId) return;
  const item = getItem(itemId);
  recordHistory();
  // recordHistory normalizes/replaces the outfit array while taking its
  // snapshot, so reacquire the mutable row after the snapshot is captured.
  getCharacterOutfit(state.selectedCharacter, look)[slot] = null;
  ensureLookOutfits(look);
  setActiveEquipmentSlot(slot);
  renderEquipment();
  renderCatalog();
  saveState();
  showToast(item
    ? t("toast.itemRemoved", { name: getItemName(item) })
    : t("toast.slotRemoved", { slot: getOutfitSlotName(slot) }));
  focusItemSearch();
}

function normaliseSavedLook(value, index) {
  const id = typeof value?.id === "string" && value.id.trim() ? value.id.trim().slice(0, 80) : `look-${index + 1}`;
  const look = createBlankLook(index + 1, id);
  look.title = typeof value?.title === "string" ? value.title.trim().slice(0, 64) || "새로운 룩" : "새로운 룩";
  look.subtitle = typeof value?.subtitle === "string" ? value.subtitle.trim().slice(0, 160) : "";
  look.background = backgrounds[value?.background] ? value.background : "paper";
  look.customBackgroundColor = normaliseHexColor(value?.customBackgroundColor, customBackgroundDefault);
  look.backgroundPattern = normaliseBackgroundPattern(value?.backgroundPattern);
  look.backgroundTexture = backgroundTextureOptions.has(value?.backgroundTexture) ? value.backgroundTexture : "none";
  look.titleFont = titleFonts[value?.titleFont] ? value.titleFont : defaultTitleFont;
  look.titleWeight = normaliseTitleWeight(look.titleFont, value?.titleWeight ?? defaultTitleWeight);
  look.titleFontSize = normaliseTitleFontSize(value?.titleFontSize);
  look.titleItalic = normaliseTitleBoolean(value?.titleItalic);
  look.titleUnderline = normaliseTitleBoolean(value?.titleUnderline);
  look.titleUppercase = normaliseTitleBoolean(value?.titleUppercase);
  look.titleAlign = normaliseTitleAlign(value?.titleAlign);
  look.titleColor = normaliseOptionalHexColor(value?.titleColor ?? value?.subtitleColor);
  look.subtitleFont = titleFonts[value?.subtitleFont] ? value.subtitleFont : defaultTitleFont;
  look.subtitleWeight = normaliseTitleWeight(look.subtitleFont, value?.subtitleWeight ?? defaultSubtitleWeight);
  look.subtitleFontSize = normaliseSubtitleFontSize(value?.subtitleFontSize);
  look.subtitleItalic = normaliseTitleBoolean(value?.subtitleItalic);
  look.subtitleUnderline = normaliseTitleBoolean(value?.subtitleUnderline);
  look.subtitleUppercase = normaliseTitleBoolean(value?.subtitleUppercase);
  look.subtitleColor = normaliseOptionalHexColor(value?.subtitleColor);
  look.outline = normaliseOutline(value?.outline, "#f1dfbb", 8);
  look.titleOutline = normaliseOutline(value?.titleOutline, "#ffffff", 6);
  look.outfits = Array.isArray(value?.outfits) ? cloneOutfits(value.outfits) : createOutfits([]);
  look.editor = value?.editor ? normaliseLookEditor(value.editor) : null;
  ensureLookOutfits(look);
  return look;
}

async function loadDraft() {
  try {
    const saved = typeof draftStorage.readValue === "function"
      ? await draftStorage.readValue(draftStorageKey)
      : JSON.parse(await draftStorage.read(draftStorageKey));
    if (!saved || typeof saved !== "object") return null;
    if (saved?.version !== 3) {
      await draftStorage.remove(draftStorageKey);
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
    state.customBackgroundColor = normaliseHexColor(
      saved.customBackgroundColor ?? look.customBackgroundColor,
      customBackgroundDefault,
    );
    if (typeof saved.cutout === "boolean") state.cutout = saved.cutout;
    if (saved.outline) state.outline = normaliseOutline(saved.outline, "#f1dfbb", 8);
    if (saved.titleOutline) state.titleOutline = normaliseOutline(saved.titleOutline, "#ffffff", 6);
    if (saved.shadow) state.shadow = LookEditor.normalizeShadow(saved.shadow);
    if (saved.zoom !== undefined || saved.panX !== undefined || saved.panY !== undefined || saved.imageFit !== undefined) {
      const placement = LookEditor.normalizeCharacter({
        imageFit: saved.imageFit,
        zoom: saved.zoom,
        panX: saved.panX,
        panY: saved.panY,
      });
      state.zoom = placement.zoom;
      state.panX = placement.panX;
      state.panY = placement.panY;
      state.imageFit = placement.imageFit;
    }
    if (["ko", "en", "ja"].includes(saved.language)) state.language = saved.language;
    if (typeof saved.multiInfoEnabled === "boolean") state.multiInfoEnabled = saved.multiInfoEnabled;
    if (["clear", "fade", "silhouette"].includes(saved.multiInfoMode)) state.multiInfoMode = saved.multiInfoMode;
    if (titleFonts[saved.titleFont]) state.titleFont = saved.titleFont;
    else if (titleFonts[look.titleFont]) state.titleFont = look.titleFont;
    if (Number.isFinite(saved.titleWeight)) state.titleWeight = normaliseTitleWeight(state.titleFont, saved.titleWeight);
    else state.titleWeight = normaliseTitleWeight(state.titleFont, look.titleWeight);
    state.titleFontSize = normaliseTitleFontSize(saved.titleFontSize ?? look.titleFontSize);
    state.titleItalic = normaliseTitleBoolean(saved.titleItalic ?? look.titleItalic);
    state.titleUnderline = normaliseTitleBoolean(saved.titleUnderline ?? look.titleUnderline);
    state.titleUppercase = normaliseTitleBoolean(saved.titleUppercase ?? look.titleUppercase);
    state.titleAlign = normaliseTitleAlign(saved.titleAlign ?? look.titleAlign);
    state.titleColor = normaliseOptionalHexColor(saved.titleColor ?? saved.subtitleColor ?? look.titleColor ?? look.subtitleColor);
    state.subtitleFont = titleFonts[saved.subtitleFont ?? look.subtitleFont] ? (saved.subtitleFont ?? look.subtitleFont) : defaultTitleFont;
    state.subtitleWeight = normaliseTitleWeight(state.subtitleFont, saved.subtitleWeight ?? look.subtitleWeight ?? defaultSubtitleWeight);
    state.subtitleFontSize = normaliseSubtitleFontSize(saved.subtitleFontSize ?? look.subtitleFontSize);
    state.subtitleItalic = normaliseTitleBoolean(saved.subtitleItalic ?? look.subtitleItalic);
    state.subtitleUnderline = normaliseTitleBoolean(saved.subtitleUnderline ?? look.subtitleUnderline);
    state.subtitleUppercase = normaliseTitleBoolean(saved.subtitleUppercase ?? look.subtitleUppercase);
    state.subtitleColor = normaliseOptionalHexColor(saved.subtitleColor ?? look.subtitleColor);
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
        character.assetKey = typeof savedCharacter.assetKey === "string" && savedCharacter.assetKey.length <= 160
          ? savedCharacter.assetKey
          : null;
        if (character.assetKey) {
          if (typeof savedCharacter.fileName === "string") character.fileName = savedCharacter.fileName.slice(0, 160);
          if (typeof savedCharacter.fileMeta === "string") character.fileMeta = savedCharacter.fileMeta.slice(0, 240);
        }
        character.cutout = savedCharacter.cutout === true;
        character.imageFit = ["contain", "cover"].includes(savedCharacter.imageFit) ? savedCharacter.imageFit : "contain";
        if (Number.isFinite(savedCharacter.zoom)) character.zoom = savedCharacter.zoom;
        if (Number.isFinite(savedCharacter.panX)) character.panX = savedCharacter.panX;
        if (Number.isFinite(savedCharacter.panY)) character.panY = savedCharacter.panY;
        character.focalPoint = savedCharacter.focalPoint ? { ...savedCharacter.focalPoint } : null;
        LookEditor.normalizeCharacter(character);
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
  cancelLiveStyleRender();
  syncHistoryControls();
  // renderStyles applies the final ratio/layout/font variables before its
  // single title-fit pass. Fitting here would measure the pre-style card and
  // force an avoidable second layout.
  renderLook({ fitTitle: false });
  renderLookList();
  renderCast();
  renderStyles();
  renderEquipment();
  if (shouldRenderCatalog()) renderCatalog();
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
  state.customBackgroundColor = normaliseHexColor(nextLook.customBackgroundColor, customBackgroundDefault);
  restoreBackgroundStyle(nextLook.backgroundPattern, nextLook.backgroundMotif, nextLook.backgroundTexture);
  state.titleFont = titleFonts[nextLook.titleFont] ? nextLook.titleFont : defaultTitleFont;
  state.titleWeight = normaliseTitleWeight(state.titleFont, nextLook.titleWeight ?? defaultTitleWeight);
  state.titleFontSize = normaliseTitleFontSize(nextLook.titleFontSize);
  state.titleItalic = normaliseTitleBoolean(nextLook.titleItalic);
  state.titleUnderline = normaliseTitleBoolean(nextLook.titleUnderline);
  state.titleUppercase = normaliseTitleBoolean(nextLook.titleUppercase);
  state.titleAlign = normaliseTitleAlign(nextLook.titleAlign);
  state.titleColor = normaliseOptionalHexColor(nextLook.titleColor ?? nextLook.subtitleColor);
  state.subtitleFont = titleFonts[nextLook.subtitleFont] ? nextLook.subtitleFont : defaultTitleFont;
  state.subtitleWeight = normaliseTitleWeight(state.subtitleFont, nextLook.subtitleWeight ?? defaultSubtitleWeight);
  state.subtitleFontSize = normaliseSubtitleFontSize(nextLook.subtitleFontSize);
  state.subtitleItalic = normaliseTitleBoolean(nextLook.subtitleItalic);
  state.subtitleUnderline = normaliseTitleBoolean(nextLook.subtitleUnderline);
  state.subtitleUppercase = normaliseTitleBoolean(nextLook.subtitleUppercase);
  state.subtitleColor = normaliseOptionalHexColor(nextLook.subtitleColor);
  state.outline = normaliseOutline(nextLook.outline, "#f1dfbb", 8);
  state.titleOutline = normaliseOutline(nextLook.titleOutline, "#ffffff", 6);
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

function syncRangeControlUi(input) {
  if (!input) return;
  updateRangeProgress(input);
  const value = Number(input.value);
  let output;
  let formattedValue;
  switch (input.id) {
    case "outlineRange":
      output = elements.outlineValue;
      formattedValue = `${String(value).padStart(2, "0")} px`;
      input.setAttribute("aria-valuetext", `${value} px`);
      break;
    case "titleOutlineRange":
      output = elements.titleOutlineValue;
      formattedValue = value ? `${value} px` : t("range.none");
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    case "textEditorOutlineRange":
      output = elements.textEditorOutlineRangeValue;
      formattedValue = value ? `${value} px` : t("range.none");
      if (elements.titleOutlineValue) elements.titleOutlineValue.textContent = formattedValue;
      if (elements.textEditorOutlineValue) elements.textEditorOutlineValue.textContent = formattedValue;
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    case "shadowRange":
      output = elements.shadowValue;
      formattedValue = `${value}%`;
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    case "zoomRange":
      output = elements.zoomReadout;
      formattedValue = `${value}%`;
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    case "panXRange":
      output = elements.panXReadout;
      formattedValue = formatImageOffset(value);
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    case "panYRange":
      output = elements.panYReadout;
      formattedValue = formatImageOffset(value);
      input.setAttribute("aria-valuetext", formattedValue);
      break;
    default:
      return;
  }
  if (output) output.textContent = formattedValue;
}

async function inspectImageDimensions(file) {
  return ImageValidation.readDimensions(file);
}

async function handleImageFile(file, characterIndex = state.selectedCharacter, { render = true, notify = true } = {}) {
  const operationEpoch = workspaceEpoch;
  const fileValidation = ImageValidation.validateFile(file);
  if (!fileValidation.ok && fileValidation.reason === "type") {
    if (notify) showToast(t("toast.invalidImage"));
    return false;
  }
  if (!fileValidation.ok && fileValidation.reason === "bytes") {
    if (notify) showToast(t("toast.imageTooLarge"));
    return false;
  }
  const dimensions = await inspectImageDimensions(file);
  if (dimensions) {
    const dimensionValidation = ImageValidation.validateDimensions(dimensions.width, dimensions.height);
    if (!dimensionValidation.ok) {
      if (notify) showToast(t("toast.imageDimensionsTooLarge"));
      return false;
    }
  }
  if (operationEpoch !== workspaceEpoch) return false;
  const targetIndex = clamp(Number(characterIndex) || 0, 0, state.characters.length - 1);
  const sourceLook = getSelectedLook();
  const character = getCharacterImageState(state.characters[targetIndex] || state.characters[0]);
  // Each original is immutable while cards or undo history may reference it.
  const assetKey = createAssetKey();
  const url = createAssetUrl(file);
  const transaction = {
    operationEpoch,
    look: sourceLook,
    targetIndex,
    targetKey: imageImportTargetKey(sourceLook, targetIndex),
    assetKey,
    nextCharacter: {
    ...character,
    src: url,
    originalSrc: url,
    assetKey,
    fileName: file.name,
    fileMeta: `${Math.round(file.size / 1024)} KB · ${t("image.original")}`,
    cutout: false,
    imageFit: "contain",
    zoom: 100,
    panX: 0,
    panY: 0,
    focalPoint: null,
    },
  };
  invalidatePendingImageImports({ look: sourceLook, characterIndex: targetIndex });
  pendingImageImports.set(transaction.targetKey, transaction);
  try {
    await writeCharacterAsset(assetKey, { originalBlob: file, cutoutBlob: null });
  } catch {
    if (isCurrentImageImport(transaction) && operationEpoch === workspaceEpoch) {
      setSaveStatus(t("status.imageSaveFailed"), true);
      if (notify && getSelectedLook() === sourceLook) showToast(t("toast.imageLoadFailed"));
    }
    releaseImageImport(transaction);
    disposeImageImport(transaction);
    return false;
  }
  if (!isCurrentImageImport(transaction)) {
    releaseImageImport(transaction);
    disposeImageImport(transaction);
    return false;
  }
  commitImageImport(transaction);
  releaseImageImport(transaction);
  if (render) {
    if (getSelectedLook() === sourceLook) renderAll();
    saveState();
  }
  if (notify && getSelectedLook() === sourceLook) showToast(t("toast.imageLoaded"));
  return true;
}

async function handleImageFiles(fileList) {
  const requestedFiles = Array.from(fileList || []);
  const files = requestedFiles.slice(0, 5);
  if (!files.length) return;
  const operationEpoch = workspaceEpoch;
  const sourceLook = getSelectedLook();
  const lookId = sourceLook.id;
  const previousCharacterCount = state.characterCount;
  const previousSelectedCharacter = state.selectedCharacter;
  recordHistory();
  const startIndex = state.selectedCharacter;
  const capacity = state.characters.length - startIndex;
  const queuedFiles = files.slice(0, capacity);
  const skippedCount = Math.max(0, requestedFiles.length - queuedFiles.length);
  if (queuedFiles.length > 1) state.characterCount = Math.max(state.characterCount, startIndex + queuedFiles.length);
  // Assign the whole batch to its originating look before yielding to card navigation.
  const imports = queuedFiles.map((file, offset) =>
    handleImageFile(file, startIndex + offset, { render: false, notify: false }));
  state.selectedCharacter = startIndex;
  syncSelectedCharacter();
  renderAll();
  const importedCount = (await Promise.all(imports)).filter(Boolean).length;
  if (operationEpoch !== workspaceEpoch) return;
  if (importedCount) {
    if (getSelectedLook() === sourceLook) {
      state.selectedCharacter = startIndex;
      syncSelectedCharacter();
      renderAll();
    }
    saveState();
  } else {
    state.characterCount = previousCharacterCount;
    state.selectedCharacter = Math.min(previousSelectedCharacter, previousCharacterCount - 1);
    if (sourceLook.editor) {
      sourceLook.editor.characterCount = previousCharacterCount;
      sourceLook.editor.selectedCharacter = Math.min(previousSelectedCharacter, previousCharacterCount - 1);
    }
    if (getSelectedLook() === sourceLook) {
      syncSelectedCharacter();
      renderAll();
    }
    saveState();
  }
  if (lookId !== state.selectedLookId) return;
  if (!importedCount) {
    showToast(t("toast.noValidImages"));
    return;
  }
  if (skippedCount > 0) {
    showToast(t("toast.imagesPlacedLimited", { count: importedCount, skipped: skippedCount }));
    return;
  }
  showToast(importedCount > 1 ? t("toast.imagesPlaced", { count: importedCount }) : t("toast.imageLoaded"));
}

function resetSelectedImagePlacement({ notify = true } = {}) {
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ imageFit: "contain", zoom: 100, panX: 0, panY: 0, focalPoint: null });
  renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  if (!imageEditorOpen) saveState();
  if (notify && !imageEditorOpen) showToast(t("toast.imageFit"));
}

function resetSelectedImagePosition({ notify = true } = {}) {
  if (state.panX === 0 && state.panY === 0) return;
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ panX: 0, panY: 0 });
  renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  if (!imageEditorOpen) saveState();
  if (notify && !imageEditorOpen) showToast(t("toast.imageCentered"));
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
  renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  if (!imageEditorOpen) saveState();
}

function changeSelectedImageZoom(delta) {
  if (imageEditorOpen) imageEditorDirty = true;
  else recordHistory();
  updateSelectedImageState({ zoom: clamp(state.zoom + delta, 70, 180) });
  renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
  if (!imageEditorOpen) saveState();
}

async function quickCutout() {
  if ($("#cutoutButton").disabled) return;
  const targetCharacter = state.characters[state.selectedCharacter];
  if (!resolveCharacterAsset(targetCharacter, "source")) {
    showToast(t("image.addFirst"));
    return;
  }
  if (state.cutout) {
    recordHistory();
    const character = state.characters[state.selectedCharacter];
    character.src = character.originalSrc;
    character.fileMeta = getDisplayImageFileMeta(character.fileMeta, false);
    character.cutout = false;
    character.focalPoint = null;
    syncSelectedCharacter();
    renderCast();
    renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
    saveState();
    showToast(t("toast.originalRestored"));
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
  cutoutProcessingKey = "cutout.processing";
  cutoutProgress = null;
  label.textContent = t("cutout.processing");

  const finishProcessing = () => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("is-processing");
    cutoutProcessingKey = "cutout.processing";
    cutoutProgress = null;
    syncCutoutActionLabel();
  };

  let resultUrl = "";
  let applied = false;
  try {
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error(t("image.sourceReadFailed"));
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
        processingTier = "server";
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
          serverError = new Error(detail.error || t("image.serverFailed"));
        }
      }
    } catch {
      // Continue to the browser model when the optional API is unavailable.
    }
    if (!resultBlob && serverError) throw serverError;
    if (!resultBlob) {
      if (!globalThis.TuyeongSetMaker2BackgroundRemoval?.removeInBrowser) throw new Error(t("image.moduleMissing"));
      cutoutProcessingKey = "cutout.browserPreparing";
      syncCutoutActionLabel();
      const browserResult = await globalThis.TuyeongSetMaker2BackgroundRemoval.removeInBrowser(sourceBlob, {
        onProgress: (progress) => {
          if (progress.status === "progress" && Number.isFinite(progress.progress)) {
            cutoutProgress = Math.round(progress.progress);
            syncCutoutActionLabel();
          }
        },
      });
      resultBlob = browserResult.blob;
      processingTier = browserResult.tier;
    }
    resultBlob = await preserveCutoutSource(sourceBlob, resultBlob);
    resultUrl = createAssetUrl(resultBlob);
    let image;
    let subjectBounds;
    try {
      image = await loadCanvasImage(resultUrl);
      subjectBounds = assertVisibleCutoutImage(image);
    } catch (error) {
      URL.revokeObjectURL(resultUrl);
      throw error;
    }
    if (!isCurrentSource()) {
      URL.revokeObjectURL(resultUrl);
      assetUrls.delete(resultUrl);
      scheduleAssetCleanup();
      showToast(t("toast.cutoutStale"));
      return;
    }
    try {
      await writeCharacterAsset(targetCharacter.assetKey, { cutoutBlob: resultBlob });
    } catch {
      URL.revokeObjectURL(resultUrl);
      assetUrls.delete(resultUrl);
      showToast(t("toast.cutoutStorageFailed"));
      return;
    }
    if (!isCurrentSource()) {
      URL.revokeObjectURL(resultUrl);
      assetUrls.delete(resultUrl);
      scheduleAssetCleanup();
      showToast(t("toast.cutoutStale"));
      return;
    }
    recordHistory();
    Object.assign(targetCharacter, {
      src: resultUrl,
      fileMeta: `${image.naturalWidth} × ${image.naturalHeight} · ${t("image.backgroundRemoved")}`,
      cutout: true,
      focalPoint: CropPlan.focalPointFromSubjectBounds(subjectBounds),
    });
    applied = true;
    syncSelectedCharacter();
    renderCast();
    renderStyles();
    saveState();
    const processingTierLabel = processingTier === "server" ? t("cutout.server") : processingTier;
    showToast(t("toast.cutoutComplete", {
      width: image.naturalWidth,
      height: image.naturalHeight,
      tier: processingTierLabel ? ` · ${processingTierLabel}` : "",
    }));
  } catch (error) {
    if (resultUrl && !applied) {
      URL.revokeObjectURL(resultUrl);
      assetUrls.delete(resultUrl);
      scheduleAssetCleanup();
    }
    showToast(getUserFacingError(error, "toast.imageProcessFailed"));
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

async function preserveCutoutSource(sourceBlob, maskBlob) {
  const sourceObjectUrl = URL.createObjectURL(sourceBlob);
  const maskObjectUrl = URL.createObjectURL(maskBlob);
  const canvas = document.createElement("canvas");
  try {
    const [source, mask] = await Promise.all([
      loadCanvasImage(sourceObjectUrl), loadCanvasImage(maskObjectUrl),
    ]);
    if (source.naturalWidth !== mask.naturalWidth || source.naturalHeight !== mask.naturalHeight) {
      throw new Error("배경 제거 결과의 크기가 원본과 다릅니다.");
    }
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("배경 제거 결과를 그릴 수 없습니다.");
    context.drawImage(source, 0, 0);
    const original = context.getImageData(0, 0, canvas.width, canvas.height);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(mask, 0, 0);
    const alpha = context.getImageData(0, 0, canvas.width, canvas.height);
    original.data.set(ImageValidation.applyCutoutAlpha(original, alpha));
    context.putImageData(original, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("배경 제거 결과를 PNG로 변환하지 못했습니다.")),
      "image/png",
    ));
  } finally {
    URL.revokeObjectURL(sourceObjectUrl);
    URL.revokeObjectURL(maskObjectUrl);
    canvas.width = canvas.height = 0;
  }
}

function assertVisibleCutoutImage(image) {
  const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
  const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
  const sampleScale = Math.min(1, 256 / sourceWidth, 256 / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * sampleScale));
  const height = Math.max(1, Math.round(sourceHeight * sampleScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error(t("image.resultMissing"));
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  canvas.width = canvas.height = 0;
  if (maxX < 0 || maxY < 0) throw new Error(t("image.resultEmpty"));
  return {
    left: minX / width,
    top: minY / height,
    right: (maxX + 1) / width,
    bottom: (maxY + 1) / height,
  };
}

let exportInProgress = false;
function exportRevision() {
  return JSON.stringify([workspaceEpoch, state.selectedLookId, state.language, createSnapshot()]);
}
function captureExportCopy() {
  const board = elements.board.getBoundingClientRect();
  const viewScale = getCanvasViewScale();
  const layoutBoardWidth = board.width / viewScale;
  const scale = getExportDimensions().layoutWidth / layoutBoardWidth;
  return [elements.boardTitle, elements.boardSubtitle, elements.boardCopyright].filter((element) => {
    if (!element) return false;
    return element === elements.boardTitle || element === elements.boardCopyright || Boolean(element.textContent.trim());
  }).map(element => {
    const style = getComputedStyle(element);
    const textAlign = ["left", "center", "right"].includes(style.textAlign) ? style.textAlign : "left";
    const uppercaseCopy = style.textTransform === "uppercase";
    const lines = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      for (let index = 0; index < node.length; index++) {
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        let line = lines.find(item => Math.abs(item.top - rect.top) < 1);
        if (!line) {
          line = { text: "", top: rect.top, left: rect.left, right: rect.right, y: ((rect.top - board.top) / viewScale) * scale, height: (rect.height / viewScale) * scale };
          lines.push(line);
        } else {
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.height = Math.max(line.height, (rect.height / viewScale) * scale);
        }
        const character = node.textContent[index];
        line.text += uppercaseCopy ? character.toUpperCase() : character;
      }
    }
    const positionedLines = lines.map(({ left, right, ...line }) => ({
      ...line,
      x: (((textAlign === "right" ? right : textAlign === "center" ? (left + right) / 2 : left) - board.left) / viewScale) * scale,
    }));
    return { lines: positionedLines, textAlign, font: `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`,
      color: style.color, opacity: Number.parseFloat(style.opacity) || 1,
      stroke: element === elements.boardTitle ? state.titleOutline.width * scale : 0,
      strokeColor: state.titleOutline.color, letterSpacing: (parseFloat(style.letterSpacing) || 0) * scale,
      fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
      textDecoration: style.textDecorationLine.includes("underline") ? "underline" : "none" };
  });
}

function captureExportLineupInfo(gear, snapshot, dimensions) {
  if (snapshot.characterCount < 3 || !snapshot.multiInfoEnabled || elements.multiInfoLayer?.hidden) return gear;
  const board = elements.board?.getBoundingClientRect();
  const viewScale = getCanvasViewScale();
  if (!board?.width || !board.height || !viewScale) return gear;
  const layoutBoardWidth = board.width / viewScale;
  const scale = dimensions.layoutWidth / layoutBoardWidth;
  const columns = Array.from(elements.multiInfoLayer?.querySelectorAll(".multi-info-column") || []);
  if (columns.length !== snapshot.characterCount) return gear;
  const toLayoutRect = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: ((rect.left + rect.width / 2 - board.left) / viewScale) * scale,
      y: ((rect.top - board.top) / viewScale) * scale,
      width: (rect.width / viewScale) * scale,
      height: (rect.height / viewScale) * scale,
    };
  };
  const captureFont = (element) => {
    if (!element) return "";
    const style = getComputedStyle(element);
    return {
      font: `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`,
      size: parseFloat(style.fontSize) * scale,
    };
  };
  return gear.map((items, characterIndex) => {
    const column = columns[characterIndex];
    if (!column) return items;
    const domItems = Array.from(column.querySelectorAll(":scope .multi-info-item"));
    return items.map((item, itemIndex) => {
      const domItem = domItems[itemIndex];
      const primary = domItem?.querySelector(":scope > span");
      if (!primary) return item;
      const secondary = domItem.querySelector(":scope > small");
      const primaryRect = toLayoutRect(primary);
      const secondaryRect = secondary ? toLayoutRect(secondary) : null;
      const primaryFont = captureFont(primary);
      const secondaryFont = captureFont(secondary);
      return {
        ...item,
        preview: {
          x: primaryRect.x,
          primaryY: primaryRect.y,
          secondaryY: secondaryRect?.y ?? null,
          primaryFont: primaryFont.font,
          secondaryFont: secondaryFont.font,
          primarySize: primaryFont.size,
          secondarySize: secondaryFont.size,
          textAlign: getComputedStyle(primary).textAlign,
        },
      };
    });
  });
}

function renderCardCopyPreview(copyLayout = null) {
  const canvas = elements.boardCopyCanvas;
  if (!(canvas instanceof HTMLCanvasElement) || typeof CardCopy === "undefined" || typeof CardCopy.draw !== "function") return null;
  if (elements.board?.dataset.copyFontPending === "true") return null;
  const board = elements.board.getBoundingClientRect();
  if (!board.width || !board.height) return null;
  const dimensions = getExportDimensions();
  const layout = copyLayout || captureExportCopy();
  if (canvas.width !== dimensions.exportWidth || canvas.height !== dimensions.exportHeight) {
    canvas.width = dimensions.exportWidth;
    canvas.height = dimensions.exportHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(CardCopy.outputScale, CardCopy.outputScale);
  CardCopy.draw(context, layout);
  elements.board.dataset.copyRendered = "true";
  return layout;
}

function scheduleCardCopyPreview() {
  if (!(elements.boardCopyCanvas instanceof HTMLCanvasElement) || cardCopyRenderFrame) return;
  cardCopyRenderFrame = window.requestAnimationFrame(() => {
    cardCopyRenderFrame = 0;
    renderCardCopyPreview();
  });
}

async function downloadComposition(event, snapshot = { ...state, characters: state.characters.map(character => ({ ...character })), titleOutline: { ...state.titleOutline }, outline: { ...state.outline }, shadow: { ...state.shadow } }) {
  if (exportInProgress) return;
  const state = snapshot;
  const look = { ...getSelectedLook(), outfits: cloneOutfits(getLookOutfits(getSelectedLook())) };
  const dimensions = getExportDimensions();
  const background = getBackgroundTheme(state);
  const exportTheme = getExportTheme(state);
  let gear = state.characters.map((character, index) => getCharacterItemIds(index, look).map(getItem).filter(Boolean).map(item => ({
    name: getItemName(item, state.language), secondaryName: getSecondaryItemName(item, state.language),
    slot: item.slot, slotName: getOutfitSlotName(item.slot, state.language),
  })));
  const revision = exportRevision();
  const assertUnchanged = () => {
    if (revision !== exportRevision()) throw new Error(t("image.resultChanged"));
  };
  const exportButton = $("#exportButton");
  try {
    const activeCharacters = state.characters.slice(0, state.characterCount);
    const missingCharacterIndex = activeCharacters.findIndex((character) => !resolveCharacterAsset(character, "hero"));
    if (missingCharacterIndex >= 0) {
      showToast(state.characterCount === 1
        ? t("toast.exportMissing")
        : t("toast.characterImageMissing", { number: missingCharacterIndex + 1 }));
      return;
    }
    const titleFontConfig = getTitleFontConfig(state.titleFont);
    state.titleWeight = normaliseTitleWeight(state.titleFont, state.titleWeight ?? defaultTitleWeight);
    const fontLoad = typeof document.fonts?.load === "function"
      ? document.fonts.load(`${state.titleWeight} 64px ${titleFontConfig.family}`)
      : Promise.resolve();
    exportInProgress = true;
    exportButton.setAttribute("aria-busy", "true");
    setExportButtonLabel("export.preparing");
    const fontReady = await Promise.race([fontLoad.then(() => true), new Promise(resolve => window.setTimeout(() => resolve(false), 8000))]);
    if (!fontReady) throw new Error(t("image.fontTimeout"));
    assertUnchanged();
    fitBoardTitle();
    const copyLayout = captureExportCopy();
    renderCardCopyPreview(copyLayout);
    gear = captureExportLineupInfo(gear, state, dimensions);
    const images = await Promise.all(activeCharacters.map((character) => loadCanvasImage(resolveCharacterAsset(character, "hero"))));
    const backgroundSurfaceAsset = backgroundSurfaceAssets[state.backgroundPattern];
    const backgroundImage = backgroundSurfaceAsset
      ? await loadCanvasImage(backgroundSurfaceAsset)
      : null;
    assertUnchanged();
    const infoTextTheme = state.multiInfoMode === "silhouette"
      ? getSilhouetteInfoTheme(background)
      : { foreground: exportTheme.text, muted: exportTheme.muted, halo: exportTheme.infoShadow };
    const board = elements.board.getBoundingClientRect();
    const layoutBoardWidth = board.width / getCanvasViewScale();
    const placementScale = layoutBoardWidth > 0 ? dimensions.layoutWidth / layoutBoardWidth : 1;
    const outputBlob = await CardPng.render({ state, dimensions, exportTheme,
      background, patternStars, images, backgroundImage, copyLayout, gear,
      placementScale, outlineColor: rgba(state.outline.color, 0.8), infoTextColor: infoTextTheme.foreground,
      infoTextMuted: infoTextTheme.muted, infoTextHalo: infoTextTheme.halo });
    assertUnchanged();
    const extension = "png";
    const link = document.createElement("a");
    link.download = `${look.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tuyeong-set-maker2-look"}.${extension}`;
    const objectUrl = URL.createObjectURL(outputBlob);
    link.href = objectUrl;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast(t("toast.exported", { width: dimensions.exportWidth, height: dimensions.exportHeight }));
  } catch (error) {
    showToast(getUserFacingError(error, "toast.exportFailed"));
  } finally {
    exportInProgress = false;
    exportButton.removeAttribute("aria-busy");
    setExportButtonLabel("export.label");
  }
}

function resetStyles() {
  recordHistory();
  state.background = "paper";
  state.customBackgroundColor = customBackgroundDefault;
  state.backgroundPattern = "none";
  state.backgroundTexture = "none";
  const character = state.characters[state.selectedCharacter];
  character.src = character.originalSrc;
  character.fileMeta = getDisplayImageFileMeta(character.fileMeta, false);
  character.cutout = false;
  character.focalPoint = null;
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
  character.focalPoint = null;
  state.multiInfoEnabled = true;
  state.multiInfoMode = "clear";
  state.titleFont = defaultTitleFont;
  state.titleWeight = defaultTitleWeight;
  state.titleFontSize = defaultTitleFontSize;
  state.titleItalic = false;
  state.titleUnderline = false;
  state.titleUppercase = false;
  state.titleAlign = "auto";
  state.titleColor = "";
  state.subtitleFont = defaultTitleFont;
  state.subtitleWeight = defaultSubtitleWeight;
  state.subtitleFontSize = defaultSubtitleFontSize;
  state.subtitleItalic = false;
  state.subtitleUnderline = false;
  state.subtitleUppercase = false;
  state.subtitleColor = "";
  state.singleRatio = "portrait";
  state.singleLayout = "info-left";
  styleAdvancedOpen = false;
  renderAll();
  saveState();
  showToast(t("toast.stylesReset"));
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
  invalidatePendingImageImports({ look });
  const defaults = defaultLookSnapshots.get(look.id) || createLookResetSnapshot(look, looks.indexOf(look));
  recordHistory();
  // Keep assets reachable through undo. Full workspace deletion is permanent.
  look.title = defaults.title;
  look.subtitle = defaults.subtitle;
  look.outfits = cloneOutfits(defaults.outfits);
  ensureLookOutfits(look);
  state.background = defaults.background;
  state.customBackgroundColor = normaliseHexColor(defaults.customBackgroundColor, customBackgroundDefault);
  restoreBackgroundStyle(defaults.backgroundPattern, undefined, defaults.backgroundTexture);
  state.multiInfoEnabled = true;
  state.multiInfoMode = "clear";
  state.titleFont = defaultTitleFont;
  state.titleWeight = defaultTitleWeight;
  state.titleFontSize = normaliseTitleFontSize(defaults.titleFontSize);
  state.titleItalic = normaliseTitleBoolean(defaults.titleItalic);
  state.titleUnderline = normaliseTitleBoolean(defaults.titleUnderline);
  state.titleUppercase = normaliseTitleBoolean(defaults.titleUppercase);
  state.titleAlign = normaliseTitleAlign(defaults.titleAlign);
  state.titleColor = normaliseOptionalHexColor(defaults.titleColor ?? defaults.subtitleColor);
  state.subtitleFont = titleFonts[defaults.subtitleFont] ? defaults.subtitleFont : defaultTitleFont;
  state.subtitleWeight = normaliseTitleWeight(state.subtitleFont, defaults.subtitleWeight ?? defaultSubtitleWeight);
  state.subtitleFontSize = normaliseSubtitleFontSize(defaults.subtitleFontSize);
  state.subtitleItalic = normaliseTitleBoolean(defaults.subtitleItalic);
  state.subtitleUnderline = normaliseTitleBoolean(defaults.subtitleUnderline);
  state.subtitleUppercase = normaliseTitleBoolean(defaults.subtitleUppercase);
  state.subtitleColor = normaliseOptionalHexColor(defaults.subtitleColor);
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
  showToast(t("toast.cardReset"));
}

async function resetWorkspace() {
  workspaceEpoch += 1;
  invalidatePendingImageImports();
  draftSaveSequence += 1;
  if (scheduledSaveTimer) {
    window.clearTimeout(scheduledSaveTimer);
    scheduledSaveTimer = 0;
  }
  clearTimeout(assetCleanupTimer);
  const activePanel = state.activePanel;
  if (imageEditorOpen) finishImageEditor(false);
  try {
    // A late upload must never recreate an asset after permanent deletion.
    await Promise.allSettled([...pendingAssetWrites]);
    await characterAssetVault.clear();
  } catch {
    showToast(t("toast.assetDeleteFailed"));
    return false;
  }
  looks.forEach(look => revokeCharacterAssets(look.editor?.characters || []));
  revokeCharacterAssets();
  for (const url of assetUrls) revokeObjectUrl(url);
  assetUrls.clear();
  let storageFailed = false;
  try {
    await draftStorage.remove(draftStorageKey);
  } catch {
    storageFailed = true;
  }
  [...legacyStorageKeys, uiPreferencesStorageKey, languagePreferenceStorageKey].forEach((key) => {
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
  clearCatalogResults();
  $("#lookSearch").value = "";
  looks = [createBlankLook(1, "look-1")];
  deletedLooks.length = 0;
  looks.forEach(ensureLookOutfits);
  captureDefaultLookSnapshots();
  Object.assign(state, {
    language: I18n.detectLanguage(),
    selectedLookId: "look-1",
    activeSlot: "head",
    characterCount: 1,
    selectedCharacter: 0,
    characters: createEmptyCharacters(),
    background: "paper",
    multiInfoEnabled: true,
    multiInfoMode: "clear",
    titleFont: defaultTitleFont,
    titleWeight: defaultTitleWeight,
    titleFontSize: defaultTitleFontSize,
    titleItalic: false,
    titleUnderline: false,
    titleUppercase: false,
    titleAlign: "auto",
    titleColor: "",
    subtitleFont: defaultTitleFont,
    subtitleWeight: defaultSubtitleWeight,
    subtitleFontSize: defaultSubtitleFontSize,
    subtitleItalic: false,
    subtitleUnderline: false,
    subtitleUppercase: false,
    subtitleColor: "",
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
  uiPreferences.canvasViewZoom = canvasViewZoomDefault;
  styleAdvancedOpen = false;
  applyPageLanguage(state.language);
  syncLibraryPanel();
  saveUiPreferences();
  syncSelectedCharacter();
  renderAll();
  syncCanvasViewZoomControl();
  openPanel(activePanel);
  if (storageFailed) {
    setSaveStatus(t("status.partialDelete"), true);
    showToast(t("toast.partialDeleteDetail"));
  } else {
    setSaveStatus(t("status.emptyWorkspace"));
    showToast(t("toast.workspaceDeleted"));
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
  if (elements.inspectorTitle) elements.inspectorTitle.textContent = t(panelLabels[nextPanel]);
  syncTextEditorDock();
  if (nextPanel === "itemsPanel") ensureMobileControlVisible(elements.itemSearch);
}

function initialiseInteractions() {
  window.addEventListener("pagehide", flushScheduledSaveState);
  initialiseLookManager();
  elements.lookList.addEventListener("click", (event) => {
    const button = event.target.closest(".look-list-item");
    if (!button || !elements.lookList.contains(button)) return;
    selectLook(button.dataset.lookId);
  });
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
    showToast(t("toast.relayout", { count: nextCount }));
  }));
  $("#multiInfoToggle").addEventListener("change", (event) => { recordHistory(); state.multiInfoEnabled = event.target.checked; renderStyles(); saveState(); });
  $$('button[data-info-mode]').forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    recordHistory();
    state.multiInfoMode = button.dataset.infoMode;
    renderStyles();
    saveState();
  }));
  $("#styleAdvancedToggle").addEventListener("click", () => {
    styleAdvancedOpen = !styleAdvancedOpen;
    renderStyles();
  });
  $$('button[data-pattern]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.backgroundPattern = button.dataset.pattern; renderStyles(); saveState(); }));
  $$('button[data-texture]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.backgroundTexture = button.dataset.texture; renderStyles(); saveState(); }));
  $$('button[data-single-ratio]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.singleRatio = button.dataset.singleRatio; renderStyles(); saveState(); showToast(t(button.dataset.singleRatio === "portrait" ? "toast.ratioPortrait" : "toast.ratioLandscape")); }));
  $$('button[data-single-layout]').forEach((button) => button.addEventListener("click", () => { recordHistory(); state.singleLayout = button.dataset.singleLayout; renderStyles(); saveState(); }));
  $("#titleFontSelect")?.addEventListener("change", (event) => setTitleFont(event.target.value));
  elements.textEditorFontSelect?.addEventListener("change", (event) => setTextEditorFont(event.target.value));
  $("#titleWeightOptions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-title-weight]");
    if (!button || Number(button.dataset.titleWeight) === state.titleWeight) return;
    recordHistory();
    state.titleWeight = normaliseTitleWeight(state.titleFont, Number(button.dataset.titleWeight));
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  });
  $$('button[data-title-align]').forEach((button) => button.addEventListener("click", () => {
    const nextAlignment = normaliseTitleAlign(button.dataset.titleAlign);
    if (nextAlignment === state.titleAlign) return;
    recordHistory();
    state.titleAlign = nextAlignment;
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  }));
  $("#focusCardTitleButton")?.addEventListener("click", () => {
    setCopyEditorTarget("title");
    elements.boardTitle?.focus({ preventScroll: true });
  });
  $("#textEditorBoldButton")?.addEventListener("click", toggleTextEditorBold);
  $("#textEditorItalicButton")?.addEventListener("click", () => toggleTextEditorInlineStyle("italic"));
  $("#textEditorUnderlineButton")?.addEventListener("click", () => toggleTextEditorInlineStyle("underline"));
  $("#textEditorUppercaseButton")?.addEventListener("click", () => toggleTextEditorInlineStyle("uppercase"));
  $("#textEditorMoreButton")?.addEventListener("click", toggleTextEditorMoreMenu);
  $$('[data-floating-align]').forEach((button) => button.addEventListener("click", () => {
    const nextAlignment = normaliseTitleAlign(button.dataset.floatingAlign);
    if (nextAlignment === state.titleAlign) return;
    recordHistory();
    state.titleAlign = nextAlignment;
    renderStyles({ refreshInfo: false, refreshPattern: false });
    saveState();
  }));
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
  let dragState = null;
  elements.portraitWrap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".character-image-actions")) return;
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
    renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false, refreshControls: false });
    if (elements.panXRange) {
      elements.panXRange.value = String(state.panX);
      syncRangeControlUi(elements.panXRange);
    }
    if (elements.panYRange) {
      elements.panYRange.value = String(state.panY);
      syncRangeControlUi(elements.panYRange);
    }
    syncImagePlacementSummary();
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
    renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
    if (!imageEditorOpen) saveState();
  }));
  $$('[data-image-nudge]').forEach((button) => button.addEventListener("click", () => nudgeSelectedImage(button.dataset.imageNudge)));
  const bindHistoryRange = (input, update) => {
    if (!input) return;
    let editing = false;
    input.addEventListener("input", () => {
      if (!editing) {
        if (imageEditorOpen) imageEditorDirty = true;
        else recordHistory();
      }
      editing = true;
      update(Number(input.value));
      scheduleLiveStyleRender({ refreshInfo: false, refreshPattern: false, fitTitle: false, refreshControls: false });
      syncRangeControlUi(input);
      if (!imageEditorOpen) scheduleSaveState();
    });
    const finish = () => {
      if (!editing) return;
      editing = false;
      flushScheduledSaveState();
      if (!flushLiveStyleRender({ refreshControls: true })) {
        renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
      }
    };
    input.addEventListener("change", finish);
    input.addEventListener("blur", finish);
  };
  bindHistoryRange(elements.zoomRange, value => { updateSelectedImageState({ zoom: value }); });
  bindHistoryRange(elements.panXRange, value => { updateSelectedImageState({ panX: value }); });
  bindHistoryRange(elements.panYRange, value => { updateSelectedImageState({ panY: value }); });
  bindHistoryRange($("#outlineRange"), value => { state.outline.width = value; });
  bindHistoryRange(elements.titleOutlineRange, value => { state.titleOutline.width = value; });
  bindHistoryRange(elements.textEditorOutlineRange, value => { state.titleOutline.width = value; });
  bindHistoryRange($("#shadowRange"), value => { state.shadow.strength = value; });
  const bindColorInput = (input, update) => {
    if (!input) return;
    let editing = false;
    input.addEventListener("input", () => {
      if (!editing) {
        recordHistory();
        editing = true;
      }
      update(input.value);
      scheduleLiveStyleRender({ refreshInfo: false, refreshPattern: false, fitTitle: false, refreshControls: false });
      scheduleSaveState();
    });
    const finish = () => {
      if (!editing) return;
      editing = false;
      flushScheduledSaveState();
      if (!flushLiveStyleRender({ refreshControls: true })) {
        renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
      }
    };
    input.addEventListener("change", finish);
    input.addEventListener("blur", finish);
  };
  bindColorInput($("#titleOutlineColorInput"), (value) => {
    state.titleOutline.color = normaliseHexColor(value, "#ffffff");
  });
  bindColorInput(elements.textEditorOutlineColorInput, (value) => {
    const color = normaliseHexColor(value, "#ffffff");
    state.titleOutline.color = color;
    elements.textEditorOutlineColorMark?.style.setProperty("--dock-outline-color", color);
    if (elements.textEditorOutlineColorValue) elements.textEditorOutlineColorValue.textContent = color.toUpperCase();
  });
  bindColorInput(elements.outlineColorInput, (value) => {
    const color = normaliseHexColor(value, "#f1dfbb");
    state.outline.color = color;
    if (elements.outlineColorValue) elements.outlineColorValue.textContent = color.toUpperCase();
  });
  bindColorInput($("#titleColorInput"), (value) => {
    state.titleColor = normaliseHexColor(value, defaultTitleColor());
  });
  bindColorInput(elements.textEditorColorInput, (value) => {
    const style = getCopyEditorStyle();
    state[style.fields.color] = normaliseHexColor(value, defaultTitleColor());
  });
  bindColorInput($("#customBackgroundColorInput"), (value) => {
    state.background = "custom";
    state.customBackgroundColor = normaliseHexColor(value, customBackgroundDefault);
  });
  $("#titleColorAutoButton")?.addEventListener("click", resetTitleColorToAuto);
  $("#textEditorColorAutoButton")?.addEventListener("click", resetTextEditorColorToAuto);
  $$("#outlineSwatches .color-swatch").forEach((swatch) => swatch.addEventListener("click", () => { recordHistory(); state.outline.color = swatch.dataset.color; renderStyles(); saveState(); }));
  $$(".title-outline-swatch").forEach((swatch) => swatch.addEventListener("click", () => {
    if (swatch.dataset.titleOutlineColor === state.titleOutline.color) return;
    recordHistory();
    state.titleOutline.color = swatch.dataset.titleOutlineColor;
    renderStyles({ refreshInfo: false, refreshPattern: false, fitTitle: false });
    saveState();
  }));
  $$(".backdrop-swatch").forEach((swatch) => swatch.addEventListener("click", () => {
    const nextBackground = backgrounds[swatch.dataset.background] ? swatch.dataset.background : "paper";
    if (nextBackground === state.background) return;
    recordHistory();
    state.background = nextBackground;
    renderStyles();
    saveState();
  }));
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
  elements.canvasViewZoomRange?.addEventListener("input", (event) => setCanvasViewZoom(event.currentTarget.value, { persist: false }));
  elements.canvasViewZoomRange?.addEventListener("change", () => saveUiPreferences());
  elements.canvasViewZoomOut?.addEventListener("click", () => setCanvasViewZoom(uiPreferences.canvasViewZoom - canvasViewZoomStep));
  elements.canvasViewZoomIn?.addEventListener("click", () => setCanvasViewZoom(uiPreferences.canvasViewZoom + canvasViewZoomStep));
  elements.canvasViewFitButton?.addEventListener("click", resetCanvasViewZoom);
  elements.canvasViewFocusButton?.addEventListener("click", () => setCanvasFocusMode(!document.body.classList.contains("canvas-focus-mode")));
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
    const button = $("#confirmWorkspaceDelete"); button.disabled = true; button.textContent = t("dialog.deleting");
    try {
      const completed = await resetWorkspace();
      if (completed) $("#deleteWorkspaceDialog").close();
    }
    finally { button.disabled = false; button.textContent = t("dialog.deleteConfirm"); }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest(".reset-control") && !$("#resetMenu")?.hidden) setResetMenuOpen(false);
    if (!event.target.closest(".look-search-control") && $("#lookSearchField")?.classList.contains("is-mobile-open")) setMobileLookSearchOpen(false);
    if (!event.target.closest(".text-editor-dock, #textEditorMoreMenu") && !$("#textEditorMoreMenu")?.hidden) closeTextEditorMoreMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#textEditorMoreMenu")?.hidden) {
      event.preventDefault();
      closeTextEditorMoreMenu();
      $("#textEditorMoreButton")?.focus({ preventScroll: true });
      return;
    }
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
  elements.saveRetryButton?.addEventListener("click", () => { void saveState({ immediate: true }); });
  $("#itemSearch").addEventListener("input", scheduleCatalogSearch);
  elements.catalogResults.addEventListener("click", (event) => {
    const result = event.target.closest(".catalog-result");
    if (!result || !elements.catalogResults.contains(result)) return;
    void linkItem(result.dataset.itemId);
  });
  elements.languageSelect.addEventListener("change", (event) => {
    state.language = I18n.normaliseLanguage(event.currentTarget.value);
    persistLanguagePreference(state.language);
    applyPageLanguage(state.language);
    renderAll();
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
    const resolveFallback = () => typeof fallback === "function" ? fallback() : fallback;
    let editSnapshot;
    element.addEventListener("focus", () => {
      editSnapshot = createSnapshot();
      element.dataset.editStart = getSelectedLook()[field] || "";
      element.dataset.editing = "true";
      elements.board.dataset.copyEditing = "true";
      setCopyEditorTarget(field);
    });
    element.addEventListener("input", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(element.textContent || "");
      look[field] = value || resolveFallback();
      if (field === "title") scheduleBoardTitleFit();
      scheduleCardCopyPreview();
      if (field === "title") {
        document.title = getDocumentTitle(look);
        syncLookListTitle(look);
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
        look[field] = element.dataset.editStart || resolveFallback();
        element.textContent = field === "title" ? getLookTitle(look) : look[field];
        element.blur();
      }
    });
    element.addEventListener("blur", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(element.textContent || "");
      look[field] = value || resolveFallback();
      if (editSnapshot && look[field] !== editSnapshot[field]) recordHistory(editSnapshot);
      editSnapshot = null;
      element.dataset.editing = "false";
      elements.board.dataset.copyEditing = "false";
      renderLook();
      saveState();
    });
  };
  bindInlineCardField(elements.boardTitle, "title", () => "새로운 룩");
  bindInlineCardField(elements.boardSubtitle, "subtitle");
  const bindCopyEditorField = (input, count, field, fallback = "") => {
    const resolveFallback = () => typeof fallback === "function" ? fallback() : fallback;
    let editSnapshot;
    input.addEventListener("focus", () => {
      editSnapshot = createSnapshot();
      input.dataset.editStart = getSelectedLook()[field] || "";
      setCopyEditorTarget(field);
    });
    input.addEventListener("input", () => {
      const look = getSelectedLook();
      look[field] = input.value;
      elements.boardTitle.textContent = getLookTitle(look);
      elements.boardSubtitle.textContent = look.subtitle || "";
      elements.boardSubtitle.dataset.empty = String(!look.subtitle);
      if (field === "title") scheduleBoardTitleFit();
      scheduleCardCopyPreview();
      if (field === "title") {
        document.title = getDocumentTitle(look);
        syncLookListTitle(look);
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
        look[field] = input.dataset.editStart || resolveFallback();
        input.value = field === "title" ? getLookTitle(look) : look[field];
        input.blur();
      }
    });
    input.addEventListener("blur", () => {
      const look = getSelectedLook();
      const value = normaliseInlineText(input.value);
      look[field] = value || resolveFallback();
      if (editSnapshot && look[field] !== editSnapshot[field]) recordHistory(editSnapshot);
      editSnapshot = null;
      renderLook();
      saveState();
    });
  };
  bindCopyEditorField(elements.cardTitleInput, elements.cardTitleCount, "title", () => "새로운 룩");
  bindCopyEditorField(elements.cardSubtitleInput, elements.cardSubtitleCount, "subtitle");
  const titleBlock = elements.boardTitle?.parentElement;
  if (titleBlock instanceof HTMLElement && "ResizeObserver" in window) {
    boardTitleResizeObserver?.disconnect();
    boardTitleResizeObserver = new ResizeObserver(() => {
      scheduleBoardTitleFit();
      scheduleCardCopyPreview();
    });
    boardTitleResizeObserver.observe(titleBlock);
  }
  // ResizeObserver and requestAnimationFrame keep viewport changes from
  // forcing a synchronous title measurement for every resize event.
  window.addEventListener("resize", () => {
    scheduleBoardTitleFit();
    scheduleCardCopyPreview();
  }, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(() => {
    fitBoardTitle();
    scheduleCardCopyPreview();
  });
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    if (imageEditorOpen && event.key === "Escape") {
      event.preventDefault();
      finishImageEditor(false);
      return;
    }
    if (imageEditorOpen && (event.metaKey || event.ctrlKey)) { event.preventDefault(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveState(); showToast(t("toast.saved")); }
    const editingCardCopy = event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.matches("input, textarea, select"));
    if (!editingCardCopy && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (document.body.classList.contains("canvas-focus-mode")) setCanvasFocusMode(false);
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
  showToast(t("toast.lookCreated"));
}

function initialiseLookManager() {
  const dialog = $("#lookManagerDialog");
  const input = $("#lookNameInput");
  const status = $("#lookManagerStatus");
  const duplicate = $("#duplicateLookButton");
  const restore = $("#restoreDeletedLookButton");
  const update = () => {
    input.value = getLookTitle(getSelectedLook());
    input.setCustomValidity("");
    dialog.querySelectorAll('form button, form input, #deleteLookButton').forEach(control => { control.disabled = lookCopyInProgress; });
    duplicate.disabled = lookCopyInProgress;
    duplicate.textContent = lookCopyInProgress ? t("manager.duplicateInProgress") : t("manager.duplicate");
    duplicate.setAttribute("aria-busy", String(lookCopyInProgress));
    restore.disabled = lookCopyInProgress || !deletedLooks.length;
    restore.textContent = deletedLooks.length ? t("manager.restoreCount", { count: deletedLooks.length }) : t("manager.restore");
  };
  $("#manageLookButton").addEventListener("click", () => {
    setMobileLookSearchOpen(false);
    status.removeAttribute("data-i18n");
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
    if (!title) { input.setCustomValidity(t("manager.nameRequired")); input.reportValidity(); return; }
    if (getSelectedLook().title !== title) {
      recordHistory();
      getSelectedLook().title = title;
      $("#lookSearch").value = "";
      renderAll();
      saveState();
    }
    dialog.close();
    showToast(t("toast.lookRenamed"));
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
    status.dataset.i18n = "manager.duplicating";
    status.textContent = t("manager.duplicating");
    update();
    try {
      await Promise.all([...pendingAssetWrites]);
      if (!isCurrent()) return;
      const copy = await LookBook.copy(snapshot, { createId: createAssetKey,
        readAsset: characterAssetVault.read, writeAsset: writeCharacterAsset, isCurrent,
        copyTitle: (sourceLook) => `${getLookTitle(sourceLook)} ${t("look.copySuffix")}` });
      if (!copy || !isCurrent()) return;
      // The copy owns a new IndexedDB key. Rehydrate fresh Blob URLs before it
      // becomes visible; revoking the source URL later must never break both
      // looks at once.
      copy.editor?.characters?.forEach((character) => {
        character.src = "";
        character.originalSrc = "";
      });
      await restoreCharacterAssets(copy.editor?.characters, copy.editor?.characters, { sync: false });
      if (!isCurrent()) return;
      looks.splice(looks.indexOf(source) + 1, 0, copy);
      captureDefaultLookSnapshots();
      $("#lookSearch").value = "";
      if (state.selectedLookId === source.id) selectLook(copy.id);
      else { renderLookList(); saveState(); }
      dialog.close();
      showToast(t("toast.lookDuplicated"));
    } catch (error) {
      if (isCurrent()) {
        status.removeAttribute("data-i18n");
        status.textContent = getUserFacingError(error, "manager.duplicateFailed");
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
    status.removeAttribute("data-i18n");
    status.textContent = t("toast.lookDeleted", { title: getLookTitle(source) });
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
    status.removeAttribute("data-i18n");
    status.textContent = t("toast.lookRestored", { title: getLookTitle(look) });
    input.focus();
  });
}

async function bootstrap() {
  migrateLegacyStorage();
  purgeLegacyStorage();
  restoreUiPreferences();
  syncLibraryPanel();
  await loadDraft();
  applyPageLanguage(state.language);
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
  if (elements.board instanceof HTMLElement && "ResizeObserver" in window) {
    canvasViewResizeObserver?.disconnect();
    canvasViewResizeObserver = new ResizeObserver(() => syncCanvasViewZoomControl());
    canvasViewResizeObserver.observe(elements.board);
  }
  const preview = document.querySelector(".canvas-column");
  new ResizeObserver(([entry]) => {
    const height = entry?.contentRect?.height;
    if (Number.isFinite(height)) document.documentElement.style.setProperty("--preview-height", `${height}px`);
  }).observe(preview);
  renderAll();
  syncCanvasViewZoomControl();
  syncCanvasFocusControls(document.body.classList.contains("canvas-focus-mode"));
  openPanel(state.activePanel);
  scheduleAssetCleanup();
}

void bootstrap();

