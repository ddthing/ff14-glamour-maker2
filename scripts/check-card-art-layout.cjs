const assert = require("node:assert/strict");
const CardArt = require("../models/card-art.js");
const CardLayout = require("../models/card-layout.js");

const expectedDimensions = {
  square: { layoutWidth: 1080, layoutHeight: 1080, exportWidth: 2160, exportHeight: 2160 },
  lookbook: { layoutWidth: 1200, layoutHeight: 1000, exportWidth: 2400, exportHeight: 2000 },
  portrait: { layoutWidth: 1080, layoutHeight: 1350, exportWidth: 2160, exportHeight: 2700 },
  landscape: { layoutWidth: 1200, layoutHeight: 675, exportWidth: 2400, exportHeight: 1350 },
};

function artLayout(characterCount, overrides = {}) {
  const characters = Array.from({ length: characterCount }, () => ({ cutout: true }));
  const singleRatio = characterCount === 1 ? "portrait" : "landscape";
  const art = CardArt.normalize({ enabled: true, ...overrides });
  const layout = CardLayout.layoutFor({ characterCount, singleRatio, characters, art });
  return { art, characters, singleRatio, layout };
}

function inside(rect, dimensions, label) {
  assert.ok(rect.x >= -0.01 && rect.y >= -0.01, `${label} starts inside the board`);
  assert.ok(rect.x + rect.width <= dimensions.layoutWidth + 0.01, `${label} right edge stays inside the board`);
  assert.ok(rect.y + rect.height <= dimensions.layoutHeight + 0.01, `${label} bottom edge stays inside the board`);
}

function overlap(first, second) {
  return first.x < second.x + second.width - 0.01
    && first.x + first.width > second.x + 0.01
    && first.y < second.y + second.height - 0.01
    && first.y + first.height > second.y + 0.01;
}

function alphaMask() {
  const width = 64;
  const height = 96;
  const alpha = new Uint8Array(width * height);
  // A narrow, full-height character with substantial transparent source padding.
  for (let y = 8; y < 90; y += 1) {
    for (let x = 22; x < 43; x += 1) alpha[y * width + x] = 255;
  }
  return { width, height, alpha };
}

function gearEntry(index, { name = `장비 이름 ${index + 1}`, secondaryName = `Gear Name ${index + 1}`, showOnCard = true } = {}) {
  return {
    id: `gear-${index}`,
    itemId: 50_000 + index,
    slot: index < 5 ? ["head", "body", "hands", "legs", "feet"][index] : "accessory",
    slotName: index < 5 ? `Slot ${index + 1}` : "Accessory",
    extra: index >= 5,
    showOnCard,
    names: { ko: name, en: secondaryName },
  };
}

function artPlan(characterCount, artOverrides, gearByCharacter, { naturalWidth = 900, naturalHeight = 1800 } = {}) {
  const { art, characters, singleRatio, layout } = artLayout(characterCount, artOverrides);
  const masks = Array.from({ length: characterCount }, () => alphaMask());
  const imageRects = layout.frames.map((frame) => CardLayout.imageRectFor({
    frame,
    naturalWidth,
    naturalHeight,
    imageFit: "contain",
    cutout: true,
  }));
  const plan = CardLayout.planComposition({
    characterCount,
    singleRatio,
    characters,
    layout,
    art,
    composition: { layer: "info-front", protectText: true, infoGap: 0 },
    gearByCharacter,
    occupancyByCharacter: masks,
    imageRects,
  });
  return { art, characters, layout, masks, imageRects, plan };
}

function artPlanForCharacter(character, artOverrides = {}, { naturalWidth = 900, naturalHeight = 1800 } = {}) {
  const art = CardArt.normalize({ enabled: true, layout: "center", ratio: "square", ...artOverrides });
  const layout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: [character], art });
  const imageRect = CardLayout.imageRectFor({
    frame: layout.frames[0],
    naturalWidth,
    naturalHeight,
    imageFit: character.imageFit || "contain",
    zoom: character.zoom,
    panX: character.panX,
    panY: character.panY,
    focalPoint: character.focalPoint,
    cutout: character.cutout === true,
  });
  const plan = CardLayout.planComposition({
    characterCount: 1,
    singleRatio: "portrait",
    characters: [character],
    layout,
    art,
    gearByCharacter: [[gearEntry(0)]],
    occupancyByCharacter: [character.cutout === true ? alphaMask() : null],
    imageRects: [imageRect],
  });
  return { layout, imageRect, plan };
}

const legacyLayout = CardLayout.layoutFor({ characterCount: 1, singleRatio: "portrait", characters: [{ cutout: true }] });
const explicitlyDisabledArt = CardLayout.layoutFor({
  characterCount: 1,
  singleRatio: "portrait",
  characters: [{ cutout: true }],
  art: { enabled: false, layout: "cover", ratio: "square", textAlign: "center" },
});
assert.deepEqual(explicitlyDisabledArt, legacyLayout, "disabled art returns the exact legacy geometry contract");

for (const [ratio, dimensions] of Object.entries(expectedDimensions)) {
  const { layout } = artLayout(1, { layout: "center", ratio });
  assert.equal(layout.ratio, ratio);
  assert.deepEqual(layout.dimensions, dimensions, `${ratio} exports use the established 2x size`);
}
assert.equal(artLayout(1, { layout: "auto", ratio: "auto" }).layout.ratio, "portrait", "automatic solo art keeps the portrait canvas");
assert.equal(artLayout(2, { layout: "auto", ratio: "auto" }).layout.ratio, "landscape", "automatic group art keeps the landscape canvas");
assert.equal(artLayout(1, { layout: "footer", ratio: "auto" }).layout.ratio, "lookbook", "automatic footer art selects the lookbook canvas");

for (let count = 1; count <= 5; count += 1) {
  for (const mode of ["auto", "center", "footer", "cover"]) {
    const { layout } = artLayout(count, { layout: mode, ratio: "lookbook" });
    assert.equal(layout.frames.length, count, `${mode} reserves one image frame per person`);
    assert.deepEqual(layout.artFrames, layout.frames, `${mode} exposes DOM and PNG frames from one geometry`);
    layout.frames.forEach((frame, index) => inside(frame, layout.dimensions, `${count} person ${mode} frame ${index}`));
    if (layout.effectiveLayout === "footer") {
      layout.frames.forEach((frame) => {
        const imageEnd = (frame.y + frame.height) / layout.dimensions.layoutHeight;
        assert.ok(imageEnd >= 0.73 && imageEnd <= 0.75, "footer subjects end near the reference 73–75% card height");
      });
    }
    layout.groupPanels.forEach((panel, index) => {
      inside(panel, layout.dimensions, `${mode} group panel ${index}`);
      inside(panel.contentRect, layout.dimensions, `${mode} panel copy area ${index}`);
      assert.ok(panel.contentRect.x >= panel.x && panel.contentRect.y >= panel.y, "copy inset starts inside the panel outer bounds");
      assert.ok(panel.contentRect.x + panel.contentRect.width <= panel.x + panel.width + 0.01, "copy inset stays inside the panel right edge");
      assert.ok(panel.contentRect.y + panel.contentRect.height <= panel.y + panel.height + 0.01, "copy inset stays inside the panel bottom edge");
    });
    if (mode === "center" && count > 2) assert.equal(layout.effectiveLayout, "footer", "central layouts with more than two people resolve to a grouped footer");
    if (mode === "cover") assert.deepEqual(layout.groupPanels, [], "cover reserves no gear copy areas");
  }
}

const centerOne = artLayout(1, { layout: "center", ratio: "square", titlePlacement: "top-left" }).layout;
assert.deepEqual(centerOne.header.align, "left");
assert.equal(artLayout(1, { layout: "center", badge: "heart" }).layout.groupPanels[0].shape, "none", "badge selection applies only to footer copy panels");
assert.equal(artLayout(1, { layout: "center", titlePlacement: "hidden" }).layout.header.hidden, true);
assert.equal(artLayout(2, { layout: "center", sharedOutfit: true }).layout.frames[1].view, "back");

for (const [badge, inset] of [
  ["heart", { left: 0.2, right: 0.2, top: 0.2, bottom: 0.35 }],
  ["flower", { left: 0.15, right: 0.15, top: 0.15, bottom: 0.15 }],
  ["scallop", { left: 0.1, right: 0.1, top: 0.1, bottom: 0.1 }],
  ["none", { left: 0, right: 0, top: 0, bottom: 0 }],
]) {
  const panel = artLayout(1, { layout: "footer", ratio: "lookbook", badge }).layout.groupPanels[0];
  assert.ok(Math.abs(panel.contentRect.x - (panel.x + panel.width * inset.left)) < 0.01, `${badge} horizontal copy inset matches the renderer path`);
  assert.ok(Math.abs(panel.contentRect.y - (panel.y + panel.height * inset.top)) < 0.01, `${badge} vertical copy inset matches the renderer path`);
  assert.ok(Math.abs(panel.contentRect.height - panel.height * (1 - inset.top - inset.bottom)) < 0.01, `${badge} copy area avoids the badge point/edge`);
}

const fiveItems = [Array.from({ length: 5 }, (_, index) => gearEntry(index))];
const roomy = artPlan(1, { layout: "center", ratio: "square", density: 0, textScale: 100 }, fiveItems);
const dense = artPlan(1, { layout: "center", ratio: "square", density: 100, textScale: 100 }, fiveItems);
const roomyGap = roomy.plan.items[2].y - (roomy.plan.items[0].y + roomy.plan.items[0].height);
const denseGap = dense.plan.items[2].y - (dense.plan.items[0].y + dense.plan.items[0].height);
assert.ok(roomyGap > denseGap, "density changes item spacing in the reserved copy area");
assert.ok(roomy.plan.items.every((item) => item.column === 0), "center mode keeps five ordinary gear names in one vertical reading order");
const centerPanel = roomy.plan.groupPanels[0].contentRect;
const centerItemStarts = roomy.plan.items.map((item) => item.y);
const centerTrackGaps = centerItemStarts.slice(1).map((top, index) => top - centerItemStarts[index]);
assert.ok(centerTrackGaps.every((gap) => Math.abs(gap - centerTrackGaps[0]) < 0.01), "center mode distributes rows on a consistent vertical rhythm");
assert.ok(roomy.plan.items[0].y >= centerPanel.y + centerPanel.height * 0.05 - 0.01, "loose center copy keeps a five-percent top inset");
assert.ok(roomy.plan.items.at(-1).y + roomy.plan.items.at(-1).height <= centerPanel.y + centerPanel.height * 0.95 + 0.01, "loose center copy keeps a five-percent bottom inset");
const compactCenterSpan = dense.plan.items.at(-1).y + dense.plan.items.at(-1).height - dense.plan.items[0].y;
const looseCenterSpan = roomy.plan.items.at(-1).y + roomy.plan.items.at(-1).height - roomy.plan.items[0].y;
  assert.ok(compactCenterSpan < looseCenterSpan, "maximum density compacts center rows to about three quarters of the available track");
assert.ok(Math.abs(compactCenterSpan / centerPanel.height - 0.675) < 0.01, "maximum center density uses 75% of the safe 90% vertical track");
assert.ok(Math.abs(looseCenterSpan / centerPanel.height - 0.9) < 0.01, "minimum center density uses the complete safe vertical track");
const smaller = artPlan(1, { layout: "center", ratio: "square", subjectScale: 60 }, fiveItems);
const largest = artPlan(1, { layout: "center", ratio: "square", subjectScale: 100 }, fiveItems);
const scaledSubjectHeight = (plan) => plan.plan.subjectBoundsByCharacter[0].height;
assert.ok(Math.abs(scaledSubjectHeight(smaller) / scaledSubjectHeight(largest) - 0.6) < 0.01, "subjectScale changes the fitted painted alpha, not transparent canvas padding");
assert.ok(Math.abs(largest.plan.subjectBoundsByCharacter[0].height - largest.layout.frames[0].height) < 1, "100% subject scale uses the available alpha height");
assert.ok(dense.plan.items[0].copy.primarySize > 0);
const largerType = artPlan(1, { layout: "center", ratio: "square", textScale: 150 }, fiveItems);
assert.ok(largerType.plan.items[0].copy.primarySize > dense.plan.items[0].copy.primarySize, "textScale changes planned gear copy size");
const narrowGap = artLayout(3, { layout: "cover", subjectGap: 0 }).layout;
const wideGap = artLayout(3, { layout: "cover", subjectGap: 80 }).layout;
const gapBetweenFrames = (layout) => layout.frames[1].x - (layout.frames[0].x + layout.frames[0].width);
assert.ok(gapBetweenFrames(wideGap) > gapBetweenFrames(narrowGap), "subjectGap changes the space between cover subjects");
const autoSmaller = artPlan(1, { layout: "auto", ratio: "portrait", subjectScale: 60 }, fiveItems);
const autoLargest = artPlan(1, { layout: "auto", ratio: "portrait", subjectScale: 100 }, fiveItems);
assert.ok(Math.abs(autoSmaller.plan.subjectBoundsByCharacter[0].height / autoLargest.plan.subjectBoundsByCharacter[0].height - 0.6) < 0.01, "automatic side composition also applies subjectScale to painted alpha");

const slotsVisible = artPlan(1, { layout: "center", showSlots: true }, fiveItems).plan;
const slotsHidden = artPlan(1, { layout: "center", showSlots: false }, fiveItems).plan;
assert.equal(slotsVisible.items[0].slotName, "Slot 1");
assert.equal(slotsHidden.items[0].slotName, "");
const secondaryHidden = artPlan(1, { layout: "center", secondaryMode: "none" }, fiveItems).plan;
assert.equal(secondaryHidden.items[0].secondaryName, "");
const centeredCopy = artPlan(1, { layout: "center", textAlign: "center" }, fiveItems).plan;
assert.ok(centeredCopy.items.every((item) => item.textAlign === "center"));

const fourCharactersFiveShortNames = Array.from({ length: 4 }, () => Array.from({ length: 5 }, (_, index) => gearEntry(index, {
  name: `장비 이름 ${index + 1}`,
  secondaryName: `Gear Name ${index + 1}`,
})));
const fourCharacterHeartPlan = artPlan(4, {
  layout: "footer",
  ratio: "lookbook",
  badge: "heart",
  secondaryMode: "all",
  density: 50,
}, fourCharactersFiveShortNames).plan;
assert.equal(fourCharacterHeartPlan.items.length, 20);
fourCharacterHeartPlan.items.forEach((item) => {
  assert.equal(item.copy.paddingX, 0, "the group contentRect owns art inset, so each tile adds no horizontal padding");
  assert.equal(item.copy.paddingY, 0, "the group contentRect owns art inset, so each tile adds no vertical padding");
  assert.equal(item.column, 0, "ordinary five-item heart groups keep one coherent vertical list");
  assert.ok(item.copy.primarySize >= 11, "five short names per heart panel retain legible primary type");
  assert.equal(item.copy.estimatedPrimaryLines, 1, "short primary names stay on one full line");
  assert.equal(item.copy.fits, true, "primary and secondary copy fit without automatic clipping");
  assert.ok(item.copyBounds.height + 0.01 >= item.copy.estimatedContentHeight, "the rendered copy bounds fit the complete planned text height");
});

const original = artLayout(1, { layout: "center", ratio: "portrait" });
const originalImageRect = CardLayout.imageRectFor({
  frame: original.layout.frames[0],
  naturalWidth: 1800,
  naturalHeight: 1200,
  imageFit: "cover",
  cutout: false,
});
const originalPlan = CardLayout.planComposition({
  characterCount: 1,
  layout: original.layout,
  art: original.art,
  characters: [{ cutout: false }],
  gearByCharacter: fiveItems,
  occupancyByCharacter: [null],
  imageRects: [originalImageRect],
});
const originalFrame = original.layout.frames[0];
const fittedOriginal = originalPlan.imageRects[0];
assert.ok(fittedOriginal.x >= originalFrame.x - 0.01 && fittedOriginal.y >= originalFrame.y - 0.01, "original images fit inside their own art frame");
assert.ok(fittedOriginal.x + fittedOriginal.width <= originalFrame.x + originalFrame.width + 0.01, "original image right edge is not clipped");
assert.ok(fittedOriginal.y + fittedOriginal.height <= originalFrame.y + originalFrame.height + 0.01, "original image bottom edge is not clipped");

const zoomBaseline = artPlanForCharacter({ cutout: true, imageFit: "contain", zoom: 100, panX: 0, panY: 0 }, { subjectScale: 60 });
const pannedImage = artPlanForCharacter({ cutout: true, imageFit: "contain", zoom: 100, panX: 20, panY: -12 }, { subjectScale: 60 });
assert.ok(pannedImage.plan.subjectBoundsByCharacter[0].x > zoomBaseline.plan.subjectBoundsByCharacter[0].x, "art fitting preserves horizontal pan within the free frame area");
assert.ok(pannedImage.plan.subjectBoundsByCharacter[0].y < zoomBaseline.plan.subjectBoundsByCharacter[0].y, "art fitting preserves vertical pan within the free frame area");
inside(pannedImage.plan.subjectBoundsByCharacter[0], pannedImage.layout.dimensions, "panned contain subject");
const zoomOut = artPlanForCharacter({ cutout: true, imageFit: "contain", zoom: 70, panX: 0, panY: 0 }, { subjectScale: 100 });
assert.ok(Math.abs(zoomOut.plan.subjectBoundsByCharacter[0].height / largest.plan.subjectBoundsByCharacter[0].height - 0.7) < 0.01, "art fitting preserves user zoom-out below the maximum subject scale");

const coverPhoto = artPlanForCharacter({ cutout: false, imageFit: "cover", zoom: 150, panX: 24, panY: -18 });
assert.deepEqual(coverPhoto.plan.imageRects[0], coverPhoto.imageRect, "original cover fit, zoom, and pan remain unchanged at 100% subject scale");

const sharedGear = [Array.from({ length: 5 }, (_, index) => gearEntry(index)), Array.from({ length: 5 }, (_, index) => gearEntry(index + 50))];
const sharedBefore = structuredClone(sharedGear);
const shared = artPlan(2, { layout: "center", sharedOutfit: true }, sharedGear);
assert.equal(shared.plan.sharedOutfit, true);
assert.deepEqual(new Set(shared.plan.items.map((item) => item.characterIndex)), new Set([0]), "two-view shared information keeps character 0 ownership and emits it once");
assert.equal(shared.plan.items.length, 5);
assert.deepEqual(sharedGear, sharedBefore, "shared outfit planning never changes either character's equipment records");
assert.deepEqual(shared.plan.groupPanels.map(({ characterIndex }) => characterIndex), [0]);

const coverGear = Array.from({ length: 3 }, (_, characterIndex) => Array.from({ length: 5 }, (_, index) => gearEntry(characterIndex * 10 + index)));
const coverBefore = structuredClone(coverGear);
const cover = artPlan(3, { layout: "cover" }, coverGear);
assert.equal(cover.plan.infoHidden, true);
assert.deepEqual(cover.plan.items, [], "cover intentionally omits information copy from the card");
assert.equal(cover.plan.hasUnplacedVisibleItems, false);
assert.deepEqual(coverGear, coverBefore, "cover leaves the card and equipment data available to exported sheets");

const manyGear = Array.from({ length: 5 }, (_, characterIndex) => Array.from({ length: 37 }, (_, index) => gearEntry(
  index,
  { name: `星空装備名前長め ${"あ🚀".repeat(14)} ${characterIndex}-${index}`, secondaryName: `English Style Reference ${characterIndex}-${index}` },
)));
const many = artPlan(5, { layout: "footer", ratio: "lookbook", badge: "heart", secondaryMode: "none", density: 100 }, manyGear);
assert.equal(many.plan.items.length, 185, "all five characters keep all 185 long unicode selections on the card");
many.plan.items.forEach((item) => {
  const panel = many.plan.groupPanels.find(({ characterIndex }) => characterIndex === item.characterIndex);
  inside(item, many.layout.dimensions, `gear tile ${item.characterIndex}/${item.gearIndex}`);
  inside(item.copyBounds, many.layout.dimensions, `gear copy ${item.characterIndex}/${item.gearIndex}`);
  assert.ok(item.copyBounds.x >= panel.contentRect.x - 0.01 && item.copyBounds.y >= panel.contentRect.y - 0.01, "copy stays within the badge-safe copy area");
  assert.ok(item.copyBounds.x + item.copyBounds.width <= panel.contentRect.x + panel.contentRect.width + 0.01, "copy stays within the badge-safe right edge");
  assert.ok(item.copyBounds.y + item.copyBounds.height <= panel.contentRect.y + panel.contentRect.height + 0.01, "copy stays within the badge-safe bottom edge");
  assert.equal(item.copy.fits, true, `auto-shrunk unicode copy fits ${item.characterIndex}/${item.gearIndex}`);
  assert.equal(item.copyOcclusionScore, 0, `copy has no painted subject collision at ${item.characterIndex}/${item.gearIndex}`);
  assert.equal(overlap(item.copyBounds, item.subjectBounds), false, `copy glyph bounds do not collide with alpha at ${item.characterIndex}/${item.gearIndex}`);
});
for (let first = 0; first < many.plan.items.length; first += 1) {
  for (let second = first + 1; second < many.plan.items.length; second += 1) {
    const one = many.plan.items[first];
    const two = many.plan.items[second];
    if (one.characterIndex === two.characterIndex) assert.equal(overlap(one, two), false, `planned gear groups do not overlap for character ${one.characterIndex}`);
  }
}

console.log("PASS: reference art ratios, frames, badge-safe copy, alpha fitting, shared/cover behavior, and 185-item retention.");
