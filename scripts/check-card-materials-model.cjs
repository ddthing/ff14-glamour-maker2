const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CardMaterials = require("../models/card-materials.js");

const root = path.join(__dirname, "..");
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
assert.ok(archive.noteTints.length >= 4);
assert.ok(airy.noteTints.length >= 4);
console.log("PASS: card material systems keep separate names, assets, note shapes, and palette contracts.");
