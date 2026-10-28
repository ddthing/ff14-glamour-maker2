/*
 * Shared card information planner. It is intentionally independent of the DOM
 * and CardLayout so the editor and PNG renderer can consume the same resolved
 * item rectangles without introducing an import cycle.
 */
const CardComposition = (() => {
  const MAX_CAST = 5;
  const MAX_INFO_GAP = 64;
  const LEGACY_ITEM_COUNT = 5;
  // Small cards can legitimately carry dozens of selected items. Export
  // glyphs are rasterized at 2×, so this remains visible in the PNG while
  // giving the planner enough range to fit unusually long official names.
  const MIN_PRIMARY_SIZE = 0.75;
  const RAIL_CLEARANCE = 24;
  const SOLO_RAIL_INSET = 54;
  const SOLO_RAIL_WIDTH = 280;
  const PAIR_RAIL_WIDTH = 220;
  const LINEUP_FOOTER_HEIGHT = 237;
  const LINEUP_IMAGE_BOTTOM = 396;
  const MASK_WIDTH = 64;
  const MASK_HEIGHT = 96;
  const MASK_CACHE_LIMIT = 32;
  const COPY_METRICS_CACHE_LIMIT = 1024;
  const occupancyCache = new Map();
  const occupancyBySource = new WeakMap();
  const copyMetricsCache = new Map();
  let copyMetricsCacheHits = 0;
  let copyMetricsCacheMisses = 0;
  const textSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

  function numberInRange(value, minimum, maximum, fallback = minimum) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
  }

  function characterCountFor(value) {
    return Math.min(MAX_CAST, Math.max(1, Math.floor(Number(value) || 1)));
  }

  function safeIndex(value, count) {
    const numeric = Math.floor(Number(value));
    return Number.isInteger(numeric) ? Math.min(count - 1, Math.max(0, numeric)) : 0;
  }

  function languageName(item, language = "ko") {
    if (item?.name != null) return String(item.name);
    if (item?.primaryName != null) return String(item.primaryName);
    if (item?.names && typeof item.names === "object") {
      return String(item.names[language] || item.names.ko || item.names.en || item.names.ja || "");
    }
    return String(item?.label || item?.title || "");
  }

  function secondaryName(item, primary, language = "ko") {
    if (item?.secondaryName != null) {
      const explicit = String(item.secondaryName).trim();
      return explicit === primary ? "" : explicit;
    }
    if (language === "en") return "";
    const names = item?.names;
    if (!names || typeof names !== "object") return "";
    const english = String(names.en || "").trim();
    return english && english !== primary ? english : "";
  }

  function slotName(item) {
    return String(item?.slotName || item?.slotLabel || item?.slot || "");
  }

  function visibleEntries(values, language) {
    if (!Array.isArray(values)) return [];
    return values.flatMap((item, gearIndex) => {
      if (!item || item.showOnCard === false) return [];
      const name = languageName(item, language).trim()
        || slotName(item)
        || String(item.itemId ?? item.id ?? "").trim()
        || `Item ${gearIndex + 1}`;
      return [{
        gearIndex,
        itemId: item.itemId ?? item.id ?? null,
        slot: item.slot || null,
        extra: item.extra === true || item.isExtra === true || item.kind === "extra",
        slotName: slotName(item),
        name,
        secondaryName: secondaryName(item, name, language),
        raw: item,
      }];
    });
  }

  function graphemes(value) {
    const text = String(value || "");
    if (textSegmenter) {
      return Array.from(textSegmenter.segment(text), (part) => part.segment);
    }
    return Array.from(text);
  }

  function graphemeWidth(character) {
    // A stable, conservative estimate for UI planning. The actual DOM font
    // metrics are captured for PNG export after the browser lays out the copy.
    if (/\p{Extended_Pictographic}/u.test(character)) return 1.2;
    if (/[\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7af]/u.test(character)) return 1.04;
    if (/[MW@#%&]/u.test(character)) return 1.02;
    if (/[A-Z]/u.test(character)) return 0.76;
    return 0.64;
  }

  function estimatedLineCount(value, fontSize, maximumWidth) {
    const width = Math.max(1, Number(maximumWidth) || 1);
    const source = String(value || "").replace(/\r\n?/gu, "\n");
    if (!source.trim()) return 0;
    let totalLines = 0;
    for (const explicitLine of source.split("\n")) {
      const glyphs = graphemes(explicitLine.replace(/\s+/gu, " ").trim());
      if (!glyphs.length) {
        totalLines += 1;
        continue;
      }
      let lineWidth = 0;
      for (const glyph of glyphs) {
        const nextWidth = Math.max(fontSize * 0.45, fontSize * graphemeWidth(glyph));
        if (lineWidth > 0 && lineWidth + nextWidth > width) {
          totalLines += 1;
          lineWidth = nextWidth;
        } else {
          lineWidth += nextWidth;
        }
      }
      if (lineWidth > 0) totalLines += 1;
    }
    return Math.max(1, totalLines);
  }

  function copyMetrics(entry, width, {
    paddingX,
    paddingY,
    maxContentHeight = Number.POSITIVE_INFINITY,
    preferredPrimarySize = null,
  } = {}) {
    const widthKey = Math.round(width * 100) / 100;
    const maxHeightKey = Number.isFinite(maxContentHeight) ? Math.round(maxContentHeight * 100) / 100 : "inf";
    const primarySizeKey = Number.isFinite(preferredPrimarySize) ? Math.round(preferredPrimarySize * 100) / 100 : "auto";
    const key = JSON.stringify([
      entry.name,
      entry.secondaryName,
      entry.slotName,
      widthKey,
      paddingX,
      paddingY,
      maxHeightKey,
      primarySizeKey,
    ]);
    let metrics = copyMetricsCache.get(key);
    if (metrics) {
      copyMetricsCacheHits += 1;
      copyMetricsCache.delete(key);
      copyMetricsCache.set(key, metrics);
    } else {
      copyMetricsCacheMisses += 1;
      const copyWidth = Math.max(1, width - paddingX * 2);
      const copyHeight = Math.max(1, Number(maxContentHeight) || Number.POSITIVE_INFINITY);
      const base = Number.isFinite(preferredPrimarySize)
        ? numberInRange(preferredPrimarySize, MIN_PRIMARY_SIZE, 24, 9)
        : numberInRange(copyWidth * 0.16, 4, 24, 9);
      const groupGap = Math.max(1, Math.min(4, copyWidth * 0.018));
      let selected = null;
      for (let primarySize = base; primarySize >= MIN_PRIMARY_SIZE - 0.001; primarySize = Math.max(MIN_PRIMARY_SIZE, primarySize - 0.25)) {
        const secondarySize = entry.secondaryName ? primarySize * 0.72 : 0;
        const slotSize = entry.slotName ? primarySize * 0.7 : 0;
        const primaryLines = estimatedLineCount(entry.name, primarySize, copyWidth);
        const secondaryParts = secondarySize ? String(entry.secondaryName).split(/\r?\n/u) : [];
        const secondaryLines = secondaryParts.reduce((sum, part) => sum + estimatedLineCount(part, secondarySize, copyWidth), 0);
        const secondaryLocaleGap = Math.max(0, secondaryParts.length - 1) * secondarySize * 0.18;
        const slotLines = slotSize ? estimatedLineCount(entry.slotName, slotSize, copyWidth) : 0;
        const primaryLineHeight = primarySize * 1.12;
        const secondaryLineHeight = secondarySize ? secondarySize * 1.1 : 0;
        const slotLineHeight = slotSize ? slotSize * 1.05 : 0;
        const totalHeight = primaryLines * primaryLineHeight
          + secondaryLines * secondaryLineHeight
          + slotLines * slotLineHeight
          + secondaryLocaleGap
          + groupGap * ((slotLines ? 1 : 0) + (secondaryLines ? 1 : 0));
        selected = {
          slotSize,
          primarySize,
          secondarySize,
          slotLineHeight,
          primaryLineHeight,
          secondaryLineHeight,
          groupGap,
          estimatedPrimaryLines: primaryLines,
          estimatedSecondaryLines: secondaryLines,
          secondaryLocaleGap,
          estimatedSlotLines: slotLines,
          estimatedContentHeight: totalHeight,
          fits: totalHeight <= copyHeight + 0.01,
        };
        if (selected.fits) break;
        if (primarySize <= MIN_PRIMARY_SIZE) break;
      }
      const compatiblePadding = Math.min(paddingX, paddingY);
      const fallback = {
        padding: compatiblePadding,
        paddingX,
        paddingY,
        primarySize: MIN_PRIMARY_SIZE,
        secondarySize: entry.secondaryName ? MIN_PRIMARY_SIZE * 0.72 : 0,
        slotSize: entry.slotName ? MIN_PRIMARY_SIZE * 0.7 : 0,
        slotLineHeight: entry.slotName ? MIN_PRIMARY_SIZE * 0.7 * 1.05 : 0,
        primaryLineHeight: MIN_PRIMARY_SIZE * 1.12,
        secondaryLineHeight: entry.secondaryName ? MIN_PRIMARY_SIZE * 0.72 * 1.1 : 0,
        groupGap: 1,
        estimatedPrimaryLines: 1,
        estimatedSecondaryLines: entry.secondaryName ? 1 : 0,
        secondaryLocaleGap: 0,
        estimatedSlotLines: entry.slotName ? 1 : 0,
        estimatedContentHeight: 1,
        fits: false,
      };
      metrics = {
        contentHeight: selected?.estimatedContentHeight || fallback.estimatedContentHeight,
        copy: { ...(selected || fallback), padding: compatiblePadding, paddingX, paddingY },
      };
      copyMetricsCache.set(key, metrics);
      while (copyMetricsCache.size > COPY_METRICS_CACHE_LIMIT) copyMetricsCache.delete(copyMetricsCache.keys().next().value);
    }
    return { contentHeight: metrics.contentHeight, copy: { ...metrics.copy } };
  }

  function clearCopyMetricsCache() {
    copyMetricsCache.clear();
    copyMetricsCacheHits = 0;
    copyMetricsCacheMisses = 0;
  }

  function copyMetricsCacheStats() {
    return { size: copyMetricsCache.size, hits: copyMetricsCacheHits, misses: copyMetricsCacheMisses };
  }

  function adaptiveColumns(itemCount, preferred = 5) {
    if (itemCount <= preferred) return 1;
    if (itemCount <= preferred * 2) return 2;
    if (itemCount <= preferred * 4) return 3;
    return 4;
  }

  function validRect(rect) {
    if (!rect || typeof rect !== "object") return null;
    const x = Number(rect.x);
    const y = Number(rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  function rectRight(rect) {
    return rect.x + rect.width;
  }

  function rectBottom(rect) {
    return rect.y + rect.height;
  }

  function intersection(first, second) {
    const left = Math.max(first.x, second.x);
    const top = Math.max(first.y, second.y);
    const right = Math.min(rectRight(first), rectRight(second));
    const bottom = Math.min(rectBottom(first), rectBottom(second));
    if (right <= left || bottom <= top) return null;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function rectanglesOverlap(first, second) {
    return Boolean(first && second && intersection(first, second));
  }

  function occupancyBounds(mask) {
    if (!mask || !(mask.width > 0 && mask.height > 0)) return { known: false, bounds: null };
    const alpha = mask.alpha || mask.data;
    if (!alpha || typeof alpha.length !== "number" || alpha.length < mask.width * mask.height) {
      return { known: false, bounds: null };
    }
    let left = mask.width;
    let top = mask.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        const value = Number(alpha[y * mask.width + x] || 0);
        if (value <= 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) return { known: true, bounds: null };
    return {
      known: true,
      bounds: {
        left: left / mask.width,
        top: top / mask.height,
        right: (right + 1) / mask.width,
        bottom: (bottom + 1) / mask.height,
      },
    };
  }

  function mapSourceBounds(sourceBounds, imageRect, clipRect = null) {
    const rect = validRect(imageRect);
    if (!sourceBounds || !rect) return null;
    const mapped = {
      x: rect.x + sourceBounds.left * rect.width,
      y: rect.y + sourceBounds.top * rect.height,
      width: (sourceBounds.right - sourceBounds.left) * rect.width,
      height: (sourceBounds.bottom - sourceBounds.top) * rect.height,
    };
    const clip = validRect(clipRect);
    return clip ? intersection(mapped, clip) : mapped;
  }

  function fitImageRectToCorridor(imageRect, sourceBounds, frame, corridor) {
    const rect = validRect(imageRect);
    if (!rect || !corridor || !(corridor.width > 0)) return rect;
    const bounds = sourceBounds || { left: 0, top: 0, right: 1, bottom: 1 };
    const subject = mapSourceBounds(bounds, rect);
    if (!subject) return rect;
    const corridorRight = corridor.x + corridor.width;
    const alreadyClear = subject.x >= corridor.x - 0.01 && rectRight(subject) <= corridorRight + 0.01;
    if (alreadyClear) return rect;

    const sourceWidth = Math.max(0.001, bounds.right - bounds.left);
    let scale = Math.min(1, corridor.width / (rect.width * sourceWidth));
    const clip = validRect(frame);
    if (clip) {
      scale = Math.min(scale, clip.width / rect.width, clip.height / rect.height);
    }
    const width = rect.width * scale;
    const height = rect.height * scale;
    const sourceCenterX = (bounds.left + bounds.right) / 2;
    const x = corridor.x + corridor.width / 2 - sourceCenterX * width;
    const currentBottom = rect.y + rect.height;
    const anchorBottom = clip
      ? Math.min(currentBottom, rectBottom(clip))
      : currentBottom;
    const y = anchorBottom - height;
    return { x, y, width, height };
  }

  function fitImageRectToRegion(imageRect, region, frame = null) {
    const rect = validRect(imageRect);
    if (!rect || !region || !(region.width > 0 && region.height > 0)) return rect;
    const clip = validRect(frame);
    let scale = Math.min(1, region.width / rect.width, region.height / rect.height);
    if (clip) scale = Math.min(scale, clip.width / rect.width, clip.height / rect.height);
    const width = rect.width * scale;
    const height = rect.height * scale;
    const x = region.x + (region.width - width) / 2;
    const y = region.y + region.height - height;
    return { x, y, width, height };
  }

  function subjectForCharacter(imageRect, occupancy, frame, {
    fitUnknown = false,
    assumeOpaque = false,
    clipToFrame = false,
  } = {}) {
    const source = occupancyBounds(occupancy);
    const hasImageRect = Boolean(validRect(imageRect));
    const sourceBounds = source.known
      ? source.bounds
      : ((fitUnknown || assumeOpaque) && hasImageRect ? { left: 0, top: 0, right: 1, bottom: 1 } : null);
    const bounds = sourceBounds
      ? mapSourceBounds(sourceBounds, imageRect, clipToFrame ? frame : null)
      : null;
    return {
      known: hasImageRect && (source.known || assumeOpaque),
      sourceBounds,
      bounds,
    };
  }

  function copyOcclusionScore(copyBounds, subject, subjectKnown) {
    if (!subjectKnown) return 1;
    if (!subject) return 0;
    return rectanglesOverlap(copyBounds, subject) ? 1 : 0;
  }

  function occlusionEvidence(bounds, subjects) {
    const overlappingCharacterIndices = [];
    let unknown = false;
    subjects.forEach((subject, characterIndex) => {
      if (subject.bounds && rectanglesOverlap(bounds, subject.bounds)) {
        overlappingCharacterIndices.push(characterIndex);
      } else if (!subject.known && !subject.bounds) {
        unknown = true;
      }
    });
    return {
      score: overlappingCharacterIndices.length || unknown ? 1 : 0,
      overlappingCharacterIndices,
      unknown,
    };
  }

  function notePadding(width, columns) {
    if (columns === 1 && width >= 170) return { x: 22, y: 16 };
    return {
      x: Math.max(3, Math.min(22, Math.round(width * 0.065))),
      y: Math.max(3, Math.min(columns > 1 ? 4 : 16, Math.round(width * 0.06))),
    };
  }

  function prepareGrid(entries, region, {
    columns,
    gap,
    characterIndex,
    railSide = null,
    focus = false,
    occupancy = null,
    frame = null,
    subjectBounds = null,
    subjectKnown = false,
    sharedPrimarySize = null,
    maxHeightPerRow = null,
  } = {}) {
    const resolvedColumns = Math.max(1, Math.min(4, Math.floor(columns) || 1));
    const resolvedGap = Math.max(2, Number(gap) || 0);
    const rows = Math.ceil(entries.length / resolvedColumns);
    const cellWidth = Math.max(1, (region.width - resolvedGap * (resolvedColumns - 1)) / resolvedColumns);
    const specs = entries.map((entry, index) => {
      const column = index % resolvedColumns;
      const row = Math.floor(index / resolvedColumns);
      const padding = notePadding(cellWidth, resolvedColumns);
      const width = cellWidth;
      const x = region.x + column * (cellWidth + resolvedGap);
      const maxContentHeight = Number.isFinite(maxHeightPerRow)
        ? Math.max(1, maxHeightPerRow - padding.y * 2)
        : Number.POSITIVE_INFINITY;
      const copy = copyMetrics(entry, width, {
        paddingX: padding.x,
        paddingY: padding.y,
        maxContentHeight,
        preferredPrimarySize: Number.isFinite(sharedPrimarySize)
          ? sharedPrimarySize
          : (width >= 170 && resolvedColumns === 1 ? 24 : null),
      });
      const height = Math.ceil(copy.contentHeight) + padding.y * 2;
      return {
        entry,
        index,
        column,
        row,
        x,
        width,
        height,
        padding,
        copy,
      };
    });
    const rowHeights = Array.from({ length: rows }, (_, row) => {
      const contentHeight = Math.max(1, ...specs.filter((spec) => spec.row === row).map((spec) => spec.height));
      return Number.isFinite(maxHeightPerRow) ? Math.min(maxHeightPerRow, contentHeight) : contentHeight;
    });
    return { entries, region, columns: resolvedColumns, gap: resolvedGap, rows, cellWidth, specs, rowHeights, characterIndex, railSide, focus, occupancy, frame, subjectBounds, subjectKnown };
  }

  function rebuildSharedGrids(groups, gap, occupancyByCharacter, maxHeightPerRow = null) {
    const makeGrids = (sharedPrimarySize) => groups.map((group) => prepareGrid(group.entries, group.region, {
      ...group,
      gap,
      occupancy: group.occupancy || occupancyByCharacter[group.characterIndex] || null,
      sharedPrimarySize,
      maxHeightPerRow,
    }));
    let grids = makeGrids(null);
    let sharedPrimarySize = Math.min(...grids.flatMap((grid) => grid.specs.map((spec) => spec.copy.copy.primarySize)));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      grids = makeGrids(sharedPrimarySize);
      const smallestSize = Math.min(...grids.flatMap((grid) => grid.specs.map((spec) => spec.copy.copy.primarySize)));
      if (smallestSize >= sharedPrimarySize - 0.01) break;
      sharedPrimarySize = smallestSize;
    }
    return { grids, sharedPrimarySize };
  }

  function placeGridGroups(groups, { gap, occupancyByCharacter = [], dimensions = {} } = {}) {
    const active = groups.filter((group) => group.entries.length);
    if (!active.length) return [];
    const rows = Math.max(...active.map((group) => Math.ceil(group.entries.length / group.columns)));
    const noteGap = Math.max(2, Number(gap) || 0);
    const railHeight = Math.min(...active.map((group) => group.region.height));
    let { grids } = rebuildSharedGrids(active, noteGap, occupancyByCharacter);
    let sharedHeights = Array.from({ length: rows }, (_, row) => Math.max(1, ...grids.flatMap((grid) => [grid.rowHeights[row] || 0])));
    const availableRowsHeight = Math.max(rows, railHeight - noteGap * Math.max(0, rows - 1));
    if (sharedHeights.reduce((sum, height) => sum + height, 0) > availableRowsHeight + 0.01) {
      const maxHeightPerRow = availableRowsHeight / rows;
      grids = rebuildSharedGrids(active, noteGap, occupancyByCharacter, maxHeightPerRow).grids;
      sharedHeights = Array.from({ length: rows }, (_, row) => Math.min(maxHeightPerRow, Math.max(1, ...grids.flatMap((grid) => [grid.rowHeights[row] || 0]))));
    }
    const rowY = [];
    let cursorY = Math.min(...active.map((group) => group.region.y));
    for (let row = 0; row < rows; row += 1) {
      rowY[row] = cursorY;
      cursorY += sharedHeights[row] + noteGap;
    }
    return grids.flatMap((grid) => grid.specs.map((spec) => {
      const y = rowY[spec.row];
      const height = sharedHeights[spec.row];
      const bounds = { x: spec.x, y, width: spec.width, height };
      const copyBounds = {
        x: bounds.x + spec.padding.x,
        y: bounds.y + spec.padding.y,
        width: Math.max(1, bounds.width - spec.padding.x * 2),
        height: Math.max(1, Math.min(spec.copy.contentHeight + 1, bounds.height - spec.padding.y * 2)),
      };
      const protectionPaddingX = 12;
      const protectionPaddingY = 12;
      const boardWidth = Number(dimensions.layoutWidth) > 0 ? Number(dimensions.layoutWidth) : Number.POSITIVE_INFINITY;
      const boardHeight = Number(dimensions.layoutHeight) > 0 ? Number(dimensions.layoutHeight) : Number.POSITIVE_INFINITY;
      const protectionBounds = {
        x: Math.max(0, copyBounds.x - protectionPaddingX),
        y: Math.max(0, copyBounds.y - protectionPaddingY),
        width: 0,
        height: 0,
      };
      protectionBounds.width = Math.min(boardWidth, copyBounds.x + copyBounds.width + protectionPaddingX) - protectionBounds.x;
      protectionBounds.height = Math.min(boardHeight, copyBounds.y + copyBounds.height + protectionPaddingY) - protectionBounds.y;
      const noteRadius = Math.max(0, Math.min(10, bounds.width * 0.04, bounds.height * 0.12, bounds.width / 2, bounds.height / 2));
      const itemCopyOcclusionScore = copyOcclusionScore(copyBounds, grid.subjectBounds, grid.subjectKnown);
      const itemProtectionOcclusionScore = copyOcclusionScore(protectionBounds, grid.subjectBounds, grid.subjectKnown);
      return {
        characterIndex: grid.characterIndex,
        gearIndex: spec.entry.gearIndex,
        itemId: spec.entry.itemId,
        slot: spec.entry.slot,
        extra: spec.entry.extra,
        slotName: spec.entry.slotName,
        name: spec.entry.name,
        secondaryName: spec.entry.secondaryName,
        ...bounds,
        copyBounds,
        protectionBounds,
        copy: { ...spec.copy.copy },
        noteRadius,
        column: spec.column,
        row: spec.row,
        railSide: grid.railSide,
        focus: grid.focus,
        subjectBounds: grid.subjectBounds ? { ...grid.subjectBounds } : null,
        copyOcclusionScore: itemCopyOcclusionScore,
        copyOverlapsSubject: itemCopyOcclusionScore > 0,
        protectionOcclusionScore: itemProtectionOcclusionScore,
        surfaceOcclusionScore: itemCopyOcclusionScore,
        textAlign: "left",
      };
    }));
  }

  function rememberOccupancy(key, mask, source = null) {
    if (!mask) return null;
    const record = {
      width: MASK_WIDTH,
      height: MASK_HEIGHT,
      alpha: mask,
      sourceWidth: Number(source?.naturalWidth || source?.videoWidth || source?.width || 0) || null,
      sourceHeight: Number(source?.naturalHeight || source?.videoHeight || source?.height || 0) || null,
    };
    if (key) {
      occupancyCache.delete(key);
      occupancyCache.set(key, record);
      while (occupancyCache.size > MASK_CACHE_LIMIT) occupancyCache.delete(occupancyCache.keys().next().value);
    }
    if (source && typeof source === "object") occupancyBySource.set(source, record);
    return record;
  }

  function alphaOccupancyFor(image, cacheKey = "") {
    if (!image || typeof image !== "object") return null;
    const key = String(cacheKey || image.currentSrc || image.src || "").trim();
    if (key && occupancyCache.has(key)) {
      const cached = occupancyCache.get(key);
      occupancyCache.delete(key);
      occupancyCache.set(key, cached);
      return cached;
    }
    if (!key && occupancyBySource.has(image)) return occupancyBySource.get(image);
    const width = Number(image.naturalWidth || image.videoWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.videoHeight || image.height || 0);
    if (!(width > 0 && height > 0)) return null;
    try {
      let canvas;
      if (typeof OffscreenCanvas === "function") canvas = new OffscreenCanvas(MASK_WIDTH, MASK_HEIGHT);
      else if (typeof document !== "undefined" && document.createElement) {
        canvas = document.createElement("canvas");
        canvas.width = MASK_WIDTH;
        canvas.height = MASK_HEIGHT;
      }
      const context = canvas?.getContext?.("2d", { willReadFrequently: true });
      if (!context) return null;
      context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
      context.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
      const pixels = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
      const alpha = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
      for (let index = 0; index < alpha.length; index += 1) alpha[index] = pixels[index * 4 + 3];
      return rememberOccupancy(key, alpha, image);
    } catch {
      // Tainted canvases or non-decoded media simply disable the placement
      // preference; copy protection still comes from the opaque copy plane.
      return null;
    }
  }

  function clearOccupancyCache() {
    occupancyCache.clear();
  }

  function soloRegions(layout, singleLayout, infoGap) {
    const { layoutWidth, layoutHeight } = layout.dimensions;
    const isPortrait = layout.ratio === "portrait";
    const sideWidth = (isPortrait ? 370 : 300) - infoGap;
    const leftX = isPortrait ? 34 : 28;
    const rightX = (isPortrait ? 676 : 872) + infoGap;
    const top = isPortrait ? 220 : 140;
    const bottom = layoutHeight - (isPortrait ? 18 : 20);
    const left = { x: leftX, y: top, width: Math.max(92, sideWidth), height: bottom - top };
    const right = { x: rightX, y: top, width: Math.max(92, sideWidth), height: bottom - top };
    return singleLayout === "info-right" ? [right, left] : [left, right];
  }

  function safeRailGeometry(layout, characterCount, infoGap, singleLayout, maximumItemCount = 0) {
    const { layoutWidth, layoutHeight } = layout.dimensions;
    const clearance = RAIL_CLEARANCE + infoGap;
    if (characterCount === 1) {
      const y = layout.ratio === "portrait" ? 220 : 140;
      const height = Math.max(1, layoutHeight - y - (layout.ratio === "portrait" ? 18 : 20));
      const left = { x: SOLO_RAIL_INSET, y, width: SOLO_RAIL_WIDTH, height, characterIndex: 0, railSide: "left" };
      const right = { x: layoutWidth - SOLO_RAIL_INSET - SOLO_RAIL_WIDTH, y, width: SOLO_RAIL_WIDTH, height, characterIndex: 0, railSide: "right" };
      const corridor = {
        x: left.x + left.width + clearance,
        y: 0,
        width: Math.max(1, right.x - clearance - (left.x + left.width + clearance)),
        height: layoutHeight,
      };
      return {
        rails: singleLayout === "info-right" ? [right, left] : [left, right],
        corridors: [corridor],
        imageLanes: [],
      };
    }

    if (characterCount === 2) {
      const y = 176;
      const height = Math.max(1, Math.min(482, layoutHeight - y - 18));
      const left = { x: SOLO_RAIL_INSET, y, width: PAIR_RAIL_WIDTH, height, characterIndex: 0, railSide: "left" };
      const right = { x: layoutWidth - SOLO_RAIL_INSET - PAIR_RAIL_WIDTH, y, width: PAIR_RAIL_WIDTH, height, characterIndex: 1, railSide: "right" };
      const center = layoutWidth / 2;
      return {
        rails: [left, right],
        corridors: [
          { x: left.x + left.width + clearance, y: 0, width: Math.max(1, center - clearance - (left.x + left.width + clearance)), height: layoutHeight },
          { x: center + clearance, y: 0, width: Math.max(1, right.x - clearance - (center + clearance)), height: layoutHeight },
        ],
        imageLanes: [],
      };
    }

    const columnWidth = layoutWidth / characterCount;
    const footerHeight = maximumItemCount >= 11
      ? LINEUP_FOOTER_HEIGHT
      : maximumItemCount >= 6
        ? 210
        : maximumItemCount >= 3
          ? 180
          : maximumItemCount === 2
            ? 120
            : 80;
    const footerBottom = Math.min(layoutHeight - 18, LINEUP_IMAGE_BOTTOM + RAIL_CLEARANCE + LINEUP_FOOTER_HEIGHT);
    const railY = footerBottom - footerHeight;
    const imageBottom = railY - clearance;
    const imageTop = 142;
    const rails = Array.from({ length: characterCount }, (_, characterIndex) => ({
      x: characterIndex * columnWidth + 12,
      y: railY,
      width: Math.max(1, columnWidth - 24),
      height: Math.max(1, Math.min(footerHeight, layoutHeight - 18 - railY)),
      characterIndex,
      railSide: null,
      role: "footnote",
    }));
    const imageLanes = Array.from({ length: characterCount }, (_, characterIndex) => ({
      x: characterIndex * columnWidth,
      y: imageTop,
      width: columnWidth,
      height: Math.max(1, imageBottom - imageTop),
    }));
    return { rails, corridors: [], imageLanes };
  }

  function compositionImageGeometry(options, layout, characterCount, allCutouts, protectText, infoGap, singleLayout, characters = [], maximumItemCount = 0) {
    const suppliedRects = Array.isArray(options.imageRects) ? options.imageRects : [];
    const sourceRects = Array.from({ length: characterCount }, (_, index) => validRect(suppliedRects[index]));
    const imageRects = sourceRects.map((rect) => rect ? { ...rect } : null);
    const occupancyByCharacter = Array.isArray(options.occupancyByCharacter) ? options.occupancyByCharacter : [];
    const hasImageEvidence = sourceRects.some(Boolean);
    const safeRails = protectText && allCutouts && hasImageEvidence
      ? safeRailGeometry(layout, characterCount, infoGap, singleLayout, maximumItemCount)
      : { rails: [], corridors: [], imageLanes: [] };
    const subjectEvidence = Array.from({ length: characterCount }, (_, characterIndex) => (
      subjectForCharacter(
        imageRects[characterIndex],
        occupancyByCharacter[characterIndex],
        layout.frames?.[characterIndex] || null,
        {
          fitUnknown: allCutouts,
          assumeOpaque: characters[characterIndex]?.cutout !== true,
          clipToFrame: characters[characterIndex]?.cutout !== true,
        },
      )
    ));

    if (safeRails.rails.length) {
      imageRects.forEach((imageRect, characterIndex) => {
        if (!imageRect) return;
        const frame = layout.frames?.[characterIndex] || null;
        if (characterCount >= 3) {
          imageRects[characterIndex] = fitImageRectToRegion(imageRect, safeRails.imageLanes[characterIndex], frame);
        } else {
          imageRects[characterIndex] = fitImageRectToCorridor(
            imageRect,
            subjectEvidence[characterIndex].sourceBounds,
            frame,
            safeRails.corridors[characterIndex],
          );
        }
      });
    }

    const finalSubjects = Array.from({ length: characterCount }, (_, characterIndex) => (
      subjectForCharacter(
        imageRects[characterIndex],
        occupancyByCharacter[characterIndex],
        layout.frames?.[characterIndex] || null,
        {
          fitUnknown: allCutouts,
          assumeOpaque: characters[characterIndex]?.cutout !== true,
          clipToFrame: characters[characterIndex]?.cutout !== true,
        },
      )
    ));
    return { imageRects, sourceRects, subjects: finalSubjects, rails: safeRails.rails, safeRailGeometry: safeRails };
  }

  function plan(options = {}) {
    const count = characterCountFor(options.characterCount ?? options.layout?.characterCount);
    const layout = options.layout || {};
    const dimensions = layout.dimensions || { layoutWidth: 1080, layoutHeight: 1350 };
    const composition = options.composition || {};
    const requestedLayer = composition.layer === "person-front" ? "person-front" : "info-front";
    const protectText = composition.protectText !== false;
    const infoGap = Math.round(numberInRange(composition.infoGap, 0, MAX_INFO_GAP, 0));
    const characters = Array.isArray(options.characters) ? options.characters.slice(0, count) : [];
    const allCutouts = characters.length >= count && characters.every((character) => character?.cutout === true);
    const effectiveLayer = requestedLayer === "person-front" && allCutouts ? "person-front" : "info-front";
    const singleLayout = options.singleLayout || "info-left";
    const selectedCharacter = safeIndex(options.selectedCharacter, count);
    const language = String(options.language || "ko");
    const gearByCharacter = Array.isArray(options.gearByCharacter) ? options.gearByCharacter : [];
    const byCharacter = Array.from({ length: count }, (_, characterIndex) => visibleEntries(gearByCharacter[characterIndex], language));
    const multiInfoEnabled = Boolean(options.multiInfoEnabled);
    const displayedGear = count < 3 || multiInfoEnabled ? byCharacter : [];
    const hasVisibleGear = displayedGear.some((entries) => entries.length);
    const maximumVisibleItems = Math.max(0, ...displayedGear.map((entries) => entries.length));
    const imageGeometry = compositionImageGeometry(
      options,
      layout,
      count,
      allCutouts,
      protectText && hasVisibleGear,
      infoGap,
      singleLayout,
      characters,
      maximumVisibleItems,
    );
    const hasSafeRailGeometry = imageGeometry.rails.length > 0;
    const hasProtectedSourceGeometry = protectText && hasVisibleGear && imageGeometry.sourceRects.some(Boolean);
    const hasNonLegacyGear = byCharacter.some((entries) => entries.length > LEGACY_ITEM_COUNT || entries.some((entry) => entry.extra));
    // Dense lineups stay complete. Keep the focus fields as a stable reserved
    // contract for a future explicit focus control, but never use them to
    // silently omit another active character's selected gear.
    const focusCharacterIndex = null;
    const needsCustomItems = count < 3
      ? hasNonLegacyGear
      : multiInfoEnabled && hasNonLegacyGear;
    const isCustom = effectiveLayer !== "info-front"
      || infoGap > 0
      || needsCustomItems
      || hasSafeRailGeometry
      || hasProtectedSourceGeometry
      || !protectText;
    const availableCharacters = count < 3
      ? byCharacter.flatMap((entries, characterIndex) => entries.map((entry) => ({ ...entry, characterIndex })))
      : multiInfoEnabled
        ? byCharacter.flatMap((entries, characterIndex) => entries.map((entry) => ({ ...entry, characterIndex })))
        : [];
    const itemBuckets = Array.from({ length: count }, () => []);
    availableCharacters.forEach((entry) => itemBuckets[entry.characterIndex].push(entry));
    let items = [];
    const columnsByCharacter = Array.from({ length: count }, () => 0);
    const maximumSelection = Math.max(0, ...itemBuckets.map((entries) => entries.length));
    const baseNoteGap = hasSafeRailGeometry && count >= 3
      ? (maximumSelection > 32 ? 6 : maximumSelection > 10 ? 8 : 10)
      : maximumSelection > 32 ? 6 : maximumSelection > 16 ? 12 : 24;
    const gapBetweenNotes = count >= 3 ? 8 : Math.max(5, Math.min(28, baseNoteGap + Math.round(infoGap / 16)));
    const occupancyByCharacter = Array.isArray(options.occupancyByCharacter) ? options.occupancyByCharacter : [];
    const gridGroups = [];

    if (isCustom) {
      if (count === 1) {
        const soloItems = itemBuckets[0];
        if (soloItems.length) {
          const regions = hasSafeRailGeometry
            ? imageGeometry.rails
            : soloRegions(layout, singleLayout, infoGap).map((region, sideIndex) => ({
              ...region,
              railSide: singleLayout === "info-right"
                ? (sideIndex === 0 ? "right" : "left")
                : (sideIndex === 0 ? "left" : "right"),
            }));
          const smallSelection = soloItems.length <= 16;
          const coreEntries = soloItems.filter((entry) => !entry.extra);
          const extraEntries = soloItems.filter((entry) => entry.extra);
          const sideGroups = smallSelection && coreEntries.length && extraEntries.length
            ? [coreEntries, extraEntries]
            : [
              soloItems.filter((_, index) => index % 2 === 0),
              soloItems.filter((_, index) => index % 2 === 1),
            ];
          const columnsBySide = sideGroups.map((entries) => adaptiveColumns(entries.length, 8));
          columnsByCharacter[0] = Math.max(0, ...columnsBySide);
          sideGroups.forEach((entries, sideIndex) => {
            if (!entries.length) return;
            const region = regions[sideIndex];
            const subject = imageGeometry.subjects[0];
            gridGroups.push({
              entries,
              region,
              columns: columnsBySide[sideIndex],
              characterIndex: 0,
              railSide: region.railSide || (sideIndex === 0 ? "left" : "right"),
              occupancy: occupancyByCharacter[0] || null,
              frame: layout.frames?.[0] || null,
              subjectBounds: subject.bounds,
              subjectKnown: subject.known,
            });
          });
        }
      } else if (count === 2) {
        const { layoutWidth, layoutHeight } = dimensions;
        const legacyRail = {
          x: Math.round(layoutWidth * 0.06),
          width: 250 - infoGap,
          y: 176,
          height: 482,
        };
        const columns = adaptiveColumns(Math.max(...itemBuckets.map((entries) => entries.length)), 5);
        itemBuckets.forEach((entries, characterIndex) => {
          if (!entries.length) return;
          columnsByCharacter[characterIndex] = columns;
          const region = hasSafeRailGeometry
            ? imageGeometry.rails[characterIndex]
            : {
              x: characterIndex === 0 ? legacyRail.x : layoutWidth - legacyRail.x - legacyRail.width,
              y: legacyRail.y,
              width: Math.max(88, legacyRail.width),
              height: Math.min(legacyRail.height, layoutHeight - legacyRail.y - 18),
              railSide: characterIndex === 0 ? "left" : "right",
            };
          const subject = imageGeometry.subjects[characterIndex];
          gridGroups.push({
            entries,
            region,
            columns,
            characterIndex,
            railSide: region.railSide || (characterIndex === 0 ? "left" : "right"),
            occupancy: occupancyByCharacter[characterIndex] || null,
            frame: layout.frames?.[characterIndex] || null,
            subjectBounds: subject.bounds,
            subjectKnown: subject.known,
          });
        });
      } else {
        const { layoutWidth, layoutHeight } = dimensions;
        const columnWidth = layoutWidth / count;
        const columns = adaptiveColumns(Math.max(...itemBuckets.map((entries) => entries.length)), 5);
        itemBuckets.forEach((entries, characterIndex) => {
          if (!entries.length) return;
          columnsByCharacter[characterIndex] = columns;
          const horizontalInset = Math.min(infoGap, Math.max(0, columnWidth * 0.22));
          const region = hasSafeRailGeometry
            ? imageGeometry.rails[characterIndex]
            : {
              x: characterIndex * columnWidth + 12 + horizontalInset,
              y: 160,
              width: Math.max(1, columnWidth - 24 - horizontalInset * 2),
              height: Math.max(1, layoutHeight - 178),
            };
          const subject = imageGeometry.subjects[characterIndex];
          gridGroups.push({
            entries,
            region,
            columns,
            characterIndex,
            occupancy: occupancyByCharacter[characterIndex] || null,
            frame: layout.frames?.[characterIndex] || null,
            subjectBounds: subject.bounds,
            subjectKnown: subject.known,
          });
        });
      }
    }

    if (isCustom) items.push(...placeGridGroups(gridGroups, { gap: gapBetweenNotes, occupancyByCharacter, dimensions }));
    items.sort((first, second) => first.characterIndex - second.characterIndex || first.gearIndex - second.gearIndex);
    const allSubjects = imageGeometry.subjects;
    items = items.map((item) => {
      const copyEvidence = occlusionEvidence(item.copyBounds, allSubjects);
      const protectionEvidence = occlusionEvidence(item.protectionBounds, allSubjects);
      const surfaceEvidence = occlusionEvidence(item, allSubjects);
      return {
        ...item,
        copyOcclusionScore: copyEvidence.score,
        copyOverlapsSubject: copyEvidence.score > 0,
        copyOverlapCharacterIndices: copyEvidence.overlappingCharacterIndices,
        copyOcclusionUnknown: copyEvidence.unknown,
        protectionOcclusionScore: protectionEvidence.score,
        protectionOverlapCharacterIndices: protectionEvidence.overlappingCharacterIndices,
        protectionOcclusionUnknown: protectionEvidence.unknown,
        surfaceOcclusionScore: surfaceEvidence.score,
        surfaceOverlapCharacterIndices: surfaceEvidence.overlappingCharacterIndices,
        surfaceOcclusionUnknown: surfaceEvidence.unknown,
      };
    });
    const plannedRails = gridGroups.map((group) => {
      const columns = Math.max(1, Math.min(4, Math.floor(group.columns) || 1));
      const gap = Math.max(2, Number(gapBetweenNotes) || 0);
      const columnWidth = Math.max(1, (group.region.width - gap * (columns - 1)) / columns);
      return {
        characterIndex: group.characterIndex,
        railSide: group.railSide || null,
        role: group.region.role || "outer",
        x: group.region.x,
        y: group.region.y,
        width: group.region.width,
        height: group.region.height,
        columns,
        columnOrigins: Array.from({ length: columns }, (_, column) => group.region.x + column * (columnWidth + gap)),
        textAlign: "left",
      };
    });
    const protectedZones = protectText
      ? items.map(({ characterIndex, gearIndex, protectionBounds }) => ({ characterIndex, gearIndex, ...(protectionBounds || {}) }))
      : [];
    const omittedCharacterIndices = [];

    return {
      isCustom,
      requestedLayer,
      effectiveLayer,
      protectText,
      infoGap,
      focusCharacterIndex,
      selectedCharacter,
      characterCount: count,
      dimensions: { ...dimensions },
      columns: columnsByCharacter,
      imageRects: imageGeometry.imageRects,
      sourceImageRects: imageGeometry.sourceRects,
      subjectBoundsByCharacter: imageGeometry.subjects.map((subject) => subject.bounds ? { ...subject.bounds } : null),
      subjectEvidenceByCharacter: imageGeometry.subjects.map((subject) => subject.known),
      rails: plannedRails,
      railClearance: hasSafeRailGeometry ? RAIL_CLEARANCE + infoGap : null,
      items,
      protectedZones,
      omittedCharacterIndices,
      hasUnplacedVisibleItems: false,
    };
  }

  return {
    plan,
    adaptiveColumns,
    characterCountFor,
    estimatedLineCount,
    clearCopyMetricsCache,
    copyMetricsCacheStats,
    alphaOccupancyFor,
    clearOccupancyCache,
    maxInfoGap: MAX_INFO_GAP,
    maskWidth: MASK_WIDTH,
    maskHeight: MASK_HEIGHT,
  };
})();

if (typeof module !== "undefined") module.exports = CardComposition;
else globalThis.CardComposition = CardComposition;
