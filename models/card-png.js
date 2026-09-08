/* PNG renderer: consumes resolved card data and decoded images only.
   It does not read editor state, DOM layout, storage, or item records. */
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

function drawExportPattern(context, width, height, background, snapshot, patternStars) {
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
    const clusters = [
      [width * 0.08, height * 0.22, Math.min(width, height) * 0.34],
      [width * 0.92, height * 0.78, Math.min(width, height) * 0.3],
    ];
    clusters.forEach(([centerX, centerY, radius]) => {
      const step = Math.max(8, Math.min(width, height) / 78);
      for (let y = centerY - radius; y <= centerY + radius; y += step) {
        for (let x = centerX - radius; x <= centerX + radius; x += step) {
          const distance = Math.hypot(x - centerX, y - centerY) / radius;
          if (distance > 1) continue;
          const dotRadius = Math.max(0.35, step * 0.2 * (1 - distance));
          context.globalAlpha = strength * Math.max(0.08, 1 - distance);
          context.fillStyle = ink;
          context.beginPath();
          context.arc(x, y, dotRadius, 0, Math.PI * 2);
          context.fill();
        }
      }
    });
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
    // The legacy bitmap key now renders as a deliberate checkerboard. Keep
    // the tile size in the same card-coordinate scale as the CSS preview.
    const square = Math.max(18, width / 60);
    for (let row = 0, y = 0; y < height; row += 1, y += square) {
      for (let column = 0, x = 0; x < width; column += 1, x += square) {
        context.globalAlpha = strength;
        context.fillStyle = (row + column) % 2 ? ink : light;
        context.fillRect(Math.floor(x), Math.floor(y), Math.ceil(square), Math.ceil(square));
      }
    }
  }

  if (state.backgroundTexture === "grain") {
    const grainCount = Math.round((width * height) / 250);
    for (let index = 0; index < grainCount; index += 1) {
      const seed = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
      const random = seed - Math.floor(seed);
      const secondSeed = Math.sin(index * 4.1414 + 19.19) * 15731.743;
      const secondRandom = secondSeed - Math.floor(secondSeed);
      context.globalAlpha = 0.1 * (0.25 + random * 0.75);
      context.fillStyle = index % 5 === 0 ? light : ink;
      context.fillRect(
        Math.floor(secondRandom * width),
        Math.floor(random * height),
        random > 0.72 ? 1.4 : 0.8,
        random > 0.72 ? 1.4 : 0.8,
      );
    }
  }

  if (state.backgroundPattern === "stars") {
    patternStars.forEach(({ x, y, size, rotate, tone, opacity }) => {
      context.save();
      context.translate((x / 100) * width, (y / 100) * height);
      context.rotate((rotate * Math.PI) / 180);
      context.globalAlpha = strength * opacity;
      context.fillStyle = tone === "light" ? light : ink;
      traceFivePointStar(context, ((size / 100) * width) / 2);
      context.fill();
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

function traceScrapbookTape(context, x, y, width, height) {
  context.beginPath();
  context.moveTo(x + width * 0.01, y + height * 0.08);
  context.lineTo(x + width * 0.98, y);
  context.lineTo(x + width, y + height * 0.91);
  context.lineTo(x + width * 0.03, y + height);
  context.closePath();
}

function drawExportBackground(context, width, height, background, backgroundImage) {
  context.save();
  context.fillStyle = background.solid;
  context.fillRect(0, 0, width, height);
  if (backgroundImage) drawCoverImage(context, backgroundImage, 0, 0, width, height);
  context.restore();
}

async function render({ state, dimensions, exportTheme, background, patternStars, images, backgroundImage = null, copyLayout, gear, outlineColor, placementScale = 1, infoTextColor = exportTheme.text, infoTextMuted = exportTheme.muted, infoTextHalo = exportTheme.infoShadow }) {
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const isPortrait = dimensions.layoutHeight > dimensions.layoutWidth;
    const characterFrames = CardLayout.characterFrames({
      characterCount: state.characterCount,
      singleRatio: isPortrait ? "portrait" : "landscape",
      singleLayout: state.singleLayout,
      characters: activeCharacters,
    });
    const { layoutWidth, layoutHeight, exportWidth, exportHeight } = dimensions;
    const outputScale = CardCopy.outputScale;
    const resolvedPlacementScale = Number.isFinite(placementScale) && placementScale > 0 ? placementScale : 1;
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    context.scale(outputScale, outputScale);
    drawExportBackground(context, layoutWidth, layoutHeight, background, backgroundImage);
    drawExportPattern(context, layoutWidth, layoutHeight, background, state, patternStars);

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
    const fitText = (value, maxWidth) => {
      if (context.measureText(value).width <= maxWidth) return value;
      let shortened = value;
      while (shortened.length > 1 && context.measureText(shortened + "…").width > maxWidth) shortened = shortened.slice(0, -1);
      return shortened + "…";
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
      context.save();
      if (collageTheme) {
        roundRect(x + 4, y + 5, width, height, 4);
        context.fillStyle = "rgba(65, 52, 40, .13)";
        context.fill();
        roundRect(x, y, width, height, 4);
        context.fillStyle = "#fffaf1";
      } else if (scrapbookTheme) {
        traceScrapbookNote(context, x + 5, y + 6, width, height);
        context.fillStyle = "rgba(48, 69, 75, .14)";
        context.fill();
        traceScrapbookNote(context, x, y, width, height);
        context.fillStyle = noteIndex % 3 === 1 ? "#eef1ed" : noteIndex % 3 === 2 ? "#f2e5d7" : "#f7f0e3";
      } else {
        roundRect(x, y, width, height, exportTheme.radius);
        context.fillStyle = exportTheme.panel;
      }
      context.fill();
      context.strokeStyle = paperNoteTheme ? "rgba(48, 69, 75, .25)" : exportTheme.panelBorder;
      context.lineWidth = 2;
      context.stroke();
      if (paperNoteTheme) {
        context.fillStyle = scrapbookTheme
          ? scrapbookSlotColors[item.slot] || "#6f8790"
          : collageSlotColors[item.slot] || "#82909a";
        if (scrapbookTheme) {
          context.fillRect(x, y, Math.max(5, Math.round(width * 0.016)), height);
        } else {
          context.fillRect(x, y, width, Math.max(4, Math.round(height * 0.045)));
        }
      }
      if (collageTheme) {
        const tapeX = x + Math.round(width * 0.37);
        const tapeY = y - Math.max(2, Math.round(height * 0.03));
        const tapeWidth = Math.max(18, Math.round(width * 0.25));
        const tapeHeight = Math.max(4, Math.round(height * 0.1));
        context.fillStyle = "rgba(215, 196, 164, .72)";
        context.fillRect(tapeX, tapeY, tapeWidth, tapeHeight);
        context.strokeStyle = "rgba(92, 74, 54, .08)";
        context.lineWidth = 1;
        context.strokeRect(tapeX + 0.5, tapeY + 0.5, tapeWidth - 1, tapeHeight - 1);
      }
      if (scrapbookTheme) {
        const tapeLeft = noteIndex % 3 === 1 ? 0.64 : noteIndex % 3 === 2 ? 0.52 : 0.16;
        const tapeWidthRatio = noteIndex % 3 === 1 ? 0.21 : noteIndex % 3 === 2 ? 0.27 : 0.24;
        context.fillStyle = noteIndex % 2 === 1 ? "rgba(194, 205, 195, .78)" : "rgba(215, 187, 141, .72)";
        const tapeX = x + Math.round(width * tapeLeft);
        // Let the tape cross the paper edge: part of it is above the note and
        // the rest visibly presses onto the surface, matching the live CSS.
        const tapeY = y - Math.max(8, Math.round(height * 0.07));
        const tapeWidth = Math.max(18, Math.round(width * tapeWidthRatio));
        const tapeHeight = Math.max(5, Math.round(height * 0.12));
        traceScrapbookTape(context, tapeX, tapeY, tapeWidth, tapeHeight);
        context.fill();
      }
      context.fillStyle = paperNoteTheme ? "rgba(59, 64, 64, .68)" : exportTheme.muted;
      context.font = `600 ${slotSize}px "Pretendard Variable", sans-serif`;
      const slotWidth = context.measureText(item.slotName).width;
      const slotLineWidth = Math.max(14, Math.round(width * 0.08));
      const slotLineX = textAlign === "right"
        ? textX - slotWidth - Math.max(4, Math.round(slotSize * 0.55)) - slotLineWidth
        : textX;
      if (!scrapbookTheme) context.fillRect(slotLineX, y + Math.round(height * 0.22), slotLineWidth, 2);
      context.textAlign = textAlign;
      context.fillText(item.slotName, textX, y + Math.round(height * 0.38));
      context.fillStyle = paperNoteTheme ? "#3b4040" : exportTheme.text;
      context.font = `700 ${primarySize}px "Pretendard Variable", sans-serif`;
      const primaryY = y + Math.round(height * (secondaryName ? 0.64 : 0.72));
      context.fillText(fitText(item.name, width - padding * 2), textX, primaryY);
      if (secondaryName) {
        context.fillStyle = paperNoteTheme ? "rgba(59, 64, 64, .62)" : exportTheme.muted;
        context.font = `500 ${secondarySize}px "Pretendard Variable", sans-serif`;
        context.fillText(fitText(secondaryName, width - padding * 2), textX, y + Math.round(height * 0.84));
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
          context.fillStyle = infoTextColor;
          context.font = `650 ${state.characterCount === 5 ? 12 : 14}px \"Pretendard Variable\", sans-serif`;
          context.fillText(fitText(item.name, columnWidth - 24), centerX, itemY);
          if (secondaryName) {
            context.fillStyle = infoTextMuted;
            context.font = `500 ${state.characterCount === 5 ? 8 : 10}px \"Pretendard Variable\", sans-serif`;
            context.fillText(fitText(secondaryName, columnWidth - 24), centerX, itemY + 14);
            itemY += 34;
          } else {
            itemY += 23;
          }
        });
      });
      context.shadowColor = "transparent";
      context.shadowBlur = 0;
      context.textAlign = "left";
    }

    const canvasBlob = (type, quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 변환 실패")), type, quality);
    });
    return canvasBlob("image/png");
}
return { render };
})();
if (typeof module !== "undefined") module.exports = CardPng;
