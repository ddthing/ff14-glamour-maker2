const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const CardGearCopy = require("../models/card-gear-copy.js");

const fixturePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";

const longItems = [
  [93031, "head", "계승자의 두건 장식이 포함된 아주 긴 아이템 이름"],
  [93032, "body", "보강된 크리스타리움 타격대 재킷과 추가 설명"],
  [93033, "hands", "음기의 마케도사 팔보호구 특별 제작 버전"],
  [93034, "legs", "샬롱 종업원 의상용 보강된 크리스타리움 바지"],
  [93035, "feet", "보강된 제련소왕 장화의 긴 표시 이름"],
];

function normalise(value) {
  return String(value || "").replace(/\s+/gu, " ").trim();
}

async function installFixture(page) {
  await page.evaluate((items) => {
    items.forEach(([id, slot, name]) => itemRecordCache.set(String(id), {
      id: String(id),
      slot,
      names: {
        ko: name,
        en: `Official English ${name}`,
        ja: name,
      },
    }));
    const look = getSelectedLook();
    const outfit = Object.fromEntries(items.map(([id, slot]) => [slot, String(id)]));
    look.outfits = look.outfits.map(() => ({ ...outfit }));
    state.selectedCharacter = 0;
    state.singleRatio = "landscape";
    state.backgroundPattern = "none";
    state.backgroundTexture = "none";
    renderAll();
  }, longItems);
}

async function readCardNames(page, selector) {
  return page.evaluate((target) => [...document.querySelectorAll(target)].map((element) => {
    const style = getComputedStyle(element);
    return {
      text: element.textContent,
      title: element.getAttribute("title") || "",
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      overflowWrap: style.overflowWrap,
      wordBreak: style.wordBreak,
      textOverflow: style.textOverflow,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  }), selector);
}

function assertReadableNames(names, label) {
  assert.ok(names.every(({ whiteSpace, textOverflow, overflowWrap, wordBreak }) => (
    whiteSpace !== "nowrap"
    && textOverflow !== "ellipsis"
    && overflowWrap === "break-word"
    && wordBreak === "keep-all"
  )), `${label} must wrap complete names at readable boundaries: ${JSON.stringify(names)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173/?item-name-readability=1");
    await page.waitForSelector("#canvasBoard");
    await installFixture(page);

    const soloNames = await readCardNames(page, "#boardGearList .gear-tile-copy strong");
    assert.deepEqual(soloNames.map(({ text }) => normalise(text)), longItems.map(([, , name]) => name), "solo card must retain every full item name");
    assertReadableNames(soloNames, "solo item names");
    assert.deepEqual(soloNames.map(({ title }) => title), longItems.map(([, , name]) => name), "solo item names need a full-name tooltip");
    await page.screenshot({ path: "artifacts/item-name-readability-solo-landscape.png" });

    await page.locator("#imageInput").setInputFiles({
      name: "item-name-readability.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixturePng.split(",")[1], "base64"),
    });
    await page.waitForFunction(() => document.querySelector("#portraitWrap img")?.naturalWidth > 0);
    await page.evaluate(() => {
      window.__itemNameDraws = [];
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      window.__itemNameOriginalFillText = originalFillText;
      CanvasRenderingContext2D.prototype.fillText = function captureItemName(text, ...args) {
        window.__itemNameDraws.push(String(text));
        return originalFillText.call(this, text, ...args);
      };
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportButton").click();
    const download = await downloadPromise;
    await download.saveAs("artifacts/item-name-readability-solo-landscape-export.png");
    await page.waitForFunction(() => !document.querySelector("#exportButton").hasAttribute("aria-busy"));
    const exportText = await page.evaluate(() => window.__itemNameDraws);
    assert.equal(exportText.some((text) => text.includes("…")), false, "PNG item names must not contain an ellipsis");
    assert.ok(longItems.every(([, , name]) => name.split(" ").filter(Boolean).every((word) => exportText.some((text) => text.includes(word)))), `PNG export lost a word from a full item name: ${JSON.stringify(exportText)}`);
    await page.evaluate(() => { CanvasRenderingContext2D.prototype.fillText = window.__itemNameOriginalFillText; });

    await page.evaluate(() => {
      state.characterCount = 2;
      renderAll();
    });
    const twoPersonNames = await readCardNames(page, ".board-gear-rail .gear-tile-copy strong");
    assert.equal(twoPersonNames.length, 10, "two-person cards must retain five item names per rail");
    assertReadableNames(twoPersonNames, "two-person item names");

    await page.evaluate(() => {
      state.characterCount = 3;
      state.multiInfoEnabled = true;
      renderAll();
    });
    const lineupNames = await readCardNames(page, ".multi-info-item > span");
    assert.equal(lineupNames.length, 15, "lineup card must retain five item names per character");
    assertReadableNames(lineupNames, "lineup item names");

    const name = longItems[3][2];
    const lines = CardGearCopy.wrapText(name, (value) => value.length, 12);
    assert.equal(lines.join(" ").replace(/\s+/gu, " ").trim(), name, "shared wrapping must preserve every character");
    assert.ok(lines.every((line) => !line.includes("…")), "shared wrapping must never add an ellipsis");
    const pngSource = fs.readFileSync(path.join(__dirname, "..", "models", "card-png.js"), "utf8");
    assert.match(pngSource, /CardGearCopyModule\.wrapText/u, "PNG must use the shared full-name wrapping seam");
    assert.doesNotMatch(pngSource, /shortened\s*\+\s*["']…["']/u, "PNG must not shorten item names with an ellipsis");
    console.log("PASS: full item-name readability holds across solo, two-person, and lineup cards.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
