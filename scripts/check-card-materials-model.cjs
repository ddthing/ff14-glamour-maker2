const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CardMaterials = require("../models/card-materials.js");

const root = path.join(__dirname, "..");
const readabilityCss = fs.readFileSync(path.join(root, "styles", "card-readability.css"), "utf8");
const archive = CardMaterials.get("collage");
const airy = CardMaterials.get("scrapbook");

assert.equal(archive.publicName, "기록의 조각");
assert.equal(airy.publicName, "푸른 여백");
assert.notEqual(archive.asset, airy.asset, "material systems must not share a surface asset");
assert.notEqual(archive.noteShape, airy.noteShape, "material systems must not share a note shape contract");
assert.ok(fs.existsSync(path.join(root, archive.asset)));
assert.ok(fs.existsSync(path.join(root, airy.asset)));
assert.match(archive.asset, /\.webp$/);
assert.match(airy.asset, /\.webp$/);
assert.ok(fs.statSync(path.join(root, archive.asset)).size < 700_000, "archive material should stay within the optimized raster budget");
assert.ok(fs.statSync(path.join(root, airy.asset)).size < 700_000, "airy material should stay within the optimized raster budget");
assert.equal(archive.notes.length, 5, "archive note material must define all five gear slots");
assert.equal(airy.notes.length, 5, "airy note material must define all five gear slots");
for (const material of [archive, airy]) {
  material.notes.forEach((note, index) => {
    const selector = `.canvas-board[data-background-pattern="${material.key}"] .board-gear-tiles .board-gear-item:nth-child(${index + 1})`;
    const rule = readabilityCss.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(rule, `${material.key}: note ${index + 1} needs a matching preview rule`);
    assert.ok(rule.includes(`--material-note-tint: ${note.tint}`), `${material.key}: note ${index + 1} tint differs between preview and PNG`);
    assert.ok(rule.includes(`--material-position: ${note.position[0]}% ${note.position[1]}%`), `${material.key}: note ${index + 1} paper crop differs between preview and PNG`);
    assert.ok(rule.includes(`--material-tape-left: ${note.tape.left}%`), `${material.key}: note ${index + 1} tape position differs between preview and PNG`);
    assert.ok(rule.includes(`--material-tape-width: ${note.tape.width}%`), `${material.key}: note ${index + 1} tape width differs between preview and PNG`);
    assert.ok(rule.includes(`--material-tape-height: ${note.tape.height}%`), `${material.key}: note ${index + 1} tape height differs between preview and PNG`);
    assert.ok(rule.includes(`--material-tape-rotation: ${note.tape.rotation}deg`), `${material.key}: note ${index + 1} tape angle differs between preview and PNG`);
    assert.ok(rule.includes(`--material-tape-color: ${note.tape.color}`), `${material.key}: note ${index + 1} tape tint differs between preview and PNG`);
  });
}
assert.equal(CardMaterials.noteFor("collage", 5), archive.notes[0], "note selection should repeat safely after the five gear slots");
assert.equal(CardMaterials.noteFor("collage", Number.POSITIVE_INFINITY), archive.notes[0], "invalid note indexes should safely resolve to the first material");
const assertRectClose = (actual, expected, message) => Object.entries(expected).forEach(([key, value]) => {
  assert.ok(Math.abs(actual[key] - value) < 0.001, `${message}: ${key} expected ${value}, got ${actual[key]}`);
});
assertRectClose(CardMaterials.noteSourceRect("collage", 0, 1024, 1536), {
  x: 54.6133, y: 81.92, width: 568.8889, height: 853.3333,
}, "PNG note crop should match CSS's 180% image sizing and first-note position");
assertRectClose(CardMaterials.tapeSourceRect(1024, 1536), {
  x: 315.0769, y: 472.6154, width: 393.8462, height: 590.7692,
}, "PNG tape crop should match the centered 260% CSS background");
assert.equal(CardMaterials.noteSourceRect("unknown", 0, 1024, 1536), null);
assert.equal(CardMaterials.sourceRectForBackground(0, 1536), null);
console.log("PASS: card material systems keep separate names, assets, note shapes, and palette contracts.");
