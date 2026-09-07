import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { onRequestPost } from "../functions/api/background-removal.js";

if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { ...(globalThis.crypto || {}), randomUUID };
}

const originalFetch = globalThis.fetch;

function request(body = Uint8Array.from([1, 2, 3]), headers = { "Content-Type": "image/png" }) {
  return new Request("https://atelier.example/api/background-removal", {
    method: "POST",
    headers,
    body,
  });
}

try {
  let response = await onRequestPost({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "cutout_service_not_configured");

  response = await onRequestPost({
    request: request(),
    env: { CUTOUT_SERVICE_URL: "http://gpu.example.test/remove" },
  });
  assert.equal(response.status, 503, "공개 주소는 HTTPS만 허용해야 합니다.");

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(Uint8Array.from([137, 80, 78, 71]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };
  response = await onRequestPost({
    request: request(),
    env: {
      CUTOUT_SERVICE_URL: "https://gpu.example.test/remove",
      CUTOUT_SERVICE_TOKEN: "test-token",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-background-mode"), "gpu");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [137, 80, 78, 71]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://gpu.example.test/remove");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer test-token");
  assert.equal(calls[0].options.headers.get("Content-Type"), "image/png");

  response = await onRequestPost({
    request: request(Uint8Array.from([1]), {
      "Content-Type": "image/png",
      "Content-Length": String(16 * 1024 * 1024 + 1),
    }),
    env: { CUTOUT_SERVICE_URL: "https://gpu.example.test/remove" },
  });
  assert.equal(response.status, 413, "request bodies must be bounded before forwarding to the service");

  globalThis.fetch = async () => new Response(Uint8Array.from([137, 80, 78, 71]), {
    status: 200,
    headers: { "Content-Type": "image/png", "Content-Length": String(32 * 1024 * 1024 + 1) },
  });
  response = await onRequestPost({
    request: request(),
    env: { CUTOUT_SERVICE_URL: "https://gpu.example.test/remove" },
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "cutout_result_too_large");

  globalThis.fetch = async () => new Response("not an image", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
  response = await onRequestPost({
    request: request(),
    env: { CUTOUT_SERVICE_URL: "https://gpu.example.test/remove" },
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "cutout_invalid_response");

  response = await onRequestPost({
    request: request(Uint8Array.from([1]), { "Content-Type": "image/gif" }),
    env: { CUTOUT_SERVICE_URL: "https://gpu.example.test/remove" },
  });
  assert.equal(response.status, 415);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Cloudflare background-removal function tests passed.");
