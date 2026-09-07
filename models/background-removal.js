/*
 * Client-side background removal for the static Pages deployment.
 *
 * The high tier is a WebGPU-ready 1024px BiRefNet export. It keeps the
 * original image in the browser and only downloads model weights on the first
 * use. Older devices fall back to the 512px export through the WASM backend.
 */
(function exposeBackgroundRemoval(global) {
  "use strict";

  const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  const HIGH_MODEL = "jiabins0303/birefnet-lite-1024-webgpu";
  const FALLBACK_MODEL = "studioludens/birefnet-lite-512";

  let transformersPromise;
  let pipelinePromise;
  let pipelineTier = "";

  async function getWebGPUAdapter() {
    const gpu = typeof navigator !== "undefined" ? navigator.gpu : null;
    if (!gpu?.requestAdapter) return null;
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
      const maxStorageBuffers = adapter?.limits?.maxStorageBuffersPerShaderStage;
      if (maxStorageBuffers != null && maxStorageBuffers < 8) return null;
      return adapter;
    } catch {
      return null;
    }
  }

  function reportProgress(callback, info) {
    if (typeof callback !== "function") return;
    if (info?.status === "progress" && Number.isFinite(info.progress)) {
      callback({ status: "progress", progress: Math.max(0, Math.min(100, info.progress)), file: info.file || "" });
      return;
    }
    if (info?.status) callback({ status: info.status, file: info.file || "" });
  }

  async function loadTransformers() {
    transformersPromise ||= import(TRANSFORMERS_URL).then((module) => {
      if (!module.pipeline || !module.RawImage) throw new Error("브라우저 AI 모듈을 불러오지 못했습니다.");
      if (module.env) {
        module.env.allowLocalModels = false;
        module.env.useBrowserCache = true;
      }
      return module;
    });
    return transformersPromise;
  }

  async function createPipeline(modelId, options, onProgress) {
    const { pipeline } = await loadTransformers();
    return pipeline("background-removal", modelId, {
      ...options,
      progress_callback: (info) => reportProgress(onProgress, info),
    });
  }

  async function loadPipelineTier(tier, onProgress) {
    if (tier === "high-webgpu") {
      const high = await createPipeline(HIGH_MODEL, { device: "webgpu", dtype: "fp32", model_file_name: "model_fp16" }, onProgress);
      pipelineTier = "BiRefNet 1024 WebGPU";
      return high;
    }
    if (tier === "fallback-webgpu") {
      const webgpuFallback = await createPipeline(FALLBACK_MODEL, { device: "webgpu", dtype: "fp16" }, onProgress);
      pipelineTier = "BiRefNet 512 WebGPU";
      return webgpuFallback;
    }
    const wasmFallback = await createPipeline(FALLBACK_MODEL, { dtype: "fp32", model_file_name: "model" }, onProgress);
    pipelineTier = "BiRefNet 512 WASM";
    return wasmFallback;
  }

  async function loadBestPipeline(onProgress) {
    if (pipelinePromise) return pipelinePromise;
    pipelinePromise = (async () => {
      if (await getWebGPUAdapter()) {
        try {
          return await loadPipelineTier("high-webgpu", onProgress);
        } catch (error) {
          console.warn("BiRefNet 1024 WebGPU를 사용할 수 없어 512px 모델로 전환합니다.", error);
        }
        try {
          return await loadPipelineTier("fallback-webgpu", onProgress);
        } catch (error) {
          console.warn("BiRefNet 512 WebGPU를 사용할 수 없어 WASM으로 전환합니다.", error);
        }
      }
      return loadPipelineTier("fallback-wasm", onProgress);
    })().catch((error) => {
      pipelinePromise = null;
      throw error;
    });
    return pipelinePromise;
  }

  async function toPngBlob(rawImage) {
    const canvas = document.createElement("canvas");
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("배경 제거 결과를 그릴 수 없습니다.");
    const pixels = rawImage.data instanceof Uint8ClampedArray
      ? rawImage.data
      : new Uint8ClampedArray(rawImage.data);
    context.putImageData(new ImageData(pixels, rawImage.width, rawImage.height), 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("배경 제거 결과를 PNG로 변환하지 못했습니다.")), "image/png");
    });
  }

  async function removeInBrowser(blob, { onProgress } = {}) {
    if (!(blob instanceof Blob)) throw new TypeError("이미지 Blob이 필요합니다.");
    const { RawImage } = await loadTransformers();
    const image = await RawImage.fromBlob(blob);
    const segmenter = await loadBestPipeline(onProgress);
    let result;
    try {
      [result] = await segmenter(image);
    } catch (error) {
      if (pipelineTier === "BiRefNet 1024 WebGPU" || pipelineTier === "BiRefNet 512 WebGPU") {
        const fallbackTier = pipelineTier === "BiRefNet 1024 WebGPU" ? "fallback-webgpu" : "fallback-wasm";
        pipelinePromise = null;
        pipelineTier = "";
        try {
          [result] = await loadPipelineTier(fallbackTier, onProgress).then((fallback) => fallback(image));
        } catch (fallbackError) {
          if (fallbackTier !== "fallback-webgpu") throw fallbackError;
          pipelinePromise = null;
          pipelineTier = "";
          [result] = await loadPipelineTier("fallback-wasm", onProgress).then((fallback) => fallback(image));
        }
      } else {
        throw error;
      }
    }
    if (!result || result.channels !== 4) throw new Error("배경 제거 결과가 올바르지 않습니다.");
    return { blob: await toPngBlob(result), tier: pipelineTier };
  }

  global.GlamourBackgroundRemoval = Object.freeze({
    removeInBrowser,
    get tier() { return pipelineTier; },
  });
})(window);
