const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const slots = await import("../functions/_shared/item-slots.mjs");
  const indexModule = await import("../functions/_shared/item-index.mjs");

  const expectedCategories = {
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
  };
  for (const [category, slot] of Object.entries(expectedCategories)) {
    assert.equal(
      slots.resolveItemSlotFromEquipSlotCategory(category),
      slot,
      `EquipSlotCategory ${category} should be indexed as ${slot}`,
    );
  }

  const rows = [
    csvHeader(),
    "int32",
    ...[
      [15478, "아기돼지 머리", 41657, 1, 3],
      [15479, "아기돼지 의상", 42523, 1, 16],
      [3352, "철제 중장 허벅지갑옷", 45291, 1, 18],
      [47285, "우주 조종사 비행복", 57288, 1, 23],
      [90001, "쉼표, 줄바꿈\n이름", 1, 1, 15],
      [90002, "액세서리", 2, 1, 9],
      [90003, "영혼", 3, 1, 17],
    ].map(([id, name, icon, level, category]) => csvRow({ id, name, icon, level, category })),
  ];
  const parsed = indexModule.parseKoreanItemIndex(rows.map((row) => Array.isArray(row) ? row.join(",") : row).join("\r\n"));
  assert.deepEqual(
    parsed.records.map(({ id, slot }) => ({ id, slot })),
    [
      { id: "15478", slot: "head" },
      { id: "15479", slot: "body" },
      { id: "3352", slot: "legs" },
      { id: "47285", slot: "body" },
      { id: "90001", slot: "body" },
    ],
    "supported special costume and leg categories must survive CSV parsing",
  );
  assert.equal(parsed.records.find((record) => record.id === "90001").names.ko, "쉼표, 줄바꿈\n이름");
  assert.equal(parsed.audit.unknownCategories.length, 0, "known non-outfit categories should be intentionally ignored");

  const unknown = indexModule.parseKoreanItemIndex(
    [csvHeader(), "int32", csvRow({ id: 99001, name: "미확인 장비", icon: 1, level: 1, category: 99 })].join("\n"),
  );
  assert.equal(unknown.audit.unknownCategories[0].category, "99");
  assert.throws(
    () => indexModule.assertNoUnknownEquipSlotCategories(unknown.audit),
    /99/,
    "new category values must fail the build instead of disappearing silently",
  );
  const unknownWithoutName = indexModule.parseKoreanItemIndex(
    [csvHeader(), "int32", csvRow({ id: 99002, name: "", icon: 1, level: 1, category: 99 })].join("\n"),
  );
  assert.throws(
    () => indexModule.assertNoUnknownEquipSlotCategories(unknownWithoutName.audit),
    /99/,
    "unknown categories must be audited even when localization is blank",
  );

  const snapshot = JSON.parse(fs.readFileSync("assets/data/items-ko.json", "utf8"));
  const requiredRecords = [
    ["15479", "body", "아기돼지 의상"],
    ["2966", "body", "순록 의상"],
    ["3352", "legs", "철제 중장 허벅지갑옷"],
    ["47285", "body", "우주 조종사 비행복"],
  ];
  for (const [id, slot, name] of requiredRecords) {
    assert.deepEqual(
      snapshot.find((record) => record.id === id && record.names?.ko === name)?.slot,
      slot,
      `${name} must be present in the bundled Korean item snapshot`,
    );
  }
  assert.equal(new Set(snapshot.map((record) => record.id)).size, snapshot.length, "snapshot item IDs must be unique");
  assert.ok(snapshot.every((record) => slots.supportedItemSlots.includes(record.slot)), "snapshot contains an unsupported slot");
  console.log(`PASS: shared item-slot mapping, CSV coverage audit, special categories, and ${snapshot.length} snapshot records.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function csvRow({ id, name, icon, level, category }) {
  const fields = Array.from({ length: 92 }, () => "");
  fields[0] = id;
  fields[10] = name;
  fields[11] = icon;
  fields[12] = level;
  fields[18] = category;
  return fields.map(escapeCsvField).join(",");
}

function csvHeader() {
  const fields = Array.from({ length: 92 }, () => "");
  fields[0] = "#";
  fields[10] = "Name";
  fields[11] = "Icon";
  fields[12] = "Level{Item}";
  fields[18] = "EquipSlotCategory";
  return fields.map(escapeCsvField).join(",");
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
