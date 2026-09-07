/* Pure contrast policy for card copy that sits on variable artwork. */
const ColorContrast = (() => {
  const darkInk = "#111111";
  const lightInk = "#ffffff";

  function parseHexColor(value) {
    const source = String(value || "").trim().replace(/^#/, "");
    const hex = source.length === 3 ? source.split("").map((character) => character + character).join("") : source;
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  }

  function linearise(channel) {
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function relativeLuminance(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return null;
    const [red, green, blue] = rgb.map(linearise);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function themeFor(backgroundColor) {
    const luminance = relativeLuminance(backgroundColor);
    const foreground = luminance !== null && luminance <= 0.179 ? lightInk : darkInk;
    const halo = foreground === lightInk ? "rgba(0, 0, 0, .84)" : "rgba(255, 255, 255, .94)";
    const muted = foreground === lightInk ? "rgba(255, 255, 255, .66)" : "rgba(17, 17, 17, .66)";
    return Object.freeze({ foreground, muted, halo });
  }

  return Object.freeze({ themeFor, relativeLuminance });
})();

if (typeof module !== "undefined") module.exports = ColorContrast;
