/* Shared card geometry: the live preview and PNG renderer must place the same
   character frames. Keep this module pure so both surfaces can consume it
   without reading editor state or the DOM. */
const CardLayout = (() => {
  const dimensions = {
    portrait: { layoutWidth: 1080, layoutHeight: 1350, exportWidth: 2160, exportHeight: 2700 },
    landscape: { layoutWidth: 1200, layoutHeight: 675, exportWidth: 2400, exportHeight: 1350 },
  };

  function ratioFor(characterCount, singleRatio) {
    return Number(characterCount) === 1 && singleRatio === "portrait" ? "portrait" : "landscape";
  }

  function dimensionsFor(characterCount, singleRatio) {
    return { ...dimensions[ratioFor(characterCount, singleRatio)] };
  }

  function characterFrames({ characterCount, singleRatio = "portrait", singleLayout = "info-left", characters = [] }) {
    const count = Math.min(5, Math.max(1, Number(characterCount) || 1));
    const ratio = ratioFor(count, singleRatio);
    const { layoutWidth, layoutHeight } = dimensions[ratio];

    if (count === 1) {
      return ratio === "portrait"
        ? [{ x: 95, y: 150, width: 890, height: 1180 }]
        : [{ x: singleLayout === "info-right" ? 18 : 362, y: 108, width: 820, height: 532 }];
    }

    if (count === 2) {
      return [
        { x: 210, y: 142, width: 390, height: 498 },
        { x: 600, y: 142, width: 390, height: 498 },
      ];
    }

    const activeCharacters = characters.slice(0, count);
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

  function infoRails({ characterCount = 2 } = {}) {
    if (Number(characterCount) !== 2) return [];
    const { layoutWidth } = dimensions.landscape;
    const inset = Math.round(layoutWidth * 0.06);
    const width = Math.round(layoutWidth * 0.19);
    const y = 150;
    const itemHeight = 82;
    const gap = 6;
    const height = itemHeight * 5 + gap * 4;
    return [
      { x: inset, y, width, height, itemHeight, gap, textAlign: "left" },
      { x: layoutWidth - inset - width, y, width, height, itemHeight, gap, textAlign: "right" },
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
    const ratio = ratioFor(characterCount, singleRatio);
    const { layoutWidth, layoutHeight } = dimensions[ratio];
    const bounds = boundsFor(frames);
    return [
      (bounds.top / layoutHeight) * 100,
      ((layoutWidth - bounds.right) / layoutWidth) * 100,
      ((layoutHeight - bounds.bottom) / layoutHeight) * 100,
      (bounds.left / layoutWidth) * 100,
    ].map((value) => `${value}%`).join(" ");
  }

  return { ratioFor, dimensionsFor, characterFrames, infoRails, boundsFor, cssInsetFor };
})();

if (typeof module !== "undefined") module.exports = CardLayout;
