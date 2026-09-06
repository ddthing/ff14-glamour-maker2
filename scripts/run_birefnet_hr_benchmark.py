import argparse
from pathlib import Path
from time import perf_counter

import torch
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation


ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = "ZhengPeng7/BiRefNet_HR-matting"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run BiRefNet HR on an explicitly supplied image.")
    parser.add_argument("source", type=Path, help="Input image outside the production asset bundle.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "background-benchmark" / "birefnet-hr")
    args = parser.parse_args()
    source = args.source
    if not source.is_file():
        parser.error(f"Input image does not exist: {source}")
    output = args.output_dir / source.name
    output.parent.mkdir(parents=True, exist_ok=True)
    load_started = perf_counter()
    model = AutoModelForImageSegmentation.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        cache_dir=ROOT / ".models" / "huggingface",
    ).to("cpu").eval()
    print(f"model-load\t{perf_counter() - load_started:.2f}s", flush=True)

    transform = transforms.Compose(
        [
            transforms.Resize((2048, 2048)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    with Image.open(source) as opened:
        image = opened.convert("RGB")
    started = perf_counter()
    tensor = transform(image).unsqueeze(0).half()
    with torch.inference_mode():
        prediction = model(tensor)[-1].sigmoid().cpu()[0].squeeze()
    mask = transforms.ToPILImage()(prediction).resize(image.size, Image.Resampling.LANCZOS)
    result = image.convert("RGBA")
    result.putalpha(mask)
    result.save(output)
    print(f"{source.name}\t{perf_counter() - started:.2f}s\t{output.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    main()
