const assert = require("node:assert/strict");
const BackgroundStyle = require("../models/background-style.js");
const CardMaterials = require("../models/card-materials.js");
const ColorContrast = require("../models/color-contrast.js");
const LookEditor = require("../models/look-editor.js");
const LookRecord = require("../models/look-record.js");
const TitleTypography = require("../models/title-typography.js");

const titleTypography = TitleTypography.create({
  fonts: {
    pretendard: { label: "Pretendard", family: "sans-serif", weights: [400, 700] },
    sketch: { label: "Sketch", family: "cursive", weights: [400] },
  },
});
const backgroundStyle = BackgroundStyle.create({
  colorContrast: ColorContrast,
  cardMaterials: CardMaterials,
});
const outfitSlots = ["head", "body", "hands", "legs", "feet"];

function createOutfit(itemIds = []) {
  return Object.fromEntries(outfitSlots.map((slot, index) => [slot, itemIds[index] || null]));
}

function createOutfits(itemIds = []) {
  return Array.from({ length: 5 }, () => createOutfit(itemIds));
}

function cloneOutfits(outfits) {
  return (outfits || []).map((outfit) => Object.fromEntries(outfitSlots.map((slot) => {
    const value = String(outfit?.[slot] ?? "");
    return [slot, /^\d{1,32}$/.test(value) ? value : null];
  })));
}

function ensureOutfits(look) {
  if (!Array.isArray(look.outfits) || !look.outfits.length) look.outfits = createOutfits([]);
  while (look.outfits.length < 5) look.outfits.push(createOutfit([]));
  look.outfits = cloneOutfits(look.outfits.slice(0, 5));
  return look.outfits;
}

function normaliseHexColor(value, fallback = "") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

function normaliseOutline(value, fallbackColor, maxWidth) {
  return {
    color: normaliseHexColor(value?.color, fallbackColor),
    width: Number.isFinite(Number(value?.width)) ? Math.min(maxWidth, Math.max(0, Number(value.width))) : 0,
  };
}

const record = LookRecord.create({
  createBlankLook: (number, id) => ({
    id,
    title: "새로운 룩",
    subtitle: "",
    background: "paper",
    customBackgroundColor: "#f7f5f0",
    backgroundPattern: "none",
    backgroundTexture: "none",
    titleFont: titleTypography.defaultFont,
    titleWeight: titleTypography.defaultWeight,
    titleFontSize: 16,
    titleItalic: false,
    titleUnderline: false,
    titleUppercase: false,
    titleAlign: "auto",
    titleColor: "",
    subtitleFont: titleTypography.defaultFont,
    subtitleWeight: 400,
    subtitleFontSize: 10,
    subtitleItalic: false,
    subtitleUnderline: false,
    subtitleUppercase: false,
    subtitleColor: "",
    outline: { color: "#f1dfbb", width: 0 },
    titleOutline: { color: "#ffffff", width: 0 },
    outfits: createOutfits([]),
  }),
  editor: LookEditor,
  title: {
    fonts: titleTypography.fonts,
    defaultFont: titleTypography.defaultFont,
    defaultWeight: titleTypography.defaultWeight,
    defaultSubtitleWeight: 400,
    normalizeTitleFontSize: (value) => Math.min(72, Math.max(8, Number.isFinite(Number(value)) ? Number(value) : 16)),
    normalizeSubtitleFontSize: (value) => Math.min(48, Math.max(6, Number.isFinite(Number(value)) ? Number(value) : 10)),
    normalizeBoolean: (value) => value === true || value === "true",
    normalizeWeight: titleTypography.normalizeWeight,
    normalizeAlign: (value) => ["auto", "left", "center", "right"].includes(value) ? value : "auto",
  },
  backgroundStyle,
  colors: {
    normalizeOptionalHex: (value) => normaliseHexColor(value, ""),
    normalizeOutline: normaliseOutline,
  },
  outfits: {
    create: createOutfits,
    clone: cloneOutfits,
    ensure: ensureOutfits,
    get: (look) => ensureOutfits(look),
  },
});

const normalized = record.normalizeSaved({
  id: "  saved-look  ",
  title: "  기억할 룩  ",
  background: "charcoal",
  backgroundPattern: "index",
  backgroundTexture: "grain",
  titleFont: "missing",
  titleWeight: 900,
  editor: { characterCount: 2, selectedCharacter: 4, characters: [{ src: "blob:runtime" }] },
  outfits: [{ head: "123", body: "bad" }],
}, 0);
assert.equal(normalized.id, "saved-look");
assert.equal(normalized.title, "기억할 룩");
assert.equal(normalized.background, "charcoal");
assert.equal(normalized.backgroundPattern, "collage");
assert.equal(normalized.backgroundTexture, "grain");
assert.equal(normalized.titleFont, "pretendard");
assert.equal(normalized.titleWeight, 700);
assert.equal(normalized.editor.characterCount, 2);
assert.equal(normalized.editor.selectedCharacter, 1);
assert.equal(normalized.outfits.length, 5);
assert.equal(normalized.outfits[0].body, null);

const serialized = record.serialize({
  id: "runtime-look",
  title: "룩",
  subtitle: "설명",
  background: "missing",
  customBackgroundColor: "not-a-color",
  backgroundPattern: "stars",
  backgroundTexture: "halftone",
  titleFont: "sketch",
  titleWeight: 400,
  outfits: createOutfits(["456"]),
  editor: {
    ...LookEditor.create(),
    characters: [{ src: "blob:runtime", originalSrc: "blob:original", assetKey: "asset-1" }],
  },
});
assert.equal(serialized.background, "paper");
assert.equal(serialized.customBackgroundColor, "#f7f5f0");
assert.equal(serialized.editor.characters[0].src, undefined);
assert.equal(serialized.editor.characters[0].assetKey, "asset-1");
assert.equal(serialized.outfits.length, 5);
assert.equal(record.normalizeSaved(null, 1).id, "look-2");

console.log("PASS: look record serialization and restoration share one normalized persisted shape without runtime image URLs.");
