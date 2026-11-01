/* Shared card geometry: the live preview and PNG renderer must place the same
   character frames. Keep this module pure so both surfaces can consume it
   without reading editor state or the DOM. */
const CropPlanModule = typeof module !== "undefined" && module.exports
  ? require("./crop-plan.js")
  : globalThis.CropPlan;
const CardArtModule = typeof module !== "undefined" && module.exports
  ? require("./card-art.js")
  : globalThis.CardArt;
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
  const artDimensions = Object.freeze({
    square: Object.freeze({ layoutWidth: 1080, layoutHeight: 1080, exportWidth: 2160, exportHeight: 2160 }),
    lookbook: Object.freeze({ layoutWidth: 1200, layoutHeight: 1000, exportWidth: 2400, exportHeight: 2000 }),
    portrait: dimensions.portrait,
    landscape: dimensions.landscape,
  });

  function normaliseCharacterCount(value) {
    return Math.min(5, Math.max(1, Number(value) || 1));
  }

  function ratioFor(characterCount, singleRatio) {
    return Number(characterCount) === 1 && singleRatio === "portrait" ? "portrait" : "landscape";
  }

  function dimensionsFor(characterCount, singleRatio) {
    return { ...dimensions[ratioFor(characterCount, singleRatio)] };
  }

  function artRatioFor({ art, characterCount, singleRatio }) {
    if (art.ratio !== "auto") return art.ratio;
    if (art.layout === "footer") return "lookbook";
    if (art.layout === "cover") return "landscape";
    if (art.layout === "center") return "square";
    return ratioFor(characterCount, singleRatio);
  }

  function scaleFrames(frames, fromDimensions, toDimensions) {
    const scaleX = toDimensions.layoutWidth / fromDimensions.layoutWidth;
    const scaleY = toDimensions.layoutHeight / fromDimensions.layoutHeight;
    return frames.map((frame, characterIndex) => ({
      characterIndex,
      x: frame.x * scaleX,
      y: frame.y * scaleY,
      width: frame.width * scaleX,
      height: frame.height * scaleY,
    }));
  }

  function artHeader(dimensions, art) {
    const { layoutWidth, layoutHeight } = dimensions;
    if (art.titlePlacement === "hidden") {
      return { x: 0, y: 0, width: 0, height: 0, align: "left", hidden: true };
    }
    const centered = art.titlePlacement === "top-center";
    const width = layoutWidth * (centered ? 0.72 : 0.58);
    return {
      x: centered ? (layoutWidth - width) / 2 : layoutWidth * 0.055,
      y: layoutHeight * 0.018,
      width,
      height: layoutHeight * 0.07,
      align: centered ? "center" : "left",
      hidden: false,
    };
  }

  function artPanel(characterIndex, x, y, width, height, art, shape = "none") {
    const inset = shape === "heart"
      ? { left: 0.20, right: 0.20, top: 0.20, bottom: 0.35 }
      : shape === "flower"
        ? { left: 0.15, right: 0.15, top: 0.15, bottom: 0.15 }
        : shape === "scallop"
          ? { left: 0.10, right: 0.10, top: 0.10, bottom: 0.10 }
          : { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      characterIndex,
      x,
      y,
      width,
      height,
      shape,
      textAlign: art.textAlign,
      contentRect: {
        x: x + width * inset.left,
        y: y + height * inset.top,
        width: width * (1 - inset.left - inset.right),
        height: height * (1 - inset.top - inset.bottom),
      },
    };
  }

  function artFramesFor({ characterCount, art, effectiveLayout, dimensions: layoutDimensions, singleRatio, singleLayout, characters }) {
    const { layoutWidth: width, layoutHeight: height } = layoutDimensions;
    const count = characterCount;
    const marginX = width * 0.035;
    const header = artHeader(layoutDimensions, art);
    const imageTop = header.hidden ? height * 0.025 : height * 0.115;
    const frameBottom = height * 0.975;
    const availableHeight = frameBottom - imageTop;

    if (effectiveLayout === "auto") {
      const baseRatio = ratioFor(count, singleRatio === "portrait" ? "portrait" : "landscape");
      const baseDimensions = dimensions[baseRatio];
      const baseFrames = characterFrames({ characterCount: count, singleRatio, singleLayout, characters });
      return scaleFrames(baseFrames, baseDimensions, layoutDimensions);
    }

    if (effectiveLayout === "center" && count === 1) {
      return [{ characterIndex: 0, x: width * 0.035, y: imageTop, width: width * 0.53, height: availableHeight }];
    }

    if (effectiveLayout === "center" && count === 2 && art.sharedOutfit) {
      const subjectWidth = width * 0.35;
      return [
        { characterIndex: 0, x: width * 0.025, y: imageTop, width: subjectWidth, height: availableHeight, view: "front" },
        { characterIndex: 1, x: width * 0.625, y: imageTop, width: subjectWidth, height: availableHeight, view: "back" },
      ];
    }

    if (effectiveLayout === "center" && count === 2) {
      const subjectWidth = width * 0.29;
      return [
        { characterIndex: 0, x: width * 0.02, y: imageTop, width: subjectWidth, height: availableHeight },
        { characterIndex: 1, x: width * 0.69, y: imageTop, width: subjectWidth, height: availableHeight },
      ];
    }

    if (effectiveLayout === "cover") {
      const gap = Math.min(width * 0.12, art.subjectGap * 1.2);
      const availableWidth = width - marginX * 2 - gap * Math.max(0, count - 1);
      const slotWidth = availableWidth / count;
      return Array.from({ length: count }, (_, characterIndex) => ({
        characterIndex,
        x: marginX + characterIndex * (slotWidth + gap),
        y: imageTop,
        width: slotWidth,
        height: availableHeight,
      }));
    }

    // Footer includes explicit `footer` and center layouts that cannot fit a
    // central information column with more than two subjects.
    const gap = Math.min(width * 0.08, art.subjectGap * 1.2);
    const availableWidth = width - marginX * 2 - gap * Math.max(0, count - 1);
    const slotWidth = availableWidth / count;
    const top = header.hidden ? height * 0.025 : height * 0.09;
    const subjectHeight = height * 0.65;
    return Array.from({ length: count }, (_, characterIndex) => ({
      characterIndex,
      x: marginX + characterIndex * (slotWidth + gap),
      y: top,
      width: slotWidth,
      height: subjectHeight,
    }));
  }

  function artGroupPanels({ characterCount, art, effectiveLayout, dimensions }) {
    const { layoutWidth: width, layoutHeight: height } = dimensions;
    if (effectiveLayout === "cover" || effectiveLayout === "auto") return [];
    if (effectiveLayout === "center" && characterCount === 1) {
      return [artPanel(0, width * 0.60, height * 0.135, width * 0.36, height * 0.82, art)];
    }
    if (effectiveLayout === "center" && characterCount === 2 && art.sharedOutfit) {
      return [artPanel(0, width * 0.385, height * 0.14, width * 0.23, height * 0.80, art)];
    }
    if (effectiveLayout === "center" && characterCount === 2) {
      return [
        artPanel(0, width * 0.325, height * 0.13, width * 0.35, height * 0.355, art),
        artPanel(1, width * 0.325, height * 0.515, width * 0.35, height * 0.355, art),
      ];
    }
    const margin = width * 0.035;
    const gap = Math.min(width * 0.08, art.subjectGap * 1.2);
    const panelTop = height * 0.745;
    const panelHeight = height * 0.235;
    const panelWidth = (width - margin * 2 - gap * Math.max(0, characterCount - 1)) / characterCount;
    return Array.from({ length: characterCount }, (_, characterIndex) => artPanel(
      characterIndex,
      margin + characterIndex * (panelWidth + gap),
      panelTop,
      panelWidth,
      panelHeight,
      art,
      art.badge,
    ));
  }

  function layoutArtFor({ characterCount, singleRatio, singleLayout, characters, art: rawArt }) {
    if (rawArt?.enabled !== true) return null;
    const art = CardArtModule?.normalize ? CardArtModule.normalize(rawArt) : rawArt;
    const count = normaliseCharacterCount(characterCount);
    const ratio = artRatioFor({ art, characterCount: count, singleRatio });
    const layoutDimensions = { ...artDimensions[ratio] };
    const effectiveLayout = art.layout === "center" && count > 2 ? "footer" : art.layout;
    const frames = artFramesFor({
      characterCount: count,
      art,
      effectiveLayout,
      dimensions: layoutDimensions,
      singleRatio,
      singleLayout,
      characters,
    });
    return {
      characterCount: count,
      ratio,
      dimensions: layoutDimensions,
      frames,
      artFrames: frames.map((frame) => ({ ...frame })),
      art,
      effectiveLayout,
      header: artHeader(layoutDimensions, art),
      groupPanels: artGroupPanels({ characterCount: count, art, effectiveLayout, dimensions: layoutDimensions }),
    };
  }

  function layoutFor({ characterCount = 1, singleRatio = "portrait", singleLayout = "info-left", characters = [], art = null } = {}) {
    const count = normaliseCharacterCount(characterCount);
    const artLayout = layoutArtFor({ characterCount: count, singleRatio, singleLayout, characters, art });
    if (artLayout) return artLayout;
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

  // Resolve the planner only when called. In the browser CardLayout is loaded
  // immediately before CardComposition, so a top-level global capture would
  // retain `undefined`; lazy lookup also keeps the pure modules acyclic.
  function planComposition(options = {}) {
    const state = options.state || options;
    const characterCount = normaliseCharacterCount(options.characterCount ?? state.characterCount);
    const singleRatio = options.singleRatio || state.singleRatio || "portrait";
    const singleLayout = options.singleLayout || state.singleLayout || "info-left";
    const characters = options.characters || state.characters || [];
    const composition = options.composition || state.cardComposition || state.composition || {};
    const art = options.art || composition.art || state.art || null;
    let layout = options.layout || null;
    if (!layout || (art && Boolean(layout.art?.enabled) !== (art.enabled === true))) {
      layout = layoutFor({ characterCount, singleRatio, singleLayout, characters, art });
    }
    const planner = typeof module !== "undefined" && module.exports
      ? require("./card-composition.js")
      : globalThis.CardComposition;
    if (typeof planner?.plan !== "function") throw new TypeError("CardComposition must be loaded before planning card notes.");
    return planner.plan({
      ...options,
      characterCount,
      singleRatio,
      singleLayout,
      characters,
      layout,
      composition,
      art: art || layout.art || null,
      gearByCharacter: options.gearByCharacter || options.gear || state.gearByCharacter || [],
      selectedCharacter: options.selectedCharacter ?? state.selectedCharacter ?? 0,
      multiInfoEnabled: options.multiInfoEnabled ?? state.multiInfoEnabled ?? false,
      language: options.language || state.language || "ko",
    });
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

  return { ratioFor, dimensionsFor, layoutFor, planComposition, characterFrames, imageRectFor, portraitGearPositions, landscapeSoloGearPositions, infoRails, boundsFor, cssInsetFor, cssInsetForLayout, gearSlotOrder };
})();

if (typeof module !== "undefined") module.exports = CardLayout;
