/* Latest-request search with bounded, language/slot-specific caching.
   emit receives view states; this module never reads or changes the DOM. */
const ItemSearch = (() => {
  const retryDelays = [150, 500];
  const retryableStatuses = new Set([502, 503, 504]);

  function create({ fetch, now = Date.now, ttl = 300000, capacity = 100 }) {
    const cache = new Map();
    let revision = 0;
    let controller;
    function cancel() { revision++; controller?.abort(); controller = null; }
    function clear() { cancel(); cache.clear(); }
    async function search({ query, slot, language: requestedLanguage }, emit) {
      cancel();
      const current = revision;
      query = query.trim();
      if (!query) { emit({ kind: "idle" }); return; }
      if (!/^\d+$/.test(query) && query.length < 2) { emit({ kind: "short" }); return; }
      const language = resolveSearchLanguage(query, requestedLanguage);
      const key = `${language}:${slot}:${query.normalize("NFKC").toLocaleLowerCase()}`;
      const cached = cache.get(key);
      if (cached?.expiresAt > now()) {
        cache.delete(key); cache.set(key, cached);
        emit({ kind: "results", results: cached.results, source: "cache" });
        return;
      }
      cache.delete(key);
      const request = new AbortController();
      controller = request;
      emit({ kind: "loading" });
      try {
        const params = new URLSearchParams({ q: query, slot, language });
        const response = await fetchWithRetry(fetch, `/api/items/search?${params}`, { signal: request.signal });
        const payload = await response.json();
        if (current !== revision) return;
        if (!response.ok || !Array.isArray(payload.results)) throw new Error("아이템 검색 응답을 읽지 못했습니다.");
        const stale = payload.source === "stale-cache";
        if (!stale) {
          cache.set(key, { results: payload.results, expiresAt: now() + ttl });
          while (cache.size > capacity) cache.delete(cache.keys().next().value);
        }
        emit({ kind: "results", results: payload.results, source: stale ? "stale" : "live" });
      } catch (error) {
        if (current === revision && error.name !== "AbortError") emit({ kind: "error" });
      } finally {
        if (current === revision) controller = null;
      }
    }
    return { search, cancel, clear };
  }

  async function fetchWithRetry(fetchImpl, url, options) {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetchImpl(url, options);
        if (!retryableStatuses.has(response.status) || attempt >= retryDelays.length) return response;
      } catch (error) {
        if (error.name === "AbortError" || attempt >= retryDelays.length) throw error;
      }
      await delay(retryDelays[attempt], options.signal);
    }
  }

  // Search language follows the script the user typed, not only the page
  // locale. A Korean query must never fall through to the remote English
  // catalog: older local servers and stale deployments route that request to
  // XIVAPI, where Korean names can produce a 502. Keep this contract aligned
  // with the server and Pages Function.
  function resolveSearchLanguage(query, requestedLanguage) {
    const language = ["ko", "en", "ja"].includes(requestedLanguage) ? requestedLanguage : "ko";
    if (/^\d+$/.test(query)) return language;
    if (/[\uAC00-\uD7A3]/u.test(query)) return "ko";
    if (/[\u3040-\u30FF]/u.test(query)) return "ja";
    return language === "ja" ? "ja" : "en";
  }

  function delay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      let timer;
      const abort = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        const error = new Error("검색 요청이 취소되었습니다.");
        error.name = "AbortError";
        reject(error);
      };
      if (signal.aborted) { abort(); return; }
      timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, milliseconds);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  return { create };
})();
if (typeof module !== "undefined") module.exports = ItemSearch;
