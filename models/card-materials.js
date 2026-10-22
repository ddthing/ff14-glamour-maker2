/*
 * Theme material contracts. The two material systems intentionally share no
 * decorative fallback: each pattern keeps its own material vocabulary while
 * sharing the deterministic renderer.
 */
const CardMaterials = (() => {
  const note = (tint, position, tape) => Object.freeze({
    tint,
    position: Object.freeze(position),
    tape: Object.freeze(tape),
  });
  const tape = (left, width, height, rotation, color) => ({ left, width, height, rotation, color });
  const materials = Object.freeze({
    collage: Object.freeze({
      key: "collage",
      publicName: "기록의 조각",
      asset: "assets/themes/materials/archive-paper-material-v1.webp",
      surface: "#eee2d1",
      ink: "#3f3933",
      mutedInk: "rgba(63, 57, 51, .64)",
      notes: Object.freeze([
        note("#f4e8d7", [12, 12], tape(37, 25, 10, -1, "rgb(211 181 137 / .76)")),
        note("#e7ddd0", [82, 18], tape(64, 21, 12, 1, "rgb(165 184 181 / .72)")),
        note("#e9d7d0", [20, 82], tape(52, 27, 12, -1.4, "rgb(220 193 157 / .74)")),
        note("#e0e5d9", [75, 76], tape(64, 21, 12, 1, "rgb(165 184 181 / .72)")),
        note("#f1e2ca", [50, 50], tape(37, 25, 10, -1, "rgb(211 181 137 / .76)")),
      ]),
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
      notes: Object.freeze([
        note("#f7f0e3", [50, 12], tape(16, 24, 12, -1, "rgb(198 213 217 / .66)")),
        note("#e7eef0", [84, 22], tape(64, 21, 12, 1, "rgb(190 205 193 / .72)")),
        note("#edf0e7", [18, 78], tape(52, 27, 12, -1.4, "rgb(219 196 164 / .66)")),
        note("#eef2f3", [76, 74], tape(64, 21, 12, 1, "rgb(190 205 193 / .72)")),
        note("#f4eee4", [50, 52], tape(16, 24, 12, -1, "rgb(198 213 217 / .66)")),
      ]),
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

  function noteFor(key, index = 0) {
    const notes = get(key)?.notes;
    if (!Array.isArray(notes) || !notes.length) return null;
    const numericIndex = Number(index);
    const resolvedIndex = Number.isFinite(numericIndex) ? Math.trunc(numericIndex) : 0;
    return notes[((resolvedIndex % notes.length) + notes.length) % notes.length];
  }

  // Resolve the source crop for CSS background-size percentages. CSS sizes
  // the sample relative to the note box, then positions the overflow within
  // that box; Canvas needs the equivalent source rectangle for the export.
  function sourceRectForBackground(imageWidth, imageHeight, { scale = 1, position = [50, 50] } = {}) {
    const width = Number(imageWidth);
    const height = Number(imageHeight);
    const resolvedScale = Number(scale);
    if (!(width > 0 && height > 0 && resolvedScale > 0)) return null;
    const sourceWidth = width / resolvedScale;
    const sourceHeight = height / resolvedScale;
    const xPosition = Math.min(100, Math.max(0, Number(position?.[0]) || 0)) / 100;
    const yPosition = Math.min(100, Math.max(0, Number(position?.[1]) || 0)) / 100;
    return {
      x: (width - sourceWidth) * xPosition,
      y: (height - sourceHeight) * yPosition,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  function noteSourceRect(key, index, imageWidth, imageHeight) {
    const materialNote = noteFor(key, index);
    return materialNote
      ? sourceRectForBackground(imageWidth, imageHeight, { scale: 1.8, position: materialNote.position })
      : null;
  }

  function tapeSourceRect(imageWidth, imageHeight) {
    return sourceRectForBackground(imageWidth, imageHeight, { scale: 2.6 });
  }

  return Object.freeze({ get, has, noteFor, noteSourceRect, sourceRectForBackground, tapeSourceRect, materials });
})();

if (typeof module !== "undefined") module.exports = CardMaterials;
