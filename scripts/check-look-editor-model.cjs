const assert = require("node:assert/strict");
const LookEditor = require("../models/look-editor.js");

const editor = LookEditor.normalize({
  characterCount: 99,
  selectedCharacter: 99,
  shadow: { strength: 999, x: -999, y: "invalid", blur: -10 },
  characters: [{
    assetKey: "x".repeat(161),
    fileName: "n".repeat(200),
    fileMeta: "m".repeat(300),
    cutout: "false",
    imageFit: "invalid",
    zoom: 999,
    panX: -999,
    panY: 999,
  }],
});

const defaults = LookEditor.create();

const runtimeCharacter = LookEditor.cloneCharacter({
  assetKey: "asset-1",
  src: "blob:cutout",
  originalSrc: "blob:original",
  focalPoint: { x: 0.25, y: 0.75 },
  zoom: 140,
});
const captured = LookEditor.capture({
  ...defaults,
  characters: [runtimeCharacter],
});
const persistedCharacter = LookEditor.serializeCharacter(runtimeCharacter);

assert.equal(editor.characterCount, 5);
assert.equal(editor.selectedCharacter, 4);
assert.deepEqual(editor.shadow, { strength: 70, x: -24, y: 12, blur: 0 });
assert.equal(editor.characters[0].assetKey, null);
assert.equal(editor.characters[0].fileName.length, 160);
assert.equal(editor.characters[0].fileMeta.length, 240);
assert.equal(editor.characters[0].cutout, false);
assert.equal(editor.characters[0].imageFit, "contain");
assert.equal(editor.characters[0].zoom, 180);
assert.equal(editor.characters[0].panX, -260);
assert.equal(editor.characters[0].panY, 260);
assert.equal(defaults.multiInfoMode, "clear");
assert.equal(Object.hasOwn(defaults, "infoDensity"), false);
assert.equal(Object.hasOwn(editor, "infoDensity"), false);
assert.equal(captured.characters.length, 5, "captured editor state must keep five character slots");
assert.equal(captured.characters[0].src, "blob:cutout");
assert.notEqual(captured.characters[0].focalPoint, runtimeCharacter.focalPoint, "captured focal points must be owned by the snapshot");
assert.equal(persistedCharacter.assetKey, "asset-1");
assert.equal(persistedCharacter.src, undefined, "persisted characters must not contain Blob URLs");
assert.equal(persistedCharacter.originalSrc, undefined, "persisted characters must not contain Blob URLs");
assert.deepEqual(persistedCharacter.focalPoint, { x: 0.25, y: 0.75 });
console.log("PASS: persisted editor values are bounded and type-safe.");
