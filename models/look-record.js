/*
 * Persisted look records are the seam between the live editor and draft v3.
 * The app keeps cache/state coordination; this module owns the field shape,
 * defaulting, and compatibility rules shared by load and save paths.
 */
const LookRecord = (() => {
  function create({
    createBlankLook,
    editor,
    title,
    backgroundStyle,
    colors,
    outfits,
  } = {}) {
    if (typeof createBlankLook !== "function") throw new TypeError("LookRecord needs a blank-look factory.");
    if (!editor?.create || !editor?.normalize || !editor?.serializeCharacter) {
      throw new TypeError("LookRecord needs an editor policy.");
    }
    if (!title?.fonts || !title?.normalizeTitleFontSize || !title?.normalizeSubtitleFontSize
      || !title?.normalizeBoolean || !title?.normalizeWeight || !title?.normalizeAlign) {
      throw new TypeError("LookRecord needs a typography policy.");
    }
    if (!backgroundStyle?.normaliseBackgroundFields) throw new TypeError("LookRecord needs a background style policy.");
    if (!colors?.normalizeOptionalHex || !colors?.normalizeOutline) {
      throw new TypeError("LookRecord needs color normalizers.");
    }
    if (!outfits?.create || !outfits?.clone || !outfits?.ensure || !outfits?.get) {
      throw new TypeError("LookRecord needs an outfit policy.");
    }

    function normalizeFont(fontKey) {
      return title.fonts[fontKey] ? fontKey : title.defaultFont;
    }

    function normalizeSaved(value, index) {
      const id = typeof value?.id === "string" && value.id.trim()
        ? value.id.trim().slice(0, 80)
        : `look-${index + 1}`;
      const look = createBlankLook(index + 1, id);
      const backgroundFields = backgroundStyle.normaliseBackgroundFields(value);
      look.title = typeof value?.title === "string" ? value.title.trim().slice(0, 64) || "새로운 룩" : "새로운 룩";
      look.subtitle = typeof value?.subtitle === "string" ? value.subtitle.trim().slice(0, 160) : "";
      Object.assign(look, backgroundFields);
      look.titleFont = normalizeFont(value?.titleFont);
      look.titleWeight = title.normalizeWeight(look.titleFont, value?.titleWeight ?? title.defaultWeight);
      look.titleFontSize = title.normalizeTitleFontSize(value?.titleFontSize);
      look.titleItalic = title.normalizeBoolean(value?.titleItalic);
      look.titleUnderline = title.normalizeBoolean(value?.titleUnderline);
      look.titleUppercase = title.normalizeBoolean(value?.titleUppercase);
      look.titleAlign = title.normalizeAlign(value?.titleAlign);
      look.titleColor = colors.normalizeOptionalHex(value?.titleColor ?? value?.subtitleColor);
      look.subtitleFont = normalizeFont(value?.subtitleFont);
      look.subtitleWeight = title.normalizeWeight(look.subtitleFont, value?.subtitleWeight ?? title.defaultSubtitleWeight);
      look.subtitleFontSize = title.normalizeSubtitleFontSize(value?.subtitleFontSize);
      look.subtitleItalic = title.normalizeBoolean(value?.subtitleItalic);
      look.subtitleUnderline = title.normalizeBoolean(value?.subtitleUnderline);
      look.subtitleUppercase = title.normalizeBoolean(value?.subtitleUppercase);
      look.subtitleColor = colors.normalizeOptionalHex(value?.subtitleColor);
      look.outline = colors.normalizeOutline(value?.outline, "#f1dfbb", 8);
      look.titleOutline = colors.normalizeOutline(value?.titleOutline, "#ffffff", 6);
      look.outfits = Array.isArray(value?.outfits) ? outfits.clone(value.outfits) : outfits.create([]);
      look.editor = value?.editor ? editor.normalize(value.editor) : null;
      outfits.ensure(look);
      return look;
    }

    function serialize(look) {
      const normalizedEditor = editor.normalize(look.editor || editor.create());
      const backgroundFields = backgroundStyle.normaliseBackgroundFields(look);
      return {
        id: String(look.id),
        title: typeof look.title === "string" ? look.title : "새로운 룩",
        subtitle: typeof look.subtitle === "string" ? look.subtitle : "",
        outfits: outfits.clone(outfits.get(look)),
        ...backgroundFields,
        titleFont: normalizeFont(look.titleFont),
        titleWeight: title.normalizeWeight(look.titleFont || title.defaultFont, look.titleWeight ?? title.defaultWeight),
        titleFontSize: title.normalizeTitleFontSize(look.titleFontSize),
        titleItalic: title.normalizeBoolean(look.titleItalic),
        titleUnderline: title.normalizeBoolean(look.titleUnderline),
        titleUppercase: title.normalizeBoolean(look.titleUppercase),
        titleAlign: title.normalizeAlign(look.titleAlign),
        titleColor: colors.normalizeOptionalHex(look.titleColor ?? look.subtitleColor),
        subtitleFont: normalizeFont(look.subtitleFont),
        subtitleWeight: title.normalizeWeight(look.subtitleFont || title.defaultFont, look.subtitleWeight ?? title.defaultSubtitleWeight),
        subtitleFontSize: title.normalizeSubtitleFontSize(look.subtitleFontSize),
        subtitleItalic: title.normalizeBoolean(look.subtitleItalic),
        subtitleUnderline: title.normalizeBoolean(look.subtitleUnderline),
        subtitleUppercase: title.normalizeBoolean(look.subtitleUppercase),
        subtitleColor: colors.normalizeOptionalHex(look.subtitleColor),
        outline: colors.normalizeOutline(look.outline, "#f1dfbb", 8),
        titleOutline: colors.normalizeOutline(look.titleOutline, "#ffffff", 6),
        editor: {
          ...normalizedEditor,
          characters: normalizedEditor.characters.map(editor.serializeCharacter),
        },
      };
    }

    return Object.freeze({ normalizeSaved, serialize });
  }

  return Object.freeze({ create });
})();

if (typeof module !== "undefined") module.exports = LookRecord;
