const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const checksDir = __dirname;
const defaultBaseUrl = "http://127.0.0.1:4173";
const files = fs.readdirSync(checksDir)
  .filter((name) => /^check-.*\.cjs$/.test(name) && name !== "check-title-halo.cjs");
files.push("audit-contrast.cjs", "test-cloudflare-functions.mjs");

let next = 0;
const results = [];
let ownedServer = null;

async function isServerReachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);
  try {
    await fetch(url, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await isServerReachable(url)) return;
    if (child.exitCode !== null) throw new Error(`테스트 서버가 ${child.exitCode} 코드로 종료되었습니다.`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`테스트 서버가 ${url}에서 시작되지 않았습니다.`);
}

async function ensureServer(baseUrl) {
  if (process.env.TEST_BASE_URL) return;
  if (await isServerReachable(baseUrl)) return;
  ownedServer = spawn(process.execPath, [path.join(path.dirname(checksDir), "server.js")], {
    cwd: path.dirname(checksDir),
    env: { ...process.env, PORT: "4173", HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  ownedServer.stderr.on("data", (chunk) => process.stderr.write(`[test-server] ${chunk}`));
  await waitForServer(baseUrl, ownedServer);
}

async function stopOwnedServer() {
  if (!ownedServer || ownedServer.exitCode !== null) return;
  ownedServer.kill();
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    ownedServer.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  if (exited || process.platform !== "win32" || ownedServer.exitCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(ownedServer.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    killer.once("close", resolve);
    killer.once("error", resolve);
  });
}

async function runCheck(file, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(checksDir, file)], { env });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.on("close", (code) => {
      results.push({ file, code, output });
      console.log(`${code === 0 ? "PASS" : "FAIL"} ${file}`);
      if (code !== 0) console.log(output);
      resolve();
    });
  });
}

async function runWorker(env) {
  while (next < files.length) {
    const file = files[next++];
    await runCheck(file, env);
  }
}

(async () => {
  const baseUrl = process.env.TEST_BASE_URL || defaultBaseUrl;
  await ensureServer(baseUrl);
  const env = { ...process.env, TEST_BASE_URL: baseUrl };
  await Promise.all(Array.from({ length: 4 }, () => runWorker(env)));
  fs.mkdirSync(path.join(path.dirname(checksDir), "artifacts"), { recursive: true });
  fs.writeFileSync(
    path.join(path.dirname(checksDir), "artifacts", "check-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`${results.filter((result) => result.code === 0).length}/${results.length} passed`);
  process.exitCode = results.some((result) => result.code !== 0) ? 1 : 0;
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopOwnedServer);
