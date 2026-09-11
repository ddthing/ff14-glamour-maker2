/* Shared card geometry: the live preview and PNG renderer must place the same
   character frames. Keep this module pure so both surfaces can consume it
   without reading editor state or the DOM. */
const CropPlanModule = typeof module !== "undefined" && module.exports
  ? require("./crop-plan.js")
  : globalThis.CropPlan;
const CardLayout = (() => {
  const dimensions = {
    portrait: { layoutWidth: 1080, layoutHeight: 1350, exportWidth: 2160, exportHeight: 2700 },
    landscape: { layoutWidth: 1200, layoutHeight: 675, exportWidth: 2400, exportHeight: 1350 },
  };
  // This order is the persisted outfit order used by the editor. Keeping the
  // semantic slot beside each coordinate makes it harder to move a note and
  // accidentally leave one of the five equipment positions behind.
  const gearSlotOrder = Object.freeze(["head", "body", "hands", "legs", "feet"]);
  const portraitGearLayout = Object.freeze([
    Object.freeze({ slot: "head", x: 34, y: 250, width: 370, height: 116 }),
    Object.freeze({ slot: "body", x: 676, y: 410, width: 370, height: 116 }),
    Object.freeze({ slot: "hands", x: 34, y: 590, width: 370, height: 116 }),
    Object.freeze({ slot: "legs", x: 676, y: 790, width: 370, height: 116 }),
    Object.freeze({ slot: "feet", x: 34, y: 990, width: 370, height: 116 }),
  ]);
  const landscapeSoloGearLayout = Object.freeze([
    // The landscape solo card keeps the portrait rhythm: odd slots sit on the
    // left, even slots on the right, leaving the character a visual center.
    Object.freeze({ slot: "head", x: 28, y: 156, width: 300, height: 92 }),
    Object.freeze({ slot: "body", x: 872, y: 156, width: 300, height: 92 }),
    Object.freeze({ slot: "hands", x: 28, y: 292, width: 300, height: 92 }),
    Object.freeze({ slot: "legs", x: 872, y: 292, width: 300, height: 92 }),
    Object.freeze({ slot: "feet", x: 28, y: 428, width: 300, height: 92 }),
  ]);
  const landscapeSoloCharacterFrame = Object.freeze({ x: 342, y: 108, width: 516, height: 532 });

  function normaliseCharacterCount(value) {
    return Math.min(5, Math.max(1, Number(value) || 1));
  }

  function ratioFor(characterCount, singleRatio) {
    return Number(characterCount) === 1 && singleRatio === "portrait" ? "portrait" : "landscape";
  }

  function dimensionsFor(characterCount, singleRatio) {
    return { ...dimensions[ratioFor(characterCount, singleRatio)] };
  }

  function layoutFor({ characterCount = 1, singleRatio = "portrait", singleLayout = "info-left", characters = [] } = {}) {
    const count = normaliseCharacterCount(characterCount);
    const ratio = ratioFor(count, singleRatio);
    return {
      characterCount: count,
      ratio,
      dimensions: { ...dimensions[ratio] },
      frames: characterFrames({
        characterCount: count,
        singleRatio,
        singleLayout,
        characters,
      }),
    };
  }

  function portraitGearPositions({ singleLayout = "info-left" } = {}) {
    const { layoutWidth } = dimensions.portrait;
    return portraitGearLayout.map((position) => (
      singleLayout === "info-right"
        ? { ...position, x: layoutWidth - position.x - position.width }
        : { ...position }
    ));
  }

  function landscapeSoloGearPositions({ singleLayout = "info-left" } = {}) {
    const { layoutWidth } = dimensions.landscape;
    return landscapeSoloGearLayout.map((position) => (
      singleLayout === "info-right"
        ? { ...position, x: layoutWidth - position.x - position.width }
        : { ...position }
    ));
  }

  function characterFrames({ characterCount, singleRatio = "portrait", singleLayout = "info-left", characters = [] }) {
    const count = normaliseCharacterCount(characterCount);
    const ratio = ratioFor(count, singleRatio);
    const { layoutWidth, layoutHeight } = dimensions[ratio];

    if (count === 1) {
      return ratio === "portrait"
        ? [{ x: 95, y: 150, width: 890, height: 1180 }]
        : [{ ...landscapeSoloCharacterFrame }];
    }

    if (count === 2) {
      return [
        { x: 210, y: 142, width: 390, height: 498 },
        { x: 600, y: 142, width: 390, height: 498 },
      ];
    }

    const activeCharacters = Array.isArray(characters) ? characters.slice(0, count) : [];
    const hasFullFrameSource = activeCharacters.some((character) => !character?.cutout);
    const figureTop = hasFullFrameSource ? 0 : 142;
    const figureBottom = hasFullFrameSource ? layoutHeight : layoutHeight - 14;
    const width = layoutWidth / count;
    return Array.from({ length: count }, (_, index) => ({
      x: width * index,
      y: figureTop,
      width,
      height: figureBottom - figureTop,
    }));
  }

  // Resolve the painted image rectangle from the same frame used by the
  // preview and PNG renderer. Keeping this math here prevents a future fit,
  // zoom, or cutout change from drifting between the two surfaces.
  function imageRectFor(options = {}) {
    return CropPlanModule.imageRectFor(options);
  }

  function infoRails({ characterCount = 2 } = {}) {
    if (Number(characterCount) !== 2) return [];
    const { layoutWidth } = dimensions.landscape;
    const inset = Math.round(layoutWidth * 0.06);
    const width = 250;
    const y = 132;
    const itemHeight = 90;
    const gap = 8;
    const height = itemHeight * 5 + gap * 4;
    return [
      { x: inset, y, width, height, itemHeight, gap, textAlign: "left" },
      { x: layoutWidth - inset - width, y, width, height, itemHeight, gap, textAlign: "left" },
    ];
  }

  function boundsFor(frames) {
    if (!frames.length) return { left: 0, top: 0, right: 0, bottom: 0 };
    return {
      left: Math.min(...frames.map((frame) => frame.x)),
      top: Math.min(...frames.map((frame) => frame.y)),
      right: Math.max(...frames.map((frame) => frame.x + frame.width)),
      bottom: Math.max(...frames.map((frame) => frame.y + frame.height)),
    };
  }

  function cssInsetFor(frames, characterCount, singleRatio) {
    return cssInsetForLayout({
      frames,
      dimensions: dimensionsFor(characterCount, singleRatio),
    });
  }

  function cssInsetForLayout({ frames, dimensions: layoutDimensions }) {
    const { layoutWidth, layoutHeight } = layoutDimensions;
    const bounds = boundsFor(frames);
    return [
      (bounds.top / layoutHeight) * 100,
      ((layoutWidth - bounds.right) / layoutWidth) * 100,
      ((layoutHeight - bounds.bottom) / layoutHeight) * 100,
      (bounds.left / layoutWidth) * 100,
    ].map((value) => `${value}%`).join(" ");
  }

  return { ratioFor, dimensionsFor, layoutFor, characterFrames, imageRectFor, portraitGearPositions, landscapeSoloGearPositions, infoRails, boundsFor, cssInsetFor, cssInsetForLayout, gearSlotOrder };
})();

if (typeof module !== "undefined") module.exports = CardLayout;
