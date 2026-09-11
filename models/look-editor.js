/* Card-owned state. No DOM, storage, or rendering dependencies. */
const LookEditor = (() => {
function createEmptyCharacter() {
  return {
    src: "",
    originalSrc: "",
    fileName: "이미지를 추가하세요",
    fileMeta: "PNG, JPG 또는 WebP · 아직 선택하지 않음",
    cutout: false,
    imageFit: "contain",
    zoom: 100,
    panX: 0,
    panY: 0,
    focalPoint: null,
  };
}

function createEmptyCharacters() {
  return Array.from({ length: 5 }, () => createEmptyCharacter());
}

const shadowRanges = {
  strength: [0, 70, 20],
  x: [-24, 24, 8],
  y: [-24, 24, 12],
  blur: [0, 80, 24],
};

function clamp(value, min, max, fallback = min) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(max, Math.max(min, numericValue)) : fallback;
}

function normaliseFocalPoint(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function normaliseShadow(value = {}) {
  return Object.fromEntries(Object.entries(shadowRanges).map(([key, [min, max, fallback]]) => [
    key,
    clamp(value?.[key], min, max, fallback),
  ]));
}

function ensureCharacterImageState(character) {
  if (!character) return character;
  character.imageFit = ["contain", "cover"].includes(character.imageFit) ? character.imageFit : "contain";
  character.zoom = Number.isFinite(character.zoom) ? clamp(character.zoom, 70, 180) : 100;
  character.panX = Number.isFinite(character.panX) ? clamp(character.panX, -260, 260) : 0;
  character.panY = Number.isFinite(character.panY) ? clamp(character.panY, -260, 260) : 0;
  character.focalPoint = normaliseFocalPoint(character.focalPoint);
  return character;
}

function cloneCharacter(value = {}, { includeRuntime = true } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const character = {
    ...createEmptyCharacter(),
    assetKey: typeof source.assetKey === "string" && source.assetKey.length <= 160 ? source.assetKey : null,
    fileName: typeof source.fileName === "string" ? source.fileName.slice(0, 160) : "이미지를 추가하세요",
    fileMeta: typeof source.fileMeta === "string" ? source.fileMeta.slice(0, 240) : "PNG, JPG 또는 WebP · 아직 선택하지 않음",
    cutout: source.cutout === true,
    imageFit: source.imageFit,
    zoom: source.zoom,
    panX: source.panX,
    panY: source.panY,
    focalPoint: source.focalPoint,
  };
  if (includeRuntime) {
    character.src = typeof source.src === "string" ? source.src : "";
    character.originalSrc = typeof source.originalSrc === "string" ? source.originalSrc : "";
  }
  return ensureCharacterImageState(character);
}

function captureCharacters(values = [], options) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 5 }, (_, index) => cloneCharacter(source[index], options));
}

function serializeCharacter(value = {}) {
  const normalized = cloneCharacter(value, { includeRuntime: false });
  return {
    assetKey: normalized.assetKey,
    fileName: normalized.fileName,
    fileMeta: normalized.fileMeta,
    cutout: normalized.cutout,
    imageFit: normalized.imageFit,
    zoom: normalized.zoom,
    panX: normalized.panX,
    panY: normalized.panY,
    focalPoint: normalized.focalPoint ? { ...normalized.focalPoint } : null,
  };
}

function defaultLookEditor() {
  return { characters: createEmptyCharacters(), characterCount: 1, selectedCharacter: 0,
    singleRatio: "portrait", singleLayout: "info-left", multiInfoEnabled: true,
    multiInfoMode: "clear", shadow: { strength: 20, x: 8, y: 12, blur: 24 } };
}

function captureLookEditor(state) {
  return Object.fromEntries(Object.keys(defaultLookEditor()).map(key => [key,
    key === "characters" ? captureCharacters(state.characters)
      : key === "shadow" ? normaliseShadow(state.shadow) : state[key]]));
}

function normaliseLookEditor(value = {}) {
  if (!value || typeof value !== "object") value = {};
  const editor = defaultLookEditor();
  editor.characterCount = clamp(value.characterCount, 1, 5, 1) | 0;
  editor.selectedCharacter = clamp(value.selectedCharacter, 0, editor.characterCount - 1, 0) | 0;
  for (const [key, allowed] of Object.entries({singleRatio:["portrait", "landscape"], singleLayout:["info-left", "info-right"], multiInfoMode:["clear", "fade", "silhouette"]})) {
    if (allowed.includes(value[key])) editor[key] = value[key];
  }
  if (typeof value.multiInfoEnabled === "boolean") editor.multiInfoEnabled = value.multiInfoEnabled;
  editor.shadow = normaliseShadow(value.shadow);
  editor.characters = captureCharacters(value.characters, { includeRuntime: false });
  return editor;
}


return { create: defaultLookEditor, capture: captureLookEditor, normalize: normaliseLookEditor,
 cloneCharacter, captureCharacters, serializeCharacter,
 emptyCharacter: createEmptyCharacter, emptyCharacters: createEmptyCharacters, normalizeCharacter: ensureCharacterImageState,
 normalizeShadow: normaliseShadow };
})();
if (typeof module !== "undefined") module.exports = LookEditor;
