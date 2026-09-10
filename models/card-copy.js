/* Shared card copy renderer: preview and PNG use the same Canvas text path. */
const CardCopy = (() => {
  const outputScale = 2;

  function draw(context, copyLayout = []) {
    if (!context || !Array.isArray(copyLayout)) return;
    for (const copy of copyLayout) {
      context.save();
      context.globalAlpha = Number.isFinite(copy.opacity) ? copy.opacity : 1;
      context.textAlign = ["left", "center", "right"].includes(copy.textAlign) ? copy.textAlign : "left";
      const textBaseline = copy.textBaseline === "top" ? "top" : "alphabetic";
      context.textBaseline = textBaseline;
      const fontStyle = copy.fontStyle === "italic" ? "italic " : "";
      context.font = `${fontStyle}${copy.font || "400 16px sans-serif"}`;
      context.fillStyle = copy.color || "#000";
      context.letterSpacing = `${Number.isFinite(copy.letterSpacing) ? copy.letterSpacing : 0}px`;
      context.lineJoin = "round";
      context.lineWidth = Number.isFinite(copy.stroke) ? copy.stroke : 0;
      context.strokeStyle = copy.strokeColor || "transparent";
      for (const line of copy.lines || []) {
        const metrics = context.measureText(line.text);
        const descent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent : 0;
        const baseline = textBaseline === "top" ? line.y : line.y + line.height - descent;
        if (context.lineWidth > 0) context.strokeText(line.text, line.x, baseline);
        context.fillText(line.text, line.x, baseline);
        if (copy.textDecoration === "underline" && line.text) {
          const startX = context.textAlign === "center"
            ? line.x - metrics.width / 2
            : context.textAlign === "right"
              ? line.x - metrics.width
              : line.x;
          const underlineY = baseline + Math.max(1, line.height * .08);
          context.save();
          context.beginPath();
          context.lineWidth = Math.max(1, line.height * .06);
          context.strokeStyle = copy.color || "#000";
          context.moveTo(startX, underlineY);
          context.lineTo(startX + metrics.width, underlineY);
          context.stroke();
          context.restore();
        }
      }
      context.restore();
    }
  }

  return { draw, outputScale };
})();

if (typeof module !== "undefined") module.exports = CardCopy;
