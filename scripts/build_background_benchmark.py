import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "artifacts/background-benchmark"
PANEL = (600, 1067)
LABEL_HEIGHT = 54


def checkerboard(size, cell=24):
    image = Image.new("RGB", size, "#ececec")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#d9d9d9")
    return image


def panel_for(path, label):
    image = Image.open(path).convert("RGBA")
    image.thumbnail(PANEL, Image.Resampling.LANCZOS)
    panel = checkerboard(PANEL).convert("RGBA")
    x = (PANEL[0] - image.width) // 2
    y = (PANEL[1] - image.height) // 2
    panel.alpha_composite(image, (x, y))
    labelled = Image.new("RGB", (PANEL[0], PANEL[1] + LABEL_HEIGHT), "white")
    labelled.paste(panel.convert("RGB"), (0, LABEL_HEIGHT))
    draw = ImageDraw.Draw(labelled)
    font = ImageFont.load_default(size=22)
    draw.text((18, 15), label, fill="#171717", font=font)
    return labelled


def alpha_metrics(path):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    total = image.width * image.height
    return {
        "size": [image.width, image.height],
        "transparent_ratio": round(sum(histogram[:8]) / total, 5),
        "soft_alpha_ratio": round(sum(histogram[8:248]) / total, 5),
        "opaque_ratio": round(sum(histogram[248:]) / total, 5),
        "alpha_bbox": list(alpha.getbbox() or (0, 0, 0, 0)),
    }


def main():
    parser = argparse.ArgumentParser(description="Build a background-removal comparison from explicitly supplied files.")
    parser.add_argument("--source", required=True, type=Path, help="Original image outside the production asset bundle.")
    parser.add_argument("--candidate", action="append", default=[], metavar="LABEL=PATH", help="Candidate result; repeat for each result.")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    results = {"original": args.source}
    for candidate in args.candidate:
        label, separator, path = candidate.partition("=")
        if not separator or not label or not path:
            parser.error(f"--candidate must use LABEL=PATH: {candidate}")
        results[label] = Path(path)
    if not args.source.is_file() or any(not path.is_file() for label, path in results.items() if label != "original"):
        parser.error("Every supplied benchmark image must exist.")
    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    panels = [panel_for(path, label) for label, path in results.items()]
    sheet = Image.new("RGB", (PANEL[0] * 2, (PANEL[1] + LABEL_HEIGHT) * 2), "#f5f5f5")
    for index, panel in enumerate(panels):
        sheet.paste(panel, ((index % 2) * PANEL[0], (index // 2) * panel.height))
    sheet.save(out_dir / "comparison.png", optimize=True)
    metrics = {label: alpha_metrics(path) for label, path in results.items() if label != "original"}
    (out_dir / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
