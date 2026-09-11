/* Draft v3 is still the browser persistence contract. The selected look is
   the source of truth; legacy top-level fields are only compatibility mirrors
   for older readers and migrations. */
const DraftSchema = (() => {
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }

  function selectedCharacter(editor) {
    const characters = Array.isArray(editor?.characters) ? editor.characters : [];
    const count = Number.isInteger(editor?.characterCount)
      ? Math.min(5, Math.max(1, editor.characterCount))
      : 1;
    const index = Number.isInteger(editor?.selectedCharacter)
      ? Math.min(count - 1, Math.max(0, editor.selectedCharacter))
      : 0;
    return characters[index] || {};
  }

  function create({ looks = [], selectedLookId = "", language = "", catalogItems = [] } = {}) {
    const serializedLooks = Array.isArray(looks) ? looks : [];
    const selected = serializedLooks.find((look) => look?.id === selectedLookId) || serializedLooks[0] || {};
    const editor = selected.editor || {};
    const character = selectedCharacter(editor);

    return {
      version: 3,
      looks: clone(serializedLooks),
      title: selected.title,
      subtitle: selected.subtitle,
      background: selected.background,
      customBackgroundColor: selected.customBackgroundColor,
      cutout: character.cutout === true,
      outline: clone(selected.outline),
      titleOutline: clone(selected.titleOutline),
      shadow: clone(editor.shadow),
      zoom: character.zoom,
      panX: character.panX,
      panY: character.panY,
      imageFit: character.imageFit,
      focalPoint: clone(character.focalPoint),
      language,
      selectedLookId: selected.id || selectedLookId,
      characterCount: editor.characterCount,
      selectedCharacter: editor.selectedCharacter,
      outfits: clone(selected.outfits),
      catalogItems: clone(catalogItems),
      multiInfoEnabled: editor.multiInfoEnabled,
      multiInfoMode: editor.multiInfoMode,
      titleFont: selected.titleFont,
      titleWeight: selected.titleWeight,
      titleFontSize: selected.titleFontSize,
      titleItalic: selected.titleItalic,
      titleUnderline: selected.titleUnderline,
      titleUppercase: selected.titleUppercase,
      titleAlign: selected.titleAlign,
      titleColor: selected.titleColor,
      subtitleFont: selected.subtitleFont,
      subtitleWeight: selected.subtitleWeight,
      subtitleFontSize: selected.subtitleFontSize,
      subtitleItalic: selected.subtitleItalic,
      subtitleUnderline: selected.subtitleUnderline,
      subtitleUppercase: selected.subtitleUppercase,
      subtitleColor: selected.subtitleColor,
      singleRatio: editor.singleRatio,
      singleLayout: editor.singleLayout,
      backgroundPattern: selected.backgroundPattern,
      backgroundTexture: selected.backgroundTexture,
      characters: clone(editor.characters),
    };
  }

  return { create };
})();

if (typeof module !== "undefined") module.exports = DraftSchema;
