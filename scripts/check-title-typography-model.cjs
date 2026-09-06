const assert = require("node:assert/strict");
const TitleTypography = require("../models/title-typography.js");

const typography = TitleTypography.create({
  fonts: {
    pretendard: { label: "Pretendard · 기본", family: "Pretendard", weights: [400, 700] },
    single: { label: "단일 굵기", family: "Single", weights: [500, 500] },
    many: { label: "다중 굵기", family: "Many", weights: [900, 100, 500, 300, 700, 200, 400, 600, 800] },
  },
  defaultWeight: 680,
  weightLabels: { 100: "가늘게", 300: "중간 가늘게", 500: "중간", 700: "굵게", 900: "검정" },
});

assert.equal(typography.defaultFont, "pretendard");
assert.equal(typography.defaultWeight, 700);
assert.equal(typography.config("missing").family, "Pretendard");
assert.equal(typography.normalizeWeight("pretendard", 550), 400);
assert.equal(typography.normalizeWeight("pretendard", 680), 700);
assert.equal(typography.normalizeWeight("single", 999), 500);
assert.deepEqual(typography.weightOptions("single"), []);
assert.deepEqual(typography.weightOptions("many"), [
  { weight: 100, label: "가늘게" },
  { weight: 300, label: "중간 가늘게" },
  { weight: 500, label: "중간" },
  { weight: 700, label: "굵게" },
  { weight: 900, label: "검정" },
]);
assert.equal(typography.fontOrder[0], "many");

const builtIn = TitleTypography.create();
assert.ok(builtIn.fonts.pretendard, "Pretendard must remain the default title font");
assert.deepEqual(builtIn.config("ridibatang").weights, [400]);
console.log("PASS: font fallback, nearest weight, single-weight hiding, sorted options, and Pretendard default.");
