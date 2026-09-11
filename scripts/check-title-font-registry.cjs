const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const TitleTypography = require("../models/title-typography.js");

const expected = [
  {
    key: "yoon-chorok-child-daehan",
    label: "윤초록우산어린이 대한",
    family: "YoonchoUsanChildrenS",
    source: "https://noonnu.cc/font_page/1433",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/2408@1.0/YoonChildfundkoreaDaeHan.woff2",
  },
  {
    key: "yoon-chorok-child-minguk",
    label: "윤초록우산어린이 민국",
    family: "YunChorokwoosanEoriniMinguk",
    source: "https://noonnu.cc/font_page/1432",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/2408@1.0/YoonChildfundkoreaMinGuk.woff2",
  },
  {
    key: "yoon-chorok-child-manse",
    label: "윤초록우산어린이 만세",
    family: "YoonChoWooSan",
    source: "https://noonnu.cc/font_page/1431",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/2408@1.0/YoonChildfundkoreaManSeh.woff2",
  },
  {
    key: "nelna-yesam",
    label: "낼나 예샘체",
    family: "Nelna_Yesam",
    source: "https://noonnu.cc/font_page/1522",
    url: "https://cdn.jsdelivr.net/gh/fontbee/font@main/Nelna/Nelna_Yesam.woff2",
  },
  {
    key: "nelna-lizzy",
    label: "낼나 리지체",
    family: "NelnaLizzyChae",
    source: "https://noonnu.cc/font_page/904",
    url: "https://cdn.jsdelivr.net/gh/fontbee/font@main/Nelna/NelnaLizzyChae.woff2",
  },
  {
    key: "cafe24-moya-moya-face",
    label: "카페24 모야모야 Face",
    family: "Cafe24MoyaMoyaFace",
    source: "https://noonnu.cc/font_page/1249",
    url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_231029@1.1/Cafe24Moyamoya-Face-v1.0.woff2",
  },
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
