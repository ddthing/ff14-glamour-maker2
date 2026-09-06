"""Persistent local BiRefNet worker using newline-delimited JSON over stdio."""

import json
import sys
from pathlib import Path

from rembg import new_session, remove


def respond(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> None:
    try:
        session = new_session("birefnet-general", providers=["CPUExecutionProvider"])
    except Exception as error:
        respond({"type": "fatal", "error": f"AI 모델을 준비하지 못했습니다: {error}"})
        return

    respond({"type": "ready", "model": "birefnet-general"})
    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            source = Path(request["input"])
            destination = Path(request["output"])
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(remove(source.read_bytes(), session=session))
            respond({"type": "result", "id": request["id"], "output": str(destination)})
        except Exception as error:
            respond({
                "type": "error",
                "id": request.get("id") if "request" in locals() else None,
                "error": str(error),
            })


if __name__ == "__main__":
    main()
