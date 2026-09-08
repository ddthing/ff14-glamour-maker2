import { buildIconUrl } from "./item-search.mjs";
import { classifyEquipSlotCategory } from "./item-slots.mjs";

const auditExampleLimit = 3;

// Canonical Korean Item.csv adapter. The builder and the local fallback both
// cross this seam so CSV parsing and omission checks cannot drift apart.
export function parseKoreanItemIndex(value, { patch = "", sourceRevision = "" } = {}) {
  const rows = parseCsvRows(String(value || ""));
  const columns = resolveItemColumns(rows);
  const records = [];
  const seenIds = new Set();
  const duplicateIds = new Set();
  const ignoredByCategory = new Map();
  const unknownCategories = new Map();
  const emptyNameByCategory = new Map();
  let namedRows = 0;
  let emptyNameRows = 0;
  let invalidIdRows = 0;

  rows.forEach((fields) => {
    const idValue = stripBom(fields[columns.id]);
    const id = Number(idValue);
    if (!Number.isInteger(id) || id <= 0) {
      invalidIdRows += 1;
      return;
    }

    const category = classifyEquipSlotCategory(fields[columns.equipSlotCategory]);
    const name = String(fields[columns.name] || "").trim();
    if (!name) {
      addCategoryAudit(emptyNameByCategory, category, id, "(이름 없음)");
      if (category.status === "unknown") addCategoryAudit(unknownCategories, category, id, "(이름 없음)");
      emptyNameRows += 1;
      return;
    }
    namedRows += 1;

    if (!category.slot) {
      addCategoryAudit(ignoredByCategory, category, id, name);
      if (category.status === "unknown") addCategoryAudit(unknownCategories, category, id, name);
      return;
    }

    const idString = String(id);
    if (seenIds.has(idString)) duplicateIds.add(idString);
    seenIds.add(idString);
    const iconId = Number(fields[columns.icon]);
    const itemLevel = Number(fields[columns.itemLevel]);
    records.push({
      id: idString,
      slot: category.slot,
      names: { ko: name },
      iconUrl: buildIconUrl(iconId),
      itemLevel: Number.isFinite(itemLevel) && itemLevel > 0 ? itemLevel : null,
      patch: String(patch || ""),
      sourceRevision: String(sourceRevision || ""),
    });
  });

  return {
    records,
    audit: {
      sourceRows: rows.length,
      namedRows,
      indexedRecords: records.length,
      invalidIdRows,
      emptyNameRows,
      emptyNameByCategory: serialiseCategoryAudit(emptyNameByCategory),
      ignoredByCategory: serialiseCategoryAudit(ignoredByCategory),
      unknownCategories: serialiseCategoryAudit(unknownCategories),
      duplicateIds: [...duplicateIds],
    },
  };
}

export function assertNoUnknownEquipSlotCategories(audit) {
  if (!audit?.unknownCategories?.length) return;
  const details = audit.unknownCategories
    .map(({ category, count, examples }) => `${category} (${count}: ${examples.map(({ id, name }) => `${id} ${name}`).join(", ")})`)
    .join("; ");
  throw new Error(`한국어 아이템 CSV에 분류되지 않은 EquipSlotCategory가 있습니다: ${details}`);
}

export function assertKoreanItemIndexAudit(audit) {
  assertNoUnknownEquipSlotCategories(audit);
  if (audit?.duplicateIds?.length) {
    throw new Error(`한국어 아이템 CSV에 중복 ID가 있습니다: ${audit.duplicateIds.join(", ")}`);
  }
}

function addCategoryAudit(target, category, id, name) {
  const key = category.category === null ? "unknown" : String(category.category);
  const entry = target.get(key) || { category: key, count: 0, examples: [] };
  entry.count += 1;
  if (entry.examples.length < auditExampleLimit) entry.examples.push({ id: String(id), name });
  target.set(key, entry);
}

function serialiseCategoryAudit(audit) {
  return [...audit.values()].sort((left, right) => {
    if (left.category === "unknown") return 1;
    if (right.category === "unknown") return -1;
    return Number(left.category) - Number(right.category);
  });
}

function resolveItemColumns(rows) {
  const headers = rows.find((fields) => {
    const names = new Set(fields);
    return names.has("Name") && names.has("Icon") && names.has("EquipSlotCategory");
  });
  if (!headers) throw new Error("한국어 아이템 CSV의 필수 헤더(Name, Icon, EquipSlotCategory)를 찾을 수 없습니다.");
  const columns = {
    id: findColumnIndex(headers, ["#", "key", "ID", "id"]),
    name: headers.indexOf("Name"),
    icon: headers.indexOf("Icon"),
    itemLevel: headers.indexOf("Level{Item}") >= 0 ? headers.indexOf("Level{Item}") : headers.indexOf("LevelItem"),
    equipSlotCategory: headers.indexOf("EquipSlotCategory"),
  };
  if (columns.id < 0 || columns.itemLevel < 0) {
    throw new Error("한국어 아이템 CSV의 필수 헤더(key, Level{Item})를 찾을 수 없습니다.");
  }
  return columns;
}

function findColumnIndex(headers, candidates) {
  return candidates.map((candidate) => headers.indexOf(candidate)).find((index) => index >= 0) ?? -1;
}

function parseCsvRows(value) {
  const rows = [];
  let fields = [];
  let field = "";
  let quoted = false;
  const quote = String.fromCharCode(34);
  const comma = String.fromCharCode(44);

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === quote) {
      if (quoted && value[index + 1] === quote) {
        field += quote;
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === comma && !quoted) {
      fields.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      fields.push(field);
      rows.push(fields);
      fields = [];
      field = "";
      if (character === "\r" && value[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("한국어 아이템 CSV에 닫히지 않은 따옴표가 있습니다.");

  if (field || fields.length) {
    fields.push(field);
    rows.push(fields);
  }
  return rows;
}

function stripBom(value) {
  return String(value || "").replace(/^\uFEFF/u, "");
}
