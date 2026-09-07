/* Shared card copy renderer: preview and PNG use the same Canvas text path. */
const CardCopy = (() => {
  const outputScale = 2;

  function draw(context, copyLayout = []) {
    if (!context || !Array.isArray(copyLayout)) return;
    for (const copy of copyLayout) {
      context.save();
      context.globalAlpha = Number.isFinite(copy.opacity) ? copy.opacity : 1;
      context.textAlign = ["left", "center", "right"].includes(copy.textAlign) ? copy.textAlign : "left";
      context.textBaseline = "alphabetic";
      context.font = copy.font || "400 16px sans-serif";
      context.fillStyle = copy.color || "#000";
      context.letterSpacing = `${Number.isFinite(copy.letterSpacing) ? copy.letterSpacing : 0}px`;
      context.lineJoin = "round";
      context.lineWidth = Number.isFinite(copy.stroke) ? copy.stroke : 0;
      context.strokeStyle = copy.strokeColor || "transparent";
      for (const line of copy.lines || []) {
        const metrics = context.measureText(line.text);
        const descent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent : 0;
        const baseline = line.y + line.height - descent;
        if (context.lineWidth > 0) context.strokeText(line.text, line.x, baseline);
        context.fillText(line.text, line.x, baseline);
      }
      context.restore();
    }
  }

  return { draw, outputScale };
})();

if (typeof module !== "undefined") module.exports = CardCopy;
