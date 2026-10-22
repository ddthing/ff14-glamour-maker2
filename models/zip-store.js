/* Dependency-free ZIP writer using the STORE method. It keeps each PNG
   byte-for-byte intact and sets the UTF-8 filename flag for international names. */
(function attachZipStore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ZipStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createZipStore() {
  "use strict";

  const encoder = new TextEncoder();
  const UTF8_FLAG = 0x0800;
  const MAX_UINT32 = 0xffffffff;
  const MAX_FILES = 0xffff;

  const crcTable = new Uint32Array(256);
  for (let index = 0; index < crcTable.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crcTable[index] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, Math.min(2107, date.getFullYear()));
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, date: day };
  }

  function sanitiseComponent(component) {
    const safe = String(component || "")
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f<>:"\\|?*]/gu, "_")
      .replace(/[. ]+$/u, "")
      .trim();
    const stem = safe.split(".", 1)[0];
    return /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem) ? `_${safe}` : safe;
  }

  function safePath(value, fallback) {
    const raw = String(value || "").replace(/\\/gu, "/");
    const components = raw.split("/").filter(Boolean)
      .filter((component) => component !== "." && component !== "..")
      .map(sanitiseComponent)
      .filter(Boolean);
    const safe = components.join("/").slice(0, 1024).replace(/\/+$/u, "");
    return safe || fallback;
  }

  function uniqueNames(files) {
    const used = new Set();
    return files.map((file, index) => {
      const initial = safePath(file?.name, `file-${index + 1}`);
      const slash = initial.lastIndexOf("/");
      const directory = slash >= 0 ? initial.slice(0, slash + 1) : "";
      const filename = slash >= 0 ? initial.slice(slash + 1) : initial;
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const extension = dot > 0 ? filename.slice(dot) : "";
      let candidate = initial;
      let suffix = 2;
      while (used.has(candidate.toLocaleLowerCase("en-US"))) {
        candidate = `${directory}${stem} (${suffix})${extension}`;
        suffix += 1;
      }
      used.add(candidate.toLocaleLowerCase("en-US"));
      return { file, name: candidate };
    });
  }

  function write16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function write32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function snapshotDataSource(blob) {
    if (blob && typeof blob.arrayBuffer === "function") return { kind: "blob", value: blob };
    if (blob instanceof ArrayBuffer) return { kind: "bytes", value: new Uint8Array(blob).slice() };
    if (ArrayBuffer.isView(blob)) {
      return { kind: "bytes", value: new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength).slice() };
    }
    throw new TypeError("Every ZIP file must provide a Blob, ArrayBuffer, or byte view.");
  }

  async function bytesOf(source) {
    if (source.kind === "bytes") return source.value;
    return new Uint8Array(await source.value.arrayBuffer()).slice();
  }

  async function create(files) {
    if (!Array.isArray(files)) throw new TypeError("ZipStore.create expects an array of { name, blob } files.");
    if (files.length > MAX_FILES) throw new RangeError("ZIP archives may contain at most 65,535 files.");

    const stamped = dosDateTime();
    // Capture names and mutable byte views before the first asynchronous read.
    // Callers can safely reuse their buffers as soon as create() returns.
    const preparedFiles = uniqueNames(files).map(({ file, name }) => ({
      name,
      source: snapshotDataSource(file?.blob ?? file?.data),
    }));
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    let centralSize = 0;

    for (const { source, name } of preparedFiles) {
      const bytes = await bytesOf(source);
      const nameBytes = encoder.encode(name);
      if (nameBytes.length > 0xffff) throw new RangeError(`ZIP filename is too long: ${name}`);
      if (bytes.byteLength > MAX_UINT32) throw new RangeError(`ZIP entry is too large: ${name}`);

      const checksum = crc32(bytes);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      write32(localView, 0, 0x04034b50);
      write16(localView, 4, 20);
      write16(localView, 6, UTF8_FLAG);
      write16(localView, 8, 0);
      write16(localView, 10, stamped.time);
      write16(localView, 12, stamped.date);
      write32(localView, 14, checksum);
      write32(localView, 18, bytes.byteLength);
      write32(localView, 22, bytes.byteLength);
      write16(localView, 26, nameBytes.length);
      write16(localView, 28, 0);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, bytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      write32(centralView, 0, 0x02014b50);
      write16(centralView, 4, 20);
      write16(centralView, 6, 20);
      write16(centralView, 8, UTF8_FLAG);
      write16(centralView, 10, 0);
      write16(centralView, 12, stamped.time);
      write16(centralView, 14, stamped.date);
      write32(centralView, 16, checksum);
      write32(centralView, 20, bytes.byteLength);
      write32(centralView, 24, bytes.byteLength);
      write16(centralView, 28, nameBytes.length);
      write16(centralView, 30, 0);
      write16(centralView, 32, 0);
      write16(centralView, 34, 0);
      write16(centralView, 36, 0);
      write32(centralView, 38, 0);
      write32(centralView, 42, localOffset);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);

      localOffset += localHeader.byteLength + bytes.byteLength;
      centralSize += centralHeader.byteLength;
      if (localOffset > MAX_UINT32 || centralSize > MAX_UINT32) throw new RangeError("ZIP archive exceeds the classic ZIP size limit.");
    }

    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    write32(endView, 0, 0x06054b50);
    write16(endView, 4, 0);
    write16(endView, 6, 0);
    write16(endView, 8, preparedFiles.length);
    write16(endView, 10, preparedFiles.length);
    write32(endView, 12, centralSize);
    write32(endView, 16, localOffset);
    write16(endView, 20, 0);

    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  }

  return Object.freeze({ create, crc32, safePath });
});
