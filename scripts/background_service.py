"""Small, stateless HTTP service for the production background-removal GPU.

The service deliberately accepts raw image bytes instead of multipart uploads so
Cloudflare Pages can proxy the request without knowing provider-specific details.
It keeps the BiRefNet session warm, serialises GPU work, and never persists input
or output files.
"""

from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

from rembg import new_session, remove


MAX_UPLOAD_BYTES = 16 * 1024 * 1024
SUPPORTED_TYPES = {"image/png", "image/jpeg", "image/webp"}
MODEL_NAME = os.environ.get("BACKGROUND_MODEL", "birefnet-general")
HOST = os.environ.get("BACKGROUND_SERVICE_HOST", "0.0.0.0")
PORT = int(os.environ.get("BACKGROUND_SERVICE_PORT", os.environ.get("PORT", "8788")))
ACCESS_TOKEN = os.environ.get("CUTOUT_SERVICE_TOKEN", "").strip()
GPU_LOCK = Lock()


def create_gpu_session():
    """Fail closed if CUDA is not available; never silently downgrade to CPU."""
    import onnxruntime as ort

    providers = ort.get_available_providers()
    if "CUDAExecutionProvider" not in providers:
        raise RuntimeError(
            "CUDAExecutionProvider를 사용할 수 없습니다. "
            "onnxruntime-gpu와 CUDA/cuDNN 호환성을 확인해주세요."
        )
    session = new_session(MODEL_NAME, providers=["CUDAExecutionProvider"])
    active = getattr(getattr(session, "inner_session", None), "get_providers", lambda: [])()
    if not active or active[0] != "CUDAExecutionProvider":
        raise RuntimeError(f"GPU 세션을 확인하지 못했습니다: {active}")
    return session


SESSION = create_gpu_session()


class CutoutHandler(BaseHTTPRequestHandler):
    server_version = "GlamourAtelierCutout/1.0"

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path.split("?", 1)[0] == "/health":
            self.send_json(200, {"status": "ok", "model": MODEL_NAME, "provider": "CUDAExecutionProvider"})
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path.split("?", 1)[0] != "/remove":
            self.send_json(404, {"error": "Not found"})
            return
        if not self.authorized():
            self.send_json(401, {"error": "Unauthorized"})
            return
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type not in SUPPORTED_TYPES:
            self.send_json(415, {"error": "PNG, JPEG, WEBP 이미지만 처리할 수 있습니다."})
            return
        content_length = self.headers.get("Content-Length")
        try:
            declared_size = int(content_length) if content_length else None
        except ValueError:
            declared_size = None
        if declared_size is not None and declared_size > MAX_UPLOAD_BYTES:
            self.send_json(413, {"error": "16MB 이하 이미지를 사용해주세요."})
            return
        body = self.read_body(declared_size)
        if body is None:
            return
        try:
            with GPU_LOCK:
                output = remove(body, session=SESSION)
        except Exception as error:  # pragma: no cover - provider-specific runtime errors
            self.log_error("background removal failed: %s", error)
            self.send_json(500, {"error": "배경 제거에 실패했습니다."})
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(output)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Background-Model", MODEL_NAME)
        self.send_header("X-Background-Provider", "CUDAExecutionProvider")
        self.end_headers()
        self.wfile.write(output)

    def authorized(self):
        if not ACCESS_TOKEN:
            return True
        received = self.headers.get("Authorization", "")
        expected = f"Bearer {ACCESS_TOKEN}"
        return hmac.compare_digest(received, expected)

    def read_body(self, declared_size):
        if declared_size is not None:
            body = self.rfile.read(declared_size)
            if len(body) != declared_size:
                self.send_json(400, {"error": "이미지를 끝까지 읽지 못했습니다."})
                return None
        else:
            body = self.rfile.read(MAX_UPLOAD_BYTES + 1)
        if len(body) > MAX_UPLOAD_BYTES:
            self.send_json(413, {"error": "16MB 이하 이미지를 사용해주세요."})
            return None
        return body

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[cutout] {self.address_string()} - {format % args}")


def main():
    server = ThreadingHTTPServer((HOST, PORT), CutoutHandler)
    print(f"Glamour Atelier cutout service listening on http://{HOST}:{PORT}")
    print(f"model={MODEL_NAME} provider=CUDAExecutionProvider")
    server.serve_forever()


if __name__ == "__main__":
    main()
