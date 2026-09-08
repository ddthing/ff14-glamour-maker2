const assert = require("node:assert/strict");
const CropPlan = require("../models/crop-plan.js");
const CardLayout = require("../models/card-layout.js");
const LookEditor = require("../models/look-editor.js");

assert.deepEqual(CropPlan.focalPointFromSubjectBounds({
  left: 0.2,
  top: 0.1,
  right: 0.8,
  bottom: 0.9,
}), { x: 0.5, y: 0.404 });
assert.equal(CropPlan.focalPointFromSubjectBounds({ left: 0.8, top: 0, right: 0.2, bottom: 1 }), null);
assert.deepEqual(CropPlan.normaliseFocalPoint({ x: 2, y: -1 }), { x: 1, y: 0 });
assert.equal(CropPlan.normaliseFocalPoint({ x: "nope", y: 0.5 }), null);

assert.equal(CropPlan.objectPositionFor({ cutout: false, imageFit: "contain" }), "50% 50%");
assert.equal(CropPlan.objectPositionFor({ cutout: true, imageFit: "contain" }), "center bottom");
assert.equal(CropPlan.objectPositionFor({ cutout: true, imageFit: "cover" }), "50% 38%");
assert.equal(CropPlan.objectPositionFor({
  cutout: true,
  imageFit: "cover",
  focalPoint: { x: 0.27, y: 0.31 },
}), "27% 31%");

const frame = { x: 10, y: 20, width: 300, height: 400 };
const centered = CardLayout.imageRectFor({
  frame,
  naturalWidth: 100,
  naturalHeight: 50,
  imageFit: "cover",
});
const focused = CardLayout.imageRectFor({
  frame,
  naturalWidth: 100,
  naturalHeight: 50,
  imageFit: "cover",
  cutout: true,
  focalPoint: { x: 0.27, y: 0.31 },
});
assert.equal(centered.width, focused.width);
assert.equal(centered.height, focused.height);
assert.equal(focused.x, frame.x + (frame.width - focused.width) * 0.27);
assert.equal(focused.y, frame.y + (frame.height - focused.height) * 0.31);

const persistedEditor = LookEditor.normalize({
  characterCount: 1,
  characters: [{ focalPoint: { x: 1.4, y: -0.2 } }],
});
assert.deepEqual(persistedEditor.characters[0].focalPoint, { x: 1, y: 0 });
const capturedEditor = LookEditor.capture({
  ...LookEditor.create(),
  characters: [{ ...LookEditor.emptyCharacter(), focalPoint: { x: 0.27, y: 0.31 } }],
});
assert.deepEqual(capturedEditor.characters[0].focalPoint, { x: 0.27, y: 0.31 });

console.log("PASS: CropPlan centralizes crop-aware focus for preview and PNG geometry.");
