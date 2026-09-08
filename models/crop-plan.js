/* Shared image crop planning: preview and PNG must resolve the same focal point. */
(function initialiseCropPlan(global) {
  const DEFAULT_ORIGINAL_FOCAL = Object.freeze({ x: 0.5, y: 0.5 });
  const DEFAULT_CUTOUT_COVER_FOCAL = Object.freeze({ x: 0.5, y: 0.38 });
  const DEFAULT_CUTOUT_CONTAIN_FOCAL = Object.freeze({ x: 0.5, y: 1 });

  function clamp(value, min = 0, max = 1, fallback = min) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.min(max, Math.max(min, numericValue)) : fallback;
  }

  function normaliseFocalPoint(value) {
    if (!value || typeof value !== "object") return null;
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: clamp(x), y: clamp(y) };
  }

  function normaliseSubjectBounds(value) {
    if (!value || typeof value !== "object") return null;
    const left = Number(value.left);
    const top = Number(value.top);
    const right = Number(value.right);
    const bottom = Number(value.bottom);
    if (![left, top, right, bottom].every(Number.isFinite)) return null;
    const bounds = {
      left: clamp(left),
      top: clamp(top),
      right: clamp(right),
      bottom: clamp(bottom),
    };
    if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return null;
    return bounds;
  }

  function focalPointFromSubjectBounds(subjectBounds) {
    const bounds = normaliseSubjectBounds(subjectBounds);
    if (!bounds) return null;
    return {
      x: clamp((bounds.left + bounds.right) / 2),
      // Keep the upper body in a cover crop instead of centering on the feet.
      y: clamp(bounds.top + (bounds.bottom - bounds.top) * 0.38),
    };
  }

  function resolveFocalPoint({ cutout = false, imageFit = "contain", focalPoint = null, subjectBounds = null } = {}) {
    const explicit = normaliseFocalPoint(focalPoint);
    if (cutout && imageFit !== "cover") {
      // Cutouts have no rectangular background to anchor against. Their
      // contain treatment stays grounded at the frame bottom for every ratio.
      return { x: explicit?.x ?? DEFAULT_CUTOUT_CONTAIN_FOCAL.x, y: DEFAULT_CUTOUT_CONTAIN_FOCAL.y };
    }
    if (explicit) return explicit;
    if (cutout) return focalPointFromSubjectBounds(subjectBounds) || { ...DEFAULT_CUTOUT_COVER_FOCAL };
    return { ...DEFAULT_ORIGINAL_FOCAL };
  }

  function imageRectFor({
    frame = {},
    naturalWidth,
    naturalHeight,
    imageFit = "contain",
    zoom = 100,
    panX = 0,
    panY = 0,
    cutout = false,
    panScale = 1,
    focalPoint = null,
    subjectBounds = null,
  } = {}) {
    const x = Number(frame.x) || 0;
    const y = Number(frame.y) || 0;
    const width = Math.max(0, Number(frame.width) || 0);
    const height = Math.max(0, Number(frame.height) || 0);
    const sourceWidth = Math.max(1, Number(naturalWidth) || 1);
    const sourceHeight = Math.max(1, Number(naturalHeight) || 1);
    const fitScale = imageFit === "cover"
      ? Math.max(width / sourceWidth, height / sourceHeight)
      : Math.min(width / sourceWidth, height / sourceHeight);
    const imageScale = fitScale * (Number.isFinite(Number(zoom)) ? Number(zoom) : 100) / 100;
    const imageWidth = sourceWidth * imageScale;
    const imageHeight = sourceHeight * imageScale;
    const resolvedPanScale = Number.isFinite(Number(panScale)) ? Number(panScale) : 1;
    const resolvedPanX = Number.isFinite(Number(panX)) ? Number(panX) : 0;
    const resolvedPanY = Number.isFinite(Number(panY)) ? Number(panY) : 0;
    const focal = resolveFocalPoint({ cutout, imageFit, focalPoint, subjectBounds });
    return {
      x: x + (width - imageWidth) * focal.x + resolvedPanX * resolvedPanScale,
      y: y + (height - imageHeight) * focal.y + resolvedPanY * resolvedPanScale,
      width: imageWidth,
      height: imageHeight,
    };
  }

  function formatPercent(value) {
    const rounded = Math.round(clamp(value) * 10000) / 100;
    return `${rounded}%`;
  }

  function objectPositionFor(options = {}) {
    if (options.cutout && options.imageFit !== "cover" && !normaliseFocalPoint(options.focalPoint)) {
      return "center bottom";
    }
    const focal = resolveFocalPoint(options);
    return `${formatPercent(focal.x)} ${formatPercent(focal.y)}`;
  }

  function transformOriginFor(options = {}) {
    return objectPositionFor(options);
  }

  const CropPlan = {
    clamp,
    normaliseFocalPoint,
    focalPointFromSubjectBounds,
    resolveFocalPoint,
    imageRectFor,
    objectPositionFor,
    transformOriginFor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CropPlan;
  else global.CropPlan = CropPlan;
})(typeof globalThis !== "undefined" ? globalThis : window);
