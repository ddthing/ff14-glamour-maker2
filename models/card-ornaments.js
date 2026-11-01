/* Shared, deterministic artwork layer for the live card and PNG renderer. */
const CardOrnaments = (() => {
  const PAPER_FALLBACK = "#fffaf4";
  const ACCENT_FALLBACK = "#d9b5c6";
  const DRAWN_PATTERNS = new Set(["halftone", "stripes", "plaid"]);
  const PANEL_SHAPES = new Set(["heart", "flower", "scallop"]);

  function boundedNumber(value, fallback, minimum, maximum) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
  }

  function hexColor(value, fallback) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value)
      ? value.toLowerCase()
      : fallback;
  }

  function artSettings(plan) {
    const source = plan?.art && typeof plan.art === "object" ? plan.art : {};
    return {
      enabled: source.enabled === true,
      badge: PANEL_SHAPES.has(source.badge) ? source.badge : "none",
      ornaments: boundedNumber(source.ornaments, 0, 0, 100),
      accentColor: hexColor(source.accentColor, ACCENT_FALLBACK),
      paperColor: hexColor(source.paperColor, PAPER_FALLBACK),
      patternScale: boundedNumber(source.patternScale, 100, 40, 160),
      patternOpacity: boundedNumber(source.patternOpacity, 18, 0, 60),
      density: boundedNumber(source.density, 50, 0, 100),
    };
  }

  function rgbForHex(hex) {
    const value = hex.slice(1);
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  }

  function luminance(hex) {
    const [red, green, blue] = rgbForHex(hex).map((channel) => {
      const encoded = channel / 255;
      return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function rgba(hex, alpha) {
    const [red, green, blue] = rgbForHex(hex);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function paletteFor(value = {}) {
    const source = value?.art && typeof value.art === "object" ? value.art : value;
    const paper = hexColor(source?.paperColor, PAPER_FALLBACK);
    const accent = hexColor(source?.accentColor, ACCENT_FALLBACK);
    const ink = luminance(paper) <= 0.179 ? "#ffffff" : "#111111";
    const muted = ink === "#ffffff" ? "rgba(255, 255, 255, .72)" : "rgba(17, 17, 17, .68)";
    return Object.freeze({
      paper,
      ink,
      muted,
      border: rgba(accent, 0.5),
    });
  }

  function validRect(value) {
    if (!value || typeof value !== "object") return null;
    const x = Number(value.x);
    const y = Number(value.y);
    const width = Number(value.width);
    const height = Number(value.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  function rectsFrom(value) {
    if (!Array.isArray(value)) return [];
    return value.map(validRect).filter(Boolean);
  }

  function planExclusions(plan) {
    const exclusions = [];
    const header = validRect(plan?.header);
    if (header && plan.header.hidden !== true) exclusions.push(header);
    exclusions.push(...rectsFrom(plan?.imageRects));
    exclusions.push(...rectsFrom(plan?.frames));
    exclusions.push(...rectsFrom(plan?.artFrames));
    exclusions.push(...rectsFrom(plan?.protectedZones));
    (Array.isArray(plan?.items) ? plan.items : []).forEach((item) => {
      const copy = validRect(item?.copyBounds || item?.protectionBounds || item);
      if (copy) exclusions.push(copy);
    });
    (Array.isArray(plan?.groupPanels) ? plan.groupPanels : []).forEach((panel) => {
      const rect = validRect(panel);
      if (rect) exclusions.push(rect);
    });
    return exclusions;
  }

  function overlaps(first, second) {
    return first.x < second.x + second.width
      && first.x + first.width > second.x
      && first.y < second.y + second.height
      && first.y + first.height > second.y;
  }

  function traceHeart(context, rect) {
    const { x, y, width, height } = rect;
    const centerX = x + width / 2;
    context.beginPath();
    context.moveTo(centerX, y + height * 0.91);
    context.bezierCurveTo(x + width * 0.38, y + height * 0.79, x + width * 0.02, y + height * 0.56, x + width * 0.04, y + height * 0.33);
    context.bezierCurveTo(x + width * 0.06, y + height * 0.08, x + width * 0.39, y + height * 0.05, centerX, y + height * 0.28);
    context.bezierCurveTo(x + width * 0.61, y + height * 0.05, x + width * 0.94, y + height * 0.08, x + width * 0.96, y + height * 0.33);
    context.bezierCurveTo(x + width * 0.98, y + height * 0.56, x + width * 0.62, y + height * 0.79, centerX, y + height * 0.91);
    context.closePath();
  }

  function traceRoundPolygon(context, points) {
    if (!points.length) return;
    context.beginPath();
    const first = points[0];
    const last = points[points.length - 1];
    context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    });
    context.closePath();
  }

  function traceFlower(context, rect) {
    const { x, y, width, height } = rect;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width * 0.49;
    const radiusY = height * 0.49;
    const points = Array.from({ length: 32 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 32;
      const radius = index % 4 < 2 ? 0.9 : 1;
      return {
        x: centerX + Math.cos(angle) * radiusX * radius,
        y: centerY + Math.sin(angle) * radiusY * radius,
      };
    });
    traceRoundPolygon(context, points);
  }

  function traceScallop(context, rect) {
    const { x, y, width, height } = rect;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width * 0.49;
    const radiusY = height * 0.49;
    const points = Array.from({ length: 40 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 40;
      const ripple = 0.935 + 0.065 * Math.cos(angle * 10);
      return {
        x: centerX + Math.cos(angle) * radiusX * ripple,
        y: centerY + Math.sin(angle) * radiusY * ripple,
      };
    });
    traceRoundPolygon(context, points);
  }

  function tracePanel(context, rect, shape) {
    if (shape === "heart") traceHeart(context, rect);
    else if (shape === "flower") traceFlower(context, rect);
    else if (shape === "scallop") traceScallop(context, rect);
    else return false;
    return true;
  }

  function isFooterLayout(plan) {
    return ["footer", "effectiveFooter"].includes(plan?.effectiveLayout)
      || ["footer", "effectiveFooter"].includes(plan?.art?.effectiveLayout)
      || ["footer", "effectiveFooter"].includes(plan?.art?.layout);
  }

  function drawPanels(context, plan, art) {
    if (!isFooterLayout(plan) || !Array.isArray(plan?.groupPanels) || !plan.groupPanels.length) return 0;
    const shapeFallback = art.badge;
    let drawn = 0;
    plan.groupPanels.forEach((panel) => {
      const rect = validRect(panel);
      if (!rect) return;
      const shape = PANEL_SHAPES.has(panel.shape) ? panel.shape : shapeFallback;
      if (!PANEL_SHAPES.has(shape)) return;
      const inset = Math.min(rect.width, rect.height) * 0.02;
      const drawRect = {
        x: rect.x + inset,
        y: rect.y + inset,
        width: Math.max(1, rect.width - inset * 2),
        height: Math.max(1, rect.height - inset * 2),
      };
      context.save();
      context.globalAlpha *= 0.97;
      tracePanel(context, drawRect, shape);
      context.fillStyle = art.paperColor;
      context.fill();
      context.globalAlpha *= 0.76;
      context.strokeStyle = art.accentColor;
      context.lineWidth = Math.max(1, Math.min(rect.width, rect.height) * 0.008);
      context.stroke();
      context.restore();
      drawn += 1;
    });
    return drawn;
  }

  function patternColors(background) {
    const colors = Array.isArray(background?.pattern) ? background.pattern : [];
    return [hexColor(colors[0], "#687a86"), hexColor(colors[1], "#ffffff")];
  }

  function drawPattern(context, dimensions, pattern, background, art) {
    if (!DRAWN_PATTERNS.has(pattern)) return false;
    const width = Number(dimensions?.layoutWidth);
    const height = Number(dimensions?.layoutHeight);
    if (!(width > 0 && height > 0)) return false;
    const scale = art.patternScale / 100;
    const opacity = art.patternOpacity / 100;
    if (opacity <= 0) return true;
    const [ink, light] = patternColors(background);
    const baseCell = pattern === "stripes" ? 36 : pattern === "plaid" ? 74 : Math.max(24, Math.min(80, width / 15));
    const cell = Math.max(8, baseCell * scale);
    context.save();
    if (pattern === "stripes") {
      context.fillStyle = ink;
      context.globalAlpha *= opacity * 0.78;
      const band = Math.max(1, cell * 0.12);
      for (let x = 0; x < width; x += cell) context.fillRect(x, 0, band, height);
      context.globalAlpha *= 0.3;
      context.fillStyle = light;
      for (let x = cell * 0.52; x < width; x += cell) context.fillRect(x, 0, Math.max(1, band * 0.45), height);
    } else {
      const band = cell * (pattern === "plaid" ? 0.2 : 0.38);
      context.fillStyle = ink;
      context.globalAlpha *= opacity * (pattern === "plaid" ? 0.52 : 0.52);
      for (let x = 0; x < width; x += cell) context.fillRect(x, 0, band, height);
      for (let y = 0; y < height; y += cell) context.fillRect(0, y, width, band);
      if (pattern === "plaid") {
        context.save();
        context.fillStyle = light;
        context.globalAlpha *= 0.34;
        const threadBand = Math.max(1, band * 0.1);
        for (let x = cell * 0.47; x < width; x += cell) context.fillRect(x, 0, threadBand, height);
        for (let y = cell * 0.47; y < height; y += cell) context.fillRect(0, y, width, threadBand);
        context.restore();

        context.save();
        context.fillStyle = art.accentColor;
        context.globalAlpha *= 0.34 + art.density / 100 * 0.5;
        const accentBand = Math.max(1, cell * 0.035);
        const accentOffset = cell * 0.69;
        for (let x = accentOffset; x < width; x += cell) context.fillRect(x, 0, accentBand, height);
        for (let y = accentOffset; y < height; y += cell) context.fillRect(0, y, width, accentBand);
        context.restore();
      }
    }
    context.restore();
    return true;
  }

  function traceStar(context, radius) {
    context.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const pointRadius = index % 2 === 0 ? radius : radius * 0.43;
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }

  function safeCandidate(rect, exclusions, width, height) {
    return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height
      && !exclusions.some((exclusion) => overlaps(rect, exclusion));
  }

  function drawOrnaments(context, plan, dimensions, art) {
    if (art.ornaments <= 0) return 0;
    const width = Number(dimensions?.layoutWidth);
    const height = Number(dimensions?.layoutHeight);
    if (!(width > 0 && height > 0)) return 0;
    const exclusions = planExclusions(plan);
    const inset = Math.max(10, Math.min(width, height) * 0.035);
    const starRadius = Math.max(2, Math.min(width, height) * 0.016);
    const candidates = [
      { x: inset, y: inset * 1.55, size: 1 },
      { x: width - inset, y: inset * 1.35, size: 0.8 },
    ];
    const frames = rectsFrom(plan?.artFrames || plan?.frames).sort((first, second) => first.x - second.x);
    for (let index = 0; index < frames.length - 1; index += 1) {
      const leftFrame = frames[index];
      const rightFrame = frames[index + 1];
      const gapLeft = leftFrame.x + leftFrame.width;
      const gapWidth = rightFrame.x - gapLeft;
      const overlapTop = Math.max(leftFrame.y, rightFrame.y);
      const overlapBottom = Math.min(leftFrame.y + leftFrame.height, rightFrame.y + rightFrame.height);
      const overlapHeight = overlapBottom - overlapTop;
      if (gapWidth <= 0 || gapWidth < starRadius * 1.4 || overlapHeight < starRadius * 2) continue;
      const size = Math.min(1, gapWidth / (starRadius * 2.2));
      candidates.push({
        x: gapLeft + gapWidth / 2,
        y: overlapTop + overlapHeight * 0.32,
        size,
      });
    }
    candidates.push(
      { x: inset * 1.25, y: height - inset * 1.15, size: 0.85 },
      { x: width - inset * 1.15, y: height - inset * 1.3, size: 0.7 },
      { x: width / 2, y: height - inset * 0.65, size: 0.58 },
    );
    let drawn = 0;
    let starsDrawn = 0;
    const targetStars = Math.max(1, Math.min(5, Math.round(art.ornaments / 20)));
    context.save();
    context.fillStyle = art.accentColor;
    context.strokeStyle = art.accentColor;
    context.globalAlpha *= 0.25 + art.ornaments / 100 * 0.5;
    candidates.forEach(({ x, y, size }) => {
      if (starsDrawn >= targetStars) return;
      const radius = starRadius * size;
      const box = { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
      if (!safeCandidate(box, exclusions, width, height)) return;
      context.save();
      context.translate(x, y);
      traceStar(context, radius);
      context.fill();
      context.restore();
      drawn += 1;
      starsDrawn += 1;
    });

    const ruleLength = Math.max(16, Math.min(width, height) * 0.04);
    const ruleThickness = Math.max(1.2, Math.min(width, height) * 0.002);
    const corners = [
      { x: inset, y: inset, dx: 1, dy: 1 },
      { x: width - inset, y: inset, dx: -1, dy: 1 },
      { x: inset, y: height - inset, dx: 1, dy: -1 },
      { x: width - inset, y: height - inset, dx: -1, dy: -1 },
    ];
    context.lineWidth = ruleThickness;
    context.lineCap = "round";
    corners.forEach(({ x, y, dx, dy }) => {
      const horizontal = { x: Math.min(x, x + dx * ruleLength), y: y - ruleThickness / 2, width: ruleLength, height: ruleThickness };
      const vertical = { x: x - ruleThickness / 2, y: Math.min(y, y + dy * ruleLength), width: ruleThickness, height: ruleLength };
      if (!safeCandidate(horizontal, exclusions, width, height) || !safeCandidate(vertical, exclusions, width, height)) return;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + dx * ruleLength, y);
      context.moveTo(x, y);
      context.lineTo(x, y + dy * ruleLength);
      context.stroke();
      drawn += 1;
    });
    context.restore();
    return drawn;
  }

  function draw(context, { plan = {}, dimensions = {}, backgroundPattern = "none", background = null } = {}) {
    const art = artSettings(plan);
    if (!context || !art.enabled) return { patternHandled: false, panelsDrawn: 0, ornamentsDrawn: 0 };
    context.save();
    const patternHandled = drawPattern(context, dimensions, backgroundPattern, background, art);
    const panelsDrawn = drawPanels(context, plan, art);
    const ornamentsDrawn = drawOrnaments(context, plan, dimensions, art);
    context.restore();
    return { patternHandled, panelsDrawn, ornamentsDrawn };
  }

  return Object.freeze({ draw, paletteFor });
})();

if (typeof module !== "undefined" && module.exports) module.exports = CardOrnaments;
else if (typeof globalThis !== "undefined") globalThis.CardOrnaments = CardOrnaments;
