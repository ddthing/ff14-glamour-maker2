/* Shared item-name wrapping: every card surface must preserve the complete
   item name instead of replacing it with an ellipsis. The measure callback is
   supplied by the caller so DOM and Canvas can use their active font metrics. */
const CardGearCopy = (() => {
  function normalise(value) {
    return String(value ?? "").replace(/\s+/gu, " ").trim();
  }

  function graphemes(value) {
    return typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment)
      : Array.from(value);
  }

  function splitToken(token, measureText, maxWidth) {
    const pieces = [];
    let current = "";
    for (const character of graphemes(token)) {
      const candidate = current + character;
      if (!current || measureText(candidate) <= maxWidth) {
        current = candidate;
      } else {
        pieces.push(current);
        current = character;
      }
    }
    if (current) pieces.push(current);
    return pieces;
  }

  function wrapText(value, measureText, maxWidth) {
    const text = normalise(value);
    if (!text) return [];
    const width = Math.max(1, Number(maxWidth) || 1);
    const lines = [];
    let line = "";
    for (const token of text.split(" ")) {
      const candidate = line ? `${line} ${token}` : token;
      if (measureText(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      const pieces = splitToken(token, measureText, width);
      if (pieces.length > 1) {
        lines.push(...pieces.slice(0, -1));
        line = pieces.at(-1);
      } else {
        line = token;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  return { normalise, wrapText };
})();

if (typeof module !== "undefined") module.exports = CardGearCopy;
