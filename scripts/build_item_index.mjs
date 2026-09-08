import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertKoreanItemIndexAudit,
  parseKoreanItemIndex,
} from "../functions/_shared/item-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = process.env.FFXIV_KO_ITEM_CSV_URL
  || "https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv/Item.csv";
const outputPath = path.resolve(root, process.argv[2] || "assets/data/items-ko.json");
const sourceRevision = process.env.FFXIV_KO_SOURCE_REVISION || "ffxiv-ko-datamining-latest";
const patch = process.env.FFXIV_KO_PATCH || "";
const response = await fetch(sourceUrl, {
  headers: { "User-Agent": "tuyeong-set-maker2-item-index-builder" },
});
if (!response.ok) throw new Error(`한국어 아이템 CSV 응답 오류 (${response.status})`);

const csv = await response.text();
const parsed = parseKoreanItemIndex(csv, { patch, sourceRevision });
assertKoreanItemIndexAudit(parsed.audit);
const records = parsed.records;
if (!records.length) throw new Error("한국어 아이템 인덱스가 비어 있습니다. CSV 열 구조를 확인해주세요.");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(records)}\n`, "utf8");
const ignoredCount = parsed.audit.ignoredByCategory.reduce((total, entry) => total + entry.count, 0);
console.log(`Built ${records.length} Korean item records → ${path.relative(root, outputPath)} (ignored ${ignoredCount} known non-outfit rows)`);
if (parsed.audit.emptyNameRows) {
  const details = parsed.audit.emptyNameByCategory.map(({ category, count }) => `${category}: ${count}`).join(", ");
  console.warn(`Skipped ${parsed.audit.emptyNameRows} source rows without a localized name (by category: ${details})`);
}
