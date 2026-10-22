/* Coordinates complete per-character sheets without depending on editor state. */
const EquipmentSheetExport = (() => {
  function snapshotEntries(entries) {
    return (Array.isArray(entries) ? entries : []).map((entry) => ({
      ...entry,
      ...(entry?.names ? { names: { ...entry.names } } : {}),
    }));
  }

  function snapshotGroups(groups) {
    return Array.isArray(groups) ? groups.map((group) => ({
      ...group,
      slots: Array.isArray(group.slots) ? [...group.slots] : [],
      ...(group.labels ? { labels: { ...group.labels } } : {}),
    })) : undefined;
  }

  function snapshotCharacter(value, shared) {
    return {
      title: String(value?.title || shared.title || "Look"),
      characterIndex: Math.max(0, Math.min(4, Math.floor(Number(value?.characterIndex) || 0))),
      language: String(value?.language || shared.language || "ko"),
      entries: snapshotEntries(value?.entries),
      image: value?.image || null,
      slotLabel: value?.slotLabel || shared.slotLabel,
      groups: snapshotGroups(value?.groups || shared.groups),
      canvasFactory: value?.canvasFactory || shared.canvasFactory,
    };
  }

  function dependencies(options) {
    const GearSheet = options.GearSheet || globalThis.GearSheet;
    const ZipStore = options.ZipStore || globalThis.ZipStore;
    if (typeof GearSheet?.render !== "function" || typeof ZipStore?.create !== "function") {
      throw new TypeError("Equipment sheet export requires GearSheet and ZipStore.");
    }
    return { GearSheet, ZipStore };
  }

  function entryKey(entry) {
    return String(entry?.id ?? entry?.itemId ?? "");
  }

  function verifyCoverage(entries, pages) {
    if (!Array.isArray(pages) || !pages.length) throw new Error("Equipment sheet export produced no pages.");
    const expected = new Map();
    entries.forEach((entry) => {
      const id = entryKey(entry);
      expected.set(id, (expected.get(id) || 0) + 1);
    });
    pages.forEach((page) => {
      if (!(page?.blob instanceof Blob) || !Array.isArray(page.entryIds)) {
        throw new Error("Equipment sheet export returned an invalid page.");
      }
      page.entryIds.forEach((value) => {
        const id = String(value ?? "");
        const remaining = expected.get(id) || 0;
        if (!remaining) throw new Error("Equipment sheet page coverage mismatch.");
        expected.set(id, remaining - 1);
      });
    });
    if ([...expected.values()].some((remaining) => remaining !== 0)) {
      throw new Error("Equipment sheet page coverage mismatch.");
    }
  }

  function pageFiles(character, pages) {
    const characterNumber = String(character.characterIndex + 1).padStart(2, "0");
    // A visible title is one filename component, never a user-defined path.
    const stem = Array.from(character.title.normalize("NFC")
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/gu, "-")
      .replace(/\s+/gu, " ")
      .replace(/^[.\s-]+|[.\s-]+$/gu, "")).slice(0, 80).join("") || "Look";
    return pages.map((page, index) => ({
      name: `${stem}-character-${characterNumber}/page-${String(index + 1).padStart(2, "0")}.png`,
      blob: page.blob,
    }));
  }

  async function selected(options = {}) {
    const { GearSheet, ZipStore } = dependencies(options);
    const character = snapshotCharacter(options, options);
    const result = await GearSheet.render(character);
    verifyCoverage(character.entries, result?.pages);
    const pages = result.pages;
    const format = pages.length === 1 ? "png" : "zip";
    const blob = format === "png" ? pages[0].blob : await ZipStore.create(pageFiles(character, pages));
    return { blob, format, pageCount: pages.length, entryCount: character.entries.length, characterCount: 1 };
  }

  async function all(options = {}) {
    const { GearSheet, ZipStore } = dependencies(options);
    // Capture every character before the first render yields to image decoding.
    const characters = (Array.isArray(options.characters) ? options.characters : [])
      .map((character) => snapshotCharacter(character, options));
    if (!characters.length) throw new Error("Equipment sheet export requires at least one character.");
    const files = [];
    let pageCount = 0;
    let entryCount = 0;
    for (const character of characters) {
      const result = await GearSheet.render(character);
      verifyCoverage(character.entries, result?.pages);
      files.push(...pageFiles(character, result.pages));
      pageCount += result.pages.length;
      entryCount += character.entries.length;
    }
    const blob = await ZipStore.create(files);
    return { blob, format: "zip", pageCount, entryCount, characterCount: characters.length };
  }

  return Object.freeze({ selected, all });
})();

if (typeof module !== "undefined") module.exports = EquipmentSheetExport;
else globalThis.EquipmentSheetExport = EquipmentSheetExport;
