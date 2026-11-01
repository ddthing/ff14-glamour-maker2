/* Pure, bounded preferences for reference-inspired card artwork. */
const CardArt = (() => {
  const choices = Object.freeze({
    layout: Object.freeze(["auto", "center", "footer", "cover"]),
    ratio: Object.freeze(["auto", "square", "lookbook", "portrait", "landscape"]),
    textAlign: Object.freeze(["left", "center"]),
    secondaryMode: Object.freeze(["all", "english", "none"]),
    titlePlacement: Object.freeze(["top-center", "top-left", "hidden"]),
    badge: Object.freeze(["none", "heart", "flower", "scallop"]),
  });

  const defaults = Object.freeze({
    enabled: false,
    layout: "auto",
    ratio: "auto",
    density: 50,
    subjectScale: 100,
    subjectGap: 16,
    textScale: 100,
    textAlign: "left",
    showSlots: false,
    secondaryMode: "all",
    titlePlacement: "top-center",
    badge: "none",
    ornaments: 0,
    accentColor: "#d9b5c6",
    paperColor: "#fffaf4",
    patternScale: 100,
    patternOpacity: 18,
    sharedOutfit: false,
  });

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function boundedInteger(value, fallback, minimum, maximum) {
    let number;
    try {
      number = Number(value);
    } catch {
      return fallback;
    }
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function enumValue(value, allowed, fallback) {
    return typeof value === "string" && allowed.includes(value) ? value : fallback;
  }

  function colorValue(value, fallback) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : fallback;
  }

  function normalize(value) {
    const source = isRecord(value) ? value : {};
    return {
      enabled: source.enabled === true,
      layout: enumValue(source.layout, choices.layout, defaults.layout),
      ratio: enumValue(source.ratio, choices.ratio, defaults.ratio),
      density: boundedInteger(source.density, defaults.density, 0, 100),
      subjectScale: boundedInteger(source.subjectScale, defaults.subjectScale, 60, 100),
      subjectGap: boundedInteger(source.subjectGap, defaults.subjectGap, 0, 80),
      textScale: boundedInteger(source.textScale, defaults.textScale, 70, 150),
      textAlign: enumValue(source.textAlign, choices.textAlign, defaults.textAlign),
      showSlots: source.showSlots === true,
      secondaryMode: enumValue(source.secondaryMode, choices.secondaryMode, defaults.secondaryMode),
      titlePlacement: enumValue(source.titlePlacement, choices.titlePlacement, defaults.titlePlacement),
      badge: enumValue(source.badge, choices.badge, defaults.badge),
      ornaments: boundedInteger(source.ornaments, defaults.ornaments, 0, 100),
      accentColor: colorValue(source.accentColor, defaults.accentColor),
      paperColor: colorValue(source.paperColor, defaults.paperColor),
      patternScale: boundedInteger(source.patternScale, defaults.patternScale, 40, 160),
      patternOpacity: boundedInteger(source.patternOpacity, defaults.patternOpacity, 0, 60),
      sharedOutfit: source.sharedOutfit === true,
    };
  }

  function recipe(id, art, background) {
    return Object.freeze({ id, art: Object.freeze(art), background: Object.freeze(background) });
  }

  const recipes = Object.freeze([
    recipe("catalog", {
      enabled: true, layout: "center", ratio: "square", textAlign: "center",
      titlePlacement: "top-center",
      showSlots: false, secondaryMode: "all", ornaments: 0, badge: "none",
    }, { background: "paper", backgroundPattern: "none", backgroundTexture: "none" }),
    recipe("editorial", {
      enabled: true, layout: "cover", ratio: "landscape", textAlign: "left",
      titlePlacement: "top-left", badge: "none", ornaments: 0,
    }, { background: "paper", backgroundPattern: "none", backgroundTexture: "none" }),
    recipe("romantic", {
      enabled: true, layout: "footer", ratio: "lookbook", badge: "heart",
      textAlign: "center", showSlots: false, secondaryMode: "none",
      titlePlacement: "top-center", ornaments: 25, accentColor: "#bd7886", patternOpacity: 24,
    }, { background: "rose", backgroundPattern: "stripes", backgroundTexture: "none" }),
    recipe("pastel", {
      enabled: true, layout: "footer", ratio: "lookbook", badge: "flower",
      textAlign: "center", showSlots: false, secondaryMode: "none",
      titlePlacement: "top-center", ornaments: 20, accentColor: "#aa98c9", patternOpacity: 20,
    }, { background: "pearl", backgroundPattern: "halftone", backgroundTexture: "none" }),
    recipe("tartan", {
      enabled: true, layout: "footer", ratio: "lookbook", badge: "scallop",
      textAlign: "center", showSlots: false, secondaryMode: "none",
      titlePlacement: "top-center", ornaments: 18, accentColor: "#8a3e46", patternOpacity: 32,
    }, { background: "ink", backgroundPattern: "plaid", backgroundTexture: "none" }),
  ]);
  const recipesById = new Map(recipes.map((entry) => [entry.id, entry]));

  function applyRecipe(current, id) {
    const selected = recipesById.get(id);
    if (!selected) return null;
    return {
      art: normalize({ ...normalize(current), ...selected.art }),
      background: { ...selected.background },
    };
  }

  return Object.freeze({ defaults, choices, recipes, normalize, applyRecipe });
})();

if (typeof module !== "undefined" && module.exports) module.exports = CardArt;
else if (typeof globalThis !== "undefined") globalThis.CardArt = CardArt;
