/* Full equipment-sheet PNG export. This renderer consumes normalized item
   records and decoded image sources; it does not inspect editor state or DOM. */
(function attachGearSheet(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GearSheet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGearSheet() {
  "use strict";

  const WIDTH = 2160;
  const HEIGHT = 2700;
  const MARGIN = 144;
  const PAGE_BOTTOM = HEIGHT - 190;
  const FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", "Noto Sans JP", "Segoe UI Variable", sans-serif';
  const COLORS = Object.freeze({
    paper: "#ffffff",
    ink: "#25292c",
    muted: "#71787d",
    quiet: "#8a9094",
    line: "#dfe3e5",
    soft: "#f4f5f5",
    primary: "#343a3e",
  });

  const GROUPS = Object.freeze([
    { id: "core", slots: ["head", "body", "hands", "legs", "feet"] },
    { id: "weapons", slots: ["weapon", "offhand"] },
    { id: "accessories", slots: ["earrings", "necklace", "bracelet", "ringLeft", "ringRight"] },
    { id: "facewear", slots: ["facewear"] },
    { id: "fashion", slots: ["fashion"] },
    { id: "custom", slots: ["custom"] },
  ]);

  const GROUP_LABELS = Object.freeze({
    core: { ko: "기본 장비", en: "Core gear", ja: "基本装備" },
    weapons: { ko: "무기", en: "Weapons", ja: "武器" },
    accessories: { ko: "액세서리", en: "Accessories", ja: "アクセサリー" },
    facewear: { ko: "얼굴 장식", en: "FACEWEAR", ja: "フェイスウェア" },
    fashion: { ko: "패션소품", en: "Fashion", ja: "ファッション" },
    custom: { ko: "기타", en: "Custom", ja: "カスタム" },
  });

  const UI_LABELS = Object.freeze({
    ko: { kicker: "전체 장비 기록", character: "캐릭터", continued: "계속", page: "페이지" },
    en: { kicker: "FULL EQUIPMENT RECORD", character: "CHARACTER", continued: "CONTINUED", page: "PAGE" },
    ja: { kicker: "全装備リスト", character: "キャラクター", continued: "続き", page: "ページ" },
  });

  const SLOT_LABELS = Object.freeze({
    head: { ko: "머리", en: "Head", ja: "頭" },
    body: { ko: "몸", en: "Body", ja: "胴" },
    hands: { ko: "손", en: "Hands", ja: "手" },
    legs: { ko: "다리", en: "Legs", ja: "脚" },
    feet: { ko: "발", en: "Feet", ja: "足" },
    weapon: { ko: "무기", en: "Weapon", ja: "武器" },
    offhand: { ko: "보조 장비", en: "Off-hand", ja: "サブアーム" },
    earrings: { ko: "귀걸이", en: "Earrings", ja: "耳飾り" },
    necklace: { ko: "목걸이", en: "Necklace", ja: "首飾り" },
    bracelet: { ko: "팔찌", en: "Bracelet", ja: "腕輪" },
    ringLeft: { ko: "왼쪽 반지", en: "Left ring", ja: "左指輪" },
    ringRight: { ko: "오른쪽 반지", en: "Right ring", ja: "右指輪" },
    facewear: { ko: "얼굴 장식", en: "Facewear", ja: "フェイスアクセサリー" },
    fashion: { ko: "패션소품", en: "Fashion", ja: "ファッションアクセサリー" },
    custom: { ko: "기타", en: "Custom", ja: "カスタム" },
  });

  function normalise(value) {
    return String(value ?? "").replace(/\s+/gu, " ").trim();
  }

  function languageCode(language) {
    const code = String(language || "ko").toLowerCase().split(/[-_]/u)[0];
    return code === "en" || code === "ja" ? code : "ko";
  }

  function graphemes(value) {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);
    }
    return Array.from(value);
  }

  function fallbackMeasure(value, font) {
    const match = String(font || "").match(/(\d+(?:\.\d+)?)px/u);
    const size = match ? Number(match[1]) : 32;
    return graphemes(value).reduce((width, character) => width + (/[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff]/u.test(character) ? size : size * 0.56), 0);
  }

  function wrapText(value, measureText, maxWidth) {
    const text = normalise(value);
    if (!text) return [];
    const width = Math.max(1, Number(maxWidth) || 1);
    const measure = typeof measureText === "function" ? measureText : (line) => fallbackMeasure(line, "32px");
    const output = [];
    const pushToken = (token, line) => {
      let next = line;
      for (const character of graphemes(token)) {
        const candidate = next + character;
        if (!next || measure(candidate) <= width) next = candidate;
        else {
          output.push(next);
          next = character;
        }
      }
      return next;
    };

    let line = "";
    for (const token of text.split(" ")) {
      const candidate = line ? `${line} ${token}` : token;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      line = pushToken(token, "");
    }
    if (line) output.push(line);
    return output;
  }

  function normalizedGroups(suppliedGroups) {
    const supplied = new Map((Array.isArray(suppliedGroups) ? suppliedGroups : [])
      .filter((group) => group && typeof group.id === "string")
      .map((group) => [group.id, group]));
    return GROUPS.map((group) => {
      const override = supplied.get(group.id);
      const labels = override?.labels || {};
      const aliases = {
        ko: override?.labelsKO,
        en: override?.labelsEN,
        ja: override?.labelsJA,
      };
      return {
        ...group,
        labels: {
          ...GROUP_LABELS[group.id],
          ...Object.fromEntries(Object.entries(aliases).filter(([, value]) => normalise(value))),
          ...Object.fromEntries(Object.entries(labels).filter(([, value]) => normalise(value))),
        },
      };
    });
  }

  function entryGroup(entry, groups) {
    const slot = String(entry?.slot || "");
    return groups.find((group) => group.slots.includes(slot))?.id || "custom";
  }

  function localizedSlotLabel(slot, language, slotLabel) {
    if (typeof slotLabel === "function") {
      try {
        const label = normalise(slotLabel(slot, language));
        if (label) return label;
      } catch {
        // Keep the bundled labels as a safe fallback for isolated exports.
      }
    }
    const labels = SLOT_LABELS[slot] || SLOT_LABELS.custom;
    return labels[language] || labels.ko;
  }

  function localizedItemNames(entry, language) {
    const names = entry?.names && typeof entry.names === "object" ? entry.names : {};
    const primary = normalise(names[language]) || normalise(entry?.name) || normalise(names.ko) || normalise(names.en) || normalise(names.ja) || "—";
    const english = language !== "en" ? normalise(names.en) : "";
    return { primary, english: english && english !== primary ? english : "" };
  }

  function measure(context, text) {
    if (context && typeof context.measureText === "function") return context.measureText(text).width;
    return fallbackMeasure(text, context?.font);
  }

  function setFont(context, size, weight = 500) {
    context.font = `${weight} ${size}px ${FONT}`;
  }

  function buildItemLayout(context, entry, language, slotLabel, columnWidth) {
    const padding = 28;
    const labelWidth = 208;
    const contentLeft = 242;
    const contentWidth = Math.max(160, columnWidth - contentLeft - 28);
    const slotText = normalise(entry._gearSheetSlotLabel) || localizedSlotLabel(entry.slot, language, slotLabel);

    setFont(context, 28, 560);
    const slotLines = wrapText(slotText, (value) => measure(context, value), labelWidth);
    const names = localizedItemNames(entry, language);
    setFont(context, 36, 620);
    const primaryLines = wrapText(names.primary, (value) => measure(context, value), contentWidth);

    let englishLines = [];
    if (names.english) {
      setFont(context, 25, 480);
      englishLines = wrapText(names.english, (value) => measure(context, value), contentWidth);
    }

    const note = normalise(entry.note);
    let noteLines = [];
    if (note) {
      setFont(context, 23, 440);
      noteLines = wrapText(note, (value) => measure(context, value), contentWidth);
    }

    const slotHeight = Math.max(1, slotLines.length) * 38;
    const textHeight = primaryLines.length * 48 + (englishLines.length ? 12 + englishLines.length * 34 : 0) + (noteLines.length ? 14 + noteLines.length * 32 : 0);
    const height = Math.max(slotHeight, textHeight) + padding * 2;
    return {
      entry,
      slotText,
      slotLines,
      primaryLines,
      englishLines,
      noteLines,
      height,
      padding,
      labelWidth,
      contentLeft,
      contentWidth,
    };
  }

  function groupEntries(entries, groups) {
    const grouped = new Map(groups.map((group) => [group.id, []]));
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry !== "object") continue;
      grouped.get(entryGroup(entry, groups)).push(entry);
    }

    const order = new Map(groups.flatMap((group, groupIndex) => group.slots.map((slot, index) => [slot, groupIndex * 100 + index])));
    return groups.flatMap((group) => {
      const items = grouped.get(group.id) || [];
      items.sort((left, right) => (order.get(left.slot) ?? 9999) - (order.get(right.slot) ?? 9999));
      if (!items.length) return [];
      return [{ ...group, entries: items }];
    });
  }

  function createPagePlan(bodyTop) {
    return { bodyTop, y: bodyTop, groups: [], entryIds: [], rowCount: 0 };
  }

  function planPages(context, groups, language, slotLabel, bodyTop, columnWidth) {
    const pages = [createPagePlan(bodyTop)];
    const groupHeaderHeight = 84;
    const rowGap = 16;
    let page = pages[0];

    const newPage = () => {
      page = createPagePlan(bodyTop);
      pages.push(page);
      return page;
    };

    for (const group of groups) {
      const items = group.entries.map((entry) => buildItemLayout(context, entry, language, slotLabel, columnWidth));
      const rows = [];
      for (let index = 0; index < items.length; index += 2) {
        const left = items[index];
        const right = items[index + 1] || null;
        rows.push({ left, right, height: Math.max(left.height, right?.height || 0) });
      }

      if (page.y + groupHeaderHeight + rows[0].height > PAGE_BOTTOM && page.groups.length) newPage();
      if (page.y + groupHeaderHeight + rows[0].height > PAGE_BOTTOM) {
        throw new Error(`Gear sheet group "${group.id}" has an item row that exceeds the page area.`);
      }

      let plannedGroup = { id: group.id, labels: group.labels, entries: [], rows: [], continued: false };
      page.groups.push(plannedGroup);
      page.y += groupHeaderHeight;

      for (const row of rows) {
        if (page.y + row.height > PAGE_BOTTOM) {
          newPage();
          plannedGroup = { id: group.id, labels: group.labels, entries: [], rows: [], continued: true };
          page.groups.push(plannedGroup);
          page.y += groupHeaderHeight;
          if (page.y + row.height > PAGE_BOTTOM) {
            throw new Error(`Gear sheet item row in "${group.id}" exceeds the page area.`);
          }
        }
        plannedGroup.rows.push(row);
        for (const item of [row.left, row.right].filter(Boolean)) {
          plannedGroup.entries.push(item);
          page.rowCount += 1;
          page.entryIds.push(item.entry.id ?? item.entry.itemId ?? null);
        }
        page.y += row.height + rowGap;
      }
    }
    return pages.filter((plannedPage) => plannedPage.rowCount > 0 || groups.length === 0);
  }

  function roundedImage(context, image, x, y, width, height) {
    const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0);
    const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0);
    if (!(imageWidth > 0 && imageHeight > 0)) return;
    const scale = Math.min(width / imageWidth, height / imageHeight);
    const paintedWidth = imageWidth * scale;
    const paintedHeight = imageHeight * scale;
    context.save();
    context.beginPath();
    if (typeof context.roundRect === "function") context.roundRect(x, y, width, height, 14);
    else context.rect(x, y, width, height);
    context.clip();
    context.drawImage(image, x + (width - paintedWidth) / 2, y + (height - paintedHeight) / 2, paintedWidth, paintedHeight);
    context.restore();
  }

  function drawHeader(context, options, language, pageNumber, pageCount, withImage, header) {
    const labels = UI_LABELS[language];
    const x = MARGIN;
    context.fillStyle = COLORS.paper;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = COLORS.primary;
    context.fillRect(x, 112, 58, 8);
    context.fillStyle = COLORS.muted;
    setFont(context, 24, 620);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(labels.kicker, x + 76, 130);

    const index = Number.isFinite(Number(options.characterIndex)) ? Math.max(0, Number(options.characterIndex)) + 1 : 1;
    const characterNumber = String(Math.floor(index)).padStart(2, "0");
    const characterLabel = `${labels.character} ${characterNumber}`;
    const hasPortrait = Boolean(withImage && options.image);
    const portrait = header.portrait;

    context.fillStyle = COLORS.ink;
    setFont(context, 82, 720);
    header.titleLines.forEach((line, lineIndex) => context.fillText(line, x, header.titleY + lineIndex * header.titleLineHeight));

    context.fillStyle = COLORS.muted;
    setFont(context, 28, 560);
    const name = normalise(options.characterName);
    context.fillText(name ? `${characterLabel}  ·  ${name}` : characterLabel, x, header.characterY);

    if (hasPortrait) {
      context.fillStyle = COLORS.soft;
      context.fillRect(portrait.x, portrait.y, portrait.width, portrait.height);
      roundedImage(context, options.image, portrait.x, portrait.y, portrait.width, portrait.height);
      context.strokeStyle = COLORS.line;
      context.lineWidth = 2;
      context.strokeRect(portrait.x, portrait.y, portrait.width, portrait.height);
    } else {
      const numberX = WIDTH - MARGIN;
      context.textAlign = "right";
      context.fillStyle = COLORS.soft;
      setFont(context, 176, 680);
      context.fillText(characterNumber, numberX, 350);
      context.textAlign = "left";
    }

    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(MARGIN, header.bodyTop - 36);
    context.lineTo(WIDTH - MARGIN, header.bodyTop - 36);
    context.stroke();

    context.fillStyle = COLORS.quiet;
    setFont(context, 20, 540);
    context.textAlign = "right";
    context.fillText(`${labels.page} ${String(pageNumber).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`, WIDTH - MARGIN, HEIGHT - 102);
    context.textAlign = "left";
  }

  function drawGroupHeader(context, group, y, language, continued) {
    const label = group.labels?.[language] || GROUP_LABELS[group.id]?.[language] || GROUP_LABELS.custom[language];
    const suffix = continued ? `  ·  ${UI_LABELS[language].continued}` : "";
    context.fillStyle = COLORS.primary;
    context.fillRect(MARGIN, y + 23, 9, 32);
    context.fillStyle = COLORS.ink;
    setFont(context, 34, 680);
    context.fillText(`${label}${suffix}`, MARGIN + 29, y + 50);
  }

  function drawItem(context, item, x, y, columnWidth, language) {
    const top = y + item.padding;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = COLORS.muted;
    setFont(context, 28, 560);
    item.slotLines.forEach((line, index) => context.fillText(line, x + 6, top + 34 + index * 38));

    let textY = top + 38;
    const textX = x + item.contentLeft;
    context.fillStyle = COLORS.ink;
    setFont(context, 36, 620);
    item.primaryLines.forEach((line) => {
      context.fillText(line, textX, textY);
      textY += 48;
    });

    if (item.englishLines.length) {
      textY += 5;
      context.fillStyle = COLORS.muted;
      setFont(context, 25, 460);
      item.englishLines.forEach((line) => {
        context.fillText(line, textX, textY);
        textY += 34;
      });
    }

    if (item.noteLines.length) {
      textY += 7;
      context.fillStyle = COLORS.quiet;
      setFont(context, 23, 440);
      item.noteLines.forEach((line) => {
        context.fillText(line, textX, textY);
        textY += 32;
      });
    }
  }

  function drawBody(context, page, language, columnWidth) {
    let y = page.bodyTop;
    const columnGap = 48;
    const rightX = MARGIN + columnWidth + columnGap;
    for (const group of page.groups) {
      drawGroupHeader(context, group, y, language, group.continued);
      y += 84;
      for (const row of group.rows) {
        drawItem(context, row.left, MARGIN, y, columnWidth, language);
        if (row.right) drawItem(context, row.right, rightX, y, columnWidth, language);
        y += row.height + 16;
      }
    }
  }

  function computeHeader(context, title, imageProvided) {
    const portrait = { x: WIDTH - MARGIN - 260, y: 168, width: 260, height: 300 };
    const titleWidth = imageProvided ? portrait.x - MARGIN - 76 : WIDTH - MARGIN * 2;
    setFont(context, 82, 720);
    const titleLines = wrapText(title || "GEAR SHEET", (value) => measure(context, value), titleWidth);
    const titleY = 274;
    const titleLineHeight = 100;
    const characterY = titleY + Math.max(1, titleLines.length) * titleLineHeight + 17;
    const bodyTop = Math.max(600, characterY + 80, imageProvided ? portrait.y + portrait.height + 82 : 0);
    if (bodyTop + 180 > PAGE_BOTTOM) throw new Error("Gear sheet title leaves too little room for item rows.");
    return { portrait, titleLines, titleY, titleLineHeight, characterY, bodyTop };
  }

  function createCanvas(canvasFactory) {
    if (typeof canvasFactory === "function") return canvasFactory();
    if (typeof document !== "undefined" && typeof document.createElement === "function") return document.createElement("canvas");
    throw new Error("Gear sheet export needs a canvasFactory or a browser document.");
  }

  function snapshotEntries(entries, language, slotLabel) {
    return (Array.isArray(entries) ? entries : []).map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const snapshot = { ...entry };
      if (entry.names && typeof entry.names === "object") snapshot.names = { ...entry.names };
      snapshot._gearSheetSlotLabel = localizedSlotLabel(snapshot.slot, language, slotLabel);
      return snapshot;
    });
  }

  function snapshotRenderOptions(options) {
    const source = options && typeof options === "object" ? options : {};
    const language = languageCode(source.language);
    const slotLabel = typeof source.slotLabel === "function" ? source.slotLabel : null;
    const characterIndex = Number(source.characterIndex);
    return {
      title: normalise(source.title) || "GEAR SHEET",
      characterName: normalise(source.characterName),
      characterIndex: Number.isFinite(characterIndex) ? Math.max(0, characterIndex) : 0,
      language,
      entries: snapshotEntries(source.entries, language, slotLabel),
      groups: normalizedGroups(source.groups),
      slotLabel,
      canvasFactory: typeof source.canvasFactory === "function" ? source.canvasFactory : null,
      image: source.image || null,
    };
  }

  function canvasToBlob(canvas) {
    if (typeof canvas.convertToBlob === "function") return canvas.convertToBlob({ type: "image/png" });
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") {
        reject(new Error("The gear sheet canvas cannot export a PNG."));
        return;
      }
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The gear sheet canvas returned an empty PNG.")), "image/png");
    });
  }

  async function decodeImageSource(source) {
    if (!source) return { image: null, owned: false };
    if (typeof source === "string") {
      if (typeof Image === "undefined") return { image: null, owned: false };
      const image = new Image();
      image.src = source;
      if (typeof image.decode === "function") await image.decode();
      else await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Could not decode the gear sheet portrait."));
      });
      return { image, owned: false };
    }

    if (typeof Blob !== "undefined" && source instanceof Blob) {
      if (typeof createImageBitmap === "function") return { image: await createImageBitmap(source), owned: true };
      if (typeof URL !== "undefined" && typeof Image !== "undefined") {
        const objectUrl = URL.createObjectURL(source);
        try {
          const image = new Image();
          image.src = objectUrl;
          if (typeof image.decode === "function") await image.decode();
          else await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("Could not decode the gear sheet portrait."));
          });
          return { image, owned: false };
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
      return { image: null, owned: false };
    }

    if (source.image && source.image !== source) return decodeImageSource(source.image);
    if (Number(source.naturalWidth || source.videoWidth || source.width) > 0) return { image: source, owned: false };
    return { image: null, owned: false };
  }

  async function render(options = {}) {
    const request = snapshotRenderOptions(options);
    let image = null;
    let decodedImage = { image: null, owned: false };
    let imageIncluded = false;
    try {
      if (request.image) {
        try {
          decodedImage = await decodeImageSource(request.image);
          image = decodedImage.image;
          imageIncluded = Boolean(image);
        } catch {
          image = null;
          decodedImage = { image: null, owned: false };
        }
      }

      const canvas = createCanvas(request.canvasFactory);
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create a 2D canvas context for the gear sheet.");
      const groups = groupEntries(request.entries, request.groups);
      const header = computeHeader(context, request.title, imageIncluded);
      const columnWidth = (WIDTH - MARGIN * 2 - 48) / 2;
      const pagePlans = planPages(context, groups, request.language, request.slotLabel, header.bodyTop, columnWidth);

      const pages = [];
      for (let index = 0; index < pagePlans.length; index += 1) {
        const page = pagePlans[index];
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const pageContext = canvas.getContext("2d");
        try {
          drawHeader(pageContext, { ...request, image }, request.language, index + 1, pagePlans.length, imageIncluded, header);
          drawBody(pageContext, page, request.language, columnWidth);
          const blob = await canvasToBlob(canvas);
          pages.push({
            blob,
            page: index + 1,
            pageCount: pagePlans.length,
            width: WIDTH,
            height: HEIGHT,
            rowCount: page.rowCount,
            entryIds: [...page.entryIds],
            imageIncluded,
          });
        } catch (error) {
          if (!imageIncluded) throw error;
          imageIncluded = false;
          image = null;
          // A cross-origin or otherwise non-exportable portrait must not make
          // the complete data sheet unavailable. Retry this page without art.
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const cleanContext = canvas.getContext("2d");
          drawHeader(cleanContext, { ...request, image: null }, request.language, index + 1, pagePlans.length, false, header);
          drawBody(cleanContext, page, request.language, columnWidth);
          const blob = await canvasToBlob(canvas);
          pages.push({
            blob,
            page: index + 1,
            pageCount: pagePlans.length,
            width: WIDTH,
            height: HEIGHT,
            rowCount: page.rowCount,
            entryIds: [...page.entryIds],
            imageIncluded: false,
          });
        }
      }

      return {
        pages,
        totalEntries: request.entries.filter((entry) => entry && typeof entry === "object").length,
        width: WIDTH,
        height: HEIGHT,
      };
    } finally {
      if (decodedImage.owned && decodedImage.image && typeof decodedImage.image.close === "function") {
        try { decodedImage.image.close(); } catch { /* Preserve the render result or original error. */ }
      }
    }
  }

  return Object.freeze({ render, wrapText, dimensions: Object.freeze({ width: WIDTH, height: HEIGHT }) });
});
