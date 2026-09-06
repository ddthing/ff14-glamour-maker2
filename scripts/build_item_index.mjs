import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = process.env.FFXIV_KO_ITEM_CSV_URL
  || "https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv/Item.csv";
const outputPath = path.resolve(root, process.argv[2] || "assets/data/items-ko.json");
const sourceRevision = process.env.FFXIV_KO_SOURCE_REVISION || "ffxiv-ko-datamining-latest";
const patch = process.env.FFXIV_KO_PATCH || "";
const slotByEquipSlotCategory = {
  1: "weapon",
  2: "weapon",
  3: "head",
  4: "body",
  5: "hands",
  7: "legs",
  8: "feet",
  13: "weapon",
};

const response = await fetch(sourceUrl, {
  headers: { "User-Agent": "glamour-atelier-item-index-builder" },
});
if (!response.ok) throw new Error(`한국어 아이템 CSV 응답 오류 (${response.status})`);

const csv = await response.text();
const records = parseKoreanItemIndex(csv);
if (!records.length) throw new Error("한국어 아이템 인덱스가 비어 있습니다. CSV 열 구조를 확인해주세요.");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(records)}\n`, "utf8");
console.log(`Built ${records.length} Korean item records → ${path.relative(root, outputPath)}`);

function parseKoreanItemIndex(value) {
  const rows = value.split(/\r?\n/);
  const records = [];
  for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
    if (!rows[rowIndex]) continue;
    const fields = parseCsvLine(rows[rowIndex]);
    const id = Number(fields[0]);
    const name = String(fields[10] || "").trim();
    const slot = slotByEquipSlotCategory[Number(fields[18])];
    const iconId = Number(fields[11]);
    const itemLevel = Number(fields[12]);
    if (!Number.isInteger(id) || id <= 0 || !name || !slot) continue;
    records.push({
      id: String(id),
      slot,
      names: { ko: name },
      iconUrl: buildIconUrl(iconId),
      itemLevel: Number.isFinite(itemLevel) && itemLevel > 0 ? itemLevel : null,
      patch,
      sourceRevision,
    });
  }
  return records;
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.replace(/\r$/, ""));
  return fields;
}

function buildIconUrl(iconId) {
  if (!Number.isInteger(iconId) || iconId <= 0) return "";
  const icon = String(iconId).padStart(6, "0");
  const bucket = String(Math.floor(iconId / 1000) * 1000).padStart(6, "0");
  return `https://xivapi.com/i/${bucket}/${icon}.png`;
}
