/* Shared item-name wrapping: every card surface must preserve the complete
   item name instead of replacing it with an ellipsis. The measure callback is
   supplied by the caller so DOM and Canvas can use their active font metrics. */
const CardGearCopy = (() => {
  function localizedNames(item, language = "ko") {
    const order = [...new Set([language, "ko", "en", "ja"])];
    const seen = new Set();
    return order.flatMap((locale) => {
      const text = normalise(item?.names?.[locale]);
      if (!text || seen.has(text)) return [];
      seen.add(text);
      return [{ language: locale, text }];
    });
  }

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
    if (String(value ?? "").includes("\n")) {
      return String(value).split(/\r?\n/u).flatMap((line) => wrapText(line, measureText, maxWidth));
    }
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

  return { normalise, wrapText, localizedNames };
})();

if (typeof module !== "undefined") module.exports = CardGearCopy;
