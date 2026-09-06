import argparse
from pathlib import Path
from time import perf_counter

from PIL import Image
from transparent_background import Remover


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run InSPyReNet on explicitly supplied images.")
    parser.add_argument("sources", nargs="+", type=Path, help="Input images outside the production asset bundle.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "background-benchmark" / "inspyrenet")
    args = parser.parse_args()
    missing = [str(source) for source in args.sources if not source.is_file()]
    if missing:
        parser.error(f"Input image does not exist: {', '.join(missing)}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    remover = Remover(mode="base", device="cpu", resize="static")

    for source in args.sources:
        started = perf_counter()
        with Image.open(source) as image:
            result = remover.process(image.convert("RGB"), type="rgba")
        destination = args.output_dir / source.name
        result.save(destination)
        elapsed = perf_counter() - started
        print(f"{source.name}\t{elapsed:.2f}s\t{destination.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    main()
