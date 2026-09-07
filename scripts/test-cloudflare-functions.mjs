import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { onRequestPost } from "../functions/api/background-removal.js";
import { onRequestGet } from "../functions/api/items/search.js";
import { normaliseKoreanRecord, normaliseXivItem, searchKoreanItems } from "../functions/_shared/item-search.mjs";

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
  assert.equal(
    normaliseKoreanRecord({ id: "1", slot: "head", names: { ko: "검증 장비" }, iconUrl: "/i/041000/041526.png" }).iconUrl,
    "https://xivapi.com/i/041000/041526.png",
    "relative snapshot icon paths must become safe absolute image URLs",
  );
  assert.equal(
    normaliseXivItem({ row_id: "2", fields: { Name: "API item", Icon: { path: "/i/041000/041527.png" }, EquipSlotCategory: { fields: { Head: 1 } } } }, "en").iconUrl,
    "https://xivapi.com/i/041000/041527.png",
    "XIVAPI relative icon paths must use the same image host as snapshot records",
  );
  assert.equal(
    searchKoreanItems([
      { id: "32799", slot: "body", names: { ko: "송아지 가죽 라이더 재킷" }, itemLevel: 1 },
    ], "송아지 가죽 라이더 자켓", "body")[0].id,
    "32799",
    "common Korean jacket spelling variants must resolve to the indexed item",
  );

  let indexFetches = 0;
  const itemSearchResponse = await onRequestGet({
    request: new Request("https://atelier.example/api/items/search?q=%EB%9A%B1%EB%83%A5%EC%9D%B4%20%EB%91%90%EA%B1%B4&slot=head&language=ko"),
    env: {
      ASSETS: {
        fetch: async () => {
          indexFetches++;
          if (indexFetches === 1) return new Response("temporary failure", { status: 503 });
          return new Response(JSON.stringify([
            { id: "38238", slot: "head", names: { ko: "뚱냥이 두건" }, itemLevel: 1 },
          ]), { status: 200, headers: { "Content-Type": "application/json" } });
        },
      },
    },
  });
  assert.equal(itemSearchResponse.status, 200, "item search should recover from a transient snapshot failure");
  assert.equal(indexFetches, 2, "item snapshot fetch should retry a transient failure");
  assert.equal((await itemSearchResponse.json()).results[0].id, "38238");

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
