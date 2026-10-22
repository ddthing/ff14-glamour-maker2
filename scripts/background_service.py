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
import re
import socket
import time
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore, Lock

from PIL import Image, UnidentifiedImageError

from rembg import new_session, remove


MAX_UPLOAD_BYTES = 16 * 1024 * 1024
MAX_RESULT_BYTES = 32 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
MAX_CONCURRENT_REQUESTS = 32
MAX_BODY_READ_SECONDS = 90
BODY_READ_CHUNK_BYTES = 64 * 1024
SUPPORTED_TYPES = {"image/png", "image/jpeg", "image/webp"}
MODEL_NAME = os.environ.get("BACKGROUND_MODEL", "birefnet-general")
HOST = os.environ.get("BACKGROUND_SERVICE_HOST", "0.0.0.0")
PORT = int(os.environ.get("BACKGROUND_SERVICE_PORT", os.environ.get("PORT", "8788")))
ACCESS_TOKEN = os.environ.get("CUTOUT_SERVICE_TOKEN", "").strip()
ALLOW_ANONYMOUS = os.environ.get("ALLOW_ANONYMOUS_CUTOUT", "").strip().lower() == "true"
GPU_LOCK = Lock()
GPU_SLOT = BoundedSemaphore(1)
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def create_gpu_session():
    """Fail closed if CUDA is not available; never silently downgrade to CPU."""
    import onnxruntime as ort

    providers = ort.get_available_providers()
    if "CUDAExecutionProvider" not in providers:
        raise RuntimeError(
            "CUDAExecutionProvider를 사용할 수 없습니다. "
            "onnxruntime-gpu와 CUDA/cuDNN 호환성을 확인해 주세요."
        )
    session = new_session(MODEL_NAME, providers=["CUDAExecutionProvider"])
    active = getattr(getattr(session, "inner_session", None), "get_providers", lambda: [])()
    if not active or active[0] != "CUDAExecutionProvider":
        raise RuntimeError(f"GPU 세션을 확인하지 못했습니다: {active}")
    return session


SESSION = create_gpu_session()


class CutoutHandler(BaseHTTPRequestHandler):
    server_version = "TuyeongSetMaker2Cutout/1.1"
    body_read_timeout_seconds = MAX_BODY_READ_SECONDS

    def setup(self):  # noqa: D401 - BaseHTTPRequestHandler lifecycle hook
        super().setup()
        self.connection.settimeout(30)

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
        transfer_encodings = self.headers.get_all("Transfer-Encoding", [])
        if transfer_encodings:
            self.send_json(400, {"error": "지원하지 않는 이미지 전송 방식입니다."})
            return
        content_lengths = self.headers.get_all("Content-Length", [])
        if not content_lengths:
            self.send_json(411, {"error": "이미지 크기 정보가 필요합니다."})
            return
        if len(content_lengths) != 1 or not re.fullmatch(r"[0-9]+", content_lengths[0].strip()):
            self.send_json(400, {"error": "올바른 이미지 크기 정보가 필요합니다."})
            return
        normalised_length = content_lengths[0].strip().lstrip("0") or "0"
        maximum_length = str(MAX_UPLOAD_BYTES)
        if len(normalised_length) > len(maximum_length) or (
            len(normalised_length) == len(maximum_length) and normalised_length > maximum_length
        ):
            self.send_json(413, {"error": "16MB 이하 이미지를 사용해 주세요."})
            return
        declared_size = int(normalised_length)
        if not GPU_SLOT.acquire(blocking=False):
            self.send_json(429, {"error": "배경 제거 서버가 처리 중입니다. 잠시 후 다시 시도해 주세요."}, {"Retry-After": "5"})
            return
        try:
            body = self.read_body(declared_size)
            if body is None or not self.validate_image_dimensions(body):
                return
            try:
                with GPU_LOCK:
                    output = remove(body, session=SESSION)
            except Exception as error:  # pragma: no cover - provider-specific runtime errors
                self.log_error("background removal failed: %s", error)
                self.send_json(500, {"error": "배경 제거에 실패했습니다."})
                return
            if len(output) > MAX_RESULT_BYTES:
                self.send_json(413, {"error": "배경 제거 결과가 너무 큽니다."})
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(output)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Background-Model", MODEL_NAME)
            self.send_header("X-Background-Provider", "CUDAExecutionProvider")
            self.end_headers()
            self.wfile.write(output)
        finally:
            GPU_SLOT.release()

    def authorized(self):
        if not ACCESS_TOKEN:
            return ALLOW_ANONYMOUS
        received = self.headers.get("Authorization", "")
        expected = f"Bearer {ACCESS_TOKEN}"
        return hmac.compare_digest(received, expected)

    def validate_image_dimensions(self, body):
        try:
            with Image.open(BytesIO(body)) as image:
                width, height = image.size
                if width * height > MAX_IMAGE_PIXELS:
                    self.send_json(413, {"error": "이미지 해상도가 너무 큽니다."})
                    return False
        except Image.DecompressionBombError:
            self.send_json(413, {"error": "이미지 해상도가 너무 큽니다."})
            return False
        except (UnidentifiedImageError, OSError):
            self.send_json(400, {"error": "유효한 이미지를 읽지 못했습니다."})
            return False
        return True

    def read_body(self, declared_size):
        if not isinstance(declared_size, int) or declared_size < 0:
            self.send_json(400, {"error": "올바른 이미지 크기 정보가 필요합니다."})
            return None
        if declared_size > MAX_UPLOAD_BYTES:
            self.send_json(413, {"error": "16MB 이하 이미지를 사용해 주세요."})
            return None

        deadline = time.monotonic() + self.body_read_timeout_seconds
        original_timeout = self.connection.gettimeout()
        chunks = []
        remaining = declared_size
        try:
            while remaining:
                time_left = deadline - time.monotonic()
                if time_left <= 0:
                    self.connection.settimeout(original_timeout)
                    self.send_json(408, {"error": "이미지 업로드 시간이 초과되었습니다."})
                    return None
                self.connection.settimeout(min(original_timeout or time_left, time_left))
                try:
                    chunk = self.rfile.read1(min(BODY_READ_CHUNK_BYTES, remaining))
                except (socket.timeout, TimeoutError):
                    self.connection.settimeout(original_timeout)
                    self.send_json(408, {"error": "이미지 업로드 시간이 초과되었습니다."})
                    return None
                if not chunk:
                    self.connection.settimeout(original_timeout)
                    self.send_json(400, {"error": "이미지를 끝까지 읽지 못했습니다."})
                    return None
                chunks.append(chunk)
                remaining -= len(chunk)
        finally:
            self.connection.settimeout(original_timeout)
        return b"".join(chunks)

    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[cutout] {self.address_string()} - {format % args}")


def main():
    server = BoundedThreadingHTTPServer((HOST, PORT), CutoutHandler)
    if not ACCESS_TOKEN and not ALLOW_ANONYMOUS:
        print("CUTOUT_SERVICE_TOKEN is not set; POST /remove will reject anonymous requests.")
    print(f"투영세트메이커2 cutout service listening on http://{HOST}:{PORT}")
    print(f"model={MODEL_NAME} provider=CUDAExecutionProvider")
    server.serve_forever()


class BoundedThreadingHTTPServer(ThreadingHTTPServer):
    """Limit request threads so slow or incomplete clients cannot grow them without bound."""

    def __init__(self, server_address, RequestHandlerClass, max_concurrent_requests=MAX_CONCURRENT_REQUESTS, **kwargs):
        if max_concurrent_requests < 1:
            raise ValueError("max_concurrent_requests must be positive")
        self._request_slots = BoundedSemaphore(max_concurrent_requests)
        super().__init__(server_address, RequestHandlerClass, **kwargs)

    def process_request(self, request, client_address):
        if not self._request_slots.acquire(blocking=False):
            body = '{"error":"배경 제거 서버가 처리 중입니다. 잠시 후 다시 시도해 주세요."}'.encode("utf-8")
            response = (
                b"HTTP/1.0 429 Too Many Requests\r\n"
                b"Content-Type: application/json; charset=utf-8\r\n"
                b"Cache-Control: no-store\r\n"
                b"Retry-After: 5\r\n"
                b"Content-Length: " + str(len(body)).encode("ascii") + b"\r\n"
                b"Connection: close\r\n\r\n" + body
            )
            try:
                request.sendall(response)
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._request_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._request_slots.release()


if __name__ == "__main__":
    main()
