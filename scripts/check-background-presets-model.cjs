const assert = require("node:assert/strict");
const BackgroundPresets = require("../models/background-presets.js");

let id = 0;
const model = BackgroundPresets.create({
  backgrounds: {
    paper: { label: "종이" },
    mist: { label: "미스트" },
    ink: { label: "먹빛" },
    custom: { label: "사용자 지정" },
  },
  patternLabels: { none: "패턴 없음", dots: "도트", stars: "별" },
  textureLabels: { none: "질감 없음", grain: "그레인" },
  patterns: new Set(["none", "dots", "stars"]),
  textures: new Set(["none", "grain"]),
  limit: 2,
  now: () => 1700000000000,
  idFactory: () => `test-${++id}`,
});

assert.deepEqual(model.selection({ background: "missing", backgroundPattern: "invalid", backgroundTexture: "grain" }), {
  background: "paper",
  customBackgroundColor: "",
  backgroundPattern: "none",
  backgroundTexture: "grain",
});
assert.equal(model.signature({ background: "mist", backgroundPattern: "dots", backgroundTexture: "grain" }), "mist|dots|grain");
assert.equal(model.describe({ background: "mist", backgroundPattern: "dots", backgroundTexture: "grain" }), "미스트 · 도트 · 그레인");
assert.deepEqual(model.selection({ background: "custom", customBackgroundColor: "#ABCDEF", backgroundPattern: "stars", backgroundTexture: "grain" }), {
  background: "custom",
  customBackgroundColor: "#abcdef",
  backgroundPattern: "stars",
  backgroundTexture: "grain",
});
assert.equal(model.signature({ background: "custom", customBackgroundColor: "#ABCDEF", backgroundPattern: "dots", backgroundTexture: "grain" }), "custom|#abcdef|dots|grain");
assert.equal(model.selection({ background: "custom", customBackgroundColor: "invalid" }).customBackgroundColor, "#f7f5f0");

const longName = `  ${"이름".repeat(30)}  `;
const normalized = model.normalize({ id: "  saved-id  ", name: longName, background: "ink", backgroundPattern: "stars", backgroundTexture: "grain", createdAt: 123 });
assert.equal(normalized.id, "saved-id");
assert.equal(normalized.name.length, 28);
assert.equal(normalized.createdAt, 123);
assert.deepEqual(model.normalize(null), null);
assert.equal(model.normalize({ name: "" }).name, "종이 · 패턴 없음 · 질감 없음");
id = 0;

const loaded = model.load([
  { id: "first", name: "첫 번째", background: "mist", backgroundPattern: "dots", backgroundTexture: "none", createdAt: 1 },
  { id: "duplicate", name: "중복", background: "mist", backgroundPattern: "dots", backgroundTexture: "none", createdAt: 2 },
  { id: "second", name: "두 번째", background: "ink", backgroundPattern: "stars", backgroundTexture: "grain", createdAt: 3 },
  { id: "third", name: "세 번째", background: "paper", backgroundPattern: "none", backgroundTexture: "none", createdAt: 4 },
  null,
]);
assert.deepEqual(loaded.map((preset) => preset.id), ["first", "second"]);

assert.equal(model.add(loaded, { background: "mist", backgroundPattern: "dots", backgroundTexture: "none" }, "새 이름"), null, "duplicate selection must not create a second preset");
const added = model.add(loaded, { background: "paper", backgroundPattern: "none", backgroundTexture: "none" }, "  새 종이  ");
assert.equal(added.preset.id, "test-1");
assert.equal(added.preset.name, "새 종이");
assert.deepEqual(added.list.map((preset) => preset.id), ["test-1", "first"]);
assert.equal(model.find(added.list, "first").name, "첫 번째");
assert.equal(model.find(added.list, "missing"), null);
assert.deepEqual(model.remove(added.list, "test-1").map((preset) => preset.id), ["first"]);
assert.equal(model.limit, 2);
const customPresets = model.load([
  { id: "custom-light", name: "밝은 사용자 지정", background: "custom", customBackgroundColor: "#ffffff" },
  { id: "custom-dark", name: "어두운 사용자 지정", background: "custom", customBackgroundColor: "#111111" },
]);
assert.equal(customPresets.length, 2, "different custom colors must remain distinct presets");
console.log("PASS: background selection normalization, signature dedupe, naming, limit, lookup, and removal.");
