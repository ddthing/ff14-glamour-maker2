const assert = require("node:assert/strict");
const ColorContrast = require("../models/color-contrast.js");

assert.equal(ColorContrast.themeFor("#25262b").foreground, "#ffffff", "charcoal cards should use white silhouette copy");
assert.equal(ColorContrast.themeFor("#343543").foreground, "#ffffff", "ink cards should use white silhouette copy");
assert.equal(ColorContrast.themeFor("#f7f5f0").foreground, "#111111", "paper cards should use black silhouette copy");
assert.equal(ColorContrast.themeFor("#e5cbc7").foreground, "#111111", "light rose cards should use black silhouette copy");
assert.equal(ColorContrast.themeFor("#ffffff").muted, "rgba(17, 17, 17, .66)");
assert.equal(ColorContrast.themeFor("#000000").muted, "rgba(255, 255, 255, .66)");
assert.equal(ColorContrast.relativeLuminance("not-a-color"), null, "invalid colors should not throw or claim a dark surface");
console.log("PASS: silhouette copy switches between white and black from the card surface luminance.");
