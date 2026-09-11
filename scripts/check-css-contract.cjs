const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const tokens = fs.readFileSync(path.join(root, "styles", "tokens.css"), "utf8");
const controls = fs.readFileSync(path.join(root, "styles", "editor-controls.css"), "utf8");
const composer = fs.readFileSync(path.join(root, "styles", "card-composer.css"), "utf8");
const readability = fs.readFileSync(path.join(root, "styles", "card-readability.css"), "utf8");
const markup = fs.readFileSync(path.join(root, "index.html"), "utf8");

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
assert.doesNotMatch(core, /212,\s*244,\s*91/, "shared chrome must not reintroduce the retired neon accent");
assert.doesNotMatch(tokens, /0\.488\s+0\.243\s+264\.376/, "dark mode must keep the primary token in the Neutral palette");
assert.doesNotMatch(core, /(?:^|\n)input\[type=\"range\"\]\s*\{/, "generic range controls must not live in the core shell stylesheet");
assert.match(controls, /(?:^|\n)input\[type=\"range\"\]\s*\{/, "generic range controls must live with editor controls");
assert.doesNotMatch(core, /\.range-(?:line|labels)/, "range layout helpers must not live in the core shell stylesheet");
assert.match(controls, /\.range-line\s*\{/, "range layout helpers must live with editor controls");
assert.match(controls, /\.range-labels\s*\{/, "range label helpers must live with editor controls");
assert.doesNotMatch(core, /\.canvas-board\[data-background-texture="(?:none|grain)"\] \.scene-texture/, "card background texture rules must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.scene-pattern\[data-pattern="gradient"\]/, "card pattern cleanup rules must not remain in the core shell stylesheet");
assert.match(composer, /\.canvas-board\[data-background-texture="none"\] \.scene-texture/, "card background texture rules must live in the card composer seam");

for (const selector of [
  '.canvas-board[data-cast="2"] .board-gear-item:nth-child(1)',
  '.canvas-board[data-cast="2"] .board-gear-item:nth-child(2)',
  '.canvas-board[data-cast="2"] .board-gear-item:nth-child(3)',
  '.canvas-board[data-cast="2"] .board-gear-item:nth-child(4)',
  '.canvas-board[data-cast="2"] .board-gear-item:nth-child(5)',
]) {
  assert.doesNotMatch(core, new RegExp(selector.replaceAll(/[.[\]()]/g, "\\$&")), `${selector} must not revive the legacy two-person grid placement`);
}
assert.match(readability, /\.canvas-board\[data-cast="2"\] \.board-gear-rail \.board-gear-item:nth-child\(n\)/, "two-person item placement must live in the rail seam");

for (const selector of [
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(n)',
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(1)',
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(2)',
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(3)',
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(4)',
  '.canvas-board[data-cast="1"] .board-gear-item:nth-child(5)',
]) {
  assert.doesNotMatch(core, new RegExp(selector.replaceAll(/[.[\]()]/g, "\\$&")), `${selector} must not revive the legacy solo grid placement`);
}
assert.match(composer, /\.canvas-board\[data-ratio="portrait"\]\[data-cast="1"\] \.board-gear-item:nth-child\(1\)/, "solo portrait item placement must live in the card composer seam");
assert.match(composer, /\.canvas-board\[data-ratio="landscape"\]\[data-cast="1"\] \.board-gear-item:nth-child\(1\)/, "solo landscape item placement must live in the card composer seam");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="1"\](?:\[data-single-layout="info-right"\])? \.board-gear-list/, "solo gear-list geometry must not remain in the core shell stylesheet");
assert.match(composer, /\.canvas-board\[data-ratio="portrait"\]\[data-cast="1"\] \.board-gear-list/, "solo portrait gear-list geometry must live in the card composer seam");
assert.match(composer, /\.canvas-board\[data-ratio="landscape"\]\[data-cast="1"\] \.board-gear-list/, "solo landscape gear-list geometry must live in the card composer seam");
assert.match(composer, /\.multi-info-layer\s*\{/, "lineup cards must keep the multi-info layer as their information surface");
assert.match(composer, /\.canvas-board\[data-cast="3"\] \.multi-info-layer/, "lineup information must be keyed by the multi-info layer");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.board-gear-list/, "lineup gear-list selectors must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.board-gear-item/, "lineup gear-item selectors must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.gear-tile-copy/, "lineup gear-copy selectors must not remain in the core shell stylesheet");
assert.match(composer, /\.canvas-board\[data-cast="3"\] \.board-gear-list[\s\S]*display:\s*none\s*!important/, "the card composer must own the retired lineup gear-list visibility");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.board-editorial-header/, "lineup header selectors must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.board-title-block/, "lineup title selectors must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\] \.caption-description/, "lineup caption selectors must not remain in the core shell stylesheet");
assert.match(composer, /\.canvas-board\[data-cast="3"\] \.board-editorial-header/, "lineup header rules must live in the card composer seam");
assert.match(composer, /\.canvas-board\[data-cast="3"\] \.board-editorial-header \.board-title-block > strong[\s\S]*letter-spacing:\s*-\.045em/, "lineup title tracking must be explicit in the card composer seam");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[345]"\]\s+\.portrait-wrap\s*(?:,|\{)/, "lineup portrait geometry must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cutout="false"\]\[data-cast="[345]"\]\s+\.portrait-wrap\s*(?:,|\{)/, "lineup full-frame portrait geometry must not remain in the core shell stylesheet");
assert.match(composer, /\.canvas-board\[data-cast="3"\] \.portrait-wrap/, "lineup portrait geometry must live in the card composer seam");
assert.match(composer, /\.canvas-board\[data-cutout="false"\]\[data-cast="3"\] \.portrait-wrap/, "lineup full-frame portrait geometry must live in the card composer seam");

for (const selector of [
  '.canvas-board[data-cast="1"] .portrait-wrap',
  '.canvas-board[data-cast="1"][data-single-layout="info-right"] .portrait-wrap',
  '.canvas-board[data-cast="2"] .portrait-wrap',
]) {
  const escapedSelector = selector.replaceAll(/[.[\\]()]/g, "\\$&");
  assert.doesNotMatch(core, new RegExp(`${escapedSelector}\\s*(?:,|\\{)`), `${selector} must not revive the legacy cast frame geometry`);
}
assert.doesNotMatch(core, /\.canvas-board\[data-cutout="false"\]\s+\.portrait-wrap\s*(?:,|\{)/, "generic full-frame portrait geometry must be supplied by CardLayout rather than the core stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[2345]"\]\s+\.character-figure\s*(?:,|\{)/, "cast-specific figure margins must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="[45]"\]\s+\.portrait-wrap\s+\.character-figure\s+img\s*\{/, "cast-specific image widths must not remain in the core shell stylesheet");
assert.doesNotMatch(core, /\.canvas-board\[data-cutout="false"\]\[data-cast="[345]"\]\s+\.character-figure/, "lineup cutout figure geometry must live in the final card readability seam");
assert.doesNotMatch(core, /\.canvas-board\[data-cast="2"\]\s+\.board-gear-list/, "two-person rail geometry must not remain in the core shell stylesheet");
assert.match(readability, /\.canvas-board\[data-cast="2"\]\s+\.board-gear-list\s*\{[\s\S]*inset:\s*0\s*!important/, "two-person rail container geometry must live in the card readability seam");

for (const selector of [
  ".board-gear-list",
  ".board-gear-item",
  ".board-gear-item span",
  ".board-gear-item strong",
  ".board-gear-list.board-gear-tiles",
  ".board-gear-tiles .board-gear-item",
  ".gear-tile-copy",
  ".gear-tile-copy span",
  ".gear-tile-copy strong",
  ".gear-tile-copy small",
  ".multi-info-layer",
  ".multi-info-column",
  ".multi-info-items",
  ".multi-info-items > span",
  ".multi-info-items small",
  ".multi-info-column.is-selected",
]) {
  assert.doesNotMatch(core, new RegExp(`${selector.replaceAll(/[.[\\]()]/g, "\\$&")}(?![\\w-])`), `${selector} must live outside the core shell stylesheet`);
}
assert.doesNotMatch(core, /\.canvas-board\[data-info="true"\]/, "lineup information-mode styling must live outside the core shell stylesheet");
assert.doesNotMatch(core, /\.prism(?:[\s:{.])/ , "retired prism decoration must not remain in the core shell stylesheet");
assert.doesNotMatch(composer, /\.prism(?:[\s:{.])/, "retired prism decoration must not remain in the card composer stylesheet");
assert.doesNotMatch(readability, /\.prism(?:[\s:{.])/, "retired prism decoration must not remain in the card readability stylesheet");
assert.doesNotMatch(markup, /class="prism(?:\s|"|')/, "retired prism decoration must not remain in the card markup");
assert.doesNotMatch(core, /\.scene-pattern\b|\.pattern-motif\b/, "card background pattern base rules must not remain in the core shell stylesheet");
assert.match(composer, /\.scene-pattern\s*\{/, "card composition must own the scene-pattern base contract");
assert.match(composer, /\.pattern-motif\s*\{/, "card composition must own the pattern-motif base contract");
assert.doesNotMatch(core, /\.scene-(?:background|texture)\s*\{/, "card scene-layer base rules must not remain in the core shell stylesheet");
assert.match(composer, /\.scene-background\s*\{/, "card composition must own the scene-background base contract");
assert.match(composer, /\.scene-texture\s*\{/, "card composition must own the scene-texture base contract");
for (const selector of [
  ".board-editorial-header",
  ".board-title-block",
  ".board-title-block > strong",
  ".caption-description",
]) {
  const escapedSelector = selector.replaceAll(/[.[\\]()]/g, "\\$&");
  assert.doesNotMatch(core, new RegExp(`${escapedSelector}(?![\\w-])`), `${selector} must live outside the core shell stylesheet`);
}
assert.match(composer, /\.board-editorial-header\s*\{/, "card composition must own the editorial header contract");
assert.match(composer, /\.board-title-block\s*\{/, "card composition must own the title-block contract");
assert.match(composer, /\.caption-description\s*\{/, "card composition must own the caption contract");
for (const selector of [
  ".portrait-wrap",
  ".character-figure",
  ".portrait-wrap .character-figure img",
  ".portrait-wrap img",
]) {
  const escapedSelector = selector.replaceAll(/[.[\\]()]/g, "\\$&");
  assert.doesNotMatch(core, new RegExp(`${escapedSelector}(?![\\w-])`), `${selector} must live outside the core shell stylesheet`);
}
assert.match(composer, /\.portrait-wrap\s*\{/, "card composition must own the portrait-frame contract");
assert.match(composer, /\.character-figure\s*\{/, "card composition must own the character-figure contract");
for (const property of [
  "position:\\s*relative",
  "width:\\s*100%",
  "aspect-ratio:",
  "overflow:\\s*hidden",
  "isolation:\\s*isolate",
  "background:",
  "box-shadow:",
]) {
  assert.doesNotMatch(core, new RegExp(`\\.canvas-board\\s*\\{[^}]*${property}`), `canvas board ${property} must live outside the core shell stylesheet`);
}
assert.doesNotMatch(core, /\.canvas-board::before\s*\{/, "canvas board frame chrome must live outside the core shell stylesheet");
assert.match(composer, /\.canvas-board\s*\{[^}]*position:\s*relative/, "card composition must own the canvas surface contract");
assert.match(composer, /\.canvas-board::before\s*\{/, "card composition must own the canvas frame chrome");
assert.match(composer, /\.board-gear-list\s*\{/, "card composition must own the gear-list base contract");
assert.match(composer, /\.board-gear-item\s*\{/, "card composition must own the gear-item base contract");
assert.match(composer, /\.gear-tile-copy\s*\{/, "card composition must own the gear-copy base contract");
assert.match(composer, /\.multi-info-layer\s*\{/, "card composition must own the lineup information-layer contract");
assert.match(composer, /\.multi-info-column\s*\{/, "card composition must own the lineup information-column contract");

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
  ".board-copy-plate",
  ".board-edge-code",
  ".caption-label",
]) {
  assert.doesNotMatch(core, new RegExp(`${selector.replace(".", "\\.")}(?![\\w-])`), `${selector} is retired and should not remain in the shared stylesheet`);
}
assert.match(core, /\.stage-composition\s*\{/, "the live card composition seam must remain defined");

console.log("PASS: canonical CSS tokens and shared thin-scrollbar contract are present.");
