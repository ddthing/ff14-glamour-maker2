/* Shared image admission policy. Byte limits protect storage and transport;
   pixel limits protect decoders from compressed, extremely large images. */
const ImageValidation = (() => {
  const maxUploadBytes = 16 * 1024 * 1024;
  const maxPixels = 50_000_000;
  const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

  function validateFile(file) {
    const type = String(file?.type || "").toLowerCase();
    if (!file || !supportedTypes.has(type)) return { ok: false, reason: "type" };
    if (Number(file.size) > maxUploadBytes) return { ok: false, reason: "bytes" };
    return { ok: true, type };
  }

  function validateDimensions(width, height) {
    const normalizedWidth = Number(width);
    const normalizedHeight = Number(height);
    if (!Number.isFinite(normalizedWidth) || !Number.isFinite(normalizedHeight)
      || normalizedWidth <= 0 || normalizedHeight <= 0) {
      return { ok: false, reason: "dimensions" };
    }
    const pixels = normalizedWidth * normalizedHeight;
    return {
      ok: pixels <= maxPixels,
      reason: pixels <= maxPixels ? "ok" : "pixels",
      width: normalizedWidth,
      height: normalizedHeight,
      pixels,
    };
  }

  function readUint16(bytes, offset, littleEndian = false) {
    if (offset + 1 >= bytes.length) return null;
    return littleEndian
      ? bytes[offset] | (bytes[offset + 1] << 8)
      : (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readUint24(bytes, offset, littleEndian = false) {
    if (offset + 2 >= bytes.length) return null;
    return littleEndian
      ? bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
      : (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
  }

  function readUint32(bytes, offset, littleEndian = false) {
    if (offset + 3 >= bytes.length) return null;
    const value = littleEndian
      ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24))
      : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
    return value >>> 0;
  }

  function matchesAscii(bytes, offset, value) {
    return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
  }

  function dimensionsFromBytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (bytes.length >= 24 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) {
      return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
    }

    if (bytes.length >= 30 && matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) {
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const chunkType = String.fromCharCode(...bytes.slice(offset, offset + 4));
        const chunkSize = readUint32(bytes, offset + 4, true);
        const data = offset + 8;
        if (chunkSize === null) return null;
        if (chunkType === "VP8X" && data + 10 <= bytes.length) {
          return {
            width: 1 + readUint24(bytes, data + 4, true),
            height: 1 + readUint24(bytes, data + 7, true),
          };
        }
        if (chunkType === "VP8 " && data + 10 <= bytes.length
          && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
          return { width: readUint16(bytes, data + 6, true), height: readUint16(bytes, data + 8, true) };
        }
        if (chunkType === "VP8L" && data + 5 <= bytes.length && bytes[data] === 0x2f) {
          const width = 1 + ((bytes[data + 1] | (bytes[data + 2] << 8)) & 0x3fff);
          const height = 1 + (((bytes[data + 2] >> 6) | (bytes[data + 3] << 2) | ((bytes[data + 4] & 0x0f) << 10)) & 0x3fff);
          return { width, height };
        }
        offset += 8 + chunkSize + (chunkSize % 2);
      }
      return null;
    }

    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
      let offset = 2;
      while (offset + 3 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        while (bytes[offset] === 0xff) offset += 1;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
        const segmentLength = readUint16(bytes, offset);
        if (!segmentLength || offset + segmentLength > bytes.length) return null;
        if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
          return { height: readUint16(bytes, offset + 3), width: readUint16(bytes, offset + 5) };
        }
        offset += segmentLength;
      }
    }
    return null;
  }

  async function readDimensions(file, { maxBytes = 1024 * 1024 } = {}) {
    if (!file?.slice || typeof file.slice(0, maxBytes).arrayBuffer !== "function") return null;
    try {
      return dimensionsFromBytes(await file.slice(0, maxBytes).arrayBuffer());
    } catch {
      return null;
    }
  }

  // Apply only model opacity. Never accept generated RGB or increase source opacity.
  function applyCutoutAlpha(source, mask) {
    if (!source || !mask || source.width !== mask.width || source.height !== mask.height
      || source.data?.length !== source.width * source.height * 4
      || mask.data?.length !== source.data.length) {
      throw new Error("배경 제거 결과의 크기가 원본과 다릅니다.");
    }
    const data = new Uint8ClampedArray(source.data);
    for (let index = 3; index < data.length; index += 4) {
      data[index] = Math.min(data[index], mask.data[index]);
    }
    return data;
  }

  return Object.freeze({ maxUploadBytes, maxPixels, supportedTypes, validateFile, validateDimensions, dimensionsFromBytes, readDimensions, applyCutoutAlpha });
})();

if (typeof globalThis !== "undefined") globalThis.ImageValidation = ImageValidation;
if (typeof module !== "undefined") module.exports = ImageValidation;
