const assert = require("node:assert/strict");
const DraftSchema = require("../models/draft-schema.js");

const emptyCharacter = () => ({
  assetKey: null,
  fileName: "이미지를 추가하세요",
  fileMeta: "PNG, JPG 또는 WebP · 아직 선택하지 않음",
  cutout: false,
  imageFit: "contain",
  zoom: 100,
  panX: 0,
  panY: 0,
  focalPoint: null,
});

const firstCharacter = emptyCharacter();
const selectedCharacter = { ...emptyCharacter(), cutout: true, zoom: 140, panX: -12, panY: 18, imageFit: "cover" };
const look = {
  id: "look-2",
  title: "Night set",
  subtitle: "A quiet silhouette",
  background: "ink",
  customBackgroundColor: "#f7f5f0",
  backgroundPattern: "dots",
  backgroundTexture: "grain",
  titleFont: "pretendard",
  titleWeight: 700,
  titleFontSize: 16,
  titleItalic: false,
  titleUnderline: false,
  titleUppercase: false,
  titleAlign: "center",
  titleColor: "",
  subtitleFont: "pretendard",
  subtitleWeight: 400,
  subtitleFontSize: 10,
  subtitleItalic: false,
  subtitleUnderline: false,
  subtitleUppercase: false,
  subtitleColor: "",
  outline: { color: "#f1dfbb", width: 2 },
  titleOutline: { color: "#ffffff", width: 1 },
  outfits: [{ head: "100", body: null, hands: null, legs: null, feet: null }],
  editor: {
    characterCount: 2,
    selectedCharacter: 1,
    singleRatio: "landscape",
    singleLayout: "info-right",
    multiInfoEnabled: true,
    multiInfoMode: "fade",
    shadow: { strength: 20, x: 8, y: 12, blur: 24 },
    characters: [firstCharacter, selectedCharacter, emptyCharacter(), emptyCharacter(), emptyCharacter()],
  },
};

const snapshot = DraftSchema.create({
  looks: [look],
  selectedLookId: look.id,
  language: "ko",
  catalogItems: [{ id: "100", slot: "head" }],
});

assert.equal(snapshot.version, 3);
assert.equal(snapshot.selectedLookId, "look-2");
assert.equal(snapshot.title, "Night set");
assert.equal(snapshot.background, "ink");
assert.equal(snapshot.characterCount, 2);
assert.equal(snapshot.selectedCharacter, 1);
assert.equal(snapshot.cutout, true);
assert.equal(snapshot.zoom, 140);
assert.equal(snapshot.panX, -12);
assert.equal(snapshot.panY, 18);
assert.equal(snapshot.imageFit, "cover");
assert.deepEqual(snapshot.outfits, look.outfits);
assert.deepEqual(snapshot.characters, look.editor.characters);
assert.deepEqual(snapshot.catalogItems, [{ id: "100", slot: "head" }]);
assert.deepEqual(snapshot.looks[0].extraEquipment, [[], [], [], [], []], "old drafts should gain default per-character extra arrays");
assert.deepEqual(snapshot.extraEquipment, [[], [], [], [], []]);
assert.deepEqual(snapshot.looks[0].cardVisibility[0], { head: true, body: true, hands: true, legs: true, feet: true });
assert.deepEqual(snapshot.cardVisibility, snapshot.looks[0].cardVisibility);
assert.deepEqual(snapshot.looks[0].cardComposition, { layer: "info-front", protectText: true, infoGap: 0 });
assert.deepEqual(snapshot.cardComposition, snapshot.looks[0].cardComposition);
assert.equal(look.extraEquipment, undefined, "draft normalization must not mutate caller-owned looks");
snapshot.extraEquipment[0].push({ id: "extra-copy-check" });
assert.deepEqual(snapshot.looks[0].extraEquipment[0], [], "legacy top-level mirrors and canonical nested looks should not alias");

const rawExtra = {
  id: "extra-ring-left",
  slot: "ringLeft",
  names: { ko: "반지", en: "Ring", ja: "指輪" },
  itemId: null,
  source: "manual",
  showOnCard: true,
};
const enrichedLook = {
  ...look,
  extraEquipment: [[rawExtra]],
  cardVisibility: [{ head: false, feet: false }],
  cardComposition: { layer: "person-front", protectText: false, infoGap: 64 },
};
const enrichedSnapshot = DraftSchema.create({ looks: [enrichedLook], selectedLookId: enrichedLook.id });
assert.equal(enrichedSnapshot.looks[0].extraEquipment[0][0].id, "extra-ring-left");
assert.equal(enrichedSnapshot.looks[0].cardVisibility[0].head, false);
assert.equal(enrichedSnapshot.looks[0].cardVisibility[0].feet, false);
assert.deepEqual(enrichedSnapshot.cardComposition, { layer: "person-front", protectText: false, infoGap: 64 });
enrichedSnapshot.looks[0].extraEquipment[0][0].names.en = "changed snapshot";
assert.equal(enrichedLook.extraEquipment[0][0].names.en, "Ring", "draft serialization must deep-copy accessory names");
assert.equal(enrichedSnapshot.extraEquipment[0][0].names.en, "Ring", "top-level and nested serialized equipment copies must remain independent");
console.log("PASS: draft legacy mirrors are derived from the selected serialized look.");
