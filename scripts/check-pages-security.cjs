const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

(async () => {
  const { onRequest } = await import(pathToFileURL(path.join(root, "functions", "_middleware.js")).href);
  const response = await onRequest({
    request: new Request("https://pages.example/"),
    next: async () => new Response("ok", {
      status: 201,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  });

  assert.equal(response.status, 201, "Pages middleware must preserve the downstream status");
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("Permissions-Policy"), "camera=(), geolocation=(), microphone=()");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(await response.text(), "ok");
  console.log("PASS: Pages middleware preserves responses and applies the security header baseline.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
