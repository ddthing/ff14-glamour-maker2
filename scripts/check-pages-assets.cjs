const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, ".runtime"), { recursive: true });
const output = fs.mkdtempSync(path.join(root, ".runtime", "pages-assets-check-"));
const slots = ["head", "body", "hands", "legs", "feet", "weapon"];

(async () => {
  try {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "build-site.cjs"), "--output-dir", output], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(output, "favicon.svg")), false, "Pages bundle must not publish the rejected favicon");
    assert.equal(fs.existsSync(path.join(output, "assets", "themes", "collage-paper-plate.png")), false, "Pages bundle must not ship the obsolete collage plate");
    assert.equal(fs.existsSync(path.join(output, "assets", "themes", "vintage-scrapbook-plate.svg")), false, "Pages bundle must not ship the obsolete scrapbook plate");
    for (const material of ["archive-paper-material-v1.webp", "airy-paper-material-v1.webp"]) {
      const materialAsset = path.join(output, "assets", "themes", "materials", material);
      assert.equal(fs.existsSync(materialAsset), true, `Pages bundle must publish generated material: ${material}`);
      const materialHeader = fs.readFileSync(materialAsset).subarray(0, 8);
      const materialContainer = fs.readFileSync(materialAsset).subarray(8, 12);
      assert.deepEqual([...materialHeader.subarray(0, 4)], [82, 73, 70, 70], `optimized material must remain a RIFF asset: ${material}`);
      assert.deepEqual([...materialContainer], [87, 69, 66, 80], `optimized material must remain a WebP asset: ${material}`);
    }
    const recordsBySlot = new Map();
    slots.forEach((slot) => {
      const file = path.join(output, "assets", "data", `items-ko-${slot}.json`);
      assert.equal(fs.existsSync(file), true, `missing slot-partitioned item index: ${slot}`);
      const records = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.ok(records.length > 0, `empty slot-partitioned item index: ${slot}`);
      assert.ok(records.every((record) => record.slot === slot), `wrong slot record in partition: ${slot}`);
      recordsBySlot.set(slot, records);
    });
    assert.equal(fs.existsSync(path.join(output, "assets", "data", "items-ko.json")), false, "the full index should not ship in the Pages bundle");

    const { onRequestGet } = await import(pathToFileURL(path.join(root, "functions", "api", "items", "search.js")).href);
    const assetRequests = [];
    const assets = {
      fetch: async (assetUrl) => {
        const url = new URL(String(assetUrl));
        assetRequests.push(url.pathname);
        const relativePath = url.pathname.replace(/^\/+/, "");
        const file = path.resolve(output, relativePath);
        if (!file.startsWith(`${output}${path.sep}`) || !fs.existsSync(file)) {
          return new Response("not found", { status: 404 });
        }
        return new Response(fs.readFileSync(file), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    };

    for (const slot of slots) {
      const expected = recordsBySlot.get(slot)[0];
      const response = await onRequestGet({
        request: new Request(`https://pages.example/api/items/search?q=${encodeURIComponent(expected.id)}&slot=${slot}&language=ko`),
        env: { ASSETS: assets },
      });
      assert.equal(response.status, 200, `slot search failed: ${slot}`);
      const payload = await response.json();
      assert.ok(payload.results.some((record) => record.id === expected.id), `slot search missed indexed record: ${slot}`);
      assert.equal(assetRequests.at(-1), `/assets/data/items-ko-${slot}.json`, `slot search loaded the wrong asset: ${slot}`);
    }

    const allExpected = recordsBySlot.get("body")[0];
    const allResponse = await onRequestGet({
      request: new Request(`https://pages.example/api/items/search?q=${encodeURIComponent(allExpected.id)}&language=ko`),
      env: { ASSETS: assets },
    });
    assert.equal(allResponse.status, 200, "all-slot fallback search failed");
    assert.ok((await allResponse.json()).results.some((record) => record.id === allExpected.id), "all-slot fallback missed indexed record");
    assert.ok(assetRequests.includes("/assets/data/items-ko.json"), "all-slot fallback should probe the legacy full index");
    assert.ok(slots.every((slot) => assetRequests.includes(`/assets/data/items-ko-${slot}.json`)), "all-slot fallback should load every partition");
    console.log("PASS: Pages builds publish slot-partitioned Korean item indexes, and the search Function reads the matching assets.");
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
