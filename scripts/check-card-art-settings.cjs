const assert = require("node:assert/strict");
const CardArt = require("../models/card-art.js");
const Equipment = require("../models/equipment.js");

const defaults = {
  enabled: false,
  layout: "auto",
  ratio: "auto",
  density: 50,
  subjectScale: 100,
  subjectGap: 16,
  textScale: 100,
  textAlign: "left",
  showSlots: false,
  secondaryMode: "all",
  titlePlacement: "top-center",
  badge: "none",
  ornaments: 0,
  accentColor: "#d9b5c6",
  paperColor: "#fffaf4",
  patternScale: 100,
  patternOpacity: 18,
  sharedOutfit: false,
};
assert.deepEqual(CardArt.normalize(), defaults);
assert.deepEqual(CardArt.normalize(null), defaults);
assert.deepEqual(CardArt.normalize("enabled"), defaults);
assert.deepEqual(CardArt.normalize([]), defaults);

const malformed = CardArt.normalize({
  enabled: "yes",
  layout: "<script>",
  ratio: "wide-ish",
  density: Infinity,
  subjectScale: -300,
  subjectGap: 1000,
  textScale: "NaN",
  textAlign: "right",
  showSlots: 1,
  secondaryMode: "all languages",
  titlePlacement: "bottom",
  badge: "url(javascript:alert(1))",
  ornaments: -1,
  accentColor: "url(#fff)",
  paperColor: "#ABCDEF",
  patternScale: 999,
  patternOpacity: -20,
  sharedOutfit: "true",
});
assert.deepEqual(malformed, {
  ...defaults,
  subjectScale: 60,
  subjectGap: 80,
  paperColor: "#abcdef",
  patternScale: 160,
  patternOpacity: 0,
});
assert.deepEqual(CardArt.normalize({
  enabled: true, layout: "footer", ratio: "lookbook", density: 42.7,
  subjectScale: 79.6, subjectGap: 4.6, textScale: 121.2, textAlign: "center",
  showSlots: true, secondaryMode: "english", titlePlacement: "hidden", badge: "flower",
  ornaments: 85.2, accentColor: "#AABBCC", paperColor: "#123456", patternScale: 64.4,
  patternOpacity: 33.8, sharedOutfit: true,
}), {
  enabled: true, layout: "footer", ratio: "lookbook", density: 43, subjectScale: 80,
  subjectGap: 5, textScale: 121, textAlign: "center", showSlots: true,
  secondaryMode: "english", titlePlacement: "hidden", badge: "flower", ornaments: 85,
  accentColor: "#aabbcc", paperColor: "#123456", patternScale: 64, patternOpacity: 34,
  sharedOutfit: true,
});

const composed = Equipment.normalizeComposition({ art: { layout: "footer", density: 120 } });
assert.deepEqual(Object.keys(composed), ["layer", "protectText", "infoGap", "art"]);
assert.equal(composed.art.layout, "footer");
assert.equal(composed.art.density, 100);
assert.deepEqual(Equipment.normalizeComposition({}), { layer: "info-front", protectText: true, infoGap: 0 });
for (const art of [null, "bad", [], 3]) {
  assert.deepEqual(Equipment.normalizeComposition({ art }), { layer: "info-front", protectText: true, infoGap: 0 });
}

assert.deepEqual(CardArt.recipes.map(({ id }) => id), ["catalog", "editorial", "romantic", "pastel", "tartan"]);
for (const entry of CardArt.recipes) {
  assert.equal(entry.art.enabled, true, `${entry.id} recipe enables card art`);
  assert.ok(entry.background.background, `${entry.id} recipe suggests a background`);
  assert.ok(entry.background.backgroundPattern, `${entry.id} recipe suggests a pattern`);
  const result = CardArt.applyRecipe(defaults, entry.id);
  assert.deepEqual(result.art, CardArt.normalize({ ...defaults, ...entry.art }));
  assert.deepEqual(result.background, entry.background);
  result.art.enabled = false;
  result.background.background = "changed";
  assert.equal(entry.art.enabled, true, "recipe application returns a fresh art object");
  assert.notEqual(entry.background.background, "changed", "recipe application returns a fresh background object");
}
assert.equal(CardArt.applyRecipe(defaults, "missing"), null);

let profiled = CardArt.applyRecipe({ ...defaults, density: 72, subjectScale: 84 }, "editorial").art;
assert.equal(profiled.titlePlacement, "top-left");
assert.equal(profiled.badge, "none");
assert.equal(profiled.density, 72);
assert.equal(profiled.subjectScale, 84);
profiled = CardArt.applyRecipe(profiled, "romantic").art;
assert.equal(profiled.titlePlacement, "top-center", "switching away from editorial resets its title placement");
assert.equal(profiled.textAlign, "center");
assert.equal(profiled.showSlots, false);
assert.equal(profiled.secondaryMode, "none");
assert.equal(profiled.density, 72, "profile changes preserve user-tuned density");
assert.equal(profiled.subjectScale, 84, "profile changes preserve user-tuned subject scale");
profiled = CardArt.applyRecipe(profiled, "catalog").art;
assert.equal(profiled.layout, "center");
assert.equal(profiled.ratio, "square");
assert.equal(profiled.titlePlacement, "top-center");
assert.equal(profiled.textAlign, "center");
assert.equal(profiled.secondaryMode, "all");
assert.equal(profiled.badge, "none");
assert.equal(profiled.density, 72);
assert.equal(profiled.subjectScale, 84);

const sourceArt = Object.freeze({ layout: "cover", accentColor: "#445566" });
const sourceLook = Object.freeze({ cardComposition: Object.freeze({ layer: "person-front", protectText: false, infoGap: 8, art: sourceArt }) });
const ensured = Equipment.ensureLook(sourceLook);
assert.deepEqual(ensured.cardComposition.art, CardArt.normalize(sourceArt));
assert.notEqual(ensured.cardComposition.art, sourceArt, "normalization copies nested settings");
ensured.cardComposition.art.layout = "footer";
assert.equal(sourceArt.layout, "cover", "normalization cannot mutate persisted settings");
const ensuredAgain = Equipment.ensureLook({ cardComposition: ensured.cardComposition });
assert.deepEqual(ensuredAgain.cardComposition, ensured.cardComposition, "ensureLook normalization is stable across a persistence round trip");
assert.deepEqual(sourceLook.cardComposition.art, { layout: "cover", accentColor: "#445566" }, "normalization leaves its input untouched");

const hostileNumeric = CardArt.normalize({ density: Symbol("bad"), subjectGap: NaN, textScale: -Infinity });
assert.equal(hostileNumeric.density, defaults.density);
assert.equal(hostileNumeric.subjectGap, defaults.subjectGap);
assert.equal(hostileNumeric.textScale, defaults.textScale);

console.log("PASS: card art settings are bounded, recipe application is isolated, and legacy composition normalization remains unchanged.");
