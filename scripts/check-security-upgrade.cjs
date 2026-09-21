const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { stopChild } = require('./test-process.cjs');
const port = 4206;
function raw(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
}
(async () => {
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, windowsHide: true });
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('startup timeout')), 5000); child.once('error', reject); child.stdout.once('data', () => { clearTimeout(timer); resolve(); }); });
    for (const path of ['/assets/data/../../package.json', '/assets/data/%2e%2e/%2e%2e/package.json', '/assets/data/..%5c..%5cpackage.json', '/assets/data/%00.json', '/toString', '/constructor', '/__proto__']) {
      assert.equal((await raw(path)).status, 404, path);
    }
    const first = await raw('/app.js');
    assert.equal(first.status, 200);
    assert.equal(first.body.length, Number(first.headers['content-length']));
    assert.ok(first.headers.etag);
    assert.equal(first.headers['x-content-type-options'], 'nosniff');
    assert.match(first.headers['content-security-policy'], /object-src 'none'/);
    const cached = await raw('/app.js', 'GET', { 'If-None-Match': first.headers.etag });
    assert.equal(cached.status, 304); assert.equal(cached.body.length, 0);
    const head = await raw('/app.js', 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], first.headers['content-length']);
    assert.equal((await raw('/', 'DELETE')).status, 405);
    assert.equal((await raw('/api/background-removal', 'POST', { Origin: 'https://other.example', 'Content-Type': 'image/png' })).status, 403);
    const { onRequestPost } = await import('../functions/api/background-removal.js');
    const denied = await onRequestPost({ request: new Request('https://site.example/api/background-removal', { method: 'POST', headers: { Origin: 'https://other.example' } }), env: {} });
    assert.equal(denied.status, 403);
    console.log('PASS: raw traversal blocked; streaming, ETag, HEAD, method and cross-origin guards.');
  } finally { await stopChild(child); }
})().catch(error => { console.error(error); process.exitCode = 1; });
