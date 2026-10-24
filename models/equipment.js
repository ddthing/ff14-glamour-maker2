/* Pure equipment schema and projection helpers for persisted looks. */
const Equipment = (() => {
  const LANGUAGES = Object.freeze(["ko", "en", "ja"]);
  const CORE_SLOT_ORDER = Object.freeze(["head", "body", "hands", "legs", "feet"]);
  const EXTRA_SLOT_ORDER = Object.freeze([
    "weapon", "offhand", "earrings", "necklace", "bracelet",
    "ringLeft", "ringRight", "facewear", "fashion", "custom",
  ]);
  const SLOT_ORDER = Object.freeze([...CORE_SLOT_ORDER, ...EXTRA_SLOT_ORDER]);
  const slots = Object.freeze({ core: CORE_SLOT_ORDER, extras: EXTRA_SLOT_ORDER, all: SLOT_ORDER });
  const MAX_EXTRA_ENTRIES = 32;
  const MAX_FIELD_LENGTH = 160;
  const MAX_EXTRA_ID_LENGTH = 80;
  const COMPOSITION_LAYERS = Object.freeze(["info-front", "person-front"]);
  const slotLabels = Object.freeze({
    head: Object.freeze({ ko: "머리", en: "Head", ja: "頭" }),
    body: Object.freeze({ ko: "몸", en: "Body", ja: "胴" }),
    hands: Object.freeze({ ko: "손", en: "Hands", ja: "手" }),
    legs: Object.freeze({ ko: "다리", en: "Legs", ja: "脚" }),
    feet: Object.freeze({ ko: "발", en: "Feet", ja: "足" }),
    weapon: Object.freeze({ ko: "무기", en: "Weapon", ja: "武器" }),
    offhand: Object.freeze({ ko: "보조 장비", en: "Off-hand", ja: "サブアーム" }),
    earrings: Object.freeze({ ko: "귀걸이", en: "Earrings", ja: "耳飾り" }),
    necklace: Object.freeze({ ko: "목걸이", en: "Necklace", ja: "首飾り" }),
    bracelet: Object.freeze({ ko: "팔찌", en: "Bracelet", ja: "腕輪" }),
    ringLeft: Object.freeze({ ko: "왼쪽 반지", en: "Left ring", ja: "左指輪" }),
    ringRight: Object.freeze({ ko: "오른쪽 반지", en: "Right ring", ja: "右指輪" }),
    facewear: Object.freeze({ ko: "얼굴 장식", en: "Facewear", ja: "フェイスアクセサリー" }),
    fashion: Object.freeze({ ko: "패션소품", en: "Fashion", ja: "ファッションアクセサリー" }),
    custom: Object.freeze({ ko: "기타", en: "Custom", ja: "カスタム" }),
  });
  function defineGroup(id, ko, en, ja, groupSlots) {
    return Object.freeze({
      id,
      labels: Object.freeze({ ko, en, ja }),
      labelsKO: ko,
      labelsEN: en,
      labelsJA: ja,
      slots: Object.freeze(groupSlots),
    });
  }

  const groups = Object.freeze([
    defineGroup("core", "기본 장비", "Core gear", "基本装備", CORE_SLOT_ORDER),
    defineGroup("weapons", "무기", "Weapons", "武器", ["weapon", "offhand"]),
    defineGroup("accessories", "액세서리", "Accessories", "アクセサリー", ["earrings", "necklace", "bracelet", "ringLeft", "ringRight"]),
    defineGroup("facewear", "얼굴 장식", "Facewear", "フェイスウェア", ["facewear"]),
    defineGroup("fashion", "패션소품", "Fashion", "ファッション", ["fashion"]),
    defineGroup("custom", "기타", "Custom", "カスタム", ["custom"]),
  ]);

  const supportedSlot = (slot) => SLOT_ORDER.includes(slot);
  const supportedLanguage = (language) => {
    const base = typeof language === "string" ? language.toLowerCase().split("-")[0] : "";
    return LANGUAGES.includes(base) ? base : "ko";
  };

  function normalizeNames(value) {
    const result = {};
    for (const language of LANGUAGES) {
      const name = value && typeof value[language] === "string" ? value[language] : "";
      result[language] = name.slice(0, MAX_FIELD_LENGTH);
    }
    return result;
  }

  function normalizeItemId(value) {
    if (typeof value === "number") {
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string" || !/^\d{1,16}$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function normalizeEntry(value, defaultSlot) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const slot = supportedSlot(value.slot) ? value.slot : supportedSlot(defaultSlot) ? defaultSlot : "";
    if (!slot) return null;
    if (typeof value.id !== "string"
      || value.id.length > MAX_EXTRA_ID_LENGTH
      || !/^extra-[A-Za-z0-9][A-Za-z0-9_-]{0,73}$/.test(value.id)) return null;

    const source = value.source === "catalog" ? "catalog" : "manual";
    const itemId = source === "catalog" ? normalizeItemId(value.itemId) : null;
    if (source === "catalog" && itemId === null) return null;
    const names = normalizeNames(value.names);
    if (source === "manual" && !Object.values(names).some((name) => name.trim())) return null;

    const result = {
      id: value.id,
      slot,
      names,
      itemId,
      source,
      showOnCard: value.showOnCard !== false,
    };
    if (typeof value.note === "string" && value.note.trim()) {
      result.note = value.note.slice(0, MAX_FIELD_LENGTH);
    }
    return result;
  }

  function uniqueId(id, used, ordinal) {
    if (!used.has(id)) return id;
    const suffix = `-${ordinal + 1}`;
    const base = id.slice(0, MAX_EXTRA_ID_LENGTH - suffix.length);
    let candidate = `${base}${suffix}`;
    let increment = ordinal + 1;
    while (used.has(candidate)) {
      increment += 1;
      const nextSuffix = `-${increment}`;
      candidate = `${id.slice(0, MAX_EXTRA_ID_LENGTH - nextSuffix.length)}${nextSuffix}`;
    }
    return candidate;
  }

  function normalizeEntryList(value) {
    const usedIds = new Set();
    const entries = [];
    for (const raw of Array.isArray(value) ? value.slice(0, MAX_EXTRA_ENTRIES) : []) {
      const entry = normalizeEntry(raw);
      if (!entry) continue;
      entry.id = uniqueId(entry.id, usedIds, entries.length);
      usedIds.add(entry.id);
      entries.push(entry);
    }
    return entries;
  }

  function normalizeExtras(value) {
    const lists = Array.isArray(value) ? value : [];
    return Array.from({ length: 5 }, (_, index) => normalizeEntryList(lists[index]));
  }

  function normalizeVisibility(value) {
    const characters = Array.isArray(value) ? value : [];
    return Array.from({ length: 5 }, (_, index) => normalizeVisibilityCharacter(characters[index]));
  }

  function normalizeVisibilityCharacter(value) {
    const character = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(CORE_SLOT_ORDER.map((slot) => [slot, character[slot] !== false]));
  }

  function normalizeComposition(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const parsedGap = Number(source.infoGap);
    const infoGap = Number.isFinite(parsedGap)
      ? Math.min(64, Math.max(0, Math.round(parsedGap)))
      : 0;
    return {
      layer: COMPOSITION_LAYERS.includes(source.layer) ? source.layer : "info-front",
      protectText: source.protectText === false ? false : true,
      infoGap,
    };
  }

  function ensureLook(look) {
    const source = look && typeof look === "object" && !Array.isArray(look) ? look : {};
    return {
      ...source,
      extraEquipment: normalizeExtras(source.extraEquipment),
      cardVisibility: normalizeVisibility(source.cardVisibility),
      cardComposition: normalizeComposition(source.cardComposition),
    };
  }

  function slotLabel(slot, language = "ko") {
    const labels = slotLabels[slot];
    return labels?.[supportedLanguage(language)] || String(slot || "");
  }

  function localizedName(names, language = "ko") {
    const normalized = normalizeNames(names);
    const requested = supportedLanguage(language);
    return normalized[requested] || normalized.en || normalized.ko || normalized.ja || "";
  }

  function secondaryLocalizedName(names, language = "ko") {
    const normalized = normalizeNames(names);
    const primary = localizedName(normalized, language);
    const requested = supportedLanguage(language);
    if (requested === "en") return "";
    return normalized.en && normalized.en !== primary ? normalized.en : "";
  }

  function createCatalogLookup(coreItems) {
    if (Array.isArray(coreItems)) {
      const indexed = new Map();
      for (const item of coreItems) {
        if (item?.id !== undefined && item?.id !== null) indexed.set(String(item.id), item);
      }
      return (id) => indexed.get(String(id)) || null;
    }
    if (coreItems instanceof Map) return (id) => coreItems.get(String(id)) || coreItems.get(id) || null;
    if (coreItems && typeof coreItems.get === "function") return (id) => coreItems.get(String(id)) || coreItems.get(id) || null;
    return (id) => coreItems && typeof coreItems === "object" ? coreItems[String(id)] || null : null;
  }

  function entriesFor({ look, characterIndex = 0, coreItems = [], language = "ko", selectedOnly = false } = {}) {
    const index = Number.isInteger(characterIndex) ? Math.min(4, Math.max(0, characterIndex)) : 0;
    const outfit = Array.isArray(look?.outfits) ? look.outfits[index] || {} : {};
    const visibility = normalizeVisibilityCharacter(Array.isArray(look?.cardVisibility) ? look.cardVisibility[index] : null);
    const extraEntries = normalizeEntryList(Array.isArray(look?.extraEquipment) ? look.extraEquipment[index] : null);
    const catalogItemFor = createCatalogLookup(coreItems);
    const entries = [];

    for (const slot of CORE_SLOT_ORDER) {
      const itemId = normalizeItemId(outfit[slot]);
      if (itemId === null) continue;
      const item = catalogItemFor(itemId);
      if (!item || item.slot !== slot) continue;
      const names = normalizeNames(item.names);
      const record = {
        id: String(item.id),
        slot,
        names,
        name: localizedName(names, language),
        secondaryName: secondaryLocalizedName(names, language),
        itemId,
        source: "catalog",
        showOnCard: visibility[slot],
        extra: false,
      };
      if (!selectedOnly || record.showOnCard) entries.push(record);
    }

    for (const entry of extraEntries) {
      const catalogItem = entry.source === "catalog" ? catalogItemFor(entry.itemId) : null;
      const catalogNames = normalizeNames(catalogItem?.names);
      const names = Object.fromEntries(LANGUAGES.map((language) => [
        language,
        entry.names[language] || catalogNames[language],
      ]));
      const record = {
        id: entry.id,
        slot: entry.slot,
        names,
        name: localizedName(names, language),
        secondaryName: secondaryLocalizedName(names, language),
        itemId: entry.itemId,
        source: entry.source,
        showOnCard: entry.showOnCard,
        extra: true,
      };
      if (entry.note !== undefined) record.note = entry.note;
      if (!selectedOnly || record.showOnCard) entries.push(record);
    }
    return entries;
  }

  return Object.freeze({
    LANGUAGES,
    CORE_SLOT_ORDER,
    EXTRA_SLOT_ORDER,
    SLOT_ORDER,
    slots,
    MAX_EXTRA_ENTRIES,
    MAX_FIELD_LENGTH,
    COMPOSITION_LAYERS,
    slotLabels,
    groups,
    normalizeItemId,
    normalizeEntry,
    normalizeExtras,
    normalizeVisibility,
    normalizeComposition,
    ensureLook,
    slotLabel,
    localizedName,
    secondaryLocalizedName,
    entriesFor,
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = Equipment;
else if (typeof globalThis !== "undefined") globalThis.Equipment = Equipment;
