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
  return new Request("https://tuyeong-set-maker2.example/api/background-removal", {
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
    normaliseXivItem({ row_id: "15479", fields: { Name: "Swine Body", Icon: { id: 42523 }, EquipSlotCategory: { value: 16 } } }, "en").slot,
    "body",
    "special costume categories must remain searchable when the API omits nested slot fields",
  );
  assert.equal(
    searchKoreanItems([
      { id: "32799", slot: "body", names: { ko: "송아지 가죽 라이더 재킷" }, itemLevel: 1 },
    ], "송아지 가죽 라이더 자켓", "body")[0].id,
    "32799",
    "common Korean jacket spelling variants must resolve to the indexed item",
  );
  const orderedIndex = [
    { id: "1", slot: "head", names: { ko: "같은 이름" }, itemLevel: 1 },
    { id: "2", slot: "body", names: { ko: "같은 이름" }, itemLevel: 1 },
    { id: "3", slot: "head", names: { ko: "같은 이름" }, itemLevel: 1 },
  ];
  assert.deepEqual(
    searchKoreanItems(orderedIndex, "같은 이름", "head").map((item) => item.id),
    ["1", "3"],
    "slot-specific search should preserve source order for equal scores",
  );
  assert.deepEqual(
    orderedIndex.map((item) => item.id),
    ["1", "2", "3"],
    "search indexing must not mutate the source records",
  );

  let indexFetches = 0;
  const assetUrls = [];
  const itemSearchResponse = await onRequestGet({
    request: new Request("https://tuyeong-set-maker2.example/api/items/search?q=%EB%9A%B1%EB%83%A5%EC%9D%B4%20%EB%91%90%EA%B1%B4&slot=head&language=ko"),
    env: {
      ASSETS: {
        fetch: async (url) => {
          assetUrls.push(String(url));
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
  assert.ok(assetUrls[0].endsWith("/assets/data/items-ko-head.json"), "slot searches should request only the active slot index");
  assert.equal((await itemSearchResponse.json()).results[0].id, "38238");

  const localizedKoreanResponse = await onRequestGet({
    request: new Request("https://tuyeong-set-maker2.example/api/items/search?q=%EC%95%84%EA%B8%B0%EB%8F%BC%EC%A7%80%20%EC%9D%98%EC%83%81&slot=body&language=en"),
    env: {
      ASSETS: {
        fetch: async () => new Response(JSON.stringify([
          { id: "15479", slot: "body", names: { ko: "아기돼지 의상" }, itemLevel: 1 },
        ]), { status: 200, headers: { "Content-Type": "application/json" } }),
      },
    },
  });
  assert.equal(localizedKoreanResponse.status, 200, "Korean queries must not use the remote language search path");
  const localizedKoreanPayload = await localizedKoreanResponse.json();
  assert.equal(localizedKoreanPayload.language, "ko");
  assert.equal(localizedKoreanPayload.results[0].id, "15479", "a Korean body query should return 아기돼지 의상 even when the page is English");

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
