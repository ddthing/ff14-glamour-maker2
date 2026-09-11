const maxUploadBytes = 16 * 1024 * 1024;
const maxResultBytes = 32 * 1024 * 1024;
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const upstreamTimeoutMs = 120_000;

export async function onRequestPost(context) {
  const contentType = normaliseContentType(context.request.headers.get("content-type"));
  if (!allowedImageTypes.has(contentType)) {
    return json({ error: "PNG, JPEG, WEBP 이미지만 처리할 수 있습니다." }, 415);
  }

  const contentLength = Number(context.request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
    return json({ error: "16MB 이하 이미지를 사용해 주세요." }, 413);
  }

  const serviceUrl = resolveServiceUrl(context.env.CUTOUT_SERVICE_URL);
  if (!serviceUrl) {
    return json({
      error: "배경 제거 서버가 아직 연결되지 않았습니다.",
      code: "cutout_service_not_configured",
    }, 503);
  }

  let imageBytes;
  try {
    imageBytes = await readLimitedRequestBody(context.request, maxUploadBytes);
  } catch (error) {
    if (error.code === "UPLOAD_TOO_LARGE") return json({ error: "16MB 이하 이미지를 사용해 주세요." }, 413);
    return json({ error: "이미지를 읽지 못했습니다." }, 400);
  }

  const headers = new Headers({
    "Content-Type": contentType,
    Accept: "image/png",
    "X-Client-Request-ID": crypto.randomUUID(),
  });
  const token = String(context.env.CUTOUT_SERVICE_TOKEN || "").trim();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let upstream;
  try {
    upstream = await fetchWithTimeout(serviceUrl, {
      method: "POST",
      headers,
      body: imageBytes,
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    console.error(`[background-removal] ${isTimeout ? "upstream timeout" : "upstream unavailable"}`);
    return json({
      error: isTimeout
        ? "배경 제거 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : "배경 제거 서버에 연결할 수 없습니다.",
      code: isTimeout ? "cutout_service_timeout" : "cutout_service_unavailable",
    }, 504);
  }

  if (!upstream.ok) {
    console.error(`[background-removal] upstream status ${upstream.status}`);
    return json({
      error: upstream.status >= 500
        ? "배경 제거 서버가 잠시 바쁩니다. 다시 시도해 주세요."
        : "이미지를 처리하지 못했습니다.",
      code: "cutout_service_error",
    }, 502);
  }

  const upstreamType = normaliseContentType(upstream.headers.get("content-type"));
  if (!allowedImageTypes.has(upstreamType)) {
    await upstream.body?.cancel();
    console.error("[background-removal] upstream returned a non-image response");
    return json({ error: "배경 제거 결과를 확인할 수 없습니다.", code: "cutout_invalid_response" }, 502);
  }

  let output;
  try {
    output = await readLimitedResponseBody(upstream, maxResultBytes, upstreamTimeoutMs);
  } catch (error) {
    const timedOut = error.code === "UPSTREAM_TIMEOUT";
    console.error(`[background-removal] ${error.code === "RESULT_TOO_LARGE" ? "upstream result too large" : timedOut ? "upstream body timeout" : "upstream body read failed"}`);
    return json({
      error: error.code === "RESULT_TOO_LARGE"
        ? "배경 제거 결과가 너무 큽니다."
        : timedOut ? "배경 제거 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." : "배경 제거 결과를 읽지 못했습니다.",
      code: error.code === "RESULT_TOO_LARGE"
        ? "cutout_result_too_large"
        : timedOut ? "cutout_service_timeout" : "cutout_invalid_response",
    }, timedOut ? 504 : 502);
  }

  const responseHeaders = new Headers({
    "Content-Type": upstreamType,
    "Cache-Control": "no-store",
    "Content-Disposition": "inline",
    "X-Background-Mode": "gpu",
  });
  return new Response(output, { status: 200, headers: responseHeaders });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function normaliseContentType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function resolveServiceUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function createResultTooLargeError() {
  const error = new Error("배경 제거 결과가 너무 큽니다.");
  error.code = "RESULT_TOO_LARGE";
  return error;
}

function createUploadTooLargeError() {
  const error = new Error("16MB 이하 이미지를 사용해 주세요.");
  error.code = "UPLOAD_TOO_LARGE";
  return error;
}

async function readLimitedRequestBody(request, limit) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) throw createUploadTooLargeError();
  if (!request.body?.getReader) {
    const output = new Uint8Array(await request.arrayBuffer());
    if (output.byteLength > limit) throw createUploadTooLargeError();
    return output;
  }
  return readLimitedStreamBody(request.body, limit, createUploadTooLargeError);
}

async function readLimitedResponseBody(response, limit, timeoutMs = 0) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    await response.body?.cancel();
    throw createResultTooLargeError();
  }
  if (!response.body?.getReader) {
    const output = new Uint8Array(await response.arrayBuffer());
    if (output.byteLength > limit) throw createResultTooLargeError();
    return output;
  }
  return readLimitedStreamBody(response.body, limit, createResultTooLargeError, timeoutMs);
}

async function readLimitedStreamBody(stream, limit, createLimitError, timeoutMs = 0) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await readStreamChunk(reader, timeoutMs);
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      size += chunk.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw createLimitError();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
