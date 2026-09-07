const assert = require("node:assert/strict");
const { create } = require("../models/background-removal.js");

class FakeBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || "";
  }
}

class FakeImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

const pipelineCalls = [];
const validResult = {
  width: 1,
  height: 1,
  channels: 4,
  data: new Uint8ClampedArray([255, 255, 255, 255]),
};
const transformers = {
  env: {},
  RawImage: { fromBlob: async () => ({ width: 1, height: 1 }) },
  pipeline: async (task, model, options) => {
    pipelineCalls.push({ task, model, options });
    if (options.device === "webgpu") return async () => { throw new Error("simulated inference failure"); };
    return async () => [validResult];
  },
};

const documentRef = {
  createElement: () => ({
    getContext: () => ({ putImageData() {} }),
    toBlob(callback, type) { callback(new FakeBlob([], { type })); },
  }),
};

const adapter = create({
  transformersLoader: async () => transformers,
  navigatorRef: { gpu: { requestAdapter: async () => ({ limits: { maxStorageBuffersPerShaderStage: 65 } }) } },
  documentRef,
  BlobCtor: FakeBlob,
  ImageDataCtor: FakeImageData,
  Uint8ClampedArrayCtor: Uint8ClampedArray,
  logger: { warn() {} },
});

(async () => {
  const source = new FakeBlob([], { type: "image/png" });
  const first = await adapter.removeInBrowser(source);
  const second = await adapter.removeInBrowser(source);

  assert.equal(pipelineCalls.length, 3, "failed WebGPU tiers should be loaded only once before WASM is cached");
  assert.deepEqual(pipelineCalls.map(({ options }) => options.device || "wasm"), ["webgpu", "webgpu", "wasm"]);
  assert.equal(first.tier, "BiRefNet 512 WASM");
  assert.equal(second.tier, "BiRefNet 512 WASM");
  assert.equal(first.blob.type, "image/png");
  assert.equal(second.blob.type, "image/png");
  console.log("PASS: browser background-removal pipeline recovery is cached and testable.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
