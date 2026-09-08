/* Pure background preset data rules.
   The editor owns storage and rendering; this module owns validation only. */
const BackgroundPresets = (() => {
  const DEFAULT_LIMIT = 18;
  const MAX_NAME_LENGTH = 28;
  const MAX_ID_LENGTH = 80;
  const DEFAULT_CUSTOM_BACKGROUND = "#f7f5f0";

  function normaliseHexColor(value, fallback = "") {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""))
      ? String(value).toLowerCase()
      : fallback;
  }

  function create({
    backgrounds = {},
    patternLabels = {},
    textureLabels = {},
    patterns,
    textures,
    limit = DEFAULT_LIMIT,
    now = Date.now,
    idFactory,
  } = {}) {
    const backgroundKeys = new Set(Object.keys(backgrounds));
    const patternKeys = new Set(patterns || Object.keys(patternLabels));
    const textureKeys = new Set(textures || Object.keys(textureLabels));
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
    const clock = typeof now === "function" ? now : Date.now;
    const makeId = typeof idFactory === "function" ? idFactory : () => (
      `background-${clock()}-${Math.random().toString(36).slice(2, 8)}`
    );

    function selection(source = {}) {
      const value = source && typeof source === "object" ? source : {};
      const background = backgroundKeys.has(value.background) ? value.background : "paper";
      return {
        background,
        customBackgroundColor: background === "custom"
          ? normaliseHexColor(value.customBackgroundColor, DEFAULT_CUSTOM_BACKGROUND)
          : "",
        backgroundPattern: patternKeys.has(value.backgroundPattern) ? value.backgroundPattern : "none",
        backgroundTexture: textureKeys.has(value.backgroundTexture) ? value.backgroundTexture : "none",
      };
    }

    function signature(source = {}) {
      const value = selection(source);
      return [
        value.background,
        ...(value.background === "custom" ? [value.customBackgroundColor] : []),
        value.backgroundPattern,
        value.backgroundTexture,
      ].join("|");
    }

    function describe(source = {}) {
      const value = selection(source);
      return [
        backgrounds[value.background]?.label || value.background,
        patternLabels[value.backgroundPattern] || value.backgroundPattern,
        textureLabels[value.backgroundTexture] || value.backgroundTexture,
      ].join(" · ");
    }

    function nextId() {
      const candidate = String(makeId() || "").trim().slice(0, MAX_ID_LENGTH);
      return candidate || `background-${clock()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalize(value) {
      if (!value || typeof value !== "object") return null;
      const normalizedSelection = selection(value);
      const name = typeof value.name === "string"
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : "";
      const createdAt = Number.isFinite(value.createdAt) ? value.createdAt : clock();
      return {
        id: nextIdFrom(value),
        name: name || describe(normalizedSelection),
        ...normalizedSelection,
        createdAt,
      };
    }

    function nextIdFrom(value) {
      const existing = typeof value?.id === "string" ? value.id.trim().slice(0, MAX_ID_LENGTH) : "";
      return existing || nextId();
    }

    function load(values) {
      if (!Array.isArray(values)) return [];
      const seen = new Set();
      return values.map(normalize).filter((preset) => {
        if (!preset) return false;
        const key = signature(preset);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, maxItems);
    }

    function add(values, source, name = "") {
      const current = load(values);
      const key = signature(source);
      if (current.some((preset) => signature(preset) === key)) return null;
      const trimmedName = typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "";
      const preset = normalize({
        ...selection(source),
        id: nextId(),
        name: trimmedName || describe(source),
        createdAt: clock(),
      });
      return { preset, list: [preset, ...current].slice(0, maxItems) };
    }

    function find(values, id) {
      if (!Array.isArray(values) || !id) return null;
      return values.find((preset) => preset?.id === id) || null;
    }

    function remove(values, id) {
      if (!Array.isArray(values)) return [];
      return values.filter((preset) => preset?.id !== id);
    }

    return { selection, signature, describe, normalize, load, add, find, remove, limit: maxItems };
  }

  return { create };
})();
if (typeof module !== "undefined") module.exports = BackgroundPresets;
