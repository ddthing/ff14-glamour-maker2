const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const sourceRevision = "0123456789abcdef0123456789abcdef01234567";
const sourceApiUrl = "https://api.github.com/repos/Ra-Workspace/ffxiv-datamining-ko/commits?path=csv%2FItem.csv&sha=master&per_page=1";

(async () => {
  const sync = await import("../scripts/item-data-sync.mjs");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ff14-item-data-sync-"));
  const outputPath = path.join(temporaryRoot, "items-ko.json");
  const manifestPath = path.join(temporaryRoot, "items-ko.manifest.json");
  const csv = buildCsv([
    [101, "테스트 무기", 39001, 1, 1],
    [102, "테스트 모자", 39002, 1, 3],
    [103, "테스트 상의", 39003, 1, 16],
    [104, "테스트 장갑", 39004, 1, 5],
    [105, "테스트 바지", 39005, 1, 7],
    [15450, "모그리 실내화", 46626, 1, 8],
    [15479, "아기돼지 의상", 42523, 1, 16],
    [52428, "계승자의 두건", 56956, 1, 3],
  ]);
  const calls = [];
  const fetchImpl = createFetch(csv, calls);
  const now = () => new Date("2026-09-08T00:00:00.000Z");

  try {
    const first = await sync.syncKoreanItemSnapshot({ outputPath, manifestPath, fetchImpl, now });
    assert.equal(first.changed, true);
    assert.equal(first.dataChanged, true);
    assert.equal(first.manifestChanged, true);
    assert.equal(first.records, 8);
    assert.deepEqual(first.slotCounts, { head: 2, body: 2, hands: 1, legs: 1, feet: 1, weapon: 1 });
    assert.equal(calls[0].url, sourceApiUrl);
    assert.match(calls[1].url, new RegExp("/" + sourceRevision + "/csv/Item[.]csv$"));

    const firstManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const firstRecords = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(firstManifest.sourceRevision, sourceRevision);
    assert.equal(firstManifest.total, 8);
    assert.equal(firstManifest.dataSha256, first.dataSha256);
    assert.equal(firstManifest.audit.ignoredRows, 0);
    assert.equal(
      firstRecords.find((record) => record.id === "102").iconUrl,
      "https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F039000%2F039002.tex&format=png",
      "future snapshots must emit current XIVAPI asset URLs",
    );

    const second = await sync.syncKoreanItemSnapshot({ outputPath, manifestPath, fetchImpl, now });
    assert.equal(second.changed, false, "the same upstream revision must be idempotent");
    assert.equal(second.dataChanged, false);
    assert.equal(second.manifestChanged, false);

    const beforeData = fs.readFileSync(outputPath, "utf8");
    const beforeManifest = fs.readFileSync(manifestPath, "utf8");
    const brokenFetch = createFetch(buildCsv([
      [101, "테스트 무기", 39001, 1, 1],
      [102, "테스트 모자", 39002, 1, 3],
      [103, "테스트 상의", 39003, 1, 16],
      [104, "테스트 장갑", 39004, 1, 5],
      [105, "테스트 바지", 39005, 1, 7],
      [106, "테스트 신발", 39006, 1, 8],
    ]));
    await assert.rejects(
      sync.syncKoreanItemSnapshot({ outputPath, manifestPath, fetchImpl: brokenFetch, now }),
      /필수 회귀 아이템이 없습니다|비정상적으로 감소했습니다/,
      "a broken upstream snapshot must fail closed",
    );
    assert.equal(fs.readFileSync(outputPath, "utf8"), beforeData);
    assert.equal(fs.readFileSync(manifestPath, "utf8"), beforeManifest);

    await assert.rejects(
      sync.resolveKoreanItemSource({
        env: { FFXIV_KO_ITEM_CSV_URL: "https://example.test/Item.csv" },
        fetchImpl,
      }),
      /40자리 FFXIV_KO_SOURCE_REVISION/,
      "custom data sources must declare a pinned revision",
    );
    console.log("PASS: item data source pinning, deterministic sync, manifest generation, and fail-closed preservation.");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

function createFetch(csv, calls) {
  return async (url) => {
    const value = String(url);
    calls?.push({ url: value });
    if (value === sourceApiUrl) {
      return new Response(JSON.stringify([{ sha: sourceRevision }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (value.endsWith("/" + sourceRevision + "/csv/Item.csv")) {
      return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
    }
    throw new Error("unexpected fetch: " + value);
  };
}

function buildCsv(items) {
  const rows = [csvHeader(), "int32"];
  items.forEach(([id, name, icon, level, category]) => {
    const fields = Array.from({ length: 92 }, () => "");
    fields[0] = id;
    fields[10] = name;
    fields[11] = icon;
    fields[12] = level;
    fields[18] = category;
    rows.push(fields.map(escapeCsvField).join(","));
  });
  return rows.join("\r\n");
}

function csvHeader() {
  const fields = Array.from({ length: 92 }, () => "");
  fields[0] = "#";
  fields[10] = "Name";
  fields[11] = "Icon";
  fields[12] = "Level{Item}";
  fields[18] = "EquipSlotCategory";
  return fields.map(escapeCsvField).join(",");
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? "\"" + text.replaceAll("\"", "\"\"") + "\"" : text;
}
