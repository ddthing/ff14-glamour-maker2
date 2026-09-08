const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

// Keep local development and the Pages Function on the same search contract.
// The server remains CommonJS because it owns the local worker lifecycle, so
// load the ESM search adapter once and await it only when a request arrives.
const itemSearchModulePromise = import("./functions/_shared/item-search.mjs");
const itemIndexModulePromise = import("./functions/_shared/item-index.mjs");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const runtimeDir = path.join(root, ".runtime", "background-removal");
const pythonPath = path.join(root, ".venv-bg", "Scripts", "python.exe");
const workerPath = path.join(root, "scripts", "background_worker.py");
const maxUploadBytes = 16 * 1024 * 1024;
const maxResultBytes = 32 * 1024 * 1024;
const remoteCutoutTimeoutMs = 120 * 1000;
const supportedBackgroundImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
let worker = null;
let workerReady = null;
const pendingJobs = new Map();
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};

const koreanItemCsvUrl = "https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv/Item.csv";
const koreanItemSnapshotPath = path.join(root, "assets", "data", "items-ko.json");
const koreanItemSnapshotBasePath = path.join(root, "assets", "data", "items-ko");
const koreanIndexSlots = ["head", "body", "hands", "legs", "feet", "weapon"];
const itemSearchCache = new Map();
const itemSearchInflight = new Map();
const koreanItemIndexPromises = new Map();
const koreanItemSnapshotPromises = new Map();
const itemSearchCacheTtlMs = 5 * 60 * 1000;
const itemSearchStaleTtlMs = 24 * 60 * 60 * 1000;
const itemSearchCacheHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
};
const supportedItemSlots = new Set(["head", "body", "hands", "legs", "feet", "weapon"]);

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

async function loadKoreanItemIndex(slot = "") {
  const cacheKey = supportedItemSlots.has(slot) ? slot : "all";
  const cached = koreanItemIndexPromises.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.resolve().then(async () => {
    if (cacheKey !== "all") {
      const slotPath = `${koreanItemSnapshotBasePath}-${cacheKey}.json`;
      if (fs.existsSync(slotPath)) return readKoreanItemSnapshot(slotPath);
    } else {
      const partitionedPaths = koreanIndexSlots.map((part) => `${koreanItemSnapshotBasePath}-${part}.json`);
      if (partitionedPaths.every((snapshotPath) => fs.existsSync(snapshotPath))) {
        const partitions = await Promise.all(partitionedPaths.map((snapshotPath) => readKoreanItemSnapshot(snapshotPath)));
        return partitions.flat();
      }
    }

    if (fs.existsSync(koreanItemSnapshotPath)) {
      const index = await readKoreanItemSnapshot(koreanItemSnapshotPath);
      return cacheKey === "all" ? index : index.filter((item) => item.slot === cacheKey);
    }

    const result = await fetchWithTimeout(koreanItemCsvUrl, {
      headers: { "User-Agent": "ff14-glamour-maker2-item-search" },
    }, 15000);
    if (!result.ok) throw new Error(`한국어 장비 데이터 응답 오류 (${result.status})`);
    const itemIndexModule = await itemIndexModulePromise;
    const parsed = itemIndexModule.parseKoreanItemIndex(await result.text());
    itemIndexModule.assertKoreanItemIndexAudit(parsed.audit);
    const index = parsed.records;
    return cacheKey === "all" ? index : index.filter((item) => item.slot === cacheKey);
  }).catch((error) => {
    koreanItemIndexPromises.delete(cacheKey);
    throw error;
  });
  koreanItemIndexPromises.set(cacheKey, promise);
  return promise;
}

function readKoreanItemSnapshot(snapshotPath = koreanItemSnapshotPath) {
  const cached = koreanItemSnapshotPromises.get(snapshotPath);
  if (cached) return cached;
  const promise = fs.promises.readFile(snapshotPath, "utf8").then((contents) => {
    const records = JSON.parse(contents);
    if (!Array.isArray(records) || !records.length) throw new Error("한국어 아이템 snapshot이 비어 있습니다.");
    const index = records.map((record) => {
      const name = String(record?.names?.ko || "").trim();
      if (!record?.id || !name || !supportedItemSlots.has(record.slot)) return null;
      return {
        ...record,
        id: String(record.id),
        slot: record.slot,
      };
    }).filter(Boolean);
    if (!index.length) throw new Error("유효한 한국어 아이템 snapshot 레코드가 없습니다.");
    return index;
  });
  koreanItemSnapshotPromises.set(snapshotPath, promise);
  promise.catch(() => {
    if (koreanItemSnapshotPromises.get(snapshotPath) === promise) koreanItemSnapshotPromises.delete(snapshotPath);
  });
  return promise;
}

async function handleItemSearch(request, response) {
  const searchModule = await itemSearchModulePromise;
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const query = (requestUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const requestedSlot = requestUrl.searchParams.get("slot") || "";
  const slot = searchModule.supportedSlots.includes(requestedSlot) ? requestedSlot : "";
  const requestedLanguage = ["ko", "en", "ja"].includes(requestUrl.searchParams.get("language"))
    ? requestUrl.searchParams.get("language")
    : "ko";
  if (!query || (!/^\d+$/.test(query) && query.length < 2)) {
    sendJson(response, 200, { results: [], language: requestedLanguage, source: "empty" });
    return;
  }
  const language = searchModule.resolveItemSearchLanguage(query, requestedLanguage);
  const cacheKey = `${language}:${slot}:${searchModule.normaliseItemSearchText(query)}`;
  const cached = itemSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload, {
      ...itemSearchCacheHeaders,
      "X-Item-Search-Cache": "HIT",
      "X-Item-Search-Source": cached.payload.source,
    });
    return;
  }
  let pending = itemSearchInflight.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const results = language === "ko"
        ? searchModule.searchKoreanItems(await loadKoreanItemIndex(slot), query, slot)
        : await searchModule.searchXivItems(query, language, slot, { version: process.env.XIVAPI_VERSION || "" });
      const payload = {
        results,
        language,
        source: language === "ko" ? "ffxiv-ko-snapshot" : "xivapi",
      };
      const expiresAt = Date.now() + itemSearchCacheTtlMs;
      itemSearchCache.set(cacheKey, {
        expiresAt,
        staleUntil: expiresAt + itemSearchStaleTtlMs,
        payload,
      });
      if (itemSearchCache.size > 200) itemSearchCache.delete(itemSearchCache.keys().next().value);
      return payload;
    })();
    itemSearchInflight.set(cacheKey, pending);
  }
  try {
    const payload = await pending;
    sendJson(response, 200, payload, {
      ...itemSearchCacheHeaders,
      "X-Item-Search-Cache": "MISS",
      "X-Item-Search-Source": payload.source,
    });
  } catch (error) {
    const stale = itemSearchCache.get(cacheKey);
    if (stale && stale.staleUntil > Date.now()) {
      sendJson(response, 200, { ...stale.payload, source: "stale-cache" }, {
        ...itemSearchCacheHeaders,
        "X-Item-Search-Cache": "STALE",
        "X-Item-Search-Source": stale.payload.source,
      });
      return;
    }
    console.error(`[item-search] ${error.message}`);
    sendJson(response, 502, {
      results: [],
      language,
      source: "error",
      error: "아이템 검색 연결에 실패했습니다.",
    });
  } finally {
    if (itemSearchInflight.get(cacheKey) === pending) itemSearchInflight.delete(cacheKey);
  }
}

function failPendingJobs(message, targetWorker = null) {
  pendingJobs.forEach((job, id) => {
    if (targetWorker && job.worker !== targetWorker) return;
    pendingJobs.delete(id);
    job.reject(new Error(message));
  });
}

function ensureWorker() {
  if (worker && workerReady) return workerReady;
  if (!fs.existsSync(pythonPath)) {
    return Promise.reject(new Error("배경 제거 환경이 없습니다. README의 설치 안내를 확인해주세요."));
  }
  fs.mkdirSync(runtimeDir, { recursive: true });
  const child = spawn(pythonPath, [workerPath], {
    cwd: root,
    env: { ...process.env, U2NET_HOME: path.join(root, ".models", "rembg") },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  worker = child;
  let buffer = "";
  let readySettled = false;
  let resolveReady;
  let rejectReady;
  const readyTimeout = setTimeout(() => failWorker(new Error("배경 제거 모델 준비 시간이 초과되었습니다.")), 120000);
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  workerReady = readyPromise;

  function settleReady(error) {
    if (readySettled) return;
    readySettled = true;
    clearTimeout(readyTimeout);
    error ? rejectReady(error) : resolveReady();
  }

  function failWorker(error) {
    settleReady(error);
    failPendingJobs(error.message, child);
    if (worker === child) {
      worker = null;
      workerReady = null;
    }
    if (!child.killed) child.kill();
  }

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.type === "ready") {
          settleReady();
          continue;
        }
        if (message.type === "fatal") {
          failWorker(new Error(message.error || "배경 제거 워커가 시작되지 않았습니다."));
          continue;
        }
        const job = pendingJobs.get(message.id);
        if (!job) continue;
        pendingJobs.delete(message.id);
        message.type === "result" ? job.resolve(message.output) : job.reject(new Error(message.error));
      } catch {
        // Ignore non-protocol output from native dependencies.
      }
    }
  });
  child.stderr.on("data", (chunk) => process.stderr.write(`[background-worker] ${chunk}`));
  child.on("exit", (code) => {
    failWorker(new Error(`배경 제거 프로세스가 종료되었습니다 (${code ?? "unknown"}).`));
  });
  child.on("error", (error) => {
    failWorker(error);
  });
  return readyPromise;
}

async function removeBackground(inputPath, outputPath) {
  const activeWorker = await ensureWorker();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingJobs.delete(id);
      reject(new Error("배경 제거 시간이 초과되었습니다."));
    }, 180000);
    pendingJobs.set(id, {
      worker: activeWorker,
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (error) => { clearTimeout(timeout); reject(error); },
    });
    try {
      if (activeWorker.stdin.destroyed) throw new Error("배경 제거 프로세스에 연결할 수 없습니다.");
      activeWorker.stdin.write(`${JSON.stringify({ id, input: inputPath, output: outputPath })}\n`, (error) => {
        if (!error || !pendingJobs.has(id)) return;
        pendingJobs.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    } catch (error) {
      pendingJobs.delete(id);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxUploadBytes) {
        rejected = true;
        reject(createUploadTooLargeError());
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function handleBackgroundRemoval(request, response) {
  if (String(process.env.CUTOUT_SERVICE_URL || "").trim()) {
    await handleRemoteBackgroundRemoval(request, response);
    return;
  }
  const contentType = String(request.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!supportedBackgroundImageTypes.has(contentType)) {
    sendJson(response, 415, { error: "PNG, JPEG, WEBP 이미지만 처리할 수 있습니다." });
    request.resume();
    return;
  }
  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
    sendJson(response, 413, { error: "16MB 이하 이미지를 사용해주세요." });
    request.resume();
    return;
  }
  const id = crypto.randomUUID();
  const inputPath = path.join(runtimeDir, `${id}.input`);
  const outputPath = path.join(runtimeDir, `${id}.png`);
  try {
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(inputPath, await readRequestBody(request));
    await removeBackground(inputPath, outputPath);
    const outputSize = fs.statSync(outputPath).size;
    if (outputSize > maxResultBytes) {
      throw createResultTooLargeError();
    }
    const output = fs.readFileSync(outputPath);
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": output.length,
      "Cache-Control": "no-store",
      "X-Background-Model": "birefnet-general",
    });
    response.end(output);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.code === "RESULT_TOO_LARGE" ? 502 : error.code === "UPLOAD_TOO_LARGE" ? 413 : 500, {
        error: error.code === "RESULT_TOO_LARGE"
          ? error.message
          : error.code === "UPLOAD_TOO_LARGE" ? error.message : "배경 제거에 실패했습니다.",
      });
    }
  } finally {
    fs.rmSync(inputPath, { force: true });
    fs.rmSync(outputPath, { force: true });
  }
}

async function handleRemoteBackgroundRemoval(request, response) {
  const contentType = String(request.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!supportedBackgroundImageTypes.has(contentType)) {
    sendJson(response, 415, { error: "PNG, JPEG, WEBP 이미지만 처리할 수 있습니다." });
    request.resume();
    return;
  }
  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
    sendJson(response, 413, { error: "16MB 이하 이미지를 사용해주세요." });
    request.resume();
    return;
  }
  const serviceUrl = resolveRemoteCutoutUrl(process.env.CUTOUT_SERVICE_URL);
  if (!serviceUrl) {
    sendJson(response, 503, { error: "배경 제거 서버 설정을 확인해주세요." });
    request.resume();
    return;
  }
  let body;
  try {
    body = await readRequestBody(request);
  } catch (error) {
    sendJson(response, error.code === "UPLOAD_TOO_LARGE" ? 413 : 400, { error: error.message || "이미지를 읽지 못했습니다." });
    return;
  }
  const headers = {
    "Content-Type": contentType,
    Accept: "image/png",
    "X-Client-Request-ID": crypto.randomUUID(),
  };
  const token = String(process.env.CUTOUT_SERVICE_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  let upstream;
  try {
    upstream = await fetchWithTimeout(serviceUrl, {
      method: "POST",
      headers,
      body,
    }, remoteCutoutTimeoutMs);
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "배경 제거 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
      : "배경 제거 서버에 연결할 수 없습니다.";
    sendJson(response, 504, { error: message });
    return;
  }
  if (!upstream.ok) {
    sendJson(response, 502, {
      error: upstream.status >= 500
        ? "배경 제거 서버가 잠시 바쁩니다. 다시 시도해주세요."
        : "이미지를 처리하지 못했습니다.",
    });
    return;
  }
  const resultType = String(upstream.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!supportedBackgroundImageTypes.has(resultType)) {
    await upstream.body?.cancel();
    sendJson(response, 502, { error: "배경 제거 결과를 확인할 수 없습니다." });
    return;
  }
  let output;
  try {
    output = await readLimitedResponseBody(upstream, maxResultBytes, remoteCutoutTimeoutMs);
  } catch (error) {
    const timedOut = error.code === "UPSTREAM_TIMEOUT";
    sendJson(response, timedOut ? 504 : 502, {
      error: error.code === "RESULT_TOO_LARGE"
        ? error.message
        : timedOut ? "배경 제거 시간이 초과되었습니다. 잠시 후 다시 시도해주세요." : "배경 제거 결과를 읽지 못했습니다.",
    });
    return;
  }
  if (output.length > maxResultBytes) {
    sendJson(response, 502, { error: "배경 제거 결과가 너무 큽니다." });
    return;
  }
  response.writeHead(200, {
    "Content-Type": resultType,
    "Content-Length": output.length,
    "Cache-Control": "no-store",
    "X-Background-Mode": "gpu",
  });
  response.end(output);
}

function createResultTooLargeError() {
  const error = new Error("배경 제거 결과가 너무 큽니다.");
  error.code = "RESULT_TOO_LARGE";
  return error;
}

function createUploadTooLargeError() {
  const error = new Error("16MB 이하 이미지를 사용해주세요.");
  error.code = "UPLOAD_TOO_LARGE";
  return error;
}

async function readLimitedResponseBody(response, limit, timeoutMs = 0) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    await response.body?.cancel();
    throw createResultTooLargeError();
  }
  if (!response.body?.getReader) {
    const output = Buffer.from(await response.arrayBuffer());
    if (output.length > limit) throw createResultTooLargeError();
    return output;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await readStreamChunk(reader, timeoutMs);
      if (done) break;
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > limit) {
        await reader.cancel();
        throw createResultTooLargeError();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  return Buffer.concat(chunks, size);
}

async function readStreamChunk(reader, timeoutMs) {
  if (!timeoutMs) return reader.read();
  let timer;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reader.cancel().catch(() => {});
          const error = new Error("upstream response timed out");
          error.code = "UPSTREAM_TIMEOUT";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function resolveRemoteCutoutUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) return null;
    return url;
  } catch {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && (request.url || "").split("?")[0] === "/api/items/search") {
    await handleItemSearch(request, response);
    return;
  }
  if (request.method === "POST" && (request.url || "").split("?")[0] === "/api/background-removal") {
    await handleBackgroundRemoval(request, response);
    return;
  }
  let requestPath;
  try { requestPath = decodeURIComponent((request.url || "/").split("?")[0]); }
  catch { sendJson(response, 400, { error: "올바르지 않은 요청 주소입니다." }); return; }
  const cleanPagePaths = {
    "/terms": "terms/index.html",
    "/terms/": "terms/index.html",
    "/privacy": "privacy/index.html",
    "/privacy/": "privacy/index.html",
    "/guide": "guide/index.html",
    "/guide/": "guide/index.html",
    "/contact": "contact/index.html",
    "/contact/": "contact/index.html",
    "/support": "support/index.html",
    "/support/": "support/index.html",
  };
  const relativePath = requestPath === "/" ? "index.html" : cleanPagePaths[requestPath] || requestPath.replace(/^\/+/, "");
  const publicFile = ["index.html", "app.js", "styles.css", "robots.txt", "sitemap.xml", "models/look-editor.js", "models/look-book.js", "models/image-assets.js", "models/image-validation.js", "models/draft-storage.js", "models/i18n.js", "models/public-pages.js", "models/item-records.js", "models/item-search.js", "models/card-layout.js", "models/card-copy.js", "models/color-contrast.js", "models/card-png.js", "models/editor-navigation.js", "models/background-presets.js", "models/title-typography.js", "models/background-removal.js", "terms/index.html", "privacy/index.html", "guide/index.html", "contact/index.html", "support/index.html"].includes(relativePath)
    || /^(styles\/[^/]+\.css|assets\/(data|fonts|icons)\/[^/]+\.(json|ttf|woff2?|svg))$/.test(relativePath);
  const filePath = path.resolve(root, relativePath);
  const isInsideRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);

  if (!publicFile || !isInsideRoot || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": relativePath.startsWith("assets/") ? "public, max-age=3600" : "no-cache",
  });
  response.end(fs.readFileSync(filePath));
});

server.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`투영세트메이커2 running at http://localhost:${port}`);
});
