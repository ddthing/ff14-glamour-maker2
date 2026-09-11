/* Title font registry and weight rules shared by editor state and controls. */
const TitleTypography = (() => {
  const defaultFonts = {
    pretendard: {
      label: "Pretendard",
      family: '"Pretendard Variable", Pretendard, sans-serif',
      weights: [400, 500, 700],
    },
    "yoon-chorok-child-daehan": {
      label: "윤초록우산어린이 대한",
      family: '"YoonchoUsanChildrenS", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1433",
    },
    "yoon-chorok-child-minguk": {
      label: "윤초록우산어린이 민국",
      family: '"YunChorokwoosanEoriniMinguk", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1432",
    },
    "yoon-chorok-child-manse": {
      label: "윤초록우산어린이 만세",
      family: '"YoonChoWooSan", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1431",
    },
    "nelna-yesam": {
      label: "낼나 예샘체",
      family: '"Nelna_Yesam", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1522",
    },
    "nelna-lizzy": {
      label: "낼나 리지체",
      family: '"NelnaLizzyChae", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/904",
    },
    "cafe24-moya-moya-face": {
      label: "카페24 모야모야 Face",
      family: '"Cafe24MoyaMoyaFace", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1249",
    },
    "gunhamimalmunteuyeot": {
      label: "군함이말문트였체",
      family: '"Gunhamimalmunteuyeot", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1869",
    },
    ridibatang: {
      label: "리디바탕",
      family: '"Ridibatang", serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/324",
    },
    stella: {
      label: "스텔라체",
      family: '"Stella", serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1907",
    },
    escoredream: {
      label: "에스코어드림",
      family: '"Escoredream", sans-serif',
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      source: "https://noonnu.cc/font_page/223",
    },
    "eutman-gungseo": {
      label: "읏맨 궁서체",
      family: '"EutmanGungseo", serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/947",
    },
    "keris-kedyuche": {
      label: "케리스 케듀체",
      family: '"KerisKedyuche", sans-serif',
      weights: [400, 700],
      source: "https://noonnu.cc/font_page/1756",
    },
    "school-safety-rounded": {
      label: "학교안심 둥근미소",
      family: '"SchoolSafetyRoundedSmile", sans-serif',
      weights: [400, 700],
      source: "https://noonnu.cc/font_page/1479",
    },
    "school-safety-outing": {
      label: "한글안심 나들이",
      family: '"SchoolSafeOuting", sans-serif',
      weights: [400, 700],
      source: "https://noonnu.cc/font_page/1482",
    },
    "gmarket-sans": {
      label: "G마켓산스",
      family: '"GMarketSans", sans-serif',
      weights: [300, 500, 700],
      source: "https://noonnu.cc/font_page/366",
    },
    "zen-serif": {
      label: "ZEN SERIF",
      family: '"ZenSerif", serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1686",
    },
    "goryeong-strawberry": {
      label: "고령딸기체",
      family: '"GoryeongStrawberry", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1132",
    },
    "cafe24-classic-type": {
      label: "카페24 클래식타입",
      family: '"Cafe24ClassicType", serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1035",
    },
    "sinchon-rhapsody": {
      label: "신촌랩소디체",
      family: '"SinchonRhapsody", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1577",
    },
    shouting: {
      label: "샤우팅체",
      family: '"Shouting", cursive',
      weights: [400],
      source: "https://noonnu.cc/font_page/1670",
    },
    "wild-gak": {
      label: "와일드각",
      family: '"KIMWILDgag-Bold", sans-serif',
      weights: [400],
      source: "https://noonnu.cc/font_page/1682",
    },
    "maru-minya-hangul": {
      label: "마루미냐 한글",
      family: '"x12y12pxMaruMinyaHangul", monospace',
      weights: [400],
      source: "https://noonnu.cc/font_page/1816",
    },
    "dos-pilgi": {
      label: "도스필기",
      family: '"DosHandwriting", monospace',
      weights: [400],
      source: "https://noonnu.cc/font_page/1141",
    },
  };

  const defaultWeightLabels = new Map([
    [100, "헤어라인"],
    [200, "아주 가늘게"],
    [300, "가늘게"],
    [400, "보통"],
    [500, "중간"],
    [600, "중간 굵게"],
    [700, "굵게"],
    [800, "아주 굵게"],
    [900, "검정"],
  ]);

  function create({
    fonts = defaultFonts,
    defaultFont = "pretendard",
    defaultWeight = 700,
    weightLabels = defaultWeightLabels,
  } = {}) {
    const source = fonts && typeof fonts === "object" ? fonts : {};
    const registry = Object.freeze(Object.fromEntries(Object.entries(source).map(([key, value]) => {
      const weights = [...new Set((Array.isArray(value?.weights) ? value.weights : [400])
        .map(Number)
        .filter(Number.isFinite))].sort((left, right) => left - right);
      return [key, Object.freeze({
        label: typeof value?.label === "string" && value.label ? value.label : key,
        family: typeof value?.family === "string" && value.family ? value.family : "sans-serif",
        weights: weights.length ? weights : [400],
        ...(typeof value?.source === "string" && value.source ? { source: value.source } : {}),
      })];
    })));
    const fallback = registry[defaultFont] ? defaultFont : Object.keys(registry)[0] || "";
    const labels = weightLabels instanceof Map
      ? weightLabels
      : new Map(Object.entries(weightLabels || {}).map(([weight, label]) => [Number(weight), label]));

    function config(fontKey) {
      return registry[fontKey] || registry[fallback] || { label: "", family: "sans-serif", weights: [400] };
    }

    function normalizeWeight(fontKey, weight) {
      const options = config(fontKey).weights;
      const numeric = Number.isFinite(Number(weight)) ? Number(weight) : options[0];
      return options.reduce((closest, candidate) => (
        Math.abs(candidate - numeric) < Math.abs(closest - numeric) ? candidate : closest
      ), options[0]);
    }

    function weightOptions(fontKey) {
      const weights = [...new Set(config(fontKey).weights)].sort((left, right) => left - right);
      if (weights.length <= 1) return [];
      const indexes = weights.length <= 5
        ? weights.map((_, index) => index)
        : [0, 2, 4, 6, weights.length - 1];
      return [...new Set(indexes)].filter((index) => Number.isFinite(weights[index])).map((index) => {
        const weight = weights[index];
        return { weight, label: labels.get(weight) || `굵기 ${weight}` };
      });
    }

    const fontOrder = Object.keys(registry).sort((left, right) => (
      registry[left].label.localeCompare(registry[right].label, "ko-KR")
      || left.localeCompare(right)
    ));
    return {
      fonts: registry,
      fontOrder,
      defaultFont: fallback,
      defaultWeight: normalizeWeight(fallback, defaultWeight),
      config,
      normalizeWeight,
      weightOptions,
    };
  }

  return { create, defaultFonts };
})();
if (typeof module !== "undefined") module.exports = TitleTypography;
