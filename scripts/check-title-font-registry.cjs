const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const TitleTypography = require("../models/title-typography.js");

const expected = [
  {
    key: "wild-gak",
    label: "와일드각",
    family: "KIMWILDgag-Bold",
    source: "https://noonnu.cc/font_page/1682",
    url: "https://cdn.jsdelivr.net/gh/woffz/b3@main/KIMWILDgag-Bold/KIMWILDgag-Bold.woff2",
  },
  {
    key: "cafe24-classic-type",
    label: "카페24 클래식타입",
    family: "Cafe24ClassicType",
    source: "https://noonnu.cc/font_page/1035",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2210-2@1.0/Cafe24ClassicType-Regular.woff2",
  },
  {
    key: "sinchon-rhapsody",
    label: "신촌랩소디체",
    family: "SinchonRhapsody",
    source: "https://noonnu.cc/font_page/1577",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/2503@1.0/SinchonRhapsody.woff2",
  },
  {
    key: "shouting",
    label: "샤우팅체",
    family: "Shouting",
    source: "https://noonnu.cc/font_page/1670",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/2510-1@1.0/Callifont-Medium.woff2",
  },
  {
    key: "goryeong-strawberry",
    label: "고령딸기체",
    family: "GoryeongStrawberry",
    source: "https://noonnu.cc/font_page/1132",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2304-01@1.0/GoryeongStrawberry.woff2",
  },
  {
    key: "maru-minya-hangul",
    label: "마루미냐 한글",
    family: "x12y12pxMaruMinyaHangul",
    source: "https://noonnu.cc/font_page/1816",
    url: "https://cdn.jsdelivr.net/gh/quiple/x12y12pxMaruMinyaHangul@main/fonts/x12y12pxMaruMinyaHangul.woff2",
  },
  {
    key: "dos-pilgi",
    label: "도스필기",
    family: "DosHandwriting",
    source: "https://noonnu.cc/font_page/1141",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2304-2@1.0/DOSPilgiMedium.woff2",
  },
];

const typography = TitleTypography.create();
const css = fs.readFileSync(path.join(__dirname, "..", "styles", "card-composer.css"), "utf8");

for (const font of expected) {
  const config = typography.fonts[font.key];
  assert.ok(config, `${font.label} must be in the title font registry`);
  assert.equal(config.label, font.label);
  assert.match(config.family, new RegExp(`\\b${font.family.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`));
  assert.equal(config.source, font.source);
  assert.match(css, new RegExp(`font-family: "${font.family}"`));
  assert.match(css, new RegExp(font.url.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")));
}

const labels = typography.fontOrder.map((key) => typography.fonts[key].label);
const sortedLabels = [...labels].sort((left, right) => left.localeCompare(right, "ko-KR") || left.localeCompare(right));
assert.deepEqual(labels, sortedLabels, "title font options must remain in deterministic Korean 가나다 order");
assert.equal(new Set(typography.fontOrder).size, typography.fontOrder.length, "title font order must not contain duplicate keys");

console.log(`PASS: ${expected.length} requested title fonts are registered, backed by CSS, and included in 가나다순 order.`);
