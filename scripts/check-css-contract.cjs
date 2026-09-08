const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const tokens = fs.readFileSync(path.join(root, "styles", "tokens.css"), "utf8");
const controls = fs.readFileSync(path.join(root, "styles", "editor-controls.css"), "utf8");

const rootBlocks = tokens.match(/^:root\s*\{/gm) || [];
assert.equal(rootBlocks.length, 1, "styles/tokens.css must have one canonical :root token block");

const tokenBlockMatch = tokens.match(/^:root\s*\{([\s\S]*?)^\}/m);
assert.ok(tokenBlockMatch, "canonical :root token block is missing");
const tokenBlock = tokenBlockMatch[1];
for (const token of ["--mono", "--scrollbar-size", "--scrollbar-thumb", "--scrollbar-thumb-hover"]) {
  assert.match(tokenBlock, new RegExp(token.replaceAll("-", "\\-") + "\\s*:"), token + " must live in the canonical token block");
}
assert.match(tokenBlock, /--scrollbar-size:\s*6px/, "shared scrollbar size must remain 6px");

for (const selector of [".canvas-column", ".look-manager-dialog", ".image-editor-dialog-shell"]) {
  assert.ok(core.includes(selector), selector + " must use the shared shell scrollbar contract");
}
assert.match(core, /scrollbar-color:\s*var\(--scrollbar-thumb\)/, "core scrollbars must use the shared thumb token");
assert.match(core, /width:\s*var\(--scrollbar-size\)/, "core webkit scrollbars must use the shared size token");

const catalogContract = controls.match(/\.inspector \.catalog-results\s*\{([\s\S]*?)\}/);
assert.ok(catalogContract, "catalog results must declare their own nested-scroll contract");
assert.match(catalogContract[1], /scrollbar-width:\s*thin/, "catalog results must be thin in Firefox-compatible engines");
assert.match(catalogContract[1], /scrollbar-color:\s*var\(--scrollbar-thumb\)/, "catalog results must use the shared thumb token");
assert.doesNotMatch(controls, /scrollbar-(?:color|width):\s*color-mix/, "scrollbar colors must not be duplicated as local formulas");

// These selectors belonged to removed prototype chrome and have no live
// markup or renderer path. Keeping them out of the shared sheet prevents a
// future selector from accidentally reviving a second layout contract.
for (const selector of [
  ".mode-nav",
  ".mode-nav-button",
  ".profile-orb",
  ".look-index",
  ".look-title-label",
  ".look-title-input",
  ".look-subtitle",
  ".stage-meta",
  ".stage-ruler",
  ".stage-notes",
  ".canvas-caption-row",
  ".workflow-strip",
  ".workflow-step",
  ".catalog-note",
  ".board-edge-code",
  ".caption-label",
]) {
  assert.doesNotMatch(core, new RegExp(`${selector.replace(".", "\\.")}(?![\\w-])`), `${selector} is retired and should not remain in the shared stylesheet`);
}
assert.match(core, /\.stage-composition\s*\{/, "the live card composition seam must remain defined");

console.log("PASS: canonical CSS tokens and shared thin-scrollbar contract are present.");
