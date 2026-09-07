const itemSlotLabels = {
  head: { ko: "머리", en: "Head", ja: "頭" },
  body: { ko: "몸통", en: "Body", ja: "胴" },
  hands: { ko: "손", en: "Hands", ja: "手" },
  legs: { ko: "다리", en: "Legs", ja: "脚" },
  feet: { ko: "발", en: "Feet", ja: "足" },
  weapon: { ko: "무기", en: "Weapon", ja: "武器" },
};

const itemSlotByEquipSlotCategory = {
  1: "weapon",
  2: "weapon",
  3: "head",
  4: "body",
  5: "hands",
  7: "legs",
  8: "feet",
  13: "weapon",
};

export const supportedLanguages = ["ko", "en", "ja"];
export const supportedSlots = Object.keys(itemSlotLabels);

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
  return `https://xivapi.com/i/${bucket}/${icon}.png`;
}

function normaliseIconUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://xivapi.com");
    if (url.protocol !== "https:" || !["xivapi.com", "www.xivapi.com", "v2.xivapi.com"].includes(url.hostname)) return "";
    if (!url.pathname.startsWith("/i/")) return "";
    if (url.hostname === "v2.xivapi.com") url.hostname = "xivapi.com";
    return url.href;
  } catch {
    return "";
  }
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

export function searchKoreanItems(index, query, slot, limit = 8) {
  const queryNormalized = normaliseItemSearchText(query);
  return index
    .map(normaliseKoreanRecord)
    .filter(Boolean)
    .filter((item) => (!slot || item.slot === slot) && scoreItem(item, query, queryNormalized) >= 0)
    .sort((left, right) => scoreItem(right, query, queryNormalized) - scoreItem(left, query, queryNormalized))
    .slice(0, limit)
    .map(({ searchName, ...item }) => item);
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
  return itemSlotByEquipSlotCategory[Number(fields?.EquipSlotCategory?.value)] || "";
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
      headers: { "User-Agent": "glamour-atelier-item-search" },
    });
    if (!response.ok) throw new Error(`아이템 데이터 응답 오류 (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
