const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { stopChild } = require("./test-process.cjs");

const appPort = 4196;
const upstreamPort = 4199;
const root = require("node:path").join(__dirname, "..");

function startApp(extraEnv = {}) {
  const env = { ...process.env, PORT: String(appPort), HOST: "127.0.0.1", ...extraEnv };
  if (extraEnv.CUTOUT_SERVICE_URL === null) delete env.CUTOUT_SERVICE_URL;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server guard test startup timeout")), 5000);
    child.once("error", reject);
    child.stdout.once("data", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return { child, ready };
}

function stopProcess(child) {
  return stopChild(child);
}

function request(path, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port: appPort, path, method, headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

(async () => {
  const upstream = http.createServer((request, response) => {
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": String(32 * 1024 * 1024 + 1),
    });
    response.end(Buffer.from([137, 80, 78, 71]));
  });
  await new Promise((resolve) => upstream.listen(upstreamPort, "127.0.0.1", resolve));
  const remote = startApp({ CUTOUT_SERVICE_URL: `http://127.0.0.1:${upstreamPort}/remove` });
  try {
    await remote.ready;
    let response = await request("/api/items/search?q=");
    assert.equal(response.status, 200, "malformed Host must not break item-search URL parsing");

    response = await request("/api/items/search?q=", { headers: { Host: "[malformed" } });
    assert.equal(response.status, 200, "item search should use a fixed URL base, not an untrusted Host header");

    response = await request("/api/background-removal", {
      method: "POST",
      headers: { "Content-Type": "image/png", "Content-Length": "4" },
      body: Buffer.from([1, 2, 3, 4]),
    });
    assert.equal(response.status, 502);
    assert.match(response.body, /너무 큽니다/);
  } finally {
    await stopProcess(remote.child);
  }

  const local = startApp({ CUTOUT_SERVICE_URL: null });
  try {
    await local.ready;
    const response = await request("/api/background-removal", {
      method: "POST",
      headers: { "Content-Type": "image/gif", "Content-Length": "1" },
      body: Buffer.from([0]),
    });
    assert.equal(response.status, 415, "local background removal must reject unsupported image MIME types");
  } finally {
    await stopProcess(local.child);
    await new Promise((resolve) => upstream.close(resolve));
  }
  console.log("PASS: server Host parsing, image MIME allowlist, and bounded remote output.");
})().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
