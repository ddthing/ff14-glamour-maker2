/* Item record cache and draft projection.
   Search, equipment rendering, and draft persistence all consume the same
   bounded records. Keeping this stateful-but-DOM-free seam separate prevents
   UI code from deciding which catalog fields are safe to retain. */
const ItemRecords = (() => {
  const languages = ["ko", "en", "ja"];
  const persistedOutfitSlots = ["head", "body", "hands", "legs", "feet"];

  function create({ slots = [] } = {}) {
    const validSlots = new Set(slots.filter((slot) => typeof slot === "string" && slot));
    const records = new Map();

    function get(id) {
      return records.get(String(id)) || null;
    }

    // Keep Map-compatible methods for the editor's reset path and fixtures.
    function set(id, item) {
      records.set(String(id), item);
      return api;
    }

    function clear() {
      records.clear();
    }

    function localise(values) {
      return Object.fromEntries(languages
        .filter((language) => typeof values?.[language] === "string")
        .map((language) => [language, values[language].slice(0, 160)]));
    }

    function serialize(item) {
      return {
        id: String(item.id),
        slot: validSlots.has(item.slot) ? item.slot : "",
        icon: typeof item.icon === "string" ? item.icon.slice(0, 160) : "",
        iconUrl: typeof item.iconUrl === "string" && item.iconUrl.startsWith("https://") ? item.iconUrl.slice(0, 320) : "",
        names: localise(item.names),
        meta: localise(item.meta),
        source: typeof item.source === "string" ? item.source.slice(0, 80) : "",
      };
    }

    function register(items = []) {
      items.forEach((item) => {
        if (!item?.id || !item?.slot || !item?.names) return;
        const id = String(item.id);
        const previous = records.get(id) || {};
        records.set(id, {
          ...previous,
          ...item,
          id,
          names: { ...(previous.names || {}), ...item.names },
          meta: { ...(previous.meta || {}), ...(item.meta || {}) },
        });
      });
    }

    function numericCatalogId(value) {
      if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
      if (typeof value !== "string" || !/^\d{1,16}$/.test(value)) return "";
      const numeric = Number(value);
      return Number.isSafeInteger(numeric) && numeric > 0 ? String(numeric) : "";
    }

    function persistedRecords(looks = []) {
      const referencedIds = new Set();
      for (const look of looks) {
        // Looks are normalized before they enter the collection. This read
        // path intentionally does not clone or repair an outfit.
        for (const outfit of Array.isArray(look?.outfits) ? look.outfits : []) {
          for (const slot of persistedOutfitSlots) {
            if (!validSlots.has(slot)) continue;
            const itemId = numericCatalogId(outfit?.[slot]);
            if (itemId) referencedIds.add(itemId);
          }
        }
        for (const entries of Array.isArray(look?.extraEquipment) ? look.extraEquipment.slice(0, 5) : []) {
          for (const entry of Array.isArray(entries) ? entries.slice(0, 32) : []) {
            if (entry?.source !== "catalog") continue;
            const itemId = numericCatalogId(entry.itemId);
            if (itemId) referencedIds.add(itemId);
          }
        }
      }
      return Array.from(referencedIds)
        .map(get)
        .filter((item) => item && validSlots.has(item.slot))
        .map(serialize);
    }

    const api = { get, set, clear, register, serialize, persistedRecords };
    return api;
  }

  return { create };
})();

if (typeof module !== "undefined") module.exports = ItemRecords;
