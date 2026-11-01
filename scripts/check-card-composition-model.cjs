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

function occupancyBox({ left = 0.25, top = 0.08, right = 0.75, bottom = 0.98 } = {}) {
  const width = CardComposition.maskWidth;
  const height = CardComposition.maskHeight;
  const alpha = new Uint8Array(width * height);
  const firstX = Math.max(0, Math.floor(left * width));
  const lastX = Math.min(width, Math.ceil(right * width));
  const firstY = Math.max(0, Math.floor(top * height));
  const lastY = Math.min(height, Math.ceil(bottom * height));
  for (let y = firstY; y < lastY; y += 1) {
    for (let x = firstX; x < lastX; x += 1) alpha[y * width + x] = 255;
  }
  return { width, height, alpha };
}

function imageRectsFor(layout, {
  naturalWidth = 1200,
  naturalHeight = 1600,
  imageFit = "contain",
  zoom = 100,
  panX = 0,
  panY = 0,
  focalPoint = null,
} = {}) {
  return layout.frames.map((frame) => CardLayout.imageRectFor({
    frame,
    naturalWidth,
    naturalHeight,
    imageFit,
    zoom,
    panX,
    panY,
    focalPoint,
    cutout: true,
  }));
}

function assertNoRectOverlap(first, second, message) {
  const overlaps = first.x < second.x + second.width - 0.01
    && first.x + first.width > second.x + 0.01
    && first.y < second.y + second.height - 0.01
    && first.y + first.height > second.y + 0.01;
  assert.equal(overlaps, false, message);
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
assert.ok(Math.min(...normalElevenPlan.items.map(({ width }) => width)) >= 260, "ordinary solo rails retain a broad horizontal copy area");
assert.ok(Math.min(...normalElevenPlan.items.map(({ copy }) => copy.primarySize)) >= 18, "ordinary eleven-item cards use the available area for legible type before shrinking dense selections");
assert.ok(Math.max(...normalElevenPlan.items.map(({ height }) => height)) <= 120, "ordinary note rows use content height instead of stretching through the rail");
assert.ok(normalElevenPlan.items.every(({ copy, copyBounds, x, y }) => (
  copy.paddingX >= 20 && copy.paddingX <= 24
  && copy.paddingY >= 16 && copy.paddingY <= 18
  && copyBounds.x - x === copy.paddingX
  && copyBounds.y - y === copy.paddingY
)), "normal glyph boxes keep the requested breathing room inside their note bounds");
assert.ok(normalElevenPlan.items.every((item) => (
  item.copyBounds.x - item.protectionBounds.x >= 12
  && item.copyBounds.x + item.copyBounds.width + 12 <= item.protectionBounds.x + item.protectionBounds.width + 0.01
  && item.copyBounds.y - item.protectionBounds.y >= 12
  && item.copyBounds.y + item.copyBounds.height + 12 <= item.protectionBounds.y + item.protectionBounds.height + 0.01
)), "the foreground protection area keeps at least 12 logical pixels around glyph copy");
assert.deepEqual(
  normalElevenPlan.items.filter(({ extra }) => !extra).map(({ gearIndex }) => gearIndex),
  [0, 1, 2, 3, 4],
  "a small mixed selection puts all core pieces on the first rail",
);
assert.deepEqual(
  normalElevenPlan.items.filter(({ extra }) => extra).map(({ gearIndex }) => gearIndex),
  [5, 6, 7, 8, 9, 10],
  "a small mixed selection puts all accessories on the second rail",
);
const coreRail = normalElevenPlan.rails.find(({ railSide }) => railSide === "left");
const extraRail = normalElevenPlan.rails.find(({ railSide }) => railSide === "right");
assert.ok(coreRail && extraRail, "small mixed solo selections expose two stable outer rails");
assert.ok(normalElevenPlan.items.filter(({ railSide }) => railSide === "left").every(({ x }) => x === coreRail.x), "core labels share a straight left edge");
assert.ok(normalElevenPlan.items.filter(({ railSide }) => railSide === "right").every(({ x }) => x === extraRail.x), "extra labels share a straight left edge");
for (let index = 0; index < 5; index += 1) {
  const core = normalElevenPlan.items.find(({ gearIndex }) => gearIndex === index);
  const extra = normalElevenPlan.items.find(({ gearIndex }) => gearIndex === index + 5);
  assert.equal(core.y, extra.y, `paired semantic rail row ${index} shares its top`);
  assert.equal(core.height, extra.height, `paired semantic rail row ${index} shares its height`);
}
for (let index = 0; index < 4; index += 1) {
  const current = normalElevenPlan.items.find(({ gearIndex }) => gearIndex === index);
  const next = normalElevenPlan.items.find(({ gearIndex }) => gearIndex === index + 1);
  assert.equal(next.y - (current.y + current.height), 24, "ordinary solo rows keep the fixed notes gutter");
}
const lastSoloRow = normalElevenPlan.items.reduce((bottom, item) => Math.max(bottom, item.y + item.height), 0);
assert.ok(lastSoloRow < normalElevenPlan.dimensions.layoutHeight - 250, "content-sized rows leave useful whitespace in the information rails");

const variableLengthSoloPlan = characterCountPlan(1, [Array.from({ length: 11 }, (_, index) => entry(index, {
  extra: index >= 5,
  longName: index === 2,
}))]);
const shortPairedRow = variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 0);
const longPairedRow = variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 2);
const longExtraRow = variableLengthSoloPlan.items.find(({ gearIndex }) => gearIndex === 7);
assert.equal(longPairedRow.y, longExtraRow.y, "the same semantic row stays aligned across both fixed rails");
assert.equal(longPairedRow.height, longExtraRow.height, "paired rows share the taller copy height");
assert.ok(longPairedRow.height > shortPairedRow.height, "longer names grow only the rows that need more copy height");

const hiddenSlotEntries = [entry(0), entry(1, { showOnCard: false, extra: true }), entry(2, { extra: true })];
const hiddenSlotPlan = characterCountPlan(1, [hiddenSlotEntries]);
assert.deepEqual(hiddenSlotPlan.items.map(({ gearIndex }) => gearIndex), [0, 2], "hidden selections preserve their source indices without being rendered");

const protectedPortraitCharacters = [{ cutout: true }];
const protectedPortraitLayout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: protectedPortraitCharacters });
const protectedPortraitRect = imageRectsFor(protectedPortraitLayout)[0];
const compactPortraitMask = occupancyBox({ left: 0.31, top: 0.08, right: 0.70, bottom: 0.98 });
const protectedPortraitPlan = characterCountPlan(1, [coreFive], {
  characters: protectedPortraitCharacters,
  layout: protectedPortraitLayout,
  imageRects: [protectedPortraitRect],
  occupancyByCharacter: [compactPortraitMask],
});
assert.equal(protectedPortraitPlan.isCustom, true, "exact protected cutout geometry routes core-five through typography rails");
assert.equal(protectedPortraitPlan.items.length, 5, "the protected core-five rail retains every source item");
assert.deepEqual(protectedPortraitPlan.imageRects[0], protectedPortraitRect, "a centered normal portrait silhouette stays at its current size");
assert.deepEqual(protectedPortraitPlan.rails.map(({ x, width, railSide }) => [x, width, railSide]), [
  [54, 280, "left"],
  [746, 280, "right"],
], "portrait typography rails use stable outer-edge geometry");
assert.equal(protectedPortraitPlan.railClearance, 24, "portrait silhouette corridor reserves the base 24px gutter");
assert.ok(protectedPortraitPlan.items.every(({ copyOcclusionScore, protectionOcclusionScore }) => copyOcclusionScore === 0 && protectionOcclusionScore === 0), "protected portrait labels and their halo remain clear of the alpha silhouette");
protectedPortraitPlan.items.forEach((item) => assertNoRectOverlap(item.protectionBounds, protectedPortraitPlan.subjectBoundsByCharacter[0], "portrait protection halo must not touch silhouette alpha"));

const zoomedPortraitLayout = protectedPortraitLayout;
const zoomedPortraitRect = CardLayout.imageRectFor({
  frame: zoomedPortraitLayout.frames[0],
  naturalWidth: 1200,
  naturalHeight: 1800,
  imageFit: "cover",
  zoom: 145,
  panX: 180,
  panY: -110,
  focalPoint: { x: 0.58, y: 0.42 },
  cutout: true,
});
const widePortraitPlan = characterCountPlan(1, [Array.from({ length: 11 }, (_, index) => entry(index, { extra: index >= 5 }))], {
  characters: protectedPortraitCharacters,
  layout: zoomedPortraitLayout,
  imageRects: [zoomedPortraitRect],
  occupancyByCharacter: [occupancyBox({ left: 0.05, top: 0.04, right: 0.95, bottom: 0.98 })],
  composition: { layer: "info-front", protectText: true, infoGap: 64 },
});
const wideSubject = widePortraitPlan.subjectBoundsByCharacter[0];
const wideCorridorLeft = widePortraitPlan.rails[0].x + widePortraitPlan.rails[0].width + widePortraitPlan.railClearance;
const wideCorridorRight = widePortraitPlan.rails[1].x - widePortraitPlan.railClearance;
assert.ok(widePortraitPlan.imageRects[0].width < zoomedPortraitRect.width, "a wide zoomed silhouette is uniformly fitted when it cannot clear the text rails");
assert.ok(wideSubject.x >= wideCorridorLeft - 0.01 && wideSubject.x + wideSubject.width <= wideCorridorRight + 0.01, "wide cover/zoom/pan alpha fits inside the stable center corridor");
assert.equal(widePortraitPlan.railClearance, 88, "maximum info gap adds to the base silhouette clearance");
assert.ok(widePortraitPlan.items.every(({ copyOcclusionScore, protectionOcclusionScore }) => copyOcclusionScore === 0 && protectionOcclusionScore === 0), "fitted wide silhouettes clear every protected copy area");
widePortraitPlan.items.forEach((item) => assertNoRectOverlap(item.protectionBounds, wideSubject, "wide silhouette must clear every expanded copy region"));

const originalPhotoCharacters = [{ cutout: false }];
const originalPhotoLayout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: originalPhotoCharacters });
const originalPhotoRect = CardLayout.imageRectFor({
  frame: originalPhotoLayout.frames[0],
  naturalWidth: 500,
  naturalHeight: 1600,
  imageFit: "contain",
  panX: -120,
  cutout: false,
});
const originalPhotoPlan = characterCountPlan(1, [coreFive], {
  characters: originalPhotoCharacters,
  layout: originalPhotoLayout,
  imageRects: [originalPhotoRect],
});
assert.equal(originalPhotoPlan.isCustom, true, "a real source image routes core-five through typography-only planning");
assert.equal(originalPhotoPlan.items.length, 5);
assert.deepEqual(originalPhotoPlan.imageRects[0], originalPhotoRect, "original photos keep their exact fit and placement");
assert.equal(originalPhotoPlan.subjectEvidenceByCharacter[0], true, "a source image rect is known occupied geometry when alpha is unavailable");
assert.ok(originalPhotoPlan.items.some(({ copyOcclusionScore }) => copyOcclusionScore === 1), "only copy overlapping the original image rect asks for a protective halo");
assert.ok(originalPhotoPlan.items.some(({ copyOcclusionScore }) => copyOcclusionScore === 0), "copy outside the visible original image rect does not request a halo");

const mixedCastCharacters = [{ cutout: true }, { cutout: false }, { cutout: false }];
const mixedCastLayout = CardLayout.layoutFor({ characterCount: 3, characters: mixedCastCharacters });
const mixedCastPlan = characterCountPlan(3, Array.from({ length: 3 }, () => [entry(0)]), {
  characters: mixedCastCharacters,
  layout: mixedCastLayout,
  imageRects: [
    { x: 200, y: 80, width: 600, height: 600 },
    { x: 400, y: 550, width: 400, height: 100 },
    { x: 800, y: 550, width: 400, height: 100 },
  ],
  occupancyByCharacter: [occupancyBox({ left: 0, top: 0, right: 1, bottom: 1 }), null, null],
  multiInfoEnabled: true,
});
const neighborRailItem = mixedCastPlan.items.find(({ characterIndex }) => characterIndex === 1);
assert.ok(!(
  neighborRailItem.copyBounds.x < mixedCastPlan.subjectBoundsByCharacter[1].x + mixedCastPlan.subjectBoundsByCharacter[1].width
  && neighborRailItem.copyBounds.x + neighborRailItem.copyBounds.width > mixedCastPlan.subjectBoundsByCharacter[1].x
  && neighborRailItem.copyBounds.y < mixedCastPlan.subjectBoundsByCharacter[1].y + mixedCastPlan.subjectBoundsByCharacter[1].height
  && neighborRailItem.copyBounds.y + neighborRailItem.copyBounds.height > mixedCastPlan.subjectBoundsByCharacter[1].y
), "the neighboring original image does not overlap its own rail copy");
assert.equal(neighborRailItem.copyOcclusionScore, 1, "a neighboring cutout overflow still requests a copy halo");
assert.deepEqual(neighborRailItem.copyOverlapCharacterIndices, [0], "cross-character copy evidence identifies the overflow source");
assert.equal(neighborRailItem.protectionOcclusionScore, 1, "the expanded protection area is checked against neighboring subjects");
assert.ok(neighborRailItem.protectionOverlapCharacterIndices.includes(0));
assert.equal(neighborRailItem.surfaceOcclusionScore, 1, "the full note surface is checked against neighboring subjects");
assert.ok(neighborRailItem.surfaceOverlapCharacterIndices.includes(0));

const noInfoLineupCharacters = Array.from({ length: 5 }, () => ({ cutout: true }));
const noInfoLineupLayout = CardLayout.layoutFor({ characterCount: 5, characters: noInfoLineupCharacters });
const noInfoLineupRects = imageRectsFor(noInfoLineupLayout);
const noInfoLineupPlan = characterCountPlan(5, Array.from({ length: 5 }, () => []), {
  characters: noInfoLineupCharacters,
  layout: noInfoLineupLayout,
  imageRects: noInfoLineupRects,
  multiInfoEnabled: false,
});
assert.deepEqual(noInfoLineupPlan.imageRects, noInfoLineupRects, "disabled information does not resize or move the lineup images");
assert.deepEqual(noInfoLineupPlan.rails, [], "disabled information does not reserve empty footer rails");
const hiddenLineupPlan = characterCountPlan(5, Array.from({ length: 5 }, () => [entry(0, { showOnCard: false })]), {
  characters: noInfoLineupCharacters,
  layout: noInfoLineupLayout,
  imageRects: noInfoLineupRects,
  occupancyByCharacter: Array.from({ length: 5 }, () => compactPortraitMask),
  multiInfoEnabled: true,
});
assert.deepEqual(hiddenLineupPlan.imageRects, noInfoLineupRects, "all-hidden lineup entries do not resize images");
assert.deepEqual(hiddenLineupPlan.rails, [], "all-hidden lineup entries do not reserve empty footer rails");
const disabledLineupPlan = characterCountPlan(5, Array.from({ length: 5 }, () => [entry(0)]), {
  characters: noInfoLineupCharacters,
  layout: noInfoLineupLayout,
  imageRects: noInfoLineupRects,
  occupancyByCharacter: Array.from({ length: 5 }, () => compactPortraitMask),
  multiInfoEnabled: false,
});
assert.deepEqual(disabledLineupPlan.imageRects, noInfoLineupRects, "turning lineup information off leaves the image placement untouched");
assert.deepEqual(disabledLineupPlan.rails, [], "turning lineup information off leaves no footer rails");
const hiddenPortraitPlan = characterCountPlan(1, [[entry(0, { showOnCard: false })]], {
  characters: protectedPortraitCharacters,
  layout: protectedPortraitLayout,
  imageRects: [protectedPortraitRect],
  occupancyByCharacter: [compactPortraitMask],
});
assert.deepEqual(hiddenPortraitPlan.imageRects[0], protectedPortraitRect, "all-hidden gear does not resize a cutout");
assert.deepEqual(hiddenPortraitPlan.rails, [], "all-hidden gear does not reserve empty rails");

const lineupFiveItemGear = Array.from({ length: 5 }, (_, characterIndex) => (
  characterIndex === 0 ? Array.from({ length: 5 }, (_, index) => entry(index)) : []
));
const lineupFiveItemPlan = characterCountPlan(5, lineupFiveItemGear, {
  characters: noInfoLineupCharacters,
  layout: noInfoLineupLayout,
  imageRects: imageRectsFor(noInfoLineupLayout, { naturalWidth: 240, naturalHeight: 519 }),
  occupancyByCharacter: Array.from({ length: 5 }, () => occupancyBox()),
  multiInfoEnabled: true,
});
assert.equal(lineupFiveItemPlan.rails[0].height, 180, "five selected items use the medium-height footnote area");
assert.ok(lineupFiveItemPlan.imageRects[0].height > noInfoLineupLayout.frames[0].height - 180 - 24 - 142, "a medium footnote area preserves more image height than a dense footer");

const lineupOneItemGear = Array.from({ length: 5 }, (_, characterIndex) => (
  characterIndex === 0 ? [entry(0)] : []
));
const lineupOneItemSourceRects = imageRectsFor(noInfoLineupLayout, { naturalWidth: 240, naturalHeight: 519 });
const lineupOneItemPlan = characterCountPlan(5, lineupOneItemGear, {
  characters: noInfoLineupCharacters,
  layout: noInfoLineupLayout,
  imageRects: lineupOneItemSourceRects,
  occupancyByCharacter: Array.from({ length: 5 }, () => occupancyBox()),
  multiInfoEnabled: true,
});
assert.equal(lineupOneItemPlan.rails[0].height, 80, "a single selected item uses a compact footnote area");
assert.equal(lineupOneItemPlan.imageRects[0].height, 411, "a compact footnote area preserves an image lane 411px tall");
assert.ok(lineupOneItemPlan.imageRects[0].height > lineupFiveItemPlan.imageRects[0].height, "fewer selected items preserve a taller lineup image");

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
  assert.ok(item.copyBounds.x - item.protectionBounds.x >= 12, "the protection halo keeps its left copy margin");
  assert.ok(item.copyBounds.y - item.protectionBounds.y >= 12, "the protection halo keeps its top copy margin");
  assert.ok(item.protectionBounds.x + item.protectionBounds.width - item.copyBounds.x - item.copyBounds.width >= 12, "the protection halo keeps its right copy margin");
  assert.ok(item.protectionBounds.y + item.protectionBounds.height - item.copyBounds.y - item.copyBounds.height >= 12, "the protection halo keeps its bottom copy margin");
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

const protectedLineupCharacters = Array.from({ length: 5 }, () => ({ cutout: true }));
const protectedLineupLayout = CardLayout.layoutFor({ characterCount: 5, characters: protectedLineupCharacters });
const protectedLineupSourceRects = imageRectsFor(protectedLineupLayout, { naturalWidth: 240, naturalHeight: 519 });
const protectedLineupPlan = characterCountPlan(5, fiveCharactersOfGear, {
  characters: protectedLineupCharacters,
  layout: protectedLineupLayout,
  imageRects: protectedLineupSourceRects,
  occupancyByCharacter: Array.from({ length: 5 }, () => occupancyBox({ left: 0.18, top: 0.05, right: 0.82, bottom: 0.98 })),
});
assert.equal(protectedLineupPlan.items.length, 185, "dedicated footnote placement keeps all 185 selected items");
assert.equal(protectedLineupPlan.rails.length, 5, "each lineup character receives one fixed footnote rail");
assert.ok(protectedLineupPlan.rails.every(({ y, height }) => y === 420 && height === 237), "dense selections use the full-height compact footer");
assert.ok(protectedLineupPlan.items.every(({ y, copyOcclusionScore, protectionOcclusionScore }) => y >= 420 && copyOcclusionScore === 0 && protectionOcclusionScore === 0), "dense footnote copy stays below every fitted silhouette");
protectedLineupPlan.subjectBoundsByCharacter.forEach((subject) => {
  assert.ok(subject.y + subject.height <= 396.01, "fitted lineup silhouettes stay above the footer clearance lane");
});
assert.equal(new Set(protectedLineupPlan.items.map(({ copy }) => copy.primarySize)).size, 1, "all dense footnote labels share one predictable type size");

const lineupElevenGear = Array.from({ length: 3 }, () => Array.from({ length: 11 }, (_, index) => entry(index, { extra: index >= 5 })));
const lineupThreeCharacters = Array.from({ length: 3 }, () => ({ cutout: true }));
const lineupThreeLayout = CardLayout.layoutFor({ characterCount: 3, characters: lineupThreeCharacters });
const lineupElevenPlan = characterCountPlan(3, lineupElevenGear, {
  characters: lineupThreeCharacters,
  layout: lineupThreeLayout,
  imageRects: imageRectsFor(lineupThreeLayout, { naturalWidth: 240, naturalHeight: 519 }),
  occupancyByCharacter: Array.from({ length: 3 }, () => occupancyBox()),
});
assert.equal(lineupElevenPlan.items.length, 33, "three-person footnotes retain all eleven entries per character");
assert.ok(lineupElevenPlan.rails.every(({ height }) => height === 237), "eleven or more entries use the dense footer height");
const sameLineupColumn = lineupElevenPlan.items.filter(({ characterIndex, column }) => characterIndex === 0 && column === 0).sort((left, right) => left.row - right.row);
assert.equal(sameLineupColumn[1].y - (sameLineupColumn[0].y + sameLineupColumn[0].height), 8, "multi-column lineup rows use a compact eight-pixel gutter");
assert.equal(new Set(lineupElevenPlan.items.map(({ copy }) => copy.primarySize)).size, 1, "eleven-item lineup labels share one font size");

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
