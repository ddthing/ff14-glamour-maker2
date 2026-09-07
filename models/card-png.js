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
    bitmap: 0.18,
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
    const clusters = [
      [width * 0.12, height * 0.18, width * 0.31, height * 0.22],
      [width * 0.66, height * 0.68, width * 0.38, height * 0.24],
    ];
    clusters.forEach(([left, top, clusterWidth, clusterHeight], clusterIndex) => {
      const step = Math.max(8, width / 118);
      for (let y = top; y < top + clusterHeight; y += step) {
        for (let x = left; x < left + clusterWidth; x += step) {
          const edge = Math.min(x - left, left + clusterWidth - x, y - top, top + clusterHeight - y);
          const fade = Math.min(1, Math.max(0, edge / (step * 3)));
          if (fade <= 0 || (Math.round(x / step) + Math.round(y / step) + clusterIndex) % 5 === 0) continue;
          context.globalAlpha = strength * fade * (0.65 + ((Math.round(x / step) + Math.round(y / step)) % 3) * 0.12);
          context.fillStyle = (Math.round(x / step) + Math.round(y / step)) % 2 ? ink : light;
          context.fillRect(Math.floor(x), Math.floor(y), Math.max(2, step * 0.42), Math.max(2, step * 0.42));
        }
      }
    });
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

function drawExportBackground(context, width, height, background) {
  context.save();
  context.fillStyle = background.solid;
  context.fillRect(0, 0, width, height);
  context.restore();
}

async function render({ state, dimensions, exportTheme, background, patternStars, images, copyLayout, gear, outlineColor }) {
  const activeCharacters = state.characters.slice(0, state.characterCount);
  const isPortrait = dimensions.layoutHeight > dimensions.layoutWidth;
    const { layoutWidth, layoutHeight, exportWidth, exportHeight } = dimensions;
    const outputScale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    context.scale(outputScale, outputScale);
    drawExportBackground(context, layoutWidth, layoutHeight, background);
    drawExportPattern(context, layoutWidth, layoutHeight, background, state, patternStars);

    const roundRect = (x, y, width, height, radius) => {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
    };
    const drawPlacedImage = (image, character, x, y, width, height) => {
      const placement = character;
      const fitScale = placement.imageFit === "cover"
        ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
        : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const scale = fitScale * (placement.zoom / 100);
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      const imageX = x + (width - imageWidth) / 2 + placement.panX * 2;
      const imageY = placement.imageFit === "cover"
        ? y + (height - imageHeight) / 2 + placement.panY * 2
        : y + height - imageHeight + placement.panY * 2;
      context.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    };
    const drawCharacter = (image, character, x, y, width, height) => {
      context.save();
      const informationMode = state.characterCount >= 3 && state.multiInfoEnabled;
      if (informationMode) {
        context.globalAlpha = state.multiInfoMode === "silhouette" && character.cutout ? 0.72 : 0.48;
        context.filter = state.multiInfoMode === "silhouette" && character.cutout
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
      const placement = character;
      const fitScale = placement.imageFit === "cover"
        ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
        : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const imageScale = fitScale * (placement.zoom / 100);
      const imageW = image.naturalWidth * imageScale;
      const imageH = image.naturalHeight * imageScale;
      const imageX = x + (width - imageW) / 2 + placement.panX * 2;
      const imageY = placement.imageFit === "cover"
        ? y + (height - imageH) / 2 + placement.panY * 2
        : y + height - imageH + placement.panY * 2;
      const outline = state.outline.width * 2;
      const characterTreatment = informationMode
        ? state.multiInfoMode === "silhouette" ? "brightness(0)" : "grayscale(82%) saturate(35%) contrast(86%) brightness(108%)"
        : "";
      context.filter = `${outline ? `drop-shadow(${outline}px 0 0 ${outlineColor}) drop-shadow(-${outline}px 0 0 ${outlineColor})` : ""} drop-shadow(${state.shadow.x * 2}px ${state.shadow.y * 2}px ${state.shadow.blur * 2}px rgba(10,11,18,${state.shadow.strength / 100})) ${characterTreatment}`.trim();
      context.drawImage(image, imageX, imageY, imageW, imageH);
      context.restore();
    };
    const fitText = (value, maxWidth) => {
      if (context.measureText(value).width <= maxWidth) return value;
      let shortened = value;
      while (shortened.length > 1 && context.measureText(shortened + "…").width > maxWidth) shortened = shortened.slice(0, -1);
      return shortened + "…";
    };
    const drawGearTile = (item, x, y, width, height) => {
      const padding = Math.max(10, Math.round(width * 0.045));
      const secondaryName = item.secondaryName;
      const slotSize = Math.max(9, Math.min(13, Math.round(height * 0.13)));
      const primarySize = Math.max(11, Math.min(17, Math.round(height * 0.18)));
      const secondarySize = Math.max(8, Math.min(11, Math.round(height * 0.11)));
      context.save();
      roundRect(x, y, width, height, exportTheme.radius);
      context.fillStyle = exportTheme.panel;
      context.fill();
      context.strokeStyle = exportTheme.panelBorder;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = exportTheme.muted;
      context.fillRect(x + padding, y + Math.round(height * 0.22), Math.max(14, Math.round(width * 0.08)), 2);
      context.font = `600 ${slotSize}px "Pretendard Variable", sans-serif`;
      context.fillText(item.slotName, x + padding, y + Math.round(height * 0.38));
      context.fillStyle = exportTheme.text;
      context.font = `700 ${primarySize}px "Pretendard Variable", sans-serif`;
      const primaryY = y + Math.round(height * (secondaryName ? 0.64 : 0.72));
      context.fillText(fitText(item.name, width - padding * 2), x + padding, primaryY);
      if (secondaryName) {
        context.fillStyle = exportTheme.muted;
        context.font = `500 ${secondarySize}px "Pretendard Variable", sans-serif`;
        context.fillText(fitText(secondaryName, width - padding * 2), x + padding, y + Math.round(height * 0.84));
      }
      context.restore();
    };

    const exportItems = gear[state.selectedCharacter] || [];
    const portraitGearPositions = () => {
      const base = [
        [34, 300, 370, 116],
        [676, 442, 370, 116],
        [34, 642, 370, 116],
        [676, 850, 370, 116],
        [34, 1060, 370, 116],
      ];
      return state.singleLayout === "info-right"
        ? base.map(([x, y, width, height]) => [layoutWidth - x - width, y, width, height])
        : base;
    };
    const drawPortraitGear = () => portraitGearPositions().forEach((position, index) => {
      const item = exportItems[index];
      if (item) drawGearTile(item, ...position);
    });
    const drawTwoPersonGear = () => {
      const railX = [24, 930];
      const railWidth = 246;
      const itemTop = 150;
      const itemHeight = 82;
      const itemGap = 6;
      activeCharacters.slice(0, 2).forEach((character, characterIndex) => {
        const items = gear[characterIndex] || [];
        const x = railX[characterIndex];
        items.forEach((item, itemIndex) => {
          drawGearTile(item, x, itemTop + itemIndex * (itemHeight + itemGap), railWidth, itemHeight);
        });
      });
    };

    const isLineup = state.characterCount >= 3;
    const hasFullFrameSource = activeCharacters.some((character) => !character.cutout);
    const figureTop = isLineup && hasFullFrameSource ? 0 : 142;
    const figureBottom = isLineup
      ? hasFullFrameSource ? layoutHeight : layoutHeight - 14
      : 640;
    if (state.characterCount === 1) {
      if (isPortrait) {
        drawCharacter(images[0], activeCharacters[0], 95, 150, 890, 1180);
      } else {
        const characterX = state.singleLayout === "info-right" ? 18 : 362;
        drawCharacter(images[0], activeCharacters[0], characterX, 108, 820, 532);
      }
    } else if (state.characterCount === 2) {
      drawCharacter(images[0], activeCharacters[0], 210, figureTop, 390, figureBottom - figureTop);
      drawCharacter(images[1], activeCharacters[1], 600, figureTop, 390, figureBottom - figureTop);
    } else {
      const lineupWidth = layoutWidth / state.characterCount;
      images.forEach((image, index) => drawCharacter(image, activeCharacters[index], lineupWidth * index, figureTop, lineupWidth, figureBottom - figureTop));
    }

    context.fillStyle = "rgba(255,255,255,.2)";
    for (let index = 0; index < layoutWidth; index += 27) {
      context.fillRect((index * 47) % layoutWidth, (index * 83) % layoutHeight, 1, 1);
    }

    // Paint the same line geometry captured from the visible card, including
    // wrapped copy and the outline's scale, instead of a second title recipe.
    for (const copy of copyLayout) {
      context.save(); context.globalAlpha = Number.isFinite(copy.opacity) ? copy.opacity : 1;
      context.textAlign = "left"; context.textBaseline = "alphabetic";
      context.font = copy.font; context.fillStyle = copy.color;
      context.letterSpacing = `${copy.letterSpacing}px`;
      context.lineJoin = "round"; context.lineWidth = copy.stroke; context.strokeStyle = copy.strokeColor;
      for (const line of copy.lines) {
        const metrics = context.measureText(line.text);
        const baseline = line.y + line.height - (metrics.fontBoundingBoxDescent || 0);
        if (copy.stroke) context.strokeText(line.text, line.x, baseline);
        context.fillText(line.text, line.x, baseline);
      }
      context.restore();
    }

    if (state.characterCount === 1) {
      if (isPortrait) {
        drawPortraitGear();
      } else {
        const informationX = state.singleLayout === "info-right" ? 816 : 24;
        const positions = [170, 262, 354, 446, 538].map((y) => [informationX, y, 360, 82]);
        exportItems.forEach((item, index) => drawGearTile(item, ...positions[index]));
      }
    } else if (state.characterCount === 2) {
      drawTwoPersonGear();
    } else if (state.multiInfoEnabled) {
      const columnWidth = layoutWidth / state.characterCount;
      context.textAlign = "center";
      activeCharacters.forEach((character, characterIndex) => {
        const items = gear[characterIndex] || [];
        const shownItems = state.infoDensity === "summary" ? items.slice(0, 3) : items;
        const centerX = columnWidth * characterIndex + columnWidth / 2;
        const startY = state.infoDensity === "summary" ? 274 : 242;
        context.fillStyle = exportTheme.muted;
        context.shadowColor = exportTheme.infoShadow;
        context.shadowBlur = 10;
        let itemY = startY;
        shownItems.forEach((item) => {
          const secondaryName = item.secondaryName;
          context.fillStyle = exportTheme.text;
          context.font = `650 ${state.characterCount === 5 ? 12 : 14}px \"Pretendard Variable\", sans-serif`;
          context.fillText(fitText(item.name, columnWidth - 24), centerX, itemY);
          if (secondaryName) {
            context.fillStyle = exportTheme.muted;
            context.font = `500 ${state.characterCount === 5 ? 8 : 10}px \"Pretendard Variable\", sans-serif`;
            context.fillText(fitText(secondaryName, columnWidth - 24), centerX, itemY + 14);
            itemY += 34;
          } else {
            itemY += 23;
          }
        });
        if (state.infoDensity === "summary" && items.length > 3) {
          context.fillStyle = exportTheme.muted;
          context.font = "600 10px Consolas, monospace";
          context.fillText(`+${items.length - 3} ITEMS`, centerX, itemY + 3);
        }
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
