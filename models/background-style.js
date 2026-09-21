/*
 * Background style policy shared by the editor preview and PNG exporter.
 *
 * The module owns palette selection, contrast-aware ink, legacy draft
 * migration, and material asset lookup. Callers only need a normalized theme
 * or a normalized style record; DOM mutation stays in app.js.
 */
const BackgroundStyle = (() => {
  const customDefaultColor = "#f7f5f0";
  const defaultBackground = "paper";
  const backgrounds = Object.freeze({
    dusk: Object.freeze({ solid: "#eee5d7", pattern: Object.freeze(["#686879", "#f8f6ff"]), label: "황혼" }),
    linen: Object.freeze({ solid: "#f4eee4", pattern: Object.freeze(["#8e7883", "#fffaf3"]), label: "리넨" }),
    tide: Object.freeze({ solid: "#b2ccd0", pattern: Object.freeze(["#385d68", "#e8f6f7"]), label: "물빛" }),
    ink: Object.freeze({ solid: "#343543", pattern: Object.freeze(["#d8d7ef", "#777c9c"]), label: "먹빛" }),
    rose: Object.freeze({ solid: "#e5cbc7", pattern: Object.freeze(["#835869", "#ffe9eb"]), label: "장미" }),
    pearl: Object.freeze({ solid: "#f8f3ef", pattern: Object.freeze(["#71819c", "#ffffff"]), label: "진주빛" }),
    paper: Object.freeze({ solid: "#f7f5f0", pattern: Object.freeze(["#858594", "#ffffff"]), label: "종이" }),
    mist: Object.freeze({ solid: "#e7eff2", pattern: Object.freeze(["#648091", "#f8fdff"]), label: "미스트" }),
    charcoal: Object.freeze({ solid: "#25262b", pattern: Object.freeze(["#dddbea", "#747481"]), label: "차콜" }),
    custom: Object.freeze({ solid: customDefaultColor, pattern: Object.freeze(["#858594", "#ffffff"]), label: "직접 지정" }),
  });
  const patterns = new Set(["none", "dots", "stars", "halftone", "bitmap", "collage", "scrapbook"]);
  const textures = new Set(["none", "grain", "risograph", "dust", "fiber", "halftone"]);
  const legacyPatternAliases = Object.freeze({ index: "collage" });
  const legacyStyleRecipes = Object.freeze({
    "quiet-paper": Object.freeze({ background: "paper", backgroundPattern: "none", backgroundTexture: "none" }),
    "blue-bitmap": Object.freeze({ background: "tide", backgroundPattern: "bitmap", backgroundTexture: "none" }),
    "soft-pixel": Object.freeze({ background: "pearl", backgroundPattern: "stars", backgroundTexture: "grain" }),
    "scrapbook-pop": Object.freeze({ background: "rose", backgroundPattern: "halftone", backgroundTexture: "grain" }),
  });

  function fallbackNormaliseColor(value, fallback = "") {
    const candidate = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
  }

  function rgba(hex, alpha) {
    const value = String(hex || "").replace("#", "");
    const number = Number.parseInt(value.length === 3 ? value.split("").map((char) => char + char).join("") : value, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function create({ colorContrast, cardMaterials, normaliseColor = fallbackNormaliseColor } = {}) {
    if (!colorContrast?.themeFor) throw new TypeError("BackgroundStyle needs a color contrast policy.");
    if (!cardMaterials?.get) throw new TypeError("BackgroundStyle needs a card material registry.");

    const surfaceAssets = Object.freeze({
      collage: cardMaterials.get("collage")?.asset || "",
      scrapbook: cardMaterials.get("scrapbook")?.asset || "",
    });

    function hasBackground(value) {
      return Boolean(backgrounds[value]);
    }

    function normalisePattern(value) {
      const restoredPattern = legacyPatternAliases[value] || value;
      return patterns.has(restoredPattern) ? restoredPattern : "none";
    }

    function hasTexture(value) {
      return textures.has(value);
    }

    function mixHexColors(baseHex, tintHex, tintWeight = 0.5) {
      const base = normaliseColor(baseHex, "#25262b").slice(1);
      const tint = normaliseColor(tintHex, "#f7f3ed").slice(1);
      const weight = Math.min(1, Math.max(0, Number(tintWeight) || 0));
      const channels = [0, 2, 4].map((offset) => {
        const baseChannel = Number.parseInt(base.slice(offset, offset + 2), 16);
        const tintChannel = Number.parseInt(tint.slice(offset, offset + 2), 16);
        return Math.round(baseChannel + (tintChannel - baseChannel) * weight).toString(16).padStart(2, "0");
      });
      return `#${channels.join("")}`;
    }

    function getPatternPalette(solid, pattern = []) {
      const contrast = colorContrast.themeFor(solid);
      if (contrast.foreground !== "#ffffff") return pattern;
      const ink = normaliseColor(pattern?.[0], "#f7f3ed");
      const light = normaliseColor(pattern?.[1], "#f7f3ed");
      return [mixHexColors(solid, ink, 0.44), mixHexColors(solid, light, 0.36)];
    }

    function themeFor(source = {}) {
      const backgroundKey = hasBackground(source?.background) ? source.background : defaultBackground;
      const base = backgrounds[backgroundKey];
      if (backgroundKey !== "custom") {
        const contrast = colorContrast.themeFor(base.solid);
        return {
          ...base,
          tone: contrast.foreground === "#ffffff" ? "dark" : "light",
          pattern: getPatternPalette(base.solid, base.pattern),
        };
      }
      const solid = normaliseColor(source?.customBackgroundColor, customDefaultColor);
      const contrast = colorContrast.themeFor(solid);
      return {
        ...base,
        solid,
        tone: contrast.foreground === "#ffffff" ? "dark" : "light",
        pattern: getPatternPalette(solid, [contrast.foreground, contrast.muted]),
      };
    }

    function textureInkFor(background) {
      return colorContrast.themeFor(background?.solid).foreground;
    }

    function exportThemeFor(source = {}) {
      const background = themeFor(source);
      const isDark = colorContrast.themeFor(background.solid).foreground === "#ffffff";
      const ink = isDark ? "#f7f3ed" : "#263238";
      const panelBase = isDark ? "#1d2228" : "#fffaf4";
      const panelBorder = isDark ? rgba("#f7f3ed", 0.24) : rgba("#263238", 0.18);
      return {
        header: rgba(panelBase, 0.92),
        headerBorder: panelBorder,
        panel: rgba(panelBase, 0.96),
        panelBorder,
        text: ink,
        muted: isDark ? rgba("#f7f3ed", 0.62) : rgba("#263238", 0.6),
        infoShadow: rgba(panelBase, 0.9),
        radius: 10,
      };
    }

    function silhouetteInfoThemeFor(background) {
      return colorContrast.themeFor(background?.solid);
    }

    function restoreStyle(pattern, legacyMotif = "none", texture = "none") {
      const legacyPatterns = {
        ascii: "dots",
        y2k: "stars",
        geometry: "halftone",
        gradient: "none",
        grain: "none",
      };
      let restoredPattern = legacyPatterns[pattern] || pattern;
      let restoredTexture = texture;
      if (pattern === "grain") restoredTexture = "grain";
      if (legacyMotif === "stars" && (!restoredPattern || restoredPattern === "none")) restoredPattern = "stars";
      return {
        backgroundPattern: normalisePattern(restoredPattern),
        backgroundTexture: hasTexture(restoredTexture) ? restoredTexture : "none",
      };
    }

    function normaliseBackgroundFields(source = {}) {
      const value = source && typeof source === "object" ? source : {};
      return {
        background: hasBackground(value.background) ? value.background : defaultBackground,
        customBackgroundColor: normaliseColor(value.customBackgroundColor, customDefaultColor),
        backgroundPattern: normalisePattern(value.backgroundPattern),
        backgroundTexture: hasTexture(value.backgroundTexture) ? value.backgroundTexture : "none",
      };
    }

    function describeSelection(source = {}, translate = (key) => key) {
      const patternLabel = source.backgroundPattern === "none"
        ? translate("background.patternNone")
        : translate(`pattern.${source.backgroundPattern}`);
      const textureLabel = source.backgroundTexture === "none"
        ? translate("background.textureNone")
        : translate(`texture.${source.backgroundTexture}`);
      const backgroundLabel = source.background === "custom"
        ? translate("background.customWithColor", { color: String(source.customBackgroundColor || customDefaultColor).toUpperCase() })
        : translate(`background.${source.background}`);
      return [backgroundLabel, patternLabel, textureLabel].join(" · ");
    }

    return Object.freeze({
      customDefaultColor,
      defaultBackground,
      hasBackground,
      hasTexture,
      normalisePattern,
      normaliseBackgroundFields,
      restoreStyle,
      themeFor,
      textureInkFor,
      exportThemeFor,
      silhouetteInfoThemeFor,
      describeSelection,
      surfaceAssetFor: (pattern) => surfaceAssets[pattern] || "",
      legacyStyleRecipeFor: (preset, theme) => legacyStyleRecipes[preset] || legacyStyleRecipes[theme] || null,
    });
  }

  return Object.freeze({ create, customDefaultColor, defaultBackground });
})();

if (typeof module !== "undefined") module.exports = BackgroundStyle;
