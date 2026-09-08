import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertKoreanItemIndexAudit,
  parseKoreanItemIndex,
} from "../functions/_shared/item-index.mjs";
import { supportedItemSlots } from "../functions/_shared/item-slots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shaPattern = /^[0-9a-f]{40}$/iu;
const defaultMinimumTotalRatio = 0.8;
const defaultMinimumSlotRatio = 0.7;
const defaultMaximumMissingIcons = 0;

export const defaultKoreanItemSource = Object.freeze({
  id: "Ra-Workspace/ffxiv-datamining-ko",
  owner: "Ra-Workspace",
  repository: "ffxiv-datamining-ko",
  branch: "master",
  path: "csv/Item.csv",
  apiUrl: "https://api.github.com/repos/Ra-Workspace/ffxiv-datamining-ko/commits?path=csv%2FItem.csv&sha=master&per_page=1",
  rawBaseUrl: "https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko",
});

export const defaultRequiredKoreanItems = Object.freeze([
  Object.freeze({ id: "15479", slot: "body", name: "아기돼지 의상" }),
  Object.freeze({ id: "15450", slot: "feet", name: "모그리 실내화" }),
]);

export function buildKoreanItemSnapshot(csv, {
  patch = "",
  sourceRevision = "",
  previousManifest = null,
  requiredItems = defaultRequiredKoreanItems,
  minimumTotalRatio = defaultMinimumTotalRatio,
  minimumSlotRatio = defaultMinimumSlotRatio,
  maximumMissingIcons = defaultMaximumMissingIcons,
} = {}) {
  const parsed = parseKoreanItemIndex(csv, { patch, sourceRevision });
  assertKoreanItemIndexAudit(parsed.audit);
  const records = [...parsed.records].sort((left, right) => Number(left.id) - Number(right.id));
  const slotCounts = countSlots(records);

  validateSnapshot(records, {
    previousManifest,
    requiredItems,
    minimumTotalRatio,
    minimumSlotRatio,
    maximumMissingIcons,
    slotCounts,
  });

  return {
    records,
    audit: parsed.audit,
    slotCounts,
  };
}

export function validateSnapshot(records, {
  previousManifest = null,
  requiredItems = defaultRequiredKoreanItems,
  minimumTotalRatio = defaultMinimumTotalRatio,
  minimumSlotRatio = defaultMinimumSlotRatio,
  maximumMissingIcons = defaultMaximumMissingIcons,
  slotCounts = countSlots(records),
} = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("한국어 아이템 snapshot이 비어 있습니다.");
  }

  const ids = new Set();
  let missingIcons = 0;
  records.forEach((record) => {
    const id = String(record?.id || "");
    const name = String(record?.names?.ko || "").trim();
    if (!/^\d+$/u.test(id) || Number(id) <= 0) throw new Error("잘못된 아이템 ID가 있습니다: " + (id || "(없음)"));
    if (ids.has(id)) throw new Error("한국어 아이템 snapshot에 중복 ID가 있습니다: " + id);
    ids.add(id);
    if (!name) throw new Error("아이템 " + id + "에 한국어 이름이 없습니다.");
    if (!supportedItemSlots.includes(record.slot)) throw new Error("아이템 " + id + "에 지원하지 않는 슬롯이 있습니다: " + record.slot);
    if (!String(record.iconUrl || "").startsWith("https://xivapi.com/i/")) missingIcons += 1;
  });

  if (missingIcons > Number(maximumMissingIcons)) {
    throw new Error("아이콘 URL이 없는 한국어 아이템이 " + missingIcons + "개 있습니다.");
  }

  supportedItemSlots.forEach((slot) => {
    if (!slotCounts[slot]) throw new Error("한국어 아이템 snapshot에 " + slot + " 아이템이 없습니다.");
  });

  const previousTotal = Number(previousManifest?.total);
  if (Number.isFinite(previousTotal) && previousTotal > 0 && records.length < previousTotal * Number(minimumTotalRatio)) {
    throw new Error("한국어 아이템 수가 비정상적으로 감소했습니다: " + previousTotal + " → " + records.length);
  }

  supportedItemSlots.forEach((slot) => {
    const previousCount = Number(previousManifest?.slots?.[slot]);
    if (Number.isFinite(previousCount) && previousCount > 0 && slotCounts[slot] < previousCount * Number(minimumSlotRatio)) {
      throw new Error("한국어 " + slot + " 아이템 수가 비정상적으로 감소했습니다: " + previousCount + " → " + slotCounts[slot]);
    }
  });

  for (const required of requiredItems || []) {
    const record = records.find((candidate) => candidate.id === String(required.id) && candidate.slot === required.slot);
    if (!record || (required.name && record.names?.ko !== required.name)) {
      throw new Error("필수 회귀 아이템이 없습니다: " + (required.name || required.id));
    }
  }

  return { slotCounts, missingIcons };
}

export function countSlots(records) {
  return supportedItemSlots.reduce((counts, slot) => {
    counts[slot] = records.filter((record) => record?.slot === slot).length;
    return counts;
  }, {});
}

export function serializeKoreanItemSnapshot(records) {
  return JSON.stringify(records) + "\n";
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function createKoreanItemManifest({ source, records, audit, slotCounts, dataText, generatedAt }) {
  return {
    schemaVersion: 1,
    sourceRevision: source.sourceRevision,
    source: {
      id: source.id,
      branch: source.branch,
      path: source.path,
      url: source.itemCsvUrl,
      revisionUrl: source.revisionUrl,
    },
    generatedAt,
    total: records.length,
    slots: slotCounts,
    dataSha256: sha256Hex(dataText),
    audit: {
      sourceRows: audit.sourceRows,
      namedRows: audit.namedRows,
      indexedRecords: audit.indexedRecords,
      invalidIdRows: audit.invalidIdRows,
      emptyNameRows: audit.emptyNameRows,
      ignoredRows: audit.ignoredByCategory.reduce((total, entry) => total + entry.count, 0),
    },
  };
}

export async function resolveKoreanItemSource({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("데이터 원본을 가져올 fetch 구현이 없습니다.");
  const explicitRevision = String(env.FFXIV_KO_SOURCE_REVISION || "").trim();
  const customCsvUrl = String(env.FFXIV_KO_ITEM_CSV_URL || "").trim();

  if (explicitRevision) {
    assertPinnedRevision(explicitRevision);
    return createSourceMetadata({
      sourceRevision: explicitRevision,
      itemCsvUrl: customCsvUrl || defaultKoreanItemSource.rawBaseUrl + "/" + explicitRevision + "/" + defaultKoreanItemSource.path,
    });
  }
  if (customCsvUrl) {
    throw new Error("사용자 지정 FFXIV_KO_ITEM_CSV_URL에는 40자리 FFXIV_KO_SOURCE_REVISION이 필요합니다.");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ff14-glamour-maker2-item-data-sync",
  };
  const token = String(env.GITHUB_TOKEN || "").trim();
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetchImpl(defaultKoreanItemSource.apiUrl, { headers });
  if (!response.ok) throw new Error("한국어 아이템 원본 버전 조회 오류 (" + response.status + ")");
  const payload = await response.json();
  const sourceRevision = Array.isArray(payload) ? payload[0]?.sha : payload?.sha;
  assertPinnedRevision(sourceRevision);
  return createSourceMetadata({
    sourceRevision,
    itemCsvUrl: defaultKoreanItemSource.rawBaseUrl + "/" + sourceRevision + "/" + defaultKoreanItemSource.path,
  });
}

export async function fetchKoreanItemCsv(source, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(source.itemCsvUrl, {
    headers: {
      "User-Agent": "ff14-glamour-maker2-item-data-sync",
    },
  });
  if (!response.ok) throw new Error("한국어 아이템 CSV 응답 오류 (" + response.status + ")");
  const csv = await response.text();
  const trimmed = csv.trim();
  if (!trimmed || /^<!doctype html|<html[\s>]/iu.test(trimmed.slice(0, 256))) {
    throw new Error("한국어 아이템 CSV가 비어 있거나 HTML 오류 페이지입니다.");
  }
  return csv;
}

export async function syncKoreanItemSnapshot({
  outputPath = path.join(root, "assets", "data", "items-ko.json"),
  manifestPath = path.join(root, "assets", "data", "items-ko.manifest.json"),
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => new Date(),
} = {}) {
  const source = await resolveKoreanItemSource({ fetchImpl, env });
  const previousManifest = readJsonIfExists(manifestPath);
  const csv = await fetchKoreanItemCsv(source, { fetchImpl });
  const snapshot = buildKoreanItemSnapshot(csv, {
    patch: env.FFXIV_KO_PATCH || "",
    sourceRevision: source.sourceRevision,
    previousManifest,
    minimumTotalRatio: readRatio(env.FFXIV_KO_MINIMUM_TOTAL_RATIO, defaultMinimumTotalRatio),
    minimumSlotRatio: readRatio(env.FFXIV_KO_MINIMUM_SLOT_RATIO, defaultMinimumSlotRatio),
    maximumMissingIcons: readNonNegativeInteger(env.FFXIV_KO_MAX_MISSING_ICONS, defaultMaximumMissingIcons),
  });
  const dataText = serializeKoreanItemSnapshot(snapshot.records);
  const existingDataText = readTextIfExists(outputPath);
  const dataChanged = existingDataText !== dataText;
  const generatedAt = !dataChanged && previousManifest?.sourceRevision === source.sourceRevision
    ? String(previousManifest.generatedAt || now().toISOString())
    : now().toISOString();
  const manifest = createKoreanItemManifest({
    source,
    records: snapshot.records,
    audit: snapshot.audit,
    slotCounts: snapshot.slotCounts,
    dataText,
    generatedAt,
  });
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const existingManifestText = readTextIfExists(manifestPath);
  const manifestChanged = existingManifestText !== manifestText;

  if (dataChanged) writeTextAtomically(outputPath, dataText);
  if (manifestChanged) writeTextAtomically(manifestPath, manifestText);

  return {
    changed: dataChanged || manifestChanged,
    dataChanged,
    manifestChanged,
    source,
    records: snapshot.records.length,
    slotCounts: snapshot.slotCounts,
    dataSha256: manifest.dataSha256,
  };
}

export function writeTextAtomically(filePath, text) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, "." + path.basename(filePath) + "." + process.pid + "." + Date.now() + ".tmp");
  fs.writeFileSync(temporaryPath, text, "utf8");
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    fs.rmSync(filePath, { force: true });
    fs.renameSync(temporaryPath, filePath);
  }
}

function createSourceMetadata({ sourceRevision, itemCsvUrl }) {
  return {
    id: defaultKoreanItemSource.id,
    branch: defaultKoreanItemSource.branch,
    path: defaultKoreanItemSource.path,
    sourceRevision: String(sourceRevision),
    itemCsvUrl,
    revisionUrl: "https://github.com/" + defaultKoreanItemSource.id + "/commit/" + sourceRevision,
  };
}

function assertPinnedRevision(value) {
  if (!shaPattern.test(String(value || ""))) {
    throw new Error("한국어 아이템 원본 커밋 SHA가 40자리 hex 형식이 아닙니다.");
  }
}

function readRatio(value, fallback) {
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : fallback;
}

function readNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function readJsonIfExists(filePath) {
  const text = readTextIfExists(filePath);
  return text === null ? null : JSON.parse(text);
}
