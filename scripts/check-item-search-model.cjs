const assert = require('node:assert/strict');
const ItemSearch = require('../models/item-search.js');
(async () => {
  const pending = [];
  const search = ItemSearch.create({ fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) });
  const events = [];
  const args = query => ({ query, slot: 'head', language: 'ko' });
  const reply = (request, results, source = 'live') => request.resolve({ ok: true, json: async () => ({ results, source }) });
  const old = search.search(args('이전'), event => events.push(event));
  const latest = search.search(args('최신'), event => events.push(event));
  assert.equal(pending[0].options.signal.aborted, true);
  reply(pending[1], [{ id: 'latest' }]); await latest;
  reply(pending[0], [{ id: 'old' }]); await old;
  assert.deepEqual(events.filter(event => event.kind === 'results').map(event => event.results[0].id), ['latest']);
  await search.search(args(' 최신 '), event => events.push(event));
  assert.equal(pending.length, 2);
  assert.equal(events.at(-1).source, 'cache');
  const cancelled = search.search(args('취소'), event => events.push(event));
  search.clear(); const length = events.length;
  reply(pending.at(-1), [{ id: 'deleted' }]); await cancelled;
  assert.equal(events.length, length);

  let time = 0; let calls = 0; let source = 'live';
  const cached = ItemSearch.create({ now: () => time, ttl: 10, capacity: 2,
    fetch: async () => { calls++; return { ok: true, json: async () => ({ results: [], source }) }; } });
  const collect = [];
  await cached.search(args('ＦＯＯ'), event => collect.push(event));
  await cached.search(args('foo'), event => collect.push(event));
  assert.equal(calls, 1, 'Normalized query missed cache');
  await cached.search({ ...args('foo'), slot: 'body' }, () => {});
  await cached.search({ ...args('foo'), language: 'en' }, () => {});
  assert.equal(calls, 3, 'Slot/language shared cache entries');
  await cached.search(args('foo'), () => {});
  assert.equal(calls, 4, 'Old cache entries were not evicted');
  time = 11;
  await cached.search(args('foo'), () => {});
  assert.equal(calls, 5, 'Expired cache survived');
  source = 'stale-cache';
  await cached.search(args('stale'), event => collect.push(event));
  await cached.search(args('stale'), event => collect.push(event));
  assert.equal(calls, 7, 'Stale results were treated as fresh cache');
  assert.equal(collect.at(-1).source, 'stale');

  let transientCalls = 0;
  const transientEvents = [];
  const transient = ItemSearch.create({
    fetch: async () => {
      transientCalls++;
      if (transientCalls === 1) {
        return { ok: false, status: 503, json: async () => ({ error: 'temporary' }) };
      }
      return { ok: true, status: 200, json: async () => ({ results: [{ id: '38238' }], source: 'live' }) };
    },
  });
  await transient.search(args('뚱냥이 두건'), event => transientEvents.push(event));
  assert.equal(transientCalls, 2, 'Transient search failures were not retried');
  assert.equal(transientEvents.at(-1).kind, 'results', 'A transient 503 remained visible as a search error');
  assert.equal(transientEvents.at(-1).results[0].id, '38238');

  const invalid = ItemSearch.create({ fetch: async () => ({ ok: true, json: async () => ({ results: {} }) }) });
  await invalid.search(args('invalid'), event => collect.push(event));
  assert.equal(collect.at(-1).kind, 'error');
  await invalid.search(args(''), event => collect.push(event));
  assert.equal(collect.at(-1).kind, 'idle');
  await invalid.search(args('a'), event => collect.push(event));
  assert.equal(collect.at(-1).kind, 'short');
  console.log('PASS: late-response isolation, cancellation/clear, normalized bounded cache, language/slot isolation, expiry, stale and malformed responses.');
})().catch(error => { console.error(error); process.exitCode = 1; });
