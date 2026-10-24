const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const Equipment = require("../models/equipment.js");
const GearSheet = require("../models/gear-sheet.js");
const ZipStore = require("../models/zip-store.js");

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function independentCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function parseStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1, "ZIP end-of-central-directory record exists");
  const count = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries = [];
  let offset = centralOffset;

  for (let index = 0; index < count; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50, "central directory signature is valid");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const expectedCrc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    assert.equal(flags & 0x0800, 0x0800, "UTF-8 filename flag is set");
    assert.equal(method, 0, "entries use the STORE method");

    assert.equal(view.getUint32(localOffset, true), 0x04034b50, "local entry signature is valid");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + size);
    assert.equal(independentCrc32(data), expectedCrc, `CRC-32 matches for ${name}`);
    entries.push({ name, data, flags });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function sampleEntries() {
  const slots = ["head", "body", "hands", "legs", "feet"];
  const entries = slots.map((slot, index) => ({
    id: `core-${slot}`,
    slot,
    name: `기본 장비 ${index + 1}`,
    names: { ko: `기본 장비 ${index + 1}`, en: `Core item ${index + 1}`, ja: `基本装備 ${index + 1}` },
    showOnCard: true,
    extra: false,
  }));
  for (let index = 0; index < 32; index += 1) {
    const number = String(index + 1).padStart(2, "0");
    const korean = index === 0 ? "룩북".repeat(80) : `추가 장비 ${number}`;
    const english = index === 0 ? "Archive".repeat(24) : `Registered item ${number}`;
    const japanese = index === 1 ? "装備記録".repeat(40) : `追加装備 ${number}`;
    entries.push({
      id: `extra-${number}`,
      slot: "custom",
      name: korean,
      names: { ko: korean, en: english, ja: japanese },
      showOnCard: index % 3 !== 0,
      extra: true,
      note: index === 2 ? "저장한 장비 메모입니다." : "",
    });
  }
  return entries;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!/Executable doesn't exist/u.test(String(error?.message))) throw error;
    const candidates = [
      process.env.GEAR_SHEET_BROWSER,
      process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null,
      process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : null,
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
    ].filter(Boolean);
    const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!executablePath) throw error;
    return chromium.launch({ headless: true, executablePath });
  }
}

async function checkGearSheet() {
  assert.deepEqual(GearSheet.dimensions, { width: 2160, height: 2700 });
  const longKorean = "장비".repeat(80);
  const koreanLines = GearSheet.wrapText(longKorean, (value) => Array.from(value).length * 36, 680);
  assert.ok(koreanLines.length > 1, "a long Korean name wraps across lines");
  assert.equal(koreanLines.join(""), longKorean, "wrapping preserves every Korean character");
  const longJapanese = "装備情報".repeat(40);
  const japaneseLines = GearSheet.wrapText(longJapanese, (value) => Array.from(value).length * 36, 680);
  assert.ok(japaneseLines.length > 1, "a long Japanese name wraps across lines");
  assert.equal(japaneseLines.join(""), longJapanese, "wrapping preserves every Japanese character");

  const entries = sampleEntries();
  assert.equal(entries.length, 37, "fixture covers five core and thirty-two registered entries");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html lang=\"ko\"><body></body></html>");
    await page.addScriptTag({ path: path.resolve(__dirname, "../models/gear-sheet.js") });

    for (const language of ["ko", "ja"]) {
      const result = await page.evaluate(async ({ records, requestedLanguage, groups, slotLabels }) => {
        const rendered = await window.GearSheet.render({
          title: "달빛 아래의 기록",
          characterIndex: 1,
          language: requestedLanguage,
          entries: records,
          slotLabel: (slot, lang) => slotLabels[slot]?.[lang],
          groups,
        });

        const pageMetadata = [];
        for (const output of rendered.pages) {
          const bytes = new Uint8Array(await output.blob.arrayBuffer());
          const bitmap = await createImageBitmap(output.blob);
          const sample = document.createElement("canvas");
          sample.width = 216;
          sample.height = 270;
          const sampleContext = sample.getContext("2d", { willReadFrequently: true });
          sampleContext.drawImage(bitmap, 0, 0, sample.width, sample.height);
          const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
          let inkPixels = 0;
          for (let offset = 0; offset < pixels.length; offset += 4) {
            if (pixels[offset] < 120 && pixels[offset + 1] < 120 && pixels[offset + 2] < 120) inkPixels += 1;
          }
          pageMetadata.push({
            page: output.page,
            pageCount: output.pageCount,
            rowCount: output.rowCount,
            entryIds: output.entryIds,
            width: bitmap.width,
            height: bitmap.height,
            type: output.blob.type,
            signature: Array.from(bytes.subarray(0, 8)),
            pngWidth: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16, false),
            pngHeight: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20, false),
            inkPixels,
          });
          bitmap.close();
        }
        return { totalEntries: rendered.totalEntries, pageCount: rendered.pages.length, pages: pageMetadata };
      }, { records: entries, requestedLanguage: language, groups: Equipment.groups, slotLabels: Equipment.slotLabels });

      assert.equal(result.totalEntries, 37, `${language} sheet reports every input record`);
      assert.ok(result.pageCount > 1, `${language} sheet paginates the full inventory`);
      assert.equal(result.pageCount, result.pages.length);
      assert.equal(result.pages.reduce((total, output) => total + output.rowCount, 0), 37, "all entry rows are represented");
      const outputIds = result.pages.flatMap((output) => output.entryIds);
      assert.deepEqual(new Set(outputIds), new Set(entries.map((entry) => entry.id)), "hidden and visible entries both appear in page metadata");
      assert.equal(outputIds.length, 37, "no entry is duplicated or silently dropped across pages");
      for (const output of result.pages) {
        assert.equal(output.width, 2160);
        assert.equal(output.height, 2700);
        assert.equal(output.pngWidth, 2160);
        assert.equal(output.pngHeight, 2700);
        assert.equal(output.type, "image/png");
        assert.deepEqual(output.signature, [137, 80, 78, 71, 13, 10, 26, 10], "canvas produced a real PNG");
        assert.ok(output.inkPixels > 10, "PNG contains rendered typography on the neutral paper background");
      }
    }

    const portraitResult = await page.evaluate(async () => {
      const portrait = new Image();
      portrait.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16"><rect width="12" height="16" fill="#dfe3e5"/><circle cx="6" cy="5" r="3" fill="#343a3e"/></svg>')}`;
      await portrait.decode();
      const draws = [];
      const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        if (source === portrait) draws.push(args);
        return originalDraw.call(this, source, ...args);
      };
      let rendered;
      try { rendered = await window.GearSheet.render({
        title: "Portrait option",
        characterIndex: 0,
        language: "en",
        entries: [],
        image: portrait,
      }); } finally { CanvasRenderingContext2D.prototype.drawImage = originalDraw; }
      const output = rendered.pages[0];
      const decoded = await createImageBitmap(output.blob);
      const imageIncluded = output.imageIncluded;
      const decodedWidth = decoded.width;
      decoded.close();
      return { imageIncluded, width: output.width, height: output.height, decodedWidth, draws };
    });
    assert.equal(portraitResult.imageIncluded, true, "an optional decoded portrait is included when available");
    assert.equal(portraitResult.width, 2160);
    assert.equal(portraitResult.height, 2700);
    assert.equal(portraitResult.decodedWidth, 2160);
    assert.ok(portraitResult.draws.length > 0 && portraitResult.draws.every(args => args.length === 4 && Math.abs(args[2] / args[3] - 12 / 16) < 0.0001), "sheet thumbnails preserve the complete portrait without cropping a character's head or feet");

    const snapshotResult = await page.evaluate(async () => {
      const drawnText = [];
      const canvasFactory = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const recordingContext = new Proxy(context, {
          get(target, key) {
            if (key === "fillText") {
              return (value, ...args) => {
                drawnText.push(String(value));
                return target.fillText(value, ...args);
              };
            }
            const value = Reflect.get(target, key, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
          set(target, key, value) {
            return Reflect.set(target, key, value, target);
          },
        });
        return {
          get width() { return canvas.width; },
          set width(value) { canvas.width = value; },
          get height() { return canvas.height; },
          set height(value) { canvas.height = value; },
          getContext: () => recordingContext,
          toBlob: canvas.toBlob.bind(canvas),
        };
      };
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16"><rect width="12" height="16" fill="#dfe3e5"/></svg>';
      const records = [{ id: "captured-entry", slot: "head", name: "Original gear", names: { ko: "Original gear", en: "Original English", ja: "Original Japanese" } }];
      const groups = [{ id: "core", slots: ["head", "body", "hands", "legs", "feet"], labels: { ko: "Original group", en: "Original group", ja: "Original group" } }];
      const options = {
        title: "Title at click",
        characterName: "Character at click",
        characterIndex: 0,
        language: "ko",
        entries: records,
        groups,
        slotLabel: () => "Slot at click",
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        canvasFactory,
      };
      const pending = window.GearSheet.render(options);
      records[0].names.ko = "Mutated gear";
      records[0].slot = "custom";
      records.push({ id: "late-entry", slot: "custom", names: { ko: "Late gear" } });
      groups[0].labels.ko = "Mutated group";
      options.title = "Title after click";
      options.characterName = "Character after click";
      options.language = "ja";
      options.entries = [];
      options.groups = [];
      options.canvasFactory = () => { throw new Error("late canvas factory must not be used"); };
      const rendered = await pending;
      return {
        text: drawnText,
        totalEntries: rendered.totalEntries,
        rowCount: rendered.pages.reduce((total, output) => total + output.rowCount, 0),
        entryIds: rendered.pages.flatMap((output) => output.entryIds),
      };
    });
    assert.equal(snapshotResult.totalEntries, 1, "render snapshots the original entry list before image decode awaits");
    assert.equal(snapshotResult.rowCount, 1);
    assert.deepEqual(snapshotResult.entryIds, ["captured-entry"]);
    for (const originalText of ["Title at click", "Character at click", "Original gear", "Original group", "Slot at click"]) {
      assert.ok(snapshotResult.text.some((value) => value.includes(originalText)), `render retains ${originalText} from click time`);
    }
    for (const changedText of ["Title after click", "Character after click", "Mutated gear", "Mutated group", "Late gear"]) {
      assert.ok(!snapshotResult.text.some((value) => value.includes(changedText)), `render ignores later mutation: ${changedText}`);
    }

    const bitmapOwnership = await page.evaluate(async () => {
      const source = document.createElement("canvas");
      source.width = 12;
      source.height = 16;
      const sourceContext = source.getContext("2d");
      sourceContext.fillStyle = "#343a3e";
      sourceContext.fillRect(0, 0, 12, 16);
      const callerBitmap = await createImageBitmap(source);
      const callerWidthBefore = callerBitmap.width;
      const callerResult = await window.GearSheet.render({ title: "Caller bitmap", language: "en", entries: [], image: callerBitmap });
      const callerWidthAfter = callerBitmap.width;
      callerBitmap.close();

      const nativeCreateImageBitmap = window.createImageBitmap;
      let internalCloseCount = 0;
      window.createImageBitmap = async () => ({
        width: 12,
        height: 16,
        close: () => { internalCloseCount += 1; },
      });
      let fallbackImageIncluded;
      try {
        const fallback = await window.GearSheet.render({
          title: "Internal bitmap fallback",
          language: "en",
          entries: [],
          image: new Blob(["decoded by the test hook"], { type: "image/png" }),
        });
        fallbackImageIncluded = fallback.pages[0].imageIncluded;
      } finally {
        window.createImageBitmap = nativeCreateImageBitmap;
      }

      let errorCloseCount = 0;
      window.createImageBitmap = async () => ({ width: 12, height: 16, close: () => { errorCloseCount += 1; } });
      let renderFailed = false;
      try {
        await window.GearSheet.render({
          title: "Internal bitmap error",
          language: "en",
          entries: [],
          image: new Blob(["decoded by the test hook"], { type: "image/png" }),
          canvasFactory: () => { throw new Error("expected canvas failure"); },
        });
      } catch (error) {
        renderFailed = error.message === "expected canvas failure";
      } finally {
        window.createImageBitmap = nativeCreateImageBitmap;
      }
      return {
        callerWidthBefore,
        callerWidthAfter,
        callerImageIncluded: callerResult.pages[0].imageIncluded,
        fallbackImageIncluded,
        internalCloseCount,
        renderFailed,
        errorCloseCount,
      };
    });
    assert.equal(bitmapOwnership.callerImageIncluded, true);
    assert.equal(bitmapOwnership.callerWidthAfter, bitmapOwnership.callerWidthBefore, "renderer leaves caller-owned ImageBitmap open");
    assert.equal(bitmapOwnership.fallbackImageIncluded, false, "an undrawable internal bitmap falls back to a sheet without art");
    assert.equal(bitmapOwnership.internalCloseCount, 1, "fallback closes the internal bitmap exactly once");
    assert.equal(bitmapOwnership.renderFailed, true, "the injected canvas error reaches the caller");
    assert.equal(bitmapOwnership.errorCloseCount, 1, "internal bitmap closes when export fails before painting");
  } finally {
    await browser.close();
  }
}

async function checkZipStore() {
  const firstBytes = new TextEncoder().encode("PNG-like binary payload\u0000\u0001");
  const secondBytes = new Uint8Array([0, 255, 7, 42, 200]);
  const archive = await ZipStore.create([
    { name: "../무기/武器.png", blob: new Blob([firstBytes], { type: "image/png" }) },
    { name: "../무기/武器.png", blob: new Blob([secondBytes], { type: "image/png" }) },
    { name: "..\\かばん\\妖精.bin", blob: new Blob(["safe unicode path"]) },
    { name: "CON.png", blob: new Blob(["windows-safe-name"]) },
    { name: "COM¹.txt", blob: new Blob(["superscript-device-name"]) },
  ]);
  assert.equal(archive.type, "application/zip");
  const parsed = parseStoredZip(new Uint8Array(await archive.arrayBuffer()));
  assert.equal(parsed.length, 5);
  assert.deepEqual(parsed.map((entry) => entry.name), ["무기/武器.png", "무기/武器 (2).png", "かばん/妖精.bin", "_CON.png", "_COM¹.txt"]);
  assert.ok(parsed.every((entry) => !entry.name.split("/").includes("..")), "paths cannot escape their archive root");
  assert.deepEqual(Array.from(parsed[0].data), Array.from(firstBytes), "stored bytes remain unchanged");
  assert.deepEqual(Array.from(parsed[1].data), Array.from(secondBytes), "duplicate filename receives a unique name without changing bytes");
}

async function checkZipSnapshotsInputs() {
  let releaseFirstRead;
  const firstBytes = new Uint8Array([11, 12, 13]);
  const mutableBytes = new Uint8Array([21, 22, 23]);
  const delayedFirstBlob = {
    arrayBuffer: () => new Promise((resolve) => {
      releaseFirstRead = () => resolve(firstBytes.slice().buffer);
    }),
  };
  const firstFile = { name: "before-first.bin", blob: delayedFirstBlob };
  const secondFile = { name: "before-second.bin", blob: mutableBytes };
  const pendingArchive = ZipStore.create([firstFile, secondFile]);
  assert.equal(typeof releaseFirstRead, "function", "first entry read is waiting so caller input can be changed");

  mutableBytes.fill(99);
  firstFile.name = "after-first.bin";
  firstFile.blob = new Blob(["changed source"]);
  secondFile.name = "after-second.bin";
  secondFile.blob = new Blob(["changed source"]);
  releaseFirstRead();

  const archive = await pendingArchive;
  const parsed = parseStoredZip(new Uint8Array(await archive.arrayBuffer()));
  assert.deepEqual(parsed.map((entry) => entry.name), ["before-first.bin", "before-second.bin"], "names and sources are captured before the first async read");
  assert.deepEqual(Array.from(parsed[0].data), Array.from(firstBytes));
  assert.deepEqual(Array.from(parsed[1].data), [21, 22, 23], "a mutable byte view is copied before awaiting another entry");
}

(async () => {
  await checkGearSheet();
  await checkZipStore();
  await checkZipSnapshotsInputs();
  console.log("Gear sheet PNG and ZIP checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
