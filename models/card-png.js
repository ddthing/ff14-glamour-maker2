/* PNG renderer: consumes resolved card data and decoded images only.
   It does not read editor state, DOM layout, storage, or item records. */
const CardGearCopyModule = typeof module !== "undefined" && module.exports
  ? require("./card-gear-copy.js")
  : typeof CardGearCopy !== "undefined" ? CardGearCopy : globalThis.CardGearCopy;
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
  const exportStrength = {
    dots: 0.16,
    stars: 0.2,
    halftone: 0.2,
    bitmap: 0.26,
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

function traceArchivePaper(context, x, y, width, height, variant = 0) {
  const edgeJitter = [0, 0.018, -0.012, 0.012, -0.008, 0.016, -0.014, 0.006];
  const top = [0.035, 0.012, 0.028, 0.004, 0.024, 0.008, 0.03, 0.014];
  const bottom = [0.978, 0.994, 0.982, 0.998, 0.976, 0.99, 0.98, 0.996];
  const right = [0.98, 0.996, 0.984, 0.998, 0.978, 0.992, 0.982, 0.995];
  const left = [0.02, 0.004, 0.018, 0.002, 0.022, 0.008, 0.018, 0.005];
  const points = [];
  for (let index = 0; index < 8; index += 1) {
    const offset = (index + variant) % edgeJitter.length;
    points.push([index / 7, top[index] + edgeJitter[offset]]);
  }
  for (let index = 7; index >= 0; index -= 1) {
    const offset = (index + variant + 2) % edgeJitter.length;
    points.push([right[index] + edgeJitter[offset], (index + 1) / 8]);
  }
  for (let index = 7; index >= 0; index -= 1) {
    const offset = (index + variant + 4) % edgeJitter.length;
    points.push([index / 7, bottom[index] + edgeJitter[offset]]);
  }
  for (let index = 0; index < 8; index += 1) {
    const offset = (index + variant + 6) % edgeJitter.length;
    points.push([left[index] + edgeJitter[offset], (7 - index) / 8]);
  }
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

function drawMaterialNote(context, image, pathBuilder, x, y, width, height, tint, shadowColor, borderColor) {
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
    context.globalAlpha = 0.68;
    drawCoverImage(context, image, x, y, width, height);
    context.globalAlpha = 0.24;
    context.fillStyle = tint;
    context.fillRect(x, y, width, height);
  }
  context.restore();
  context.save();
  pathBuilder();
  context.strokeStyle = borderColor;
  context.lineWidth = Math.max(1, width * 0.002);
  context.stroke();
  context.restore();
}

function drawMaterialTape(context, x, y, width, height, color, rotation = 0) {
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(rotation);
  context.translate(-(x + width / 2), -(y + height / 2));
  traceScrapbookTape(context, x, y, width, height);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = "rgba(78, 67, 55, .12)";
  context.lineWidth = Math.max(0.5, width * 0.0015);
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, .16)";
  context.lineWidth = Math.max(0.5, height * 0.08);
  for (let index = 1; index < 5; index += 1) {
    const lineX = x + (width * index) / 5;
    context.beginPath();
    context.moveTo(lineX, y + height * 0.17);
    context.lineTo(lineX + width * 0.015, y + height * 0.83);
    context.stroke();
  }
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

async function render({ state, dimensions, layout = null, exportTheme, background, textureInk = null, patternStars, images, backgroundImage = null, copyLayout, gear, outlineColor, placementScale = 1, infoTextColor = exportTheme.text, infoTextMuted = exportTheme.muted, infoTextHalo = exportTheme.infoShadow }) {
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const resolvedLayout = layout || CardLayout.layoutFor({
    characterCount: state.characterCount,
    singleRatio: dimensions.layoutHeight > dimensions.layoutWidth ? "portrait" : "landscape",
    singleLayout: state.singleLayout,
    characters: activeCharacters,
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
    const collageSlotColors = Object.freeze({
      head: "#7d96a5",
      body: "#a97778",
      hands: "#8b9b86",
      legs: "#b29467",
      feet: "#817b98",
      weapon: "#646b70",
      offhand: "#646b70",
    });
    const scrapbookSlotColors = Object.freeze({
      head: "#6f8790",
      body: "#9c6e63",
      hands: "#7f8d78",
      legs: "#b18457",
      feet: "#766b80",
      weapon: "#4d5b5d",
      offhand: "#4d5b5d",
    });
    const drawGearTile = (item, x, y, width, height, { textAlign = "left", noteIndex = 0 } = {}) => {
      const padding = Math.max(10, Math.round(width * 0.045));
      const secondaryName = item.secondaryName;
      const slotSize = Math.max(9, Math.min(13, Math.round(height * 0.13)));
      const primarySize = Math.max(11, Math.min(17, Math.round(height * 0.18)));
      const secondarySize = Math.max(8, Math.min(11, Math.round(height * 0.11)));
      const textX = textAlign === "right" ? x + width - padding : x + padding;
      const collageTheme = state.backgroundPattern === "collage";
      const scrapbookTheme = state.backgroundPattern === "scrapbook";
      const paperNoteTheme = collageTheme || scrapbookTheme;
      const material = typeof CardMaterials !== "undefined" ? CardMaterials.get(state.backgroundPattern) : null;
      const noteTints = material?.noteTints || (collageTheme
        ? ["#f4e8d7", "#e7ddd0", "#e9d7d0", "#e0e5d9"]
        : ["#f7f0e3", "#e7eef0", "#edf0e7", "#eef2f3"]);
      const tapeTints = material?.tapeTints || (collageTheme
        ? ["rgba(211, 181, 137, .78)", "rgba(165, 184, 181, .76)", "rgba(220, 193, 157, .74)"]
        : ["rgba(198, 213, 217, .72)", "rgba(219, 196, 164, .68)", "rgba(190, 205, 193, .72)"]);
      const pathBuilder = () => {
        if (collageTheme) traceArchivePaper(context, x, y, width, height, noteIndex);
        else traceScrapbookNote(context, x, y, width, height);
      };
      context.save();
      if (paperNoteTheme) {
        drawMaterialNote(
          context,
          backgroundImage,
          pathBuilder,
          x,
          y,
          width,
          height,
          noteTints[noteIndex % noteTints.length],
          collageTheme ? "rgba(67, 55, 43, .16)" : "rgba(48, 69, 75, .13)",
          collageTheme ? "rgba(67, 55, 43, .24)" : "rgba(48, 69, 75, .22)",
        );
      } else {
        roundRect(x, y, width, height, exportTheme.radius);
        context.fillStyle = exportTheme.panel;
        context.fill();
        context.strokeStyle = exportTheme.panelBorder;
        context.lineWidth = 2;
        context.stroke();
      }
      if (paperNoteTheme) {
        const tapeLeft = noteIndex % 3 === 1 ? 0.64 : noteIndex % 3 === 2 ? 0.52 : 0.16;
        const tapeWidthRatio = noteIndex % 3 === 1 ? 0.21 : noteIndex % 3 === 2 ? 0.27 : 0.24;
        const tapeX = x + Math.round(width * tapeLeft);
        const tapeY = y - Math.max(8, Math.round(height * 0.07));
        const tapeWidth = Math.max(18, Math.round(width * tapeWidthRatio));
        const tapeHeight = Math.max(5, Math.round(height * 0.12));
        drawMaterialTape(
          context,
          tapeX,
          tapeY,
          tapeWidth,
          tapeHeight,
          tapeTints[noteIndex % tapeTints.length],
          (noteIndex % 2 ? 1 : -1) * Math.PI / 180,
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
      const capturedCopy = item.preview;
      if (capturedCopy?.primaryCopy?.lines?.length) {
        CardCopy.draw(context, [capturedCopy.slotCopy, capturedCopy.primaryCopy, capturedCopy.secondaryCopy].filter(Boolean));
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
      if (item) drawGearTile(item, position.x, position.y, position.width, position.height, { noteIndex: index });
    });
    const drawLandscapeSoloGear = () => CardLayout.landscapeSoloGearPositions({ singleLayout: state.singleLayout }).forEach((position, index) => {
      const item = exportItems[index];
      if (item) drawGearTile(item, position.x, position.y, position.width, position.height, { noteIndex: index });
    });
    const drawTwoPersonGear = () => {
      const rails = CardLayout.infoRails({ characterCount: state.characterCount });
      activeCharacters.slice(0, 2).forEach((character, characterIndex) => {
        const rail = rails[characterIndex];
        const items = gear[characterIndex] || [];
        items.forEach((item, itemIndex) => {
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

    characterFrames.forEach((frame, index) => {
      drawCharacter(images[index], activeCharacters[index], frame.x, frame.y, frame.width, frame.height);
    });

    context.fillStyle = "rgba(255,255,255,.2)";
    for (let index = 0; index < layoutWidth; index += 27) {
      context.fillRect((index * 47) % layoutWidth, (index * 83) % layoutHeight, 1, 1);
    }

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

    const canvasBlob = (type, quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 변환 실패")), type, quality);
    });
    return canvasBlob("image/png");
}
return { render, shouldDrawPatternStamp };
})();
if (typeof module !== "undefined") module.exports = CardPng;
