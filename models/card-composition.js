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

  function copyMetrics(entry, bounds) {
    const widthKey = Math.round(bounds.width * 100) / 100;
    const heightKey = Math.round(bounds.height * 100) / 100;
    const key = JSON.stringify([entry.name, entry.secondaryName, entry.slotName, widthKey, heightKey]);
    let metrics = copyMetricsCache.get(key);
    if (metrics) {
      copyMetricsCacheHits += 1;
      copyMetricsCache.delete(key);
      copyMetricsCache.set(key, metrics);
    } else {
      copyMetricsCacheMisses += 1;
      const padding = Math.max(3, Math.min(8, Math.round(Math.min(bounds.width, bounds.height) * 0.07)));
      const copyWidth = Math.max(1, bounds.width - padding * 2);
      const copyHeight = Math.max(1, bounds.height - padding * 2);
      const base = numberInRange(Math.min(copyWidth * 0.075, copyHeight * 0.24), 4, 24, 9);
      const groupGap = Math.max(1, Math.min(4, copyHeight * 0.055));
      let selected = null;
      for (let primarySize = base; primarySize >= MIN_PRIMARY_SIZE; primarySize -= 0.25) {
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
          padding,
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
          fits: totalHeight <= copyHeight + 0.01,
        };
        if (selected.fits) break;
      }
      metrics = { padding, copy: selected || { padding, primarySize: MIN_PRIMARY_SIZE, secondarySize: 0, slotSize: 0, fits: false } };
      copyMetricsCache.set(key, metrics);
      while (copyMetricsCache.size > COPY_METRICS_CACHE_LIMIT) copyMetricsCache.delete(copyMetricsCache.keys().next().value);
    }
    const copyBounds = {
      x: bounds.x + metrics.padding,
      y: bounds.y + metrics.padding,
      width: Math.max(1, bounds.width - metrics.padding * 2),
      height: Math.max(1, bounds.height - metrics.padding * 2),
    };
    return { copyBounds, copy: { ...metrics.copy } };
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

  function maskAt(mask, x, y) {
    if (!mask || !(mask.width > 0 && mask.height > 0)) return 0;
    const column = Math.min(mask.width - 1, Math.max(0, Math.floor(x * mask.width)));
    const row = Math.min(mask.height - 1, Math.max(0, Math.floor(y * mask.height)));
    const index = row * mask.width + column;
    const alpha = mask.alpha?.[index] ?? mask.data?.[index] ?? 0;
    return Number(alpha) > 1 ? Number(alpha) / 255 : Number(alpha);
  }

  function occupancyScore(bounds, frame, mask) {
    if (!frame || !mask || !(frame.width > 0 && frame.height > 0)) return null;
    let score = 0;
    let samples = 0;
    for (const yRatio of [0.2, 0.5, 0.8]) {
      for (const xRatio of [0.2, 0.5, 0.8]) {
        const x = bounds.x + bounds.width * xRatio;
        const y = bounds.y + bounds.height * yRatio;
        const normalizedX = (x - frame.x) / frame.width;
        const normalizedY = (y - frame.y) / frame.height;
        if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) continue;
        score += maskAt(mask, normalizedX, normalizedY);
        samples += 1;
      }
    }
    return samples ? score / samples : 0;
  }

  function placeGrid(entries, region, { columns, gap, characterIndex, railSide = null, focus = false, occupancy = null, frame = null } = {}) {
    if (!entries.length) return [];
    const resolvedColumns = Math.max(1, Math.min(4, Math.floor(columns) || 1));
    const resolvedGap = Math.max(2, Number(gap) || 0);
    const rows = Math.ceil(entries.length / resolvedColumns);
    const tileWidth = Math.max(1, (region.width - resolvedGap * (resolvedColumns - 1)) / resolvedColumns);
    const tileHeight = Math.max(1, (region.height - resolvedGap * (rows - 1)) / rows);
    const slots = entries.map((_, index) => {
      const column = index % resolvedColumns;
      const row = Math.floor(index / resolvedColumns);
      const bounds = {
        x: region.x + column * (tileWidth + resolvedGap),
        y: region.y + row * (tileHeight + resolvedGap),
        width: tileWidth,
        height: tileHeight,
      };
      return {
        ...bounds,
        column,
        row,
        surfaceOcclusionScore: occupancyScore(bounds, frame, occupancy),
      };
    });
    if (occupancy && frame) {
      slots.sort((first, second) => (first.surfaceOcclusionScore ?? 0) - (second.surfaceOcclusionScore ?? 0)
        || first.row - second.row
        || first.column - second.column);
    }
    return entries.map((entry, index) => {
      const slot = slots[index];
      const bounds = { x: slot.x, y: slot.y, width: slot.width, height: slot.height };
      const metrics = copyMetrics(entry, bounds);
      return {
        characterIndex,
        gearIndex: entry.gearIndex,
        itemId: entry.itemId,
        slot: entry.slot,
        extra: entry.extra,
        slotName: entry.slotName,
        name: entry.name,
        secondaryName: entry.secondaryName,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        copyBounds: metrics.copyBounds,
        copy: metrics.copy,
        column: slot.column,
        row: slot.row,
        railSide,
        focus,
        surfaceOcclusionScore: slot.surfaceOcclusionScore,
        textAlign: "left",
      };
    });
  }

  function rememberOccupancy(key, mask, source = null) {
    if (!mask) return null;
    const record = {
      width: MASK_WIDTH,
      height: MASK_HEIGHT,
      alpha: mask,
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
    const selectedCharacter = safeIndex(options.selectedCharacter, count);
    const language = String(options.language || "ko");
    const gearByCharacter = Array.isArray(options.gearByCharacter) ? options.gearByCharacter : [];
    const byCharacter = Array.from({ length: count }, (_, characterIndex) => visibleEntries(gearByCharacter[characterIndex], language));
    const multiInfoEnabled = Boolean(options.multiInfoEnabled);
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
      || !protectText;
    const availableCharacters = count < 3
      ? byCharacter.flatMap((entries, characterIndex) => entries.map((entry) => ({ ...entry, characterIndex })))
      : multiInfoEnabled
        ? byCharacter.flatMap((entries, characterIndex) => entries.map((entry) => ({ ...entry, characterIndex })))
        : [];
    const itemBuckets = Array.from({ length: count }, () => []);
    availableCharacters.forEach((entry) => itemBuckets[entry.characterIndex].push(entry));
    const items = [];
    const columnsByCharacter = Array.from({ length: count }, () => 0);
    const gapBetweenNotes = Math.max(5, Math.min(14, 7 + Math.round(infoGap / 16)));
    const occupancyByCharacter = Array.isArray(options.occupancyByCharacter) ? options.occupancyByCharacter : [];

    if (isCustom) {
      if (count === 1) {
        const soloItems = itemBuckets[0];
        if (soloItems.length) {
          const regions = soloRegions(layout, options.singleLayout || "info-left", infoGap);
          const leftEntries = soloItems.filter((_, index) => index % 2 === 0);
          const rightEntries = soloItems.filter((_, index) => index % 2 === 1);
          const sideGroups = [leftEntries, rightEntries];
          sideGroups.forEach((entries, sideIndex) => {
            if (!entries.length) return;
            const region = regions[sideIndex];
            const columns = adaptiveColumns(entries.length, 8);
            columnsByCharacter[0] = Math.max(columnsByCharacter[0], columns);
            items.push(...placeGrid(entries, region, {
              columns,
              gap: gapBetweenNotes,
              characterIndex: 0,
              railSide: sideIndex === 0 ? "left" : "right",
              occupancy: effectiveLayer === "person-front" ? occupancyByCharacter[0] : null,
              frame: layout.frames?.[0] || null,
            }));
          });
        }
      } else if (count === 2) {
        const { layoutWidth, layoutHeight } = dimensions;
        const legacyRail = {
          x: Math.round(layoutWidth * 0.06),
          width: 250 - infoGap,
          y: 132,
          height: 482,
        };
        itemBuckets.forEach((entries, characterIndex) => {
          if (!entries.length) return;
          const columns = adaptiveColumns(entries.length, 5);
          columnsByCharacter[characterIndex] = columns;
          const region = {
            x: characterIndex === 0 ? legacyRail.x : layoutWidth - legacyRail.x - legacyRail.width,
            y: legacyRail.y,
            width: Math.max(88, legacyRail.width),
            height: Math.min(legacyRail.height, layoutHeight - legacyRail.y - 18),
          };
          items.push(...placeGrid(entries, region, {
            columns,
            gap: gapBetweenNotes,
            characterIndex,
            railSide: characterIndex === 0 ? "left" : "right",
            occupancy: effectiveLayer === "person-front" ? occupancyByCharacter[characterIndex] : null,
            frame: layout.frames?.[characterIndex] || null,
          }));
        });
      } else {
        const { layoutWidth, layoutHeight } = dimensions;
        const columnWidth = layoutWidth / count;
        itemBuckets.forEach((entries, characterIndex) => {
          if (!entries.length) return;
          const columns = adaptiveColumns(entries.length, 5);
          columnsByCharacter[characterIndex] = columns;
          const horizontalInset = Math.min(infoGap, Math.max(0, columnWidth * 0.22));
          const region = {
            x: characterIndex * columnWidth + 12 + horizontalInset,
            y: 160,
            width: Math.max(1, columnWidth - 24 - horizontalInset * 2),
            height: Math.max(1, layoutHeight - 178),
          };
          items.push(...placeGrid(entries, region, {
            columns,
            gap: gapBetweenNotes,
            characterIndex,
            occupancy: effectiveLayer === "person-front" ? occupancyByCharacter[characterIndex] : null,
            frame: layout.frames?.[characterIndex] || null,
          }));
        });
      }
    }

    items.sort((first, second) => first.characterIndex - second.characterIndex || first.gearIndex - second.gearIndex);
    const protectedZones = protectText ? items.map(({ characterIndex, gearIndex, copyBounds }) => ({ characterIndex, gearIndex, ...copyBounds })) : [];
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
