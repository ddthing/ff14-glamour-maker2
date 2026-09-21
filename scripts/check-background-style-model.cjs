const assert = require("node:assert/strict");
const BackgroundStyle = require("../models/background-style.js");
const CardMaterials = require("../models/card-materials.js");
const ColorContrast = require("../models/color-contrast.js");

const style = BackgroundStyle.create({
  colorContrast: ColorContrast,
  cardMaterials: CardMaterials,
});

assert.equal(style.customDefaultColor, "#f7f5f0");
assert.equal(style.defaultBackground, "paper");
assert.equal(style.normalisePattern("index"), "collage");
assert.equal(style.normalisePattern("unknown"), "none");
assert.deepEqual(
  style.normaliseBackgroundFields({
    background: "missing",
    customBackgroundColor: "not-a-color",
    backgroundPattern: "index",
    backgroundTexture: "missing",
  }),
  {
    background: "paper",
    customBackgroundColor: "#f7f5f0",
    backgroundPattern: "collage",
    backgroundTexture: "none",
  },
);
assert.deepEqual(style.restoreStyle("grain", "none", "none"), {
  backgroundPattern: "none",
  backgroundTexture: "grain",
});
assert.deepEqual(style.restoreStyle("none", "stars", "none"), {
  backgroundPattern: "stars",
  backgroundTexture: "none",
});
assert.equal(style.themeFor({ background: "charcoal" }).tone, "dark");
assert.equal(style.textureInkFor(style.themeFor({ background: "charcoal" })), "#ffffff");
assert.equal(style.legacyStyleRecipeFor("blue-bitmap").background, "tide");
assert.ok(style.surfaceAssetFor("collage").endsWith(".webp"));

console.log("PASS: background style policy normalizes drafts and keeps preview/export theme rules in one pure module.");
