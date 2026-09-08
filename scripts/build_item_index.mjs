import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncKoreanItemSnapshot } from "./item-data-sync.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(root, process.argv[2] || "assets/data/items-ko.json");
const manifestPath = process.env.FFXIV_KO_MANIFEST_PATH
  ? path.resolve(root, process.env.FFXIV_KO_MANIFEST_PATH)
  : path.join(path.dirname(outputPath), "items-ko.manifest.json");
const result = await syncKoreanItemSnapshot({ outputPath, manifestPath });
const action = result.changed ? "Updated" : "Unchanged";
console.log(action + " " + result.records + " Korean item records → " + path.relative(root, outputPath) + " (source " + result.source.sourceRevision + ")");
console.log("Slot counts: " + JSON.stringify(result.slotCounts) + "; data SHA-256: " + result.dataSha256);
