/* PNG renderer: consumes resolved card data and decoded images only.
   It does not read editor state, DOM layout, storage, or item records. */
const CardGearCopyModule = typeof module !== "undefined" && module.exports
  ? require("./card-gear-copy.js")
  : typeof CardGearCopy !== "undefined" ? CardGearCopy : globalThis.CardGearCopy;
const CardMaterialsModule = typeof module !== "undefined" && module.exports
  ? require("./card-materials.js")
  : typeof CardMaterials !== "undefined" ? CardMaterials : globalThis.CardMaterials;
const CardPng = (() => {
function traceFivePointStar(context, radius) {
  const innerRadius = radius * 0.42;
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const pointRadius = index % 2 === 0 ? radius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawExportTexture(context, width, height, background, texture, textureInk = null) {
  const textureStrength = {
    grain: 0.1,
    risograph: 0.12,
    dust: 0.14,
    fiber: 0.12,
    halftone: 0.12,
  }[texture] ?? 0;
  if (!textureStrength) return;

  const ink = textureInk || background.pattern[0];
  const light = ink;
  const seededUnit = (index, salt) => {
    const seed = Math.sin(index * 12.9898 + salt) * 43758.5453;
    return seed - Math.floor(seed);
  };

  context.save();
  if (texture === "grain") {
    const grainCount = Math.round((width * height) / 250);
    for (let index = 0; index < grainCount; index += 1) {
      const random = seededUnit(index, 78.233);
      const secondRandom = seededUnit(index, 19.19);
      context.globalAlpha = textureStrength * (0.25 + random * 0.75);
      context.fillStyle = index % 5 === 0 ? light : ink;
      context.fillRect(
        Math.floor(secondRandom * width),
        Math.floor(random * height),
        random > 0.72 ? 1.4 : 0.8,
        random > 0.72 ? 1.4 : 0.8,
      );
    }
  } else if (texture === "risograph") {
    const step = Math.max(6, Math.min(10, width / 140));
    const drawScreen = (color, offsetX, offsetY, angle, alpha) => {
      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(angle);
      context.translate(-width / 2 + offsetX, -height / 2 + offsetY);
      context.fillStyle = color;
      context.globalAlpha = textureStrength * alpha;
      for (let y = -step; y < height + step; y += step) {
        for (let x = -step; x < width + step; x += step) {
          context.beginPath();
          context.arc(x, y, Math.max(0.42, step * 0.14), 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();
    };
    drawScreen(ink, 0, 0, -0.012, 0.84);
    drawScreen(light, step * 0.24, step * 0.12, 0.012, 0.55);
  } else if (texture === "dust") {
    const dustCount = Math.round((width * height) / 5000);
    for (let index = 0; index < dustCount; index += 1) {
      const random = seededUnit(index, 41.7);
      const secondRandom = seededUnit(index, 93.13);
      const x = secondRandom * width;
      const y = random * height;
      const color = index % 4 === 0 ? light : ink;
      context.globalAlpha = textureStrength * (0.22 + random * 0.78);
      context.fillStyle = color;
      if (index % 7 === 0) {
        const scratchLength = 4 + secondRandom * 18;
        context.strokeStyle = color;
        context.lineWidth = Math.max(0.35, random * 1.1);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(
          x + (secondRandom - 0.5) * scratchLength * 2,
          y + (random - 0.5) * 3,
        );
        context.stroke();
      } else {
        const radius = random > 0.92 ? 2.2 : random > 0.7 ? 1.1 : 0.55;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (texture === "fiber") {
    const fiberCount = Math.round((width * height) / 2400);
    context.lineCap = "round";
    for (let index = 0; index < fiberCount; index += 1) {
      const random = seededUnit(index, 17.11);
      const secondRandom = seededUnit(index, 63.47);
      const x = random * width;
      const y = secondRandom * height;
      const length = 3 + seededUnit(index, 81.29) * 16;
      const vertical = index % 3 === 0;
      const angle = vertical
        ? Math.PI / 2 + (random - 0.5) * 0.13
        : (secondRandom - 0.5) * 0.13;
      const color = index % 5 === 0 ? light : ink;
      context.globalAlpha = textureStrength * (0.18 + seededUnit(index, 119.3) * 0.62);
      context.strokeStyle = color;
      context.lineWidth = 0.28 + seededUnit(index, 149.2) * 0.72;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }
  } else if (texture === "halftone") {
    const step = Math.max(6, Math.min(10, width / 160));
    context.fillStyle = ink;
    for (let y = step / 2; y < height; y += step) {
      const verticalFade = 0.08 + Math.pow(y / height, 1.35) * 0.92;
      const offset = (Math.round(y / step) % 2) * step * 0.5;
      for (let x = step / 2 + offset; x < width; x += step) {
        const variation = 0.76 + seededUnit(Math.round(x + y), 207.4) * 0.24;
        context.globalAlpha = textureStrength * verticalFade * variation;
        context.beginPath();
        context.arc(x, y, Math.max(0.35, step * (0.06 + verticalFade * 0.12)), 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  context.restore();
}

function drawExportPattern(context, width, height, background, snapshot, patternStars, textureInk = null) {
  const state = snapshot;
  if (state.backgroundPattern === "none" && state.backgroundTexture === "none") return;
  const isDarkSurface = background?.tone === "dark";
  const exportStrength = {
    dots: isDarkSurface ? 0.28 : 0.16,
    stars: isDarkSurface ? 0.3 : 0.2,
    halftone: isDarkSurface ? 0.3 : 0.2,
    bitmap: isDarkSurface ? 0.32 : 0.26,
  };
  const strength = exportStrength[state.backgroundPattern] ?? 0;
  const ink = background.pattern[0];
  const light = background.pattern[1];
  context.save();

  if (state.backgroundPattern === "halftone") {
    // The halftone control is a soft gingham check: translucent vertical and
    // horizontal bands overlap into darker squares like reference image 3.
    const cell = Math.max(24, Math.min(80, width / 15));
    const band = cell * 0.38;
    context.fillStyle = ink;
    context.globalAlpha = strength * 0.52;
    for (let x = 0; x < width; x += cell) context.fillRect(x, 0, band, height);
    for (let y = 0; y < height; y += cell) context.fillRect(0, y, width, band);
  } else if (state.backgroundPattern === "dots") {
    const step = Math.max(13, width / 68);
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2 + ((Math.round(y / step) % 2) * step / 2); x < width; x += step) {
        const centerFade = Math.min(1, Math.abs(x - width / 2) / (width * 0.3) + 0.18);
        context.globalAlpha = strength * centerFade;
        context.fillStyle = (Math.round(y / step) + Math.round(x / step)) % 2 ? ink : light;
        context.beginPath();
        context.arc(x, y, Math.max(0.8, step * 0.075), 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (state.backgroundPattern === "bitmap") {
    // The legacy bitmap key now renders as a deliberate large checkerboard.
    // Keep roughly ten squares across so export follows the CSS preview.
    const square = Math.max(32, Math.min(132, width / 10));
    for (let row = 0, y = 0; y < height; row += 1, y += square) {
      for (let column = 0, x = 0; x < width; column += 1, x += square) {
        context.globalAlpha = strength;
        context.fillStyle = (row + column) % 2 ? ink : light;
        context.fillRect(Math.floor(x), Math.floor(y), Math.ceil(square), Math.ceil(square));
      }
    }
  }

  drawExportTexture(context, width, height, background, state.backgroundTexture, textureInk);

  if (state.backgroundPattern === "stars") {
    patternStars.forEach(({ x, y, size, rotate, tone, shape = "star", opacity }) => {
      context.save();
      context.translate((x / 100) * width, (y / 100) * height);
      context.rotate((rotate * Math.PI) / 180);
      context.globalAlpha = strength * opacity;
      context.fillStyle = tone === "light" ? light : ink;
      const radius = ((size / 100) * width) / 2;
      if (shape === "outline") {
        context.strokeStyle = context.fillStyle;
        context.lineWidth = Math.max(1, radius * 0.15);
        traceFivePointStar(context, radius);
        context.stroke();
      } else if (shape === "sparkle") {
        traceEightPointSparkle(context, radius);
        context.fill();
      } else if (shape === "ring") {
        context.beginPath();
        context.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
        context.lineWidth = Math.max(1, radius * 0.16);
        context.strokeStyle = context.fillStyle;
        context.stroke();
      } else if (shape === "dot") {
        context.beginPath();
        context.arc(0, 0, radius * 0.36, 0, Math.PI * 2);
        context.fill();
      } else {
        traceFivePointStar(context, radius);
        context.fill();
      }
      context.restore();
    });
  }
  context.restore();
}

function drawCoverImage(context, image, x, y, width, height) {
  const imageWidth = Number(image?.naturalWidth || image?.width || 0);
  const imageHeight = Number(image?.naturalHeight || image?.height || 0);
  if (!(imageWidth > 0 && imageHeight > 0 && width > 0 && height > 0)) {
    context.drawImage(image, x, y, width, height);
    return;
  }
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (imageWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (imageHeight - sourceHeight) / 2);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function traceScrapbookNote(context, x, y, width, height) {
  const points = [
    [0, 0.03],
    [0.08, 0.01],
    [0.17, 0.02],
    [0.27, 0],
    [0.38, 0.02],
    [0.49, 0.01],
    [0.61, 0.02],
    [0.72, 0],
    [0.84, 0.02],
    [1, 0.03],
    [0.99, 0.22],
    [1, 0.44],
    [0.98, 0.66],
    [1, 0.83],
    [0.98, 1],
    [0.87, 0.98],
    [0.76, 1],
    [0.66, 0.98],
    [0.55, 1],
    [0.44, 0.98],
    [0.34, 1],
    [0.23, 0.98],
    [0.13, 1],
    [0.04, 0.98],
    [0, 1],
    [0.01, 0.8],
    [0, 0.61],
    [0.02, 0.41],
  ];
  context.beginPath();
  points.forEach(([pointX, pointY], index) => {
    const resolvedX = x + pointX * width;
    const resolvedY = y + pointY * height;
    if (index === 0) context.moveTo(resolvedX, resolvedY);
    else context.lineTo(resolvedX, resolvedY);
  });
  context.closePath();
}

function traceEightPointSparkle(context, radius) {
  const innerRadius = radius * 0.2;
  context.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const pointRadius = index % 2 === 0 ? radius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / 4;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function traceArchivePaper(context, x, y, width, height) {
  // Keep this silhouette in lockstep with the archive note's CSS clip-path;
  // the PNG and DOM preview should share the same quiet torn edge.
  const points = [
    [0, 0.04], [0.08, 0.01], [0.18, 0.03], [0.29, 0], [0.4, 0.03],
    [0.5, 0.01], [0.61, 0.03], [0.72, 0], [0.84, 0.03], [1, 0.02],
    [0.98, 0.2], [1, 0.38], [0.97, 0.55], [1, 0.74], [0.98, 0.98],
    [0.86, 0.97], [0.74, 1], [0.62, 0.97], [0.5, 1], [0.38, 0.97],
    [0.25, 1], [0.12, 0.97], [0.01, 1], [0.03, 0.82], [0, 0.64],
    [0.02, 0.45], [0, 0.24],
  ];
  context.beginPath();
  points.forEach(([pointX, pointY], index) => {
    const resolvedX = x + pointX * width;
    const resolvedY = y + pointY * height;
    if (index === 0) context.moveTo(resolvedX, resolvedY);
    else context.lineTo(resolvedX, resolvedY);
  });
  context.closePath();
}

function traceScrapbookTape(context, x, y, width, height) {
  context.beginPath();
  context.moveTo(x + width * 0.01, y + height * 0.08);
  context.lineTo(x + width * 0.98, y);
  context.lineTo(x + width, y + height * 0.91);
  context.lineTo(x + width * 0.03, y + height);
  context.closePath();
}

function drawMaterialNote(context, image, pathBuilder, x, y, width, height, tint, shadowColor, borderColor, sourceRect) {
  context.save();
  context.shadowColor = shadowColor;
  context.shadowBlur = Math.max(3, Math.round(width * 0.018));
  context.shadowOffsetX = Math.max(2, Math.round(width * 0.014));
  context.shadowOffsetY = Math.max(3, Math.round(height * 0.035));
  pathBuilder();
  context.fillStyle = tint;
  context.fill();
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  pathBuilder();
  context.clip();
  if (image) {
    context.globalCompositeOperation = "multiply";
    if (sourceRect) {
      context.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, x, y, width, height);
    } else {
      drawCoverImage(context, image, x, y, width, height);
    }
    context.globalCompositeOperation = "soft-light";
    const highlight = context.createLinearGradient(x, y, x, y + height * 0.34);
    highlight.addColorStop(0, "rgba(255, 255, 255, .2)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = highlight;
    context.fillRect(x, y, width, height);
    context.globalCompositeOperation = "source-over";
  }
  context.restore();
  context.save();
  pathBuilder();
  context.strokeStyle = borderColor;
  context.lineWidth = Math.max(1, width * 0.002);
  context.stroke();
  context.restore();
}

function drawMaterialTape(context, image, x, y, width, height, color, rotation = 0) {
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(rotation);
  context.translate(-(x + width / 2), -(y + height / 2));
  traceScrapbookTape(context, x, y, width, height);
  context.fillStyle = color;
  context.fill();
  traceScrapbookTape(context, x, y, width, height);
  context.clip();
  const imageWidth = Number(image?.naturalWidth || image?.width || 0);
  const imageHeight = Number(image?.naturalHeight || image?.height || 0);
  const sourceRect = CardMaterialsModule?.tapeSourceRect(imageWidth, imageHeight);
  if (image && sourceRect) {
    context.globalCompositeOperation = "multiply";
    context.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, x, y, width, height);
    context.globalCompositeOperation = "soft-light";
    const highlight = context.createLinearGradient(x, y, x + width, y);
    highlight.addColorStop(0, "rgba(255, 255, 255, .28)");
    highlight.addColorStop(0.42, "rgba(255, 255, 255, 0)");
    highlight.addColorStop(1, "rgba(79, 69, 58, .08)");
    context.fillStyle = highlight;
    context.fillRect(x, y, width, height);
  }
  context.globalCompositeOperation = "source-over";
  traceScrapbookTape(context, x, y, width, height);
  context.strokeStyle = "rgba(82, 70, 56, .1)";
  context.lineWidth = Math.max(0.5, width * 0.01);
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, .32)";
  context.lineWidth = Math.max(0.5, height * 0.08);
  context.beginPath();
  context.moveTo(x + width * 0.04, y + height * 0.12);
  context.lineTo(x + width * 0.96, y + height * 0.04);
  context.stroke();
  context.restore();
}

function shouldDrawPatternStamp(backgroundPattern) {
  // Material note stamps are intentionally removed from every card surface.
  // The paper and tape already establish attachment; keeping this decision
  // here prevents the portrait PNG path from diverging from the CSS preview.
  return !["collage", "scrapbook"].includes(backgroundPattern);
}

function drawArchiveStamp(context, x, y, size, color, rotation = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = 0.68;
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, size * 0.035);
  context.setLineDash([size * 0.08, size * 0.055]);
  context.beginPath();
  context.arc(0, 0, size / 2, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.lineWidth = Math.max(0.8, size * 0.018);
  context.beginPath();
  context.arc(0, 0, size * 0.32, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(-size * 0.26, 0);
  context.lineTo(size * 0.26, 0);
  context.moveTo(-size * 0.2, size * 0.12);
  context.lineTo(size * 0.2, size * 0.12);
  context.stroke();
  context.restore();
}

function drawEditorialMark(context, x, y, width, color, rotation = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = 0.52;
  context.strokeStyle = color;
  context.lineWidth = Math.max(0.8, width * 0.025);
  context.beginPath();
  context.moveTo(-width / 2, 0);
  context.lineTo(width / 2, 0);
  context.moveTo(-width * 0.27, width * 0.22);
  context.lineTo(width * 0.27, width * 0.22);
  context.stroke();
  context.restore();
}

function drawExportBackground(context, width, height, background, backgroundImage) {
  context.save();
  context.fillStyle = background.solid;
  context.fillRect(0, 0, width, height);
  if (backgroundImage) drawCoverImage(context, backgroundImage, 0, 0, width, height);
  context.restore();
}

async function render({ state, dimensions, layout = null, compositionPlan = null, exportTheme, background, textureInk = null, patternStars, images, backgroundImage = null, copyLayout, gear, outlineColor, placementScale = 1, infoTextColor = exportTheme.text, infoTextMuted = exportTheme.muted, infoTextHalo = exportTheme.infoShadow }) {
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const resolvedLayout = layout || CardLayout.layoutFor({
    characterCount: state.characterCount,
    singleRatio: dimensions.layoutHeight > dimensions.layoutWidth ? "portrait" : "landscape",
    singleLayout: state.singleLayout,
    characters: activeCharacters,
  });
  // Older saved snapshots do not contain cardComposition. Keep them on the
  // byte-stable legacy path while allowing export callers to omit an explicit
  // planner result when they do use the new composition controls.
  const resolvedCompositionPlan = compositionPlan || CardLayout.planComposition({
    characterCount: state.characterCount,
    singleRatio: resolvedLayout.ratio,
    singleLayout: state.singleLayout,
    characters: activeCharacters,
    layout: resolvedLayout,
    composition: state.cardComposition || {},
    gearByCharacter: Array.isArray(gear) ? gear : [],
    selectedCharacter: state.selectedCharacter,
    multiInfoEnabled: state.multiInfoEnabled,
    language: state.language,
  });
  const isPortrait = resolvedLayout.ratio === "portrait";
  const characterFrames = resolvedLayout.frames;
  const { layoutWidth, layoutHeight, exportWidth, exportHeight } = dimensions;
    const outputScale = CardCopy.outputScale;
    const resolvedPlacementScale = Number.isFinite(placementScale) && placementScale > 0 ? placementScale : 1;
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    context.scale(outputScale, outputScale);
    drawExportBackground(context, layoutWidth, layoutHeight, background, backgroundImage);
    drawExportPattern(context, layoutWidth, layoutHeight, background, state, patternStars, textureInk);

    const roundRect = (x, y, width, height, radius) => {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
    };
    const drawPlacedImage = (image, character, x, y, width, height) => {
      const imageRect = CardLayout.imageRectFor({
        frame: { x, y, width, height },
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        imageFit: character.imageFit,
        zoom: character.zoom,
        panX: character.panX,
        panY: character.panY,
        focalPoint: character.focalPoint,
        panScale: resolvedPlacementScale,
      });
      context.drawImage(image, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    };
    const drawCharacter = (image, character, x, y, width, height) => {
      context.save();
      const informationMode = state.characterCount >= 3 && state.multiInfoEnabled;
      const silhouetteMode = informationMode && state.multiInfoMode === "silhouette" && character.cutout;
      const fadeMode = informationMode && state.multiInfoMode === "fade";
      if (silhouetteMode || fadeMode) {
        context.globalAlpha = silhouetteMode ? 0.72 : 0.48;
        context.filter = silhouetteMode
          ? "brightness(0)"
          : "grayscale(82%) saturate(35%) contrast(86%) brightness(108%)";
      }
      if (!character.cutout) {
        context.beginPath();
        context.rect(x, y, width, height);
        context.clip();
        drawPlacedImage(image, character, x, y, width, height);
        context.restore();
        return;
      }
      const imageRect = CardLayout.imageRectFor({
        frame: { x, y, width, height },
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        imageFit: character.imageFit,
        zoom: character.zoom,
        panX: character.panX,
        panY: character.panY,
        cutout: true,
        focalPoint: character.focalPoint,
        panScale: resolvedPlacementScale,
      });
      const outline = state.outline.width * 2;
      const characterTreatment = silhouetteMode
        ? "brightness(0)"
        : fadeMode
          ? "grayscale(82%) saturate(35%) contrast(86%) brightness(108%)"
          : "";
      context.filter = `${outline ? `drop-shadow(${outline}px 0 0 ${outlineColor}) drop-shadow(-${outline}px 0 0 ${outlineColor})` : ""} drop-shadow(${state.shadow.x * 2}px ${state.shadow.y * 2}px ${state.shadow.blur * 2}px rgba(10,11,18,${state.shadow.strength / 100})) ${characterTreatment}`.trim();
      context.drawImage(image, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      context.restore();
    };
    const wrapGearText = (value, maxWidth) => CardGearCopyModule.wrapText(
      value,
      (text) => context.measureText(text).width,
      maxWidth,
    );
    const fitGearCopy = ({ primaryName, secondaryName, maxWidth, maxHeight, primaryBaseSize, secondaryBaseSize, slotSize }) => {
      const groupGap = Math.max(2, maxHeight * 0.045);
      let best = null;
      for (let scale = 1; scale >= 0.55; scale -= 0.05) {
        const primarySize = Math.max(8, Math.round(primaryBaseSize * scale * 10) / 10);
        const secondarySize = Math.max(7, Math.round(secondaryBaseSize * scale * 10) / 10);
        context.font = `700 ${primarySize}px "Pretendard Variable", sans-serif`;
        const primaryLines = wrapGearText(primaryName, maxWidth);
        context.font = `500 ${secondarySize}px "Pretendard Variable", sans-serif`;
        const secondaryLines = secondaryName ? wrapGearText(secondaryName, maxWidth) : [];
        const primaryLineHeight = primarySize * 1.14;
        const secondaryLineHeight = secondarySize * 1.12;
        const slotLineHeight = slotSize * 1.05;
        const height = slotLineHeight
          + groupGap
          + primaryLines.length * primaryLineHeight
          + (secondaryLines.length ? groupGap + secondaryLines.length * secondaryLineHeight : 0);
        best = { primaryLines, secondaryLines, primarySize, secondarySize, primaryLineHeight, secondaryLineHeight, slotLineHeight, groupGap, height };
        if (height <= maxHeight) return best;
      }
      return best;
    };
    const drawTextLines = (lines, x, top, { font, fillStyle, lineHeight, textAlign = "left" } = {}) => {
      if (!lines?.length) return;
      context.font = font;
      context.fillStyle = fillStyle;
      context.textAlign = textAlign;
      context.textBaseline = "alphabetic";
      lines.forEach((line, index) => context.fillText(line, x, top + lineHeight * index + parseFloat(font.match(/(\d+(?:\.\d+)?)px/u)?.[1] || "0")));
    };
    const drawTopAlignedTextLines = (lines, x, top, { font, fillStyle, lineHeight, textAlign = "left" } = {}) => {
      if (!lines?.length) return;
      context.font = font;
      context.fillStyle = fillStyle;
      context.textAlign = textAlign;
      context.textBaseline = "top";
      lines.forEach((line, index) => context.fillText(line, x, top + lineHeight * index));
    };
    const drawGearTile = (item, x, y, width, height, {
      textAlign = "left",
      noteIndex = 0,
      surfaceOnly = false,
      copyOnly = false,
      compositionItem = null,
      copyBounds = null,
      protectionBounds = null,
    } = {}) => {
      const padding = Math.max(10, Math.round(width * 0.045));
      const secondaryName = item.secondaryName;
      const slotSize = Math.max(9, Math.min(13, Math.round(height * 0.13)));
      const primarySize = Math.max(11, Math.min(17, Math.round(height * 0.18)));
      const secondarySize = Math.max(8, Math.min(11, Math.round(height * 0.11)));
      const textX = textAlign === "right" ? x + width - padding : x + padding;
      const collageTheme = state.backgroundPattern === "collage";
      const scrapbookTheme = state.backgroundPattern === "scrapbook";
      const paperNoteTheme = collageTheme || scrapbookTheme;
      const material = CardMaterialsModule?.get(state.backgroundPattern);
      const materialNote = CardMaterialsModule?.noteFor(state.backgroundPattern, noteIndex);
      const darkCopy = background?.tone === "dark" || exportTheme.text === "#f7f3ed";
      const copyInk = material?.ink || (darkCopy ? "#f7f3ed" : "#263238");
      const copyMuted = material?.mutedInk || (darkCopy ? "rgba(247, 243, 237, .68)" : "rgba(38, 50, 56, .68)");
      const copyEdge = collageTheme
        ? "rgba(63, 57, 51, .2)"
        : scrapbookTheme
          ? "rgba(41, 70, 80, .22)"
          : darkCopy ? "rgba(247, 243, 237, .24)" : "rgba(38, 50, 56, .18)";
      const protectedSurface = collageTheme
        ? "#f4e8d7"
        : scrapbookTheme
          ? "#f7f0e3"
          : darkCopy ? "#1d2228" : "#fffaf4";
      const plannedNote = Boolean(compositionItem);
      const noteRadius = Math.max(0, Number(compositionItem?.noteRadius ?? exportTheme.radius) || 0);
      const pathBuilder = () => {
        if (plannedNote) roundRect(x, y, width, height, noteRadius);
        else if (collageTheme) traceArchivePaper(context, x, y, width, height);
        else traceScrapbookNote(context, x, y, width, height);
      };
      const fillProtectedRegion = (bounds) => {
        const regionRadius = Math.min(noteRadius, bounds.width / 2, bounds.height / 2);
        context.save();
        roundRect(bounds.x, bounds.y, bounds.width, bounds.height, regionRadius);
        context.clip();
        context.fillStyle = paperNoteTheme ? (materialNote?.tint || protectedSurface) : protectedSurface;
        context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        context.restore();
      };
      context.save();
      if (!copyOnly && plannedNote && paperNoteTheme) {
        const tint = materialNote?.tint || protectedSurface;
        roundRect(x, y, width, height, noteRadius);
        context.fillStyle = tint;
        context.fill();
        roundRect(x, y, width, height, noteRadius);
        context.strokeStyle = copyEdge;
        context.lineWidth = 1;
        context.stroke();
      } else if (!copyOnly && plannedNote) {
        roundRect(x, y, width, height, noteRadius);
        context.fillStyle = protectedSurface;
        context.fill();
        roundRect(x, y, width, height, noteRadius);
        context.strokeStyle = copyEdge;
        context.lineWidth = 1;
        context.stroke();
      } else if (!copyOnly && paperNoteTheme) {
        drawMaterialNote(
          context,
          backgroundImage,
          pathBuilder,
          x,
          y,
          width,
          height,
          materialNote?.tint || (collageTheme ? "#f4e8d7" : "#f7f0e3"),
          collageTheme ? "rgba(67, 55, 43, .16)" : "rgba(48, 69, 75, .13)",
          collageTheme ? "rgba(67, 55, 43, .24)" : "rgba(48, 69, 75, .22)",
          CardMaterialsModule?.noteSourceRect(
            state.backgroundPattern,
            noteIndex,
            Number(backgroundImage?.naturalWidth || backgroundImage?.width || 0),
            Number(backgroundImage?.naturalHeight || backgroundImage?.height || 0),
          ),
        );
      } else if (!copyOnly) {
        roundRect(x, y, width, height, exportTheme.radius);
        context.fillStyle = exportTheme.panel;
        context.fill();
        context.strokeStyle = exportTheme.panelBorder;
        context.lineWidth = 2;
        context.stroke();
      }
      if (!copyOnly && paperNoteTheme && !plannedNote) {
        const tapeSpec = materialNote?.tape;
        const tapeLeft = tapeSpec ? tapeSpec.left / 100 : noteIndex % 3 === 1 ? 0.64 : noteIndex % 3 === 2 ? 0.52 : 0.16;
        const tapeWidthRatio = tapeSpec ? tapeSpec.width / 100 : noteIndex % 3 === 1 ? 0.21 : noteIndex % 3 === 2 ? 0.27 : 0.24;
        const tapeHeightRatio = tapeSpec ? tapeSpec.height / 100 : 0.12;
        const tapeX = x + width * tapeLeft;
        const tapeY = y - height * 0.07;
        const tapeWidth = Math.max(18, width * tapeWidthRatio);
        const tapeHeight = Math.max(5, height * tapeHeightRatio);
        drawMaterialTape(
          context,
          backgroundImage,
          tapeX,
          tapeY,
          tapeWidth,
          tapeHeight,
          tapeSpec?.color || "rgba(198, 213, 217, .72)",
          (tapeSpec?.rotation ?? (noteIndex % 2 ? 1 : -1)) * Math.PI / 180,
        );
        if (shouldDrawPatternStamp(state.backgroundPattern, isPortrait)) {
          if (collageTheme) {
            drawArchiveStamp(
              context,
              x + width * 0.84,
              y + height * 0.24,
              Math.max(12, Math.min(width, height) * 0.2),
              material?.stampInk || "rgba(77, 70, 62, .64)",
              (noteIndex % 3 - 1) * 0.12,
            );
          } else {
            drawEditorialMark(
              context,
              x + width * 0.82,
              y + height * 0.26,
              Math.max(12, width * 0.16),
              material?.stampInk || "rgba(52, 82, 91, .48)",
              (noteIndex % 2 ? 1 : -1) * 0.08,
            );
          }
        }
      }
      if (surfaceOnly) {
        context.restore();
        return;
      }
      const glyphBounds = copyBounds || compositionItem?.copyBounds || null;
      const safeBounds = protectionBounds || compositionItem?.protectionBounds || null;
      if (plannedNote && compositionItem?.copy && resolvedCompositionPlan?.effectiveLayer === "person-front"
        && resolvedCompositionPlan?.protectText && safeBounds) {
        fillProtectedRegion(safeBounds);
      }
      const capturedCopy = item.preview;
      if (capturedCopy?.primaryCopy?.lines?.length) {
        CardCopy.draw(context, [capturedCopy.slotCopy, capturedCopy.primaryCopy, capturedCopy.secondaryCopy].filter(Boolean));
      } else if (compositionItem?.copy && glyphBounds) {
        const copyPlan = compositionItem.copy;
        const textWidth = Math.max(1, glyphBounds.width);
        const glyphX = glyphBounds.x;
        const allLines = [];
        context.font = `700 ${copyPlan.primarySize}px "Pretendard Variable", sans-serif`;
        const primaryLines = wrapGearText(item.name || compositionItem.name, textWidth);
        context.font = `500 ${copyPlan.secondarySize || 0}px "Pretendard Variable", sans-serif`;
        const resolvedSecondaryName = item.secondaryName || compositionItem.secondaryName;
        const resolvedSlotName = item.slotName || compositionItem.slotName;
        const secondaryLines = resolvedSecondaryName ? wrapGearText(resolvedSecondaryName, textWidth) : [];
        context.font = `600 ${copyPlan.slotSize || 0}px "Pretendard Variable", sans-serif`;
        const slotLines = resolvedSlotName ? wrapGearText(resolvedSlotName, textWidth) : [];
        const totalHeight = slotLines.length * copyPlan.slotLineHeight
          + primaryLines.length * copyPlan.primaryLineHeight
          + secondaryLines.length * copyPlan.secondaryLineHeight
          + copyPlan.groupGap * ((slotLines.length ? 1 : 0) + (secondaryLines.length ? 1 : 0));
        if (slotLines.length) {
          allLines.push({ lines: slotLines, font: `600 ${copyPlan.slotSize}px "Pretendard Variable", sans-serif`, size: copyPlan.slotSize, height: copyPlan.slotLineHeight, color: copyMuted });
        }
        allLines.push({ lines: primaryLines, font: `700 ${copyPlan.primarySize}px "Pretendard Variable", sans-serif`, size: copyPlan.primarySize, height: copyPlan.primaryLineHeight, color: copyInk });
        if (secondaryLines.length) {
          allLines.push({ lines: secondaryLines, font: `500 ${copyPlan.secondarySize}px "Pretendard Variable", sans-serif`, size: copyPlan.secondarySize, height: copyPlan.secondaryLineHeight, color: copyMuted });
        }
        let currentTop = glyphBounds.y;
        allLines.forEach((group) => {
          drawTopAlignedTextLines(group.lines, glyphX, currentTop, {
            font: group.font,
            fillStyle: group.color,
            lineHeight: group.height,
            textAlign,
          });
          currentTop += group.lines.length * group.height + copyPlan.groupGap;
        });
      } else {
        const textWidth = Math.max(1, width - padding * 2);
        const copyTop = y + Math.round(height * 0.16);
        const copyHeight = Math.max(20, Math.round(height * 0.76));
        const copy = fitGearCopy({
          primaryName: item.name,
          secondaryName,
          maxWidth: textWidth,
          maxHeight: copyHeight,
          primaryBaseSize: primarySize,
          secondaryBaseSize: secondarySize,
          slotSize,
        });
        const totalHeight = Math.min(copy?.height || copyHeight, copyHeight);
        const slotTop = copyTop + Math.max(0, (copyHeight - totalHeight) / 2);
        const slotFont = `600 ${slotSize}px "Pretendard Variable", sans-serif`;
        const primaryFont = `700 ${copy?.primarySize || primarySize}px "Pretendard Variable", sans-serif`;
        const secondaryFont = `500 ${copy?.secondarySize || secondarySize}px "Pretendard Variable", sans-serif`;
        drawTextLines([item.slotName], textX, slotTop, {
          font: slotFont,
          fillStyle: paperNoteTheme ? "rgba(59, 64, 64, .68)" : exportTheme.muted,
          lineHeight: copy?.slotLineHeight || slotSize * 1.05,
          textAlign,
        });
        const primaryTop = slotTop + (copy?.slotLineHeight || slotSize * 1.05) + (copy?.groupGap || 3);
        drawTextLines(copy?.primaryLines || [item.name], textX, primaryTop, {
          font: primaryFont,
          fillStyle: paperNoteTheme ? "#3b4040" : exportTheme.text,
          lineHeight: copy?.primaryLineHeight || primarySize * 1.14,
          textAlign,
        });
        if (copy?.secondaryLines?.length) {
          const secondaryTop = primaryTop + copy.primaryLines.length * copy.primaryLineHeight + copy.groupGap;
          drawTextLines(copy.secondaryLines, textX, secondaryTop, {
            font: secondaryFont,
            fillStyle: paperNoteTheme ? "rgba(59, 64, 64, .62)" : exportTheme.muted,
            lineHeight: copy.secondaryLineHeight,
            textAlign,
          });
        }
      }
      context.restore();
    };

    const exportItems = gear[state.selectedCharacter] || [];
    const drawPortraitGear = () => CardLayout.portraitGearPositions({ singleLayout: state.singleLayout }).forEach((position, index) => {
      const item = exportItems[index];
      if (item && item.showOnCard !== false) drawGearTile(item, position.x, position.y, position.width, position.height, { noteIndex: index });
    });
    const drawLandscapeSoloGear = () => CardLayout.landscapeSoloGearPositions({ singleLayout: state.singleLayout }).forEach((position, index) => {
      const item = exportItems[index];
      if (item && item.showOnCard !== false) drawGearTile(item, position.x, position.y, position.width, position.height, { noteIndex: index });
    });
    const drawTwoPersonGear = () => {
      const rails = CardLayout.infoRails({ characterCount: state.characterCount });
      activeCharacters.slice(0, 2).forEach((character, characterIndex) => {
        const rail = rails[characterIndex];
        const items = gear[characterIndex] || [];
        items.forEach((item, itemIndex) => {
          if (!item || item.showOnCard === false) return;
          drawGearTile(
            item,
            rail.x,
            rail.y + itemIndex * (rail.itemHeight + rail.gap),
            rail.width,
            rail.itemHeight,
            { textAlign: rail.textAlign, noteIndex: itemIndex },
          );
        });
      });
    };

    const gearItemForPlan = (itemPlan) => {
      const sourceItem = gear?.[itemPlan.characterIndex]?.[itemPlan.gearIndex] || {};
      return {
        ...sourceItem,
        name: sourceItem.name || sourceItem.primaryName || itemPlan.name,
        secondaryName: sourceItem.secondaryName || itemPlan.secondaryName,
        slotName: sourceItem.slotName || sourceItem.slotLabel || itemPlan.slotName,
      };
    };
    const drawPlannedGear = ({ surfacesOnly = false, copyOnly = false } = {}) => {
      (resolvedCompositionPlan.items || []).forEach((itemPlan) => {
        const item = gearItemForPlan(itemPlan);
        drawGearTile(item, itemPlan.x, itemPlan.y, itemPlan.width, itemPlan.height, {
          noteIndex: itemPlan.gearIndex,
          textAlign: "left",
          surfaceOnly: surfacesOnly,
          copyOnly,
          compositionItem: itemPlan,
          copyBounds: itemPlan.copyBounds,
          protectionBounds: itemPlan.protectionBounds,
        });
      });
    };

    if (resolvedCompositionPlan.isCustom && resolvedCompositionPlan.effectiveLayer === "person-front") {
      drawPlannedGear({ surfacesOnly: true });
    }

    characterFrames.forEach((frame, index) => {
      drawCharacter(images[index], activeCharacters[index], frame.x, frame.y, frame.width, frame.height);
    });

    context.fillStyle = "rgba(255,255,255,.2)";
    for (let index = 0; index < layoutWidth; index += 27) {
      context.fillRect((index * 47) % layoutWidth, (index * 83) % layoutHeight, 1, 1);
    }

    // Legacy cards retain the exact existing order. Custom plans draw their
    // notes through the shared layout; `person-front` paints note material
    // before the subjects and the protected copy plane after them.
    if (resolvedCompositionPlan.isCustom) {
      drawPlannedGear({ copyOnly: resolvedCompositionPlan.effectiveLayer === "person-front" });
      CardCopy.draw(context, copyLayout);
    } else {
      // The preview renders this same high-resolution copy layer. Keeping the
      // text implementation behind one small interface prevents DOM and PNG
      // glyphs from drifting apart again.
      CardCopy.draw(context, copyLayout);

      if (state.characterCount === 1) {
        if (isPortrait) {
          drawPortraitGear();
        } else {
          drawLandscapeSoloGear();
        }
      } else if (state.characterCount === 2) {
        drawTwoPersonGear();
      } else if (state.multiInfoEnabled) {
        const columnWidth = layoutWidth / state.characterCount;
        context.textAlign = "center";
        activeCharacters.forEach((character, characterIndex) => {
          const items = gear[characterIndex] || [];
          const centerX = columnWidth * characterIndex + columnWidth / 2;
          const startY = 242;
          context.fillStyle = infoTextMuted;
          context.shadowColor = infoTextHalo;
          context.shadowBlur = 10;
          let itemY = startY;
          items.forEach((item) => {
            if (!item || item.showOnCard === false) return;
            const secondaryName = item.secondaryName;
            const preview = item.preview;
            const textX = preview?.x ?? centerX;
            if (preview?.primaryCopy?.lines?.length) {
              CardCopy.draw(context, [preview.primaryCopy, preview.secondaryCopy].filter(Boolean));
              const capturedLines = [
                ...(preview.primaryCopy.lines || []),
                ...(preview.secondaryCopy?.lines || []),
              ];
              const blockBottom = Math.max(...capturedLines.map((line) => line.y + line.height));
              itemY = Math.max(itemY, blockBottom + 4);
              return;
            }
            const textAlign = preview?.textAlign || "center";
            const primaryFont = preview?.primaryFont || `650 ${state.characterCount === 5 ? 12 : 14}px \"Pretendard Variable\", sans-serif`;
            const secondaryFont = preview?.secondaryFont || `500 ${state.characterCount === 5 ? 8 : 10}px \"Pretendard Variable\", sans-serif`;
            const primarySize = preview?.primarySize || Number.parseFloat(primaryFont.match(/(\d+(?:\.\d+)?)px/u)?.[1] || "14");
            const secondarySize = preview?.secondarySize || Number.parseFloat(secondaryFont.match(/(\d+(?:\.\d+)?)px/u)?.[1] || "10");
            const lineWidth = preview?.width || (preview ? Math.max(24, columnWidth * 0.86) : columnWidth - 24);
            const primaryLineHeight = primarySize * 1.14;
            const secondaryLineHeight = secondarySize * 1.12;
            context.font = primaryFont;
            const primaryLines = CardGearCopyModule.wrapText(item.name, (text) => context.measureText(text).width, lineWidth);
            const primaryY = preview?.primaryY ?? itemY;
            drawTopAlignedTextLines(primaryLines, textX, primaryY, {
              font: primaryFont,
              fillStyle: infoTextColor,
              lineHeight: primaryLineHeight,
              textAlign,
            });
            let blockBottom = primaryY + primaryLines.length * primaryLineHeight;
            if (secondaryName) {
              const secondaryY = preview?.secondaryY ?? blockBottom + Math.max(2, primarySize * 0.18);
              context.font = secondaryFont;
              const secondaryLines = CardGearCopyModule.wrapText(secondaryName, (text) => context.measureText(text).width, lineWidth);
              drawTopAlignedTextLines(secondaryLines, textX, secondaryY, {
                font: secondaryFont,
                fillStyle: infoTextMuted,
                lineHeight: secondaryLineHeight,
                textAlign,
              });
              blockBottom = secondaryY + secondaryLines.length * secondaryLineHeight;
            }
            itemY = Math.max(itemY, blockBottom + Math.max(4, primarySize * 0.35));
          });
        });
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
      }
    }

    const canvasBlob = (type, quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 변환 실패")), type, quality);
    });
    return canvasBlob("image/png");
}
return { render, shouldDrawPatternStamp };
})();
if (typeof module !== "undefined") module.exports = CardPng;
