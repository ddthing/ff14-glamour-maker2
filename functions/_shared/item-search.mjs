import {
  resolveItemSlotFromEquipSlotCategory,
  supportedItemSlots,
} from "./item-slots.mjs";

const itemSlotLabels = {
  head: { ko: "머리", en: "Head", ja: "頭" },
  body: { ko: "몸", en: "Body", ja: "胴" },
  hands: { ko: "손", en: "Hands", ja: "手" },
  legs: { ko: "다리", en: "Legs", ja: "脚" },
  feet: { ko: "발", en: "Feet", ja: "足" },
  weapon: { ko: "무기", en: "Weapon", ja: "武器" },
};

export const supportedLanguages = ["ko", "en", "ja"];
export const supportedSlots = supportedItemSlots;

const legacyIconUrlPattern = /^\/i\/(\d{6})\/(\d{6})\.png$/u;
const iconAssetPathPattern = /^ui\/icon\/(\d{6})\/(\d{6})(?:_hr1)?\.tex$/u;

export function normaliseItemSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/자켓/gu, "재킷")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function itemMeta(slot, levelItem, language = "ko") {
  const label = itemSlotLabels[slot]?.[language] || itemSlotLabels[slot]?.ko || "장비";
  const level = Number(levelItem);
  return Number.isFinite(level) && level > 0 ? `${label} · i${level}` : label;
}

export function buildIconUrl(iconId) {
  const numericIcon = Number(iconId);
  if (!Number.isInteger(numericIcon) || numericIcon <= 0) return "";
  const icon = String(numericIcon).padStart(6, "0");
  const bucket = String(Math.floor(numericIcon / 1000) * 1000).padStart(6, "0");
  return buildIconAssetUrl(bucket, icon);
}

function normaliseIconUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const directAssetUrl = buildIconAssetUrlFromPath(raw);
  if (directAssetUrl) return directAssetUrl;
  try {
    const url = new URL(raw, "https://xivapi.com");
    if (url.protocol !== "https:" || !["xivapi.com", "www.xivapi.com", "v2.xivapi.com"].includes(url.hostname)) return "";
    const legacyMatch = legacyIconUrlPattern.exec(url.pathname);
    if (legacyMatch) return buildIconAssetUrl(legacyMatch[1], legacyMatch[2]);
    if (url.pathname === "/api/asset" && url.searchParams.get("format") === "png") {
      const assetUrl = buildIconAssetUrlFromPath(url.searchParams.get("path"));
      if (assetUrl) return assetUrl;
    }
    return buildIconAssetUrlFromPath(url.pathname) || "";
  } catch {
    return "";
  }
}

function buildIconAssetUrlFromPath(value) {
  const path = String(value || "").trim().replace(/^\/+/, "");
  const match = iconAssetPathPattern.exec(path);
  return match ? buildIconAssetUrl(match[1], match[2]) : "";
}

function buildIconAssetUrl(bucket, icon) {
  const url = new URL("https://v2.xivapi.com/api/asset");
  url.searchParams.set("path", `ui/icon/${bucket}/${icon}.tex`);
  url.searchParams.set("format", "png");
  return url.href;
}

export function resolveItemSearchLanguage(query, requestedLanguage) {
  if (/^\d+$/.test(query)) return requestedLanguage;
  if (/[\uAC00-\uD7A3]/u.test(query)) return "ko";
  if (/[\u3040-\u30FF]/u.test(query)) return "ja";
  return requestedLanguage === "ja" ? "ja" : "en";
}

export function normaliseKoreanRecord(record) {
  const id = String(record?.id || record?.itemId || "");
  const name = String(record?.names?.ko || record?.name || "").trim();
  const slot = supportedSlots.includes(record?.slot) ? record.slot : "";
  if (!id || !name || !slot) return null;
  const itemLevel = Number(record.itemLevel);
  return {
    id,
    slot,
    icon: "",
    iconUrl: normaliseIconUrl(record.iconUrl),
    names: { ko: name },
    meta: { ko: itemMeta(slot, itemLevel, "ko") },
    itemLevel: Number.isFinite(itemLevel) && itemLevel > 0 ? itemLevel : null,
    patch: String(record.patch || ""),
    sourceRevision: String(record.sourceRevision || ""),
    source: "ffxiv-ko-snapshot",
    searchName: normaliseItemSearchText(name),
  };
}

export function isSupportedIconUrl(value) {
  return Boolean(normaliseIconUrl(value));
}

// The Pages Function reuses the same immutable index for the lifetime of an
// isolate. Normalising 23k records for every keystroke made search cost scale
// with the catalog instead of the query. WeakMap keeps this cache scoped to
// the exact index instance without retaining replaced/test indexes forever.
const normalizedKoreanIndexCache = new WeakMap();

function getNormalizedKoreanIndex(index) {
  if (!Array.isArray(index)) return { all: [], bySlot: new Map() };
  const cached = normalizedKoreanIndexCache.get(index);
  if (cached) return cached;
  const normalized = index.map(normaliseKoreanRecord).filter(Boolean);
  const bySlot = new Map();
  normalized.forEach((item) => {
    const records = bySlot.get(item.slot) || [];
    records.push(item);
    bySlot.set(item.slot, records);
  });
  const searchable = { all: normalized, bySlot };
  normalizedKoreanIndexCache.set(index, searchable);
  return searchable;
}

export function searchKoreanItems(index, query, slot, limit = 8) {
  const queryNormalized = normaliseItemSearchText(query);
  const normalized = getNormalizedKoreanIndex(index);
  const candidates = slot ? normalized.bySlot.get(slot) || [] : normalized.all;
  const matches = [];
  candidates.forEach((item, order) => {
    const score = scoreItem(item, query, queryNormalized);
    if (score >= 0) matches.push({ item, score, order });
  });
  return matches
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit)
    .map(({ item }) => {
      const { searchName, ...publicItem } = item;
      // Do not expose the cached record's nested objects to callers that may
      // enrich or otherwise mutate a result before it is registered.
      return { ...publicItem, names: { ...publicItem.names }, meta: { ...publicItem.meta } };
    });
}

function scoreItem(item, query, queryNormalized) {
  if (/^\d+$/.test(query) && item.id === query) return 1000;
  if (!queryNormalized) return 0;
  if (item.searchName === queryNormalized) return 900;
  if (item.searchName.startsWith(queryNormalized)) return 700;
  if (item.searchName.includes(queryNormalized)) return 500;
  return -1;
}

function inferItemSlot(fields) {
  const equipSlotFields = fields?.EquipSlotCategory?.fields || {};
  if (Number(equipSlotFields.Head) > 0) return "head";
  if (Number(equipSlotFields.Body) > 0) return "body";
  if (Number(equipSlotFields.Gloves) > 0) return "hands";
  if (Number(equipSlotFields.Legs) > 0) return "legs";
  if (Number(equipSlotFields.Feet) > 0) return "feet";
  if (Number(equipSlotFields.MainHand) > 0 || Number(equipSlotFields.OffHand) > 0) return "weapon";
  return resolveItemSlotFromEquipSlotCategory(fields?.EquipSlotCategory?.value);
}

function getIconUrl(icon) {
  const directUrl = normaliseIconUrl(icon?.path) || normaliseIconUrl(icon?.url);
  if (directUrl) return directUrl;
  return buildIconUrl(icon?.id);
}

export function normaliseXivItem(result, language) {
  const fields = result?.fields || {};
  const name = String(fields.Name || "").trim();
  const id = String(result?.row_id || "");
  const slot = inferItemSlot(fields);
  if (!id || !name || !slot) return null;
  const levelItem = fields.LevelItem?.value ?? fields.LevelItem;
  return {
    id,
    slot,
    icon: "",
    iconUrl: getIconUrl(fields.Icon),
    names: { [language]: name },
    meta: { [language]: itemMeta(slot, levelItem, language) },
    itemLevel: Number(levelItem) || null,
    source: "xivapi",
  };
}

export async function searchXivItems(query, language, slot, { fetchImpl = fetch, version = "" } = {}) {
  if (/^\d+$/.test(query)) {
    const url = new URL(`https://v2.xivapi.com/api/sheet/Item/${encodeURIComponent(query)}`);
    url.searchParams.set("fields", "Name,Icon,LevelItem,EquipSlotCategory");
    url.searchParams.set("language", language);
    if (version) url.searchParams.set("version", version);
    const result = await fetchJson(url, fetchImpl);
    const item = normaliseXivItem(result, language);
    return item && (!slot || item.slot === slot) ? [item] : [];
  }
  const safeQuery = query.replace(/["\\]/g, "\\$&");
  const url = new URL("https://v2.xivapi.com/api/search");
  url.searchParams.set("sheets", "Item");
  url.searchParams.set("fields", "Name,Icon,LevelItem,EquipSlotCategory");
  url.searchParams.set("query", `Name~"${safeQuery}"`);
  url.searchParams.set("language", language);
  url.searchParams.set("limit", "24");
  if (version) url.searchParams.set("version", version);
  const payload = await fetchJson(url, fetchImpl);
  return (payload.results || [])
    .map((entry) => normaliseXivItem(entry, language))
    .filter((item) => item && (!slot || item.slot === slot))
    .slice(0, 8);
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "tuyeong-set-maker2-item-search" },
    });
    if (!response.ok) throw new Error(`아이템 데이터 응답 오류 (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
