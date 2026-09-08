import {
  normaliseItemSearchText,
  resolveItemSearchLanguage,
  searchKoreanItems,
  searchXivItems,
  supportedLanguages,
  supportedSlots,
} from "../../_shared/item-search.mjs";

const koreanIndexBasePath = "/assets/data/items-ko";
const koreanIndexFallbackPath = "/assets/data/items-ko.json";
const koreanIndexSlots = supportedSlots;
const cacheTtlSeconds = 300;
const staleTtlMs = 24 * 60 * 60 * 1000;
const assetRetryDelays = [50, 200];
const retryableAssetStatuses = new Set([502, 503, 504]);
const memoryCache = new Map();
const inflight = new Map();
const koreanIndexPromises = new Map();

const cacheHeaders = {
  "Cache-Control": `public, max-age=0, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=86400`,
};

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const query = (requestUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const slot = supportedSlots.includes(requestUrl.searchParams.get("slot"))
    ? requestUrl.searchParams.get("slot")
    : "";
  const requestedLanguage = supportedLanguages.includes(requestUrl.searchParams.get("language"))
    ? requestUrl.searchParams.get("language")
    : "ko";

  if (!query || (!/^\d+$/.test(query) && query.length < 2)) {
    return json({ results: [], language: requestedLanguage, source: "empty" });
  }

  const language = resolveItemSearchLanguage(query, requestedLanguage);
  const cacheKey = `${language}:${slot}:${normaliseItemSearchText(query)}`;
  const edgeCache = getEdgeCache();
  const edgeRequest = new Request(buildCacheUrl(requestUrl, language, slot, query));
  if (edgeCache) {
    const edgeHit = await edgeCache.match(edgeRequest);
    if (edgeHit) return withHeader(edgeHit, "X-Item-Search-Cache", "EDGE");
  }

  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return json(cached.payload, {
      ...cacheHeaders,
      "X-Item-Search-Cache": "HIT",
      "X-Item-Search-Source": cached.payload.source,
    });
  }

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = resolveSearch(context, query, language, slot);
    inflight.set(cacheKey, pending);
  }

  try {
    const payload = await pending;
    const expiresAt = Date.now() + cacheTtlSeconds * 1000;
    memoryCache.set(cacheKey, { expiresAt, staleUntil: expiresAt + staleTtlMs, payload });
    trimMemoryCache();
    const response = json(payload, {
      ...cacheHeaders,
      "X-Item-Search-Cache": "MISS",
      "X-Item-Search-Source": payload.source,
    });
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(edgeRequest, response.clone()));
    }
    return response;
  } catch (error) {
    const stale = memoryCache.get(cacheKey);
    if (stale && stale.staleUntil > Date.now()) {
      return json({ ...stale.payload, source: "stale-cache" }, {
        ...cacheHeaders,
        "X-Item-Search-Cache": "STALE",
        "X-Item-Search-Source": stale.payload.source,
      });
    }
    console.error(`[item-search] ${error.message}`);
    return json({
      results: [],
      language,
      source: "error",
      error: "아이템 검색 연결에 실패했습니다.",
    }, { "Cache-Control": "no-store" }, 502);
  } finally {
    if (inflight.get(cacheKey) === pending) inflight.delete(cacheKey);
  }
}

async function resolveSearch(context, query, language, slot) {
  if (language === "ko") {
    const index = await loadKoreanIndex(context, slot);
    return {
      results: searchKoreanItems(index, query, slot),
      language,
      source: "ffxiv-ko-snapshot",
    };
  }
  return {
    results: await searchXivItems(query, language, slot, {
      version: context.env.XIVAPI_VERSION || "",
    }),
    language,
    source: "xivapi",
  };
}

async function loadKoreanIndex(context, slot = "") {
  const cacheKey = supportedSlots.includes(slot) ? slot : "all";
  const cached = koreanIndexPromises.get(cacheKey);
  if (cached) return cached;
  if (!context.env.ASSETS?.fetch) throw new Error("한국어 아이템 인덱스 바인딩이 없습니다.");
  const promise = (async () => {
    if (cacheKey !== "all") {
      const slotUrl = new URL(`${koreanIndexBasePath}-${cacheKey}.json`, context.request.url);
      try {
        return await fetchKoreanIndexAsset(context.env.ASSETS, slotUrl);
      } catch (error) {
        if (error.status !== 404) throw error;
        return fetchKoreanIndexAsset(context.env.ASSETS, new URL(koreanIndexFallbackPath, context.request.url));
      }
    }

    try {
      return await fetchKoreanIndexAsset(context.env.ASSETS, new URL(koreanIndexFallbackPath, context.request.url));
    } catch (error) {
      if (error.status !== 404) throw error;
      const parts = await Promise.all(koreanIndexSlots.map((part) => fetchKoreanIndexAsset(
        context.env.ASSETS,
        new URL(`${koreanIndexBasePath}-${part}.json`, context.request.url),
      )));
      return parts.flat();
    }
  })().catch((error) => {
    koreanIndexPromises.delete(cacheKey);
    throw error;
  });
  koreanIndexPromises.set(cacheKey, promise);
  return promise;
}

async function fetchKoreanIndexAsset(assets, assetUrl) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await assets.fetch(assetUrl);
    } catch (error) {
      if (attempt >= assetRetryDelays.length) throw error;
      await delay(assetRetryDelays[attempt]);
      continue;
    }
    if (retryableAssetStatuses.has(response.status) && attempt < assetRetryDelays.length) {
      await delay(assetRetryDelays[attempt]);
      continue;
    }
    if (!response.ok) {
      const error = new Error(`한국어 아이템 인덱스 응답 오류 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const index = await response.json();
    if (!Array.isArray(index) || !index.length) throw new Error("한국어 아이템 인덱스가 비어 있습니다.");
    return index;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getEdgeCache() {
  try {
    return caches?.default || null;
  } catch {
    return null;
  }
}

function buildCacheUrl(requestUrl, language, slot, query) {
  const url = new URL(requestUrl);
  url.pathname = "/api/items/search";
  url.search = "";
  url.searchParams.set("q", query.normalize("NFKC").trim().toLocaleLowerCase());
  url.searchParams.set("slot", slot);
  url.searchParams.set("language", language);
  return url;
}

function trimMemoryCache() {
  if (memoryCache.size <= 200) return;
  memoryCache.delete(memoryCache.keys().next().value);
}

function json(payload, headers = {}, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}
