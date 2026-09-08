const assert = require("node:assert/strict");
const ImageValidation = require("../models/image-validation.js");

assert.equal(ImageValidation.validateFile({ type: "image/png", size: 1024 }).ok, true);
assert.equal(ImageValidation.validateFile({ type: "image/svg+xml", size: 1024 }).reason, "type");
assert.equal(ImageValidation.validateFile({ type: "image/png", size: ImageValidation.maxUploadBytes + 1 }).reason, "bytes");
assert.equal(ImageValidation.validateDimensions(5000, 5000).ok, true);
assert.equal(ImageValidation.validateDimensions(10000, 10000).reason, "pixels");
const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0x08, 0, 0, 0, 0x04, 0]);
assert.deepEqual(ImageValidation.dimensionsFromBytes(pngHeader), { width: 2048, height: 1024 });
console.log("PASS: image admission validates type, byte size, and decoded pixel budget.");
