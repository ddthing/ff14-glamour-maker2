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
  return character;
}

function defaultLookEditor() {
  return { characters: createEmptyCharacters(), characterCount: 1, selectedCharacter: 0,
    singleRatio: "portrait", singleLayout: "info-left", multiInfoEnabled: true,
    multiInfoMode: "fade", infoDensity: "summary", shadow: { strength: 20, x: 8, y: 12, blur: 24 } };
}

function captureLookEditor(state) {
  return Object.fromEntries(Object.keys(defaultLookEditor()).map(key => [key,
    key === "characters" ? state.characters.map(character => {
      const copy = { ...character };
      ensureCharacterImageState(copy);
      return copy;
    })
      : key === "shadow" ? normaliseShadow(state.shadow) : state[key]]));
}

function normaliseLookEditor(value = {}) {
  if (!value || typeof value !== "object") value = {};
  const editor = defaultLookEditor();
  editor.characterCount = clamp(value.characterCount, 1, 5, 1) | 0;
  editor.selectedCharacter = clamp(value.selectedCharacter, 0, editor.characterCount - 1, 0) | 0;
  for (const [key, allowed] of Object.entries({singleRatio:["portrait", "landscape"], singleLayout:["info-left", "info-right"], multiInfoMode:["fade", "silhouette"], infoDensity:["summary", "full"]})) {
    if (allowed.includes(value[key])) editor[key] = value[key];
  }
  if (typeof value.multiInfoEnabled === "boolean") editor.multiInfoEnabled = value.multiInfoEnabled;
  editor.shadow = normaliseShadow(value.shadow);
  if (Array.isArray(value.characters)) value.characters.slice(0, 5).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const character = editor.characters[index];
    character.assetKey = typeof item.assetKey === "string" && item.assetKey.length <= 160 ? item.assetKey : null;
    if (typeof item.fileName === "string") character.fileName = item.fileName.slice(0, 160);
    if (typeof item.fileMeta === "string") character.fileMeta = item.fileMeta.slice(0, 240);
    character.cutout = item.cutout === true;
    for (const key of ["imageFit", "zoom", "panX", "panY"]) if (item[key] !== undefined) character[key] = item[key];
    ensureCharacterImageState(character);
  });
  return editor;
}


return { create: defaultLookEditor, capture: captureLookEditor, normalize: normaliseLookEditor,
 emptyCharacter: createEmptyCharacter, emptyCharacters: createEmptyCharacters, normalizeCharacter: ensureCharacterImageState,
 normalizeShadow: normaliseShadow };
})();
if (typeof module !== "undefined") module.exports = LookEditor;
