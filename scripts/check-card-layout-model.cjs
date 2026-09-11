const assert = require("node:assert/strict");
const CardLayout = require("../models/card-layout.js");

const frame = { x: 95, y: 150, width: 890, height: 1180 };

const portraitLayout = CardLayout.layoutFor({
  characterCount: 1,
  singleRatio: "portrait",
  singleLayout: "info-left",
  characters: [{ cutout: true }],
});
assert.equal(portraitLayout.characterCount, 1);
assert.equal(portraitLayout.ratio, "portrait");
assert.deepEqual(portraitLayout.dimensions, CardLayout.dimensionsFor(1, "portrait"));
assert.deepEqual(portraitLayout.frames, CardLayout.characterFrames({
  characterCount: 1,
  singleRatio: "portrait",
  singleLayout: "info-left",
  characters: [{ cutout: true }],
}));
assert.equal(
  CardLayout.cssInsetForLayout(portraitLayout),
  CardLayout.cssInsetFor(portraitLayout.frames, 1, "portrait"),
  "CSS inset should be derived from the resolved layout contract",
);

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

assert.deepEqual(CardLayout.gearSlotOrder, ["head", "body", "hands", "legs", "feet"]);
assert.deepEqual(CardLayout.portraitGearPositions(), [
  { slot: "head", x: 34, y: 250, width: 370, height: 116 },
  { slot: "body", x: 676, y: 410, width: 370, height: 116 },
  { slot: "hands", x: 34, y: 590, width: 370, height: 116 },
  { slot: "legs", x: 676, y: 790, width: 370, height: 116 },
  { slot: "feet", x: 34, y: 990, width: 370, height: 116 },
]);
assert.deepEqual(CardLayout.portraitGearPositions({ singleLayout: "info-right" }).map(({ x }) => x), [
  676, 34, 676, 34, 676,
], "right-side portrait layout must mirror the same gear notes without changing their y coordinates");
assert.deepEqual(CardLayout.landscapeSoloGearPositions(), [
  { slot: "head", x: 24, y: 146, width: 360, height: 82 },
  { slot: "body", x: 24, y: 250, width: 360, height: 82 },
  { slot: "hands", x: 24, y: 354, width: 360, height: 82 },
  { slot: "legs", x: 24, y: 458, width: 360, height: 82 },
  { slot: "feet", x: 24, y: 562, width: 360, height: 82 },
]);
assert.deepEqual(CardLayout.landscapeSoloGearPositions({ singleLayout: "info-right" }).map(({ x }) => x), [
  816, 816, 816, 816, 816,
], "right-side landscape layout must mirror the same gear notes without changing their y coordinates");

console.log("PASS: CardLayout owns image placement and portrait/landscape gear geometry.");
