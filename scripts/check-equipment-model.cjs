const assert = require("node:assert/strict");
const Equipment = require("../models/equipment.js");
const LookBook = require("../models/look-book.js");

const { slots, groups } = Equipment;
assert.deepEqual(slots.core, ["head", "body", "hands", "legs", "feet"]);
assert.deepEqual(slots.extras, ["weapon", "offhand", "earrings", "necklace", "bracelet", "ringLeft", "ringRight", "facewear", "fashion", "custom"]);
assert.deepEqual(slots.all, [...slots.core, ...slots.extras]);
assert.deepEqual(groups.map(({ id }) => id), ["core", "weapons", "accessories", "facewear", "fashion", "custom"]);
assert.deepEqual(groups.flatMap(({ slots: groupSlots }) => groupSlots).sort(), [...slots.all].sort(), "each valid slot belongs to exactly one product group");
assert.equal(Equipment.slotLabel("facewear", "ko"), "얼굴 장식");
assert.equal(Equipment.slotLabel("body", "ko"), "몸", "the existing core body label should remain unchanged");
assert.equal(Equipment.slotLabel("fashion", "ko"), "패션소품");
assert.equal(Equipment.slotLabel("ringRight", "en-US"), "Right ring");
assert.equal(Equipment.slotLabel("earrings", "ja"), "耳飾り");

const unsafeName = '<img src=x onerror="run()"> 룩';
const manual = {
  id: "extra-facewear-1",
  slot: "facewear",
  names: { ko: unsafeName, en: "Face accessory", ja: "顔装備" },
  itemId: 900001,
  source: "manual",
  showOnCard: true,
  note: "<script>data only</script>".repeat(20),
  ignored: "not persisted",
};
const catalogExtra = {
  id: "extra-weapon-1",
  slot: "weapon",
  names: { ko: "", en: "", ja: "" },
  itemId: "2002",
  source: "catalog",
  showOnCard: false,
};
const boundedEntries = [manual, catalogExtra, { ...manual, names: { en: "Duplicate id" } }];
for (let index = 0; index < 36; index += 1) {
  boundedEntries.push({ ...manual, id: `extra-bounded-${index}`, names: { ko: "x".repeat(200) }, note: "n".repeat(200) });
}
boundedEntries.push({ ...manual, id: 123 }, { ...manual, id: "extra-bad-slot", slot: "mount" }, { ...catalogExtra, id: "extra-unsafe-id", itemId: "9007199254740993" });
const normalizedExtras = Equipment.normalizeExtras([boundedEntries]);
assert.equal(normalizedExtras.length, 5, "extra entries should always have one array for each character");
assert.equal(normalizedExtras[0].length, Equipment.MAX_EXTRA_ENTRIES, "extra entries should have a strict per-character bound");
assert.deepEqual(normalizedExtras.slice(1), [[], [], [], []]);
assert.equal(normalizedExtras[0][0].id, manual.id);
assert.equal(normalizedExtras[0][0].itemId, null, "manual entries must never create fake numeric catalog references");
assert.equal(normalizedExtras[0][0].names.ko, unsafeName, "Unicode and markup-like names remain inert data");
assert.equal(normalizedExtras[0][0].note.length, 160);
assert.equal(Object.hasOwn(normalizedExtras[0][0], "ignored"), false);
assert.equal(normalizedExtras[0][1].itemId, 2002, "catalog references should normalize to safe numeric IDs");
assert.equal(normalizedExtras[0][1].source, "catalog");
assert.equal(normalizedExtras[0][2].id, "extra-facewear-1-3", "duplicate extra IDs should be made unique without losing entries");
assert.equal(normalizedExtras[0].at(-1).names.ko.length, 160);
assert.equal(Equipment.normalizeEntry({ ...manual, id: "900001" }), null, "catalog IDs must not be accepted as extra-entry IDs");
assert.equal(Equipment.normalizeEntry({ ...manual, id: "extra-../../unsafe" }), null, "extra IDs should not carry path or control syntax");
assert.equal(Equipment.normalizeEntry({ ...manual, id: `extra-${"a".repeat(75)}` }), null, "extra IDs should have a strict length bound");
assert.equal(Equipment.normalizeEntry({ ...catalogExtra, itemId: -1 }), null);
assert.equal(Equipment.normalizeEntry({ ...manual, slot: "unknown" }), null);
assert.deepEqual(Equipment.normalizeExtras([[{ ...manual, id: 123 }, { ...manual, slot: "mount" }]])[0], [], "malformed entries should be dropped at the pure schema boundary");

const visibility = Equipment.normalizeVisibility([{ head: false, body: "false", feet: 0 }, { ringLeft: false }]);
assert.equal(visibility.length, 5);
assert.equal(visibility[0].head, false);
assert.equal(visibility[0].body, true, "only explicit booleans should affect visibility");
assert.equal(visibility[0].feet, true);
assert.equal(visibility[0].hands, true);
assert.equal(visibility[1].body, true);
assert.equal(Object.keys(visibility[0]).length, 5);

assert.deepEqual(Equipment.normalizeComposition(), { layer: "info-front", protectText: true, infoGap: 0 });
assert.deepEqual(Equipment.normalizeComposition({ layer: "person-front", protectText: false, infoGap: 12.6 }), {
  layer: "person-front", protectText: false, infoGap: 13,
});
assert.deepEqual(Equipment.normalizeComposition({ layer: "script", protectText: "false", infoGap: 900 }), {
  layer: "info-front", protectText: true, infoGap: 64,
});
assert.equal(Equipment.normalizeComposition({ infoGap: -40 }).infoGap, 0);
assert.equal(Equipment.normalizeComposition({ infoGap: "not a number" }).infoGap, 0);

const coreItems = Object.freeze([
  Object.freeze({ id: "101", slot: "head", names: Object.freeze({ ko: "머리 장비", en: "Head item", ja: "頭装備" }) }),
  Object.freeze({ id: "102", slot: "body", names: Object.freeze({ ko: "몸 장비", en: "Body item", ja: "胴装備" }) }),
  Object.freeze({ id: "2002", slot: "weapon", names: Object.freeze({ ko: "무기 이름", en: "Weapon name", ja: "武器名" }) }),
]);
const look = Object.freeze({
  outfits: Object.freeze([
    Object.freeze({ head: "101", body: "102", hands: null, legs: null, feet: null }),
  ]),
  cardVisibility: Object.freeze([Object.freeze({ head: true, body: false })]),
  extraEquipment: Object.freeze([Object.freeze([
    Object.freeze({ ...manual, id: "extra-facewear-1", itemId: 777, source: "manual", showOnCard: true }),
    Object.freeze({ ...catalogExtra, itemId: 2002, source: "catalog", showOnCard: false }),
  ])]),
});
const allEntries = Equipment.entriesFor({ look, characterIndex: 0, coreItems, language: "en" });
assert.deepEqual(allEntries.map(({ id }) => id), ["101", "102", "extra-facewear-1", "extra-weapon-1"]);
assert.equal(allEntries[0].name, "Head item");
assert.equal(allEntries[0].secondaryName, "", "English-card names do not add a redundant secondary label");
assert.equal(allEntries[0].showOnCard, true);
assert.equal(allEntries[1].showOnCard, false, "core visibility should be read from the per-character map");
assert.equal(allEntries[2].itemId, null, "manual item IDs should remain null when projected");
assert.equal(allEntries[2].name, "Face accessory");
assert.equal(allEntries[3].name, "Weapon name", "catalog-sourced extras should resolve names from the supplied catalog");
assert.equal(allEntries[3].extra, true);
const editedCatalogEntry = Equipment.entriesFor({
  look: {
    extraEquipment: [[{ ...catalogExtra, names: { ko: "사용자 수정 이름", en: "", ja: "" }, itemId: 2002 }]],
  },
  coreItems,
  language: "ko",
}).find(({ id }) => id === catalogExtra.id);
assert.equal(editedCatalogEntry.name, "사용자 수정 이름", "a user-edited localized label should take precedence over its catalog label");
assert.equal(editedCatalogEntry.names.en, "Weapon name", "missing localized values should still hydrate from the catalog record");
const koreanEntries = Equipment.entriesFor({ look, characterIndex: 0, coreItems, language: "ko" });
assert.equal(koreanEntries[0].secondaryName, "Head item", "Korean names may show an English secondary label");
assert.equal(Equipment.entriesFor({ look, characterIndex: 0, coreItems, language: "ja" })[0].secondaryName, "Head item", "Japanese names may show an English secondary label");
const selectedEntries = Equipment.entriesFor({ look, characterIndex: 0, coreItems, language: "en", selectedOnly: true });
assert.deepEqual(selectedEntries.map(({ id }) => id), ["101", "extra-facewear-1"], "selectedOnly filters visibility without applying a display count cap");
selectedEntries[0].names.ko = "changed output";
assert.equal(coreItems[0].names.ko, "머리 장비", "projected records must not mutate supplied catalog items");
assert.equal(look.outfits[0].head, "101", "projection must not mutate authoritative core outfits");

const unvisitedExtras = new Proxy([], {
  get(target, property, receiver) {
    if (property === Symbol.iterator) throw new Error("entriesFor scanned a nonselected character's extras");
    return Reflect.get(target, property, receiver);
  },
});
assert.equal(Equipment.entriesFor({
  look: { outfits: [{ head: "101" }], extraEquipment: [[], unvisitedExtras], cardVisibility: [{ head: true }] },
  characterIndex: 0,
  coreItems,
}).length, 1, "card projection should normalize only the requested character instead of cloning all five arrays");

const allSelectedLook = Equipment.ensureLook({
  outfits: [{ head: "101", body: "102", hands: "103", legs: "104", feet: "105" }],
  extraEquipment: [Array.from({ length: 32 }, (_, index) => ({
    id: `extra-all-${index}`,
    slot: "custom",
    names: { en: `Custom ${index}` },
    source: "manual",
    showOnCard: true,
  }))],
});
const fiveCoreItems = slots.core.map((slot, index) => ({ id: String(101 + index), slot, names: { en: `${slot} ${index}` } }));
assert.equal(Equipment.entriesFor({ look: allSelectedLook, characterIndex: 0, coreItems: fiveCoreItems, selectedOnly: true }).length, 37, "all five core slots and all 32 registered extras remain eligible to display");

(async () => {
  const copySource = {
    id: "copy-source",
    title: "Source look",
    outfits: [{ head: "101", body: "102", hands: "103", legs: "104", feet: "105" }],
    extraEquipment: [[{ ...manual, id: "extra-copy-source" }]],
    cardVisibility: [{ head: false }],
    cardComposition: { layer: "person-front", protectText: true, infoGap: 28 },
    history: [{ extraEquipment: [[{ ...manual }]] }],
    redo: [],
  };
  const copy = await LookBook.copy(copySource, {
    createId: () => "copy-result",
    readAsset: async () => null,
    writeAsset: async () => {},
    isCurrent: () => true,
  });
  assert.equal(copy.id, "copy-result");
  assert.deepEqual(copy.outfits, copySource.outfits, "copying a look must preserve all five legacy core equipment slots");
  assert.deepEqual(copy.extraEquipment, copySource.extraEquipment);
  assert.deepEqual(copy.cardVisibility, copySource.cardVisibility);
  assert.deepEqual(copy.cardComposition, copySource.cardComposition);
  assert.equal(Object.hasOwn(copy, "history"), false, "a duplicate should not inherit the source look's undo branch");
  copy.extraEquipment[0][0].names.en = "changed duplicate";
  assert.equal(copySource.extraEquipment[0][0].names.en, "Face accessory", "look duplication must deep-copy extra equipment names");
  copy.cardVisibility[0].head = true;
  assert.equal(copySource.cardVisibility[0].head, false, "look duplication must deep-copy per-slot visibility");
  copy.cardComposition.infoGap = 0;
  assert.equal(copySource.cardComposition.infoGap, 28, "look duplication must deep-copy card composition");
  console.log("PASS: equipment metadata, bounds, inert text, per-character visibility, catalog projection, copy isolation, and uncapped card selection are normalized consistently.");
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
