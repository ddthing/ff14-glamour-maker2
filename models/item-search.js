/* Latest-request search with bounded, language/slot-specific caching.
   emit receives view states; this module never reads or changes the DOM. */
const ItemSearch = (() => {
  function create({ fetch, now = Date.now, ttl = 300000, capacity = 100 }) {
    const cache = new Map();
    let revision = 0;
    let controller;
    function cancel() { revision++; controller?.abort(); controller = null; }
    function clear() { cancel(); cache.clear(); }
    async function search({ query, slot, language }, emit) {
      cancel();
      const current = revision;
      query = query.trim();
      if (!query) { emit({ kind: "idle" }); return; }
      if (!/^\d+$/.test(query) && query.length < 2) { emit({ kind: "short" }); return; }
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
        const response = await fetch(`/api/items/search?${params}`, { signal: request.signal });
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
  return { create };
})();
if (typeof module !== "undefined") module.exports = ItemSearch;
