import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseKoreanRecord } from "../functions/_shared/item-search.mjs";
import { supportedItemSlots } from "../functions/_shared/item-slots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.resolve(root, process.argv[2] || "assets/data/items-ko.json");
const sampleLimit = readPositiveInteger(process.env.FFXIV_ICON_HEALTH_SAMPLE_SIZE, 30);
const requiredItemIds = ["15479", "15450", "52428"];
const requestTimeoutMs = 8000;
const retryCount = 2;
const concurrency = 4;

const records = readSnapshot(snapshotPath);
const samples = selectSamples(records, sampleLimit);
const results = await mapWithConcurrency(samples, concurrency, async (record) => {
  const normalised = normaliseKoreanRecord(record);
  if (!normalised?.iconUrl) {
    return { record, error: "정규화된 아이콘 URL이 없습니다." };
  }
  try {
    const response = await fetchIcon(normalised.iconUrl);
    return { record, url: normalised.iconUrl, ...response };
  } catch (error) {
    return { record, url: normalised.iconUrl, error: error.message };
  }
});

const failures = results.filter((result) => result.error);
if (failures.length) {
  const details = failures
    .map(({ record, url, error }) => `${record.id} ${record.names?.ko || "(이름 없음)"} · ${url || "(없음)"} · ${error}`)
    .join("\n");
  throw new Error(`아이템 아이콘 health check 실패 (${failures.length}/${results.length}):\n${details}`);
}

console.log(`PASS: ${results.length}개 대표 아이템 아이콘이 image 응답으로 확인되었습니다.`);
console.log(`Checked item IDs: ${results.map(({ record }) => record.id).join(", ")}`);

function readSnapshot(filePath) {
  const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`한국어 아이템 snapshot이 비어 있습니다: ${filePath}`);
  }
  return records;
}

function selectSamples(records, limit) {
  const byId = new Map(records.map((record) => [String(record?.id || ""), record]));
  const selected = [];
  const selectedIds = new Set();

  const add = (record) => {
    const id = String(record?.id || "");
    if (!id || selectedIds.has(id)) return;
    selectedIds.add(id);
    selected.push(record);
  };

  requiredItemIds.forEach((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`필수 아이템이 snapshot에 없습니다: ${id}`);
    add(record);
  });
  supportedItemSlots.forEach((slot) => {
    const slotRecords = records
      .filter((record) => record?.slot === slot)
      .sort((left, right) => Number(left.id) - Number(right.id));
    add(slotRecords[0]);
    add(slotRecords[Math.floor(slotRecords.length / 2)]);
    add(slotRecords.at(-1));
  });

  const remaining = Math.max(0, limit - selected.length);
  if (remaining > 0) {
    const step = records.length / remaining;
    for (let index = 0; index < remaining; index += 1) {
      add(records[Math.min(records.length - 1, Math.floor(index * step))]);
    }
  }
  return selected;
}

async function fetchIcon(url) {
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ff14-glamour-maker2-item-icon-health-check" },
      });
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      const body = new Uint8Array(await response.arrayBuffer());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!contentType.startsWith("image/")) throw new Error(`content-type ${contentType || "(없음)"}`);
      if (!body.length) throw new Error("빈 이미지 응답");
      if (contentType.includes("png") && !isPng(body)) throw new Error("PNG signature 불일치");
      return { contentType, bytes: body.length };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) await delay(250 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("알 수 없는 요청 오류");
}

function isPng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return signature.every((value, index) => bytes[index] === value);
}

async function mapWithConcurrency(values, workerCount, worker) {
  const results = Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(workerCount, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
