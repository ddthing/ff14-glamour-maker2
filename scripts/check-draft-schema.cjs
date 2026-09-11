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
console.log("PASS: draft legacy mirrors are derived from the selected serialized look.");
