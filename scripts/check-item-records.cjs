const assert = require("node:assert/strict");
const ItemRecords = require("../models/item-records.js");

const store = ItemRecords.create({ slots: ["head", "body", "weapon", "ring"] });
store.register([
  {
    id: 101,
    slot: "head",
    icon: "icon-101",
    iconUrl: "https://xivapi.com/i/0/101.png",
    names: { ko: "모자", en: "Hat" },
    meta: { ko: "머리", en: "Head" },
    source: "xivapi",
    ignored: "not persisted",
  },
  { id: 102, slot: "body", names: { ko: "상의" }, meta: { ko: "몸" } },
  { id: 103, slot: "ring", names: { ko: "반지", en: "Ring" } },
  { id: 104, slot: "weapon", names: { ko: "무기", en: "Weapon" } },
  { id: 105, slot: "ring", names: { ko: "다른 반지", en: "Another ring" } },
]);
store.register([{ id: "101", slot: "head", names: { ja: "帽子" }, meta: { ja: "頭" } }]);

assert.equal(store.get(101).names.ja, "帽子", "register should merge localized names");
assert.equal(store.get(101).meta.en, "Head", "register should preserve earlier metadata");
assert.equal(store.get(101).ignored, "not persisted", "cache may retain server-only fields");

const serialized = store.serialize(store.get(101));
assert.deepEqual(serialized, {
  id: "101",
  slot: "head",
  icon: "icon-101",
  iconUrl: "https://xivapi.com/i/0/101.png",
  names: { ko: "모자", en: "Hat", ja: "帽子" },
  meta: { ko: "머리", en: "Head", ja: "頭" },
  source: "xivapi",
});

const persisted = store.persistedRecords([
  {
    outfits: [{ head: "101", body: "102", feet: "999", ring: "105" }, { head: "101" }],
    extraEquipment: [[
      { id: "extra-left-ring", slot: "ringLeft", itemId: 103, source: "catalog" },
      { id: "extra-right-ring", slot: "ringRight", itemId: "103", source: "catalog" },
      { id: "extra-weapon", slot: "weapon", itemId: 104, source: "catalog" },
      { id: "extra-manual", slot: "facewear", itemId: 102, source: "manual" },
      { id: "extra-unsafe", slot: "custom", itemId: "9007199254740993", source: "catalog" },
    ]],
  },
  { outfits: [{ head: "not-an-id", body: "102" }] },
]);
assert.deepEqual(persisted.map(({ id }) => id), ["101", "102", "103", "104"], "projection should deduplicate core and catalog extras, including raw ring IDs, while skipping noncore outfit values, manual/unsafe references");
assert.equal(persisted.find(({ id }) => id === "103").slot, "ring", "the cache keeps the raw catalog ring slot while UI extras own left/right placement");
assert.equal(Object.hasOwn(persisted[0], "ignored"), false, "draft projection should keep the bounded schema");

const restrictedSlots = ItemRecords.create({ slots: ["head"] });
restrictedSlots.register([{ id: 103, slot: "ring", names: { en: "Ring" } }]);
assert.deepEqual(restrictedSlots.persistedRecords([{ extraEquipment: [[{ itemId: 103, source: "catalog" }]] }]), [], "catalog item slot validity remains controlled by the caller-supplied allowlist");

assert.equal(store.set("103", { id: "103", slot: "head", names: { ko: "테스트" } }), store, "set should remain Map-compatible");
assert.equal(store.get("103").names.ko, "테스트");
store.clear();
assert.equal(store.get("101"), null, "clear should remove cached records");
console.log("PASS: item record cache merges search data and projects only referenced bounded records.");
