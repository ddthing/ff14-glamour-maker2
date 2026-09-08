/*
 * Theme material contracts. The two material systems intentionally share no
 * decorative fallback: each pattern keeps its own material vocabulary while
 * sharing the deterministic renderer.
 */
const CardMaterials = (() => {
  const materials = Object.freeze({
    collage: Object.freeze({
      key: "collage",
      publicName: "기록의 조각",
      asset: "assets/themes/materials/archive-paper-material-v1.webp",
      surface: "#eee2d1",
      ink: "#3f3933",
      mutedInk: "rgba(63, 57, 51, .64)",
      noteTints: Object.freeze(["#f4e8d7", "#e7ddd0", "#e9d7d0", "#e0e5d9"]),
      tapeTints: Object.freeze(["rgba(211, 181, 137, .78)", "rgba(165, 184, 181, .76)", "rgba(220, 193, 157, .74)"]),
      stampInk: "rgba(77, 70, 62, .64)",
      noteShape: "torn",
    }),
    scrapbook: Object.freeze({
      key: "scrapbook",
      publicName: "푸른 여백",
      asset: "assets/themes/materials/airy-paper-material-v1.webp",
      surface: "#f4f5f1",
      ink: "#294650",
      mutedInk: "rgba(41, 70, 80, .62)",
      noteTints: Object.freeze(["#f7f0e3", "#e7eef0", "#edf0e7", "#eef2f3"]),
      tapeTints: Object.freeze(["rgba(198, 213, 217, .72)", "rgba(219, 196, 164, .68)", "rgba(190, 205, 193, .72)"]),
      stampInk: "rgba(52, 82, 91, .48)",
      noteShape: "deckled",
    }),
  });

  function get(key) {
    return materials[key] || null;
  }

  function has(key) {
    return Boolean(materials[key]);
  }

  return Object.freeze({ get, has, materials });
})();

if (typeof module !== "undefined") module.exports = CardMaterials;
