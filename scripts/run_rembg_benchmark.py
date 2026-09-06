import argparse
from pathlib import Path
from time import perf_counter
from rembg import new_session, remove


MODEL = "birefnet-general"
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description="Run rembg on explicitly supplied images.")
    parser.add_argument("sources", nargs="+", type=Path, help="Input images outside the production asset bundle.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "background-benchmark" / "birefnet-general")
    args = parser.parse_args()
    missing = [str(source) for source in args.sources if not source.is_file()]
    if missing:
        parser.error(f"Input image does not exist: {', '.join(missing)}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    session = new_session(MODEL)
    for source in args.sources:
        started = perf_counter()
        output = remove(source.read_bytes(), session=session)
        destination = args.output_dir / source.name
        destination.write_bytes(output)
        print(f"{source.name}\t{perf_counter() - started:.2f}s\t{len(output)} bytes")


if __name__ == "__main__":
    main()
