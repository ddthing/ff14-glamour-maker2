const assert = require("node:assert/strict");
const { applyCutoutAlpha } = require("../models/image-validation.js");
const source = { width: 3, height: 1, data: new Uint8ClampedArray([
  21, 42, 63, 255, 80, 90, 100, 120, 111, 112, 113, 0,
]) };
const before = [...source.data];
const mask = { width: 3, height: 1, data: new Uint8ClampedArray([
  255, 0, 0, 180, 0, 255, 0, 200, 0, 0, 255, 255,
]) };
assert.deepEqual([...applyCutoutAlpha(source, mask)], [
  21, 42, 63, 180, 80, 90, 100, 120, 111, 112, 113, 0,
]);
assert.deepEqual([...source.data], before, "source must remain immutable");
assert.throws(() => applyCutoutAlpha(source, { ...mask, width: 1 }), /크기/);
assert.throws(() => applyCutoutAlpha(source, { ...mask, data: [] }), /크기/);
console.log("PASS: model RGB discarded, source alpha never increased, source immutable, mismatched masks rejected.");
