import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveKoreanItemSource } from "./item-data-sync.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.resolve(root, process.argv[2] || "assets/data/items-ko.manifest.json");

const source = await resolveKoreanItemSource({ env: process.env });
const manifest = readManifest(manifestPath);
const previousRevision = String(manifest?.sourceRevision || "");
const changed = previousRevision !== source.sourceRevision
  || String(manifest?.source?.id || "") !== source.id
  || String(manifest?.source?.branch || "") !== source.branch
  || String(manifest?.source?.path || "") !== source.path;

console.log(`Upstream Korean item revision: ${source.sourceRevision}`);
console.log(`Bundled Korean item revision: ${previousRevision || "(none)"}`);
console.log(`Update required: ${changed ? "yes" : "no"}`);

writeGithubOutputs({
  changed,
  sourceRevision: source.sourceRevision,
  previousRevision,
});

function readManifest(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`아이템 manifest를 읽을 수 없습니다: ${filePath}\n${error.message}`);
  }
}

function writeGithubOutputs({ changed: isChanged, sourceRevision, previousRevision: oldRevision }) {
  const outputPath = String(process.env.GITHUB_OUTPUT || "").trim();
  if (!outputPath) return;
  fs.appendFileSync(
    outputPath,
    [
      `changed=${isChanged}`,
      `source_revision=${sourceRevision}`,
      `previous_revision=${oldRevision}`,
    ].join("\n") + "\n",
    "utf8",
  );
}
