const assert = require("node:assert/strict");
const CardLayout = require("../models/card-layout.js");
const CardComposition = require("../models/card-composition.js");

function entry(index, { extra = false, showOnCard = true, longName = false } = {}) {
  const suffix = String(index + 1).padStart(2, "0");
  return {
    id: `gear-${suffix}`,
    itemId: 10_000 + index,
    slot: extra ? "accessory" : ["head", "body", "hands", "legs", "feet"][index % 5],
    slotName: extra ? "Accessory" : `Slot ${index + 1}`,
    extra,
    showOnCard,
    names: {
      ko: longName ? `아주 긴 장비 이름 별빛의 은빛 달빛 예복 ${suffix}` : `장비 이름 ${suffix}`,
      en: longName ? `Extremely Long Moonlit Silverwear Set ${suffix}` : `Gear Name ${suffix}`,
      ja: `装備名 ${suffix}`,
    },
  };
}

function characterCountPlan(characterCount, gearByCharacter, overrides = {}) {
  const characters = Array.from({ length: characterCount }, () => ({ cutout: true }));
  const singleRatio = characterCount === 1 ? "portrait" : "landscape";
  const layout = CardLayout.layoutFor({ characterCount, singleRatio, characters });
  return CardLayout.planComposition({
    characterCount,
    singleRatio,
    characters,
    layout,
    gearByCharacter,
    multiInfoEnabled: characterCount >= 3,
    selectedCharacter: 0,
    language: "ko",
    composition: { layer: "info-front", protectText: true, infoGap: 0 },
    ...overrides,
  });
}

function assertInsideBoard(rect, dimensions, message) {
  assert.ok(rect.x >= -0.01, `${message}: x starts outside the board`);
  assert.ok(rect.y >= -0.01, `${message}: y starts outside the board`);
  assert.ok(rect.x + rect.width <= dimensions.layoutWidth + 0.01, `${message}: right edge escapes the board`);
  assert.ok(rect.y + rect.height <= dimensions.layoutHeight + 0.01, `${message}: bottom edge escapes the board`);
}

function assertNoTileOverlap(items) {
  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    const first = items[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const second = items[secondIndex];
      if (first.characterIndex !== second.characterIndex) continue;
      const overlaps = first.x < second.x + second.width - 0.01
        && first.x + first.width > second.x + 0.01
        && first.y < second.y + second.height - 0.01
        && first.y + first.height > second.y + 0.01;
      assert.equal(overlaps, false, `planned notes overlap for character ${first.characterIndex}: ${first.gearIndex} / ${second.gearIndex}`);
    }
  }
}

assert.equal(CardComposition.estimatedLineCount("first locale\nsecond locale", 10, 200), 2, "explicit locale separators remain separate lines during fitting");

const coreFive = Array.from({ length: 5 }, (_, index) => entry(index));
const legacyDefault = characterCountPlan(1, [coreFive]);
assert.equal(legacyDefault.isCustom, false, "the default core-five card must keep its legacy geometry");
assert.deepEqual(legacyDefault.items, [], "legacy cards must leave note placement to the unchanged renderer");
assert.equal(legacyDefault.hasUnplacedVisibleItems, false, "legacy five-slot rendering is not an omission");

const accessoryOnly = [entry(0, { extra: true }), entry(1, { extra: true }), entry(2, { extra: true })];
const accessoryPlan = characterCountPlan(1, [accessoryOnly]);
assert.equal(accessoryPlan.isCustom, true, "even a small extra-only list needs custom slot geometry");
assert.deepEqual(accessoryPlan.items.map(({ gearIndex, extra }) => [gearIndex, extra]), [[0, true], [1, true], [2, true]]);
assert.equal(accessoryPlan.items.length, accessoryOnly.length, "every visible accessory is planned");

const normalElevenPlan = characterCountPlan(1, [Array.from({ length: 11 }, (_, index) => entry(index, { extra: index >= 5 }))]);
assert.equal(normalElevenPlan.items.length, 11);
assert.deepEqual(normalElevenPlan.columns, [1], "paired solo rails share one note column through eight items per side");
assert.ok(Math.min(...normalElevenPlan.items.map(({ width }) => width)) >= 300, "ordinary solo notes retain a broad horizontal copy area");
assert.ok(Math.min(...normalElevenPlan.items.map(({ copy }) => copy.primarySize)) >= 18, "ordinary eleven-item cards use the available area for legible type before shrinking dense selections");
assert.ok(Math.max(...normalElevenPlan.items.map(({ height }) => height)) <= 120, "ordinary note rows use content height instead of stretching through the rail");
assert.ok(normalElevenPlan.items.every(({ copy, copyBounds, x, y }) => (
  copy.paddingX >= 20 && copy.paddingX <= 24
  && copy.paddingY >= 16 && copy.paddingY <= 18
  && copyBounds.x - x === copy.paddingX
  && copyBounds.y - y === copy.paddingY
)), "normal glyph boxes keep the requested breathing room inside their note bounds");
assert.ok(normalElevenPlan.items.every((item) => (
  item.copyBounds.x - item.protectionBounds.x >= 8
  && item.copyBounds.x - item.protectionBounds.x <= 12
  && item.copyBounds.y - item.protectionBounds.y >= 6
  && item.copyBounds.y - item.protectionBounds.y <= 10
)), "the opaque foreground panel has a separate, modest clearance around each glyph box");
for (let gearIndex = 0; gearIndex < 10; gearIndex += 2) {
  const left = normalElevenPlan.items.find((item) => item.gearIndex === gearIndex);
  const right = normalElevenPlan.items.find((item) => item.gearIndex === gearIndex + 1);
  assert.equal(left.y, right.y, `paired solo notes ${gearIndex}/${gearIndex + 1} share their row top`);
  assert.equal(left.height, right.height, `paired solo notes ${gearIndex}/${gearIndex + 1} share their row height`);
  if (gearIndex < 8) {
    const nextLeft = normalElevenPlan.items.find((item) => item.gearIndex === gearIndex + 2);
    const rowGap = nextLeft.y - (left.y + left.height);
    assert.ok(rowGap >= 22 && rowGap <= 28, "ordinary note rows retain a deliberate, consistent gutter");
  }
}
const lastSoloRow = normalElevenPlan.items.reduce((bottom, item) => Math.max(bottom, item.y + item.height), 0);
assert.ok(lastSoloRow < normalElevenPlan.dimensions.layoutHeight - 250, "content-sized rows leave useful whitespace in the information rails");

const variableLengthSoloPlan = characterCountPlan(1, [Array.from({ length: 11 }, (_, index) => entry(index, {
  extra: index >= 5,
  longName: index === 2,
}))]);
const shortPairedRow = variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 0);
const longPairedRow = variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 2);
assert.equal(longPairedRow.y, variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 3).y, "a longer note grows its paired row without changing the other rail's top alignment");
assert.ok(longPairedRow.height > shortPairedRow.height, "longer names grow only the rows that need more copy height");

const hiddenSlotEntries = [entry(0), entry(1, { showOnCard: false, extra: true }), entry(2, { extra: true })];
const hiddenSlotPlan = characterCountPlan(1, [hiddenSlotEntries]);
assert.deepEqual(hiddenSlotPlan.items.map(({ gearIndex }) => gearIndex), [0, 2], "hidden selections preserve their source indices without being rendered");

const fiveCharactersOfGear = Array.from({ length: 5 }, () => Array.from({ length: 37 }, (_, index) => entry(index, { extra: index >= 5, longName: true })));
const lineupPlan = characterCountPlan(5, fiveCharactersOfGear);
assert.equal(lineupPlan.isCustom, true, "dense lineup selections must use adaptive geometry");
assert.equal(lineupPlan.items.length, 185, "all 37 selected entries for all five active characters must remain on the card");
assert.deepEqual(lineupPlan.focusCharacterIndex, null, "dense selections never switch to an implicit focused-person mode");
assert.deepEqual(lineupPlan.omittedCharacterIndices, [], "dense selections never omit another character");
assert.equal(lineupPlan.hasUnplacedVisibleItems, false);
assert.deepEqual(lineupPlan.columns, [4, 4, 4, 4, 4], "the largest supported selections use an adaptive four-column grid per character");
assertNoTileOverlap(lineupPlan.items);
lineupPlan.items.forEach((item) => {
  assertInsideBoard(item, lineupPlan.dimensions, `item ${item.characterIndex}/${item.gearIndex}`);
  assertInsideBoard(item.copyBounds, lineupPlan.dimensions, `copy ${item.characterIndex}/${item.gearIndex}`);
  assertInsideBoard(item.protectionBounds, lineupPlan.dimensions, `protection ${item.characterIndex}/${item.gearIndex}`);
  assert.ok(item.copyBounds.x >= item.protectionBounds.x && item.copyBounds.y >= item.protectionBounds.y, "glyph copy starts inside its opaque protection panel");
  assert.ok(item.copyBounds.x + item.copyBounds.width <= item.protectionBounds.x + item.protectionBounds.width + 0.01, "glyph copy stays inside its protection panel width");
  assert.ok(item.copyBounds.y + item.copyBounds.height <= item.protectionBounds.y + item.protectionBounds.height + 0.01, "glyph copy stays inside its protection panel height");
  assert.ok(item.protectionBounds.width < item.width || item.protectionBounds.height < item.height, "the foreground protection surface leaves a material rim around the glyph panel");
  assert.ok(item.noteRadius > 0 && item.noteRadius <= 10, "each note carries one unitless, size-aware corner radius");
  assert.equal(item.copy.fits, true, `long multilingual copy must fit item ${item.characterIndex}/${item.gearIndex}`);
});
assert.equal(lineupPlan.protectedZones.length, lineupPlan.items.length, "every selected item gets an opaque protected panel bound");
assert.deepEqual(
  lineupPlan.protectedZones[0],
  { characterIndex: 0, gearIndex: 0, ...lineupPlan.items[0].protectionBounds },
  "foreground protection zones mirror each item's protection panel rather than the inner glyph box",
);
assert.ok(lineupPlan.items.every(({ y }) => y >= 150), "lineup information clears the title area");

const extremeNames = Array.from({ length: 5 }, () => Array.from({ length: 37 }, (_, index) => ({
  id: `long-${index}`,
  slot: "accessory",
  slotName: "Accessory",
  extra: index >= 5,
  secondaryName: `${"🎤".repeat(160)}\n${"W".repeat(160)}`,
  names: {
    ko: index % 3 === 0 ? "아".repeat(160) : index % 3 === 1 ? "W".repeat(160) : "🎤".repeat(160),
    en: "W".repeat(160),
  },
})));
CardComposition.clearCopyMetricsCache();
const extremePlan = characterCountPlan(5, extremeNames, {
  composition: { layer: "info-front", protectText: true, infoGap: 64 },
});
const firstCacheStats = CardComposition.copyMetricsCacheStats();
const repeatedExtremePlan = characterCountPlan(5, extremeNames, {
  composition: { layer: "info-front", protectText: true, infoGap: 64 },
});
const repeatedCacheStats = CardComposition.copyMetricsCacheStats();
assert.equal(extremePlan.items.length, 185, "extreme official names cannot reduce the selected-entry count");
assert.equal(repeatedExtremePlan.items.length, 185);
assert.equal(extremePlan.items.filter(({ copy }) => !copy.fits).length, 0, "160-grapheme primary and two secondary locale lines fit at the auto-shrunk size");
assert.ok(Math.min(...extremePlan.items.map(({ copy }) => copy.primarySize)) <= 1.1, "extreme text can shrink below one layout pixel when required");
assertNoTileOverlap(extremePlan.items);
assert.equal(repeatedCacheStats.misses, firstCacheStats.misses, "repeated renders reuse fitted copy metrics for unchanged names and tile sizes");
assert.ok(repeatedCacheStats.hits > firstCacheStats.hits, "copy metric cache hits increase on repeat planning");
assert.ok(repeatedCacheStats.size <= 1024, "copy metric cache stays bounded");

const twoPersonPlan = characterCountPlan(2, Array.from({ length: 2 }, () => Array.from({ length: 37 }, (_, index) => entry(index, { extra: index >= 5, longName: true }))));
assert.equal(twoPersonPlan.items.length, 74, "both two-person rails keep every selected core and accessory item");
assert.deepEqual(twoPersonPlan.columns, [4, 4]);
assertNoTileOverlap(twoPersonPlan.items);

const cutoutCharacters = [{ cutout: true }];
const gapLayout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: cutoutCharacters });
const closePlan = CardLayout.planComposition({
  characterCount: 1,
  singleRatio: "portrait",
  characters: cutoutCharacters,
  layout: gapLayout,
  gearByCharacter: [coreFive],
  composition: { layer: "person-front", protectText: true, infoGap: 0 },
});
const occupiedPlan = CardLayout.planComposition({
  characterCount: 1,
  singleRatio: "portrait",
  characters: cutoutCharacters,
  layout: gapLayout,
  gearByCharacter: [coreFive],
  occupancyByCharacter: [{ width: 1, height: 1, alpha: new Uint8Array([255]) }],
  composition: { layer: "person-front", protectText: true, infoGap: 0 },
});
assert.deepEqual(
  occupiedPlan.items.map(({ gearIndex, x, y, column, row }) => ({ gearIndex, x, y, column, row })),
  closePlan.items.map(({ gearIndex, x, y, column, row }) => ({ gearIndex, x, y, column, row })),
  "occupancy scores cannot reorder the stable left-to-right item reading order",
);
const spacedPlan = CardLayout.planComposition({
  characterCount: 1,
  singleRatio: "portrait",
  characters: cutoutCharacters,
  layout: gapLayout,
  gearByCharacter: [coreFive],
  composition: { layer: "person-front", protectText: true, infoGap: 24 },
});
assert.equal(closePlan.effectiveLayer, "person-front");
assert.ok(spacedPlan.items[0].x + spacedPlan.items[0].width < closePlan.items[0].x + closePlan.items[0].width, "infoGap moves the note's inner edge outward instead of changing image zoom");
assert.ok(spacedPlan.infoGap <= 64);

const opaqueFallback = CardLayout.planComposition({
  characterCount: 1,
  singleRatio: "portrait",
  characters: [{ cutout: false }],
  layout: CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: [{ cutout: false }] }),
  gearByCharacter: [coreFive],
  composition: { layer: "person-front", protectText: true, infoGap: 0 },
});
assert.equal(opaqueFallback.requestedLayer, "person-front");
assert.equal(opaqueFallback.effectiveLayer, "info-front", "person-front falls back for any opaque image");
assert.equal(opaqueFallback.isCustom, false, "the fallback preserves exact legacy core-five geometry");

const localizedItems = [
  { slot: "head", names: { ko: "한국어 이름", en: "English Name", ja: "日本語名" } },
];
const localizedKo = characterCountPlan(1, [localizedItems], {
  composition: { layer: "info-front", protectText: false, infoGap: 0 },
});
const localizedEn = characterCountPlan(1, [localizedItems], {
  language: "en",
  composition: { layer: "info-front", protectText: false, infoGap: 0 },
});
assert.equal(localizedKo.items[0].secondaryName, "English Name", "Korean copy keeps the quiet English reference");
assert.equal(localizedEn.items[0].secondaryName, "", "English mode never duplicates the selected language");

console.log("PASS: CardComposition keeps all selected items, legacy defaults, copy protection, spacing, and cutout layer fallback.");
