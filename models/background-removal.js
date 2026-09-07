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
  const HIGH_WEBGPU_MIN_STORAGE_BUFFERS = 65;
  const FALLBACK_WEBGPU_MIN_STORAGE_BUFFERS = 65;
  const HIGH_TIER = "BiRefNet 1024 WebGPU";
  const FALLBACK_WEBGPU_TIER = "BiRefNet 512 WebGPU";
  const FALLBACK_WASM_TIER = "BiRefNet 512 WASM";

  function createBackgroundRemoval(options = {}) {
    const navigatorRef = options.navigatorRef || global?.navigator || null;
    const documentRef = options.documentRef || global?.document || null;
    const BlobCtor = options.BlobCtor || global?.Blob;
    const ImageDataCtor = options.ImageDataCtor || global?.ImageData;
    const Uint8ClampedArrayCtor = options.Uint8ClampedArrayCtor || global?.Uint8ClampedArray || Uint8ClampedArray;
    const transformersLoader = options.transformersLoader || (() => import(TRANSFORMERS_URL));
    const logger = options.logger || console;

    let transformersPromise = null;
    let pipelinePromise = null;
    let pipelineTier = "";

    async function getWebGPUAdapter(minStorageBuffersPerShaderStage) {
      const gpu = navigatorRef?.gpu;
      if (!gpu?.requestAdapter) return null;
      try {
        const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
        const maxStorageBuffers = adapter?.limits?.maxStorageBuffersPerShaderStage;
        if (!Number.isFinite(maxStorageBuffers) || maxStorageBuffers < minStorageBuffersPerShaderStage) return null;
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
      if (!transformersPromise) {
        transformersPromise = Promise.resolve()
          .then(() => transformersLoader())
          .then((module) => {
            if (!module?.pipeline || !module?.RawImage) throw new Error("브라우저 AI 모듈을 불러오지 못했습니다.");
            if (module.env) {
              module.env.allowLocalModels = false;
              module.env.useBrowserCache = true;
            }
            return module;
          })
          .catch((error) => {
            transformersPromise = null;
            throw error;
          });
      }
      return transformersPromise;
    }

    async function createPipeline(modelId, pipelineOptions, onProgress) {
      const { pipeline } = await loadTransformers();
      return pipeline("background-removal", modelId, {
        ...pipelineOptions,
        progress_callback: (info) => reportProgress(onProgress, info),
      });
    }

    function resetPipeline() {
      pipelinePromise = null;
      pipelineTier = "";
    }

    async function createPipelineTier(tier, onProgress) {
      if (tier === "high-webgpu") {
        return {
          segmenter: await createPipeline(HIGH_MODEL, { device: "webgpu", dtype: "fp32", model_file_name: "model_fp16" }, onProgress),
          label: HIGH_TIER,
        };
      }
      if (tier === "fallback-webgpu") {
        return {
          segmenter: await createPipeline(FALLBACK_MODEL, { device: "webgpu", dtype: "fp16" }, onProgress),
          label: FALLBACK_WEBGPU_TIER,
        };
      }
      return {
        segmenter: await createPipeline(FALLBACK_MODEL, { dtype: "fp32", model_file_name: "model" }, onProgress),
        label: FALLBACK_WASM_TIER,
      };
    }

    function loadPipelineTier(tier, onProgress) {
      if (pipelinePromise) return pipelinePromise;
      const promise = createPipelineTier(tier, onProgress)
        .then(({ segmenter, label }) => {
          pipelineTier = label;
          return segmenter;
        })
        .catch((error) => {
          if (pipelinePromise === promise) resetPipeline();
          throw error;
        });
      pipelinePromise = promise;
      return promise;
    }

    async function loadBestPipeline(onProgress) {
      if (pipelinePromise) return pipelinePromise;
      // The 1024px graph contains a large Concat op. Devices with the default
      // eight storage-buffer limit can create a pipeline that returns an empty
      // image, so skip that tier before invoking ONNX Runtime.
      if (await getWebGPUAdapter(HIGH_WEBGPU_MIN_STORAGE_BUFFERS)) {
        try {
          return await loadPipelineTier("high-webgpu", onProgress);
        } catch (error) {
          logger.warn?.("BiRefNet 1024 WebGPU를 사용할 수 없어 512px 모델로 전환합니다.", error);
        }
      }
      if (await getWebGPUAdapter(FALLBACK_WEBGPU_MIN_STORAGE_BUFFERS)) {
        try {
          return await loadPipelineTier("fallback-webgpu", onProgress);
        } catch (error) {
          logger.warn?.("BiRefNet 512 WebGPU를 사용할 수 없어 WASM으로 전환합니다.", error);
        }
      }
      return loadPipelineTier("fallback-wasm", onProgress);
    }

    function assertUsableResult(rawImage) {
      if (!rawImage || rawImage.channels !== 4 || !rawImage.data?.length) {
        throw new Error("배경 제거 결과가 올바르지 않습니다.");
      }
      let maxAlpha = 0;
      for (let index = 3; index < rawImage.data.length; index += rawImage.channels) {
        maxAlpha = Math.max(maxAlpha, Number(rawImage.data[index]) || 0);
      }
      const alphaThreshold = maxAlpha <= 1 ? 0.01 : 8;
      if (maxAlpha <= alphaThreshold) {
        throw new Error("배경 제거 모델이 빈 결과를 반환했습니다.");
      }
    }

    async function runSegmenter(segmenter, image) {
      const [result] = await segmenter(image);
      assertUsableResult(result);
      return result;
    }

    async function runCachedSegmenter(image, onProgress, tier = "") {
      const segmenter = tier ? await loadPipelineTier(tier, onProgress) : await loadBestPipeline(onProgress);
      try {
        return await runSegmenter(segmenter, image);
      } catch (error) {
        // A successfully-created ONNX pipeline can still fail on a particular
        // device. Do not cache that broken instance for the next request.
        pipelinePromise = null;
        throw error;
      }
    }

    async function runWithRecovery(image, onProgress) {
      try {
        return await runCachedSegmenter(image, onProgress);
      } catch (error) {
        const failedTier = pipelineTier;
        if (failedTier !== HIGH_TIER && failedTier !== FALLBACK_WEBGPU_TIER) throw error;
        const fallbackTier = failedTier === HIGH_TIER ? "fallback-webgpu" : "fallback-wasm";
        resetPipeline();
        try {
          return await runCachedSegmenter(image, onProgress, fallbackTier);
        } catch (fallbackError) {
          if (fallbackTier !== "fallback-webgpu") throw fallbackError;
          resetPipeline();
          return runCachedSegmenter(image, onProgress, "fallback-wasm");
        }
      }
    }

    async function toPngBlob(rawImage) {
      if (!documentRef?.createElement || !ImageDataCtor || !BlobCtor) {
        throw new Error("브라우저 이미지 변환 환경을 사용할 수 없습니다.");
      }
      const canvas = documentRef.createElement("canvas");
      canvas.width = rawImage.width;
      canvas.height = rawImage.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("배경 제거 결과를 그릴 수 없습니다.");
      const pixels = rawImage.data instanceof Uint8ClampedArrayCtor
        ? rawImage.data
        : new Uint8ClampedArrayCtor(rawImage.data);
      context.putImageData(new ImageDataCtor(pixels, rawImage.width, rawImage.height), 0, 0);
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("배경 제거 결과를 PNG로 변환하지 못했습니다.")), "image/png");
      });
    }

    async function removeInBrowser(blob, { onProgress } = {}) {
      if (!BlobCtor || !(blob instanceof BlobCtor)) throw new TypeError("이미지 Blob이 필요합니다.");
      const { RawImage } = await loadTransformers();
      const image = await RawImage.fromBlob(blob);
      const result = await runWithRecovery(image, onProgress);
      return { blob: await toPngBlob(result), tier: pipelineTier };
    }

    return Object.freeze({
      removeInBrowser,
      get tier() { return pipelineTier; },
    });
  }

  const api = createBackgroundRemoval();
  if (global) global.GlamourBackgroundRemoval = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { create: createBackgroundRemoval };
  }
})(typeof window !== "undefined" ? window : globalThis);
