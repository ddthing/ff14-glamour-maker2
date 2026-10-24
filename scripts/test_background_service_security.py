"""Socket-level regression checks for the cutout service HTTP boundary."""

import importlib.util
import io
import os
import socket
import sys
import threading
import types
from pathlib import Path
from unittest.mock import patch

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SERVICE_PATH = ROOT / "scripts" / "background_service.py"


class FakeSession:
    class InnerSession:
        @staticmethod
        def get_providers():
            return ["CUDAExecutionProvider"]

    inner_session = InnerSession()


def load_service():
    rembg = types.ModuleType("rembg")
    rembg.new_session = lambda *_args, **_kwargs: FakeSession()
    rembg.remove = lambda image_bytes, session: image_bytes
    onnxruntime = types.ModuleType("onnxruntime")
    onnxruntime.get_available_providers = lambda: ["CUDAExecutionProvider"]
    sys.modules["rembg"] = rembg
    sys.modules["onnxruntime"] = onnxruntime
    spec = importlib.util.spec_from_file_location("background_service_security_test", SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_png():
    image = Image.new("RGB", (1, 1), "white")
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def exchange(address, request_bytes, timeout=1):
    with socket.create_connection(address, timeout=timeout) as client:
        client.settimeout(timeout)
        client.sendall(request_bytes)
        chunks = []
        while True:
            chunk = client.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
    return b"".join(chunks)


def status(response):
    line = response.split(b"\r\n", 1)[0]
    return int(line.split(b" ", 2)[1])


class DummySocket:
    def __init__(self):
        self.closed = False
        self.payload = b""

    def sendall(self, payload):
        self.payload = payload

    def shutdown(self, _how):
        pass

    def close(self):
        self.closed = True


def main():
    with patch.dict(os.environ, {"CUTOUT_SERVICE_TOKEN": "", "ALLOW_ANONYMOUS_CUTOUT": "true"}):
        module = load_service()
    handler = type("FastCutoutHandler", (module.CutoutHandler,), {"body_read_timeout_seconds": 0.2})
    server = module.BoundedThreadingHTTPServer(("127.0.0.1", 0), handler, max_concurrent_requests=1)
    serving = threading.Thread(target=server.serve_forever, daemon=True)
    serving.start()
    address = server.server_address
    png = make_png()
    try:
        cases = [
            (b"Content-Type: image/png\r\n", 411, "missing Content-Length"),
            (b"Content-Type: image/png\r\nContent-Length: -1\r\n", 400, "negative Content-Length"),
            (b"Content-Type: image/png\r\nContent-Length: 4x\r\n", 400, "malformed Content-Length"),
            (b"Content-Type: image/png\r\nContent-Length: 1\r\nContent-Length: 1\r\n", 400, "duplicate Content-Length"),
            (b"Content-Type: image/png\r\nTransfer-Encoding: chunked\r\n", 400, "unsupported chunked framing"),
            (f"Content-Type: image/png\r\nContent-Length: {module.MAX_UPLOAD_BYTES + 1}\r\n".encode(), 413, "oversized Content-Length"),
        ]
        for headers, expected, label in cases:
            response = exchange(address, b"POST /remove HTTP/1.0\r\n" + headers + b"\r\n")
            assert status(response) == expected, f"{label}: got {response[:80]!r}"

        success = exchange(
            address,
            b"POST /remove HTTP/1.0\r\nContent-Type: image/png\r\nContent-Length: "
            + str(len(png)).encode()
            + b"\r\n\r\n"
            + png,
        )
        assert status(success) == 200, "well-framed image upload should still succeed"
        assert success.endswith(png), "cutout output should be returned unchanged by the test stub"

        with socket.create_connection(address, timeout=1) as slow:
            slow.settimeout(1)
            slow.sendall(
                b"POST /remove HTTP/1.0\r\nContent-Type: image/png\r\nContent-Length: 4\r\n\r\nx"
            )
            timed_out = []
            while True:
                chunk = slow.recv(4096)
                if not chunk:
                    break
                timed_out.append(chunk)
        assert status(b"".join(timed_out)) == 408, "a stalled body must hit the total upload deadline"

        assert server._request_slots.acquire(blocking=False), "all request slots should be released after completed requests"
        excess = DummySocket()
        server.process_request(excess, ("127.0.0.1", 0))
        assert excess.closed, "the server must close excess connections instead of creating unbounded threads"
        assert excess.payload.startswith(b"HTTP/1.0 429 Too Many Requests\r\n"), "overload should return a retryable response"
        assert b"Retry-After: 5\r\n" in excess.payload
        server._request_slots.release()
    finally:
        server.shutdown()
        server.server_close()
        serving.join(timeout=2)

    print("PASS: cutout framing rejects ambiguous lengths, limits body time, and bounds request threads.")


if __name__ == "__main__":
    main()
