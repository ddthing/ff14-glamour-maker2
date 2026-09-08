// EquipSlotCategory is a game-data enum, not a one-to-one list of the six
// editor slots. Costume-only and restricted gear uses categories 15–23.
// Keep this table at one seam so ingestion, local fallback, and live results
// cannot silently disagree about which items are searchable.
export const supportedItemSlots = Object.freeze([
  "head",
  "body",
  "hands",
  "legs",
  "feet",
  "weapon",
]);

const slotByEquipSlotCategory = Object.freeze({
  1: "weapon",
  2: "weapon",
  3: "head",
  4: "body",
  5: "hands",
  7: "legs",
  8: "feet",
  13: "weapon",
  14: "weapon",
  15: "body",
  16: "body",
  18: "legs",
  19: "body",
  20: "body",
  21: "body",
  22: "body",
  23: "body",
});

// These categories are intentionally outside the editor contract: currency,
// waist gear, accessories, and soul crystals. They must be explicit so a new
// category cannot disappear from the index without a build-time warning.
const knownIgnoredEquipSlotCategories = Object.freeze([0, 6, 9, 10, 11, 12, 17]);

export function resolveItemSlotFromEquipSlotCategory(value) {
  return classifyEquipSlotCategory(value).slot;
}

export function classifyEquipSlotCategory(value) {
  const numericCategory = Number(value);
  const category = Number.isInteger(numericCategory) && numericCategory >= 0
    ? numericCategory
    : null;
  const slot = category === null ? "" : slotByEquipSlotCategory[category] || "";
  if (slot) return { category, slot, status: "supported" };
  if (category !== null && knownIgnoredEquipSlotCategories.includes(category)) {
    return { category, slot: "", status: "ignored" };
  }
  return { category, slot: "", status: "unknown" };
}
