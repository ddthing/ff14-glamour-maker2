const assert = require("node:assert/strict");
const CardLayout = require("../models/card-layout.js");

const frame = { x: 95, y: 150, width: 890, height: 1180 };

const contain = CardLayout.imageRectFor({
  frame,
  naturalWidth: 120,
  naturalHeight: 180,
  imageFit: "contain",
  zoom: 100,
  panX: 12,
  panY: -8,
  panScale: 2,
});
assert.deepEqual(contain, {
  x: 170.66666666666669,
  y: 134,
  width: 786.6666666666666,
  height: 1180,
});

const cover = CardLayout.imageRectFor({
  frame,
  naturalWidth: 120,
  naturalHeight: 180,
  imageFit: "cover",
  zoom: 130,
  panX: -4,
  panY: 6,
  panScale: 1.5,
});
assert.ok(cover.width > frame.width, "cover mode should fill the frame on both axes");
assert.ok(cover.height > frame.height, "cover mode should crop the source on the shorter axis");
assert.equal(cover.x, -44.5);
assert.equal(cover.y, -118.75000000000011);

const centered = CardLayout.imageRectFor({
  frame: { x: 10, y: 20, width: 300, height: 400 },
  naturalWidth: 100,
  naturalHeight: 50,
  imageFit: "unsupported-fit",
  zoom: 100,
});
const bottomAligned = CardLayout.imageRectFor({
  frame: { x: 10, y: 20, width: 300, height: 400 },
  naturalWidth: 100,
  naturalHeight: 50,
  imageFit: "contain",
  cutout: true,
});
assert.equal(centered.y, 145);
assert.equal(bottomAligned.y, 270);
assert.equal(centered.x, bottomAligned.x);

console.log("PASS: CardLayout owns contain, cover, pan scaling, and cutout alignment math.");
