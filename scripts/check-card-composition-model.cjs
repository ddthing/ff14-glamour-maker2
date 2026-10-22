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
assert.deepEqual(normalElevenPlan.columns, [1], "solo rails remain full-width through eight items per side before splitting into columns");
assert.ok(Math.min(...normalElevenPlan.items.map(({ width }) => width)) >= 300, "a normal eleven-item solo card keeps broad, balanced note rails");
assert.ok(Math.min(...normalElevenPlan.items.map(({ copy }) => copy.primarySize)) >= 18, "ordinary eleven-item cards use the available area for legible type before shrinking dense selections");

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
  assert.ok(item.copyBounds.x >= item.x && item.copyBounds.y >= item.y, "protected copy starts inside its note");
  assert.ok(item.copyBounds.x + item.copyBounds.width <= item.x + item.width + 0.01, "protected copy stays inside its note width");
  assert.ok(item.copyBounds.y + item.copyBounds.height <= item.y + item.height + 0.01, "protected copy stays inside its note height");
  assert.equal(item.copy.fits, true, `long multilingual copy must fit item ${item.characterIndex}/${item.gearIndex}`);
});
assert.equal(lineupPlan.protectedZones.length, lineupPlan.items.length, "every selected item gets an opaque protected copy bound");
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
const spacedPlan = CardLayout.planComposition({
  characterCount: 1,
  singleRatio: "portrait",
  characters: cutoutCharacters,
  layout: gapLayout,
  gearByCharacter: [coreFive],
  composition: { layer: "person-front", protectText: true, infoGap: 24 },
});
assert.equal(closePlan.effectiveLayer, "person-front");
assert.ok(spacedPlan.items[0].width < closePlan.items[0].width, "infoGap moves the note's inner edge outward instead of changing image zoom");
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
