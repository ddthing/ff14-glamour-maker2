const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const counts = [1, 2, 3, 5];
const viewports = [1600, 375];
const gearCount = 11;

function fixturePng() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  const cape = context.createLinearGradient(150, 180, 990, 820);
  cape.addColorStop(0, "#8ba9b7");
  cape.addColorStop(0.48, "#385a70");
  cape.addColorStop(1, "#203748");
  // An intentionally asymmetric, transparent cutout. The broad left cape,
  // right shoulder and angled weapon make crop and transform drift visible.
  context.fillStyle = cape;
  context.beginPath();
  context.moveTo(475, 185);
  context.lineTo(590, 180);
  context.lineTo(720, 235);
  context.lineTo(840, 174);
  context.lineTo(970, 262);
  context.lineTo(902, 430);
  context.lineTo(1015, 680);
  context.lineTo(810, 748);
  context.lineTo(720, 600);
  context.lineTo(675, 845);
  context.quadraticCurveTo(560, 885, 450, 845);
  context.lineTo(400, 580);
  context.lineTo(285, 790);
  context.lineTo(125, 700);
  context.lineTo(270, 430);
  context.lineTo(230, 280);
  context.closePath();
  context.fill();
  context.fillStyle = "#dbc7aa";
  context.beginPath();
  context.ellipse(554, 130, 72, 92, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1d2b37";
  context.beginPath();
  context.ellipse(554, 92, 86, 48, 0, Math.PI, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#d6d2c6";
  context.lineWidth = 18;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(820, 570);
  context.lineTo(1115, 65);
  context.stroke();
  context.strokeStyle = "#b59b6c";
  context.lineWidth = 34;
  context.beginPath();
  context.moveTo(781, 624);
  context.lineTo(853, 666);
  context.stroke();
  context.fillStyle = "#d3bd90";
  for (let y = 330; y < 690; y += 74) {
    context.beginPath();
    context.arc(600, y, 7, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#172935";
  context.fillRect(466, 818, 72, 68);
  context.fillRect(583, 818, 72, 68);
  return canvas.toDataURL("image/png").split(",")[1];
}

function configFor(count, viewportWidth) {
  const configs = {
    "1:1600": { imageFit: "contain", zoom: 100, panX: 0, panY: 0 },
    "1:375": { imageFit: "cover", zoom: 130, panX: 22, panY: -18 },
    "2:1600": { imageFit: "cover", zoom: 100, panX: -16, panY: 22 },
    "2:375": { imageFit: "contain", zoom: 140, panX: 18, panY: -20 },
    "3:1600": { imageFit: "contain", zoom: 112, panX: 12, panY: -14 },
    "3:375": { imageFit: "cover", zoom: 125, panX: -14, panY: 16 },
    "5:1600": { imageFit: "cover", zoom: 110, panX: 14, panY: 18 },
    "5:375": { imageFit: "contain", zoom: 120, panX: -12, panY: -16 },
  };
  return configs[`${count}:${viewportWidth}`];
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const modesSeen = new Set();
  const summaries = [];
  try {
    for (const viewportWidth of viewports) {
      const context = await browser.newContext({ viewport: { width: viewportWidth, height: 900 }, locale: "ko-KR" });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.addInitScript(() => localStorage.clear());
        await page.route("**/api/items/search**", route => route.fulfill({ json: { results: [] } }));
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#canvasBoard");
        const imageFixture = await page.evaluate(fixturePng);

        for (const count of counts) {
          const config = configFor(count, viewportWidth);
          modesSeen.add(config.imageFit);
          await page.evaluate(async ({ count, config, imageFixture }) => {
            const bytes = Uint8Array.from(atob(imageFixture), character => character.charCodeAt(0));
            const file = new File([bytes], "asymmetric-cape-weapon.png", { type: "image/png" });
            for (let index = 0; index < count; index += 1) {
              const ok = await handleImageFile(file, index, { render: false, notify: false });
              if (!ok) throw new Error(`fixture upload failed for character ${index}`);
            }
            state.language = "ko";
            state.characterCount = count;
            state.selectedCharacter = 0;
            state.singleRatio = "portrait";
            state.multiInfoEnabled = true;
            state.characters.slice(0, count).forEach(character => {
              character.cutout = true;
              character.imageFit = config.imageFit;
              character.zoom = config.zoom;
              character.panX = config.panX;
              character.panY = config.panY;
            });
            const look = getSelectedLook();
            const slots = ["head", "body", "hands", "legs", "feet"];
            const labels = ["서리빛 여행자의 모자", "한밤의 탐험가 외투", "은빛 실로 엮은 장갑", "도시 여행자의 바지", "별을 따라 걷는 장화"];
            for (let index = 0; index < slots.length; index += 1) {
              const id = 980001 + index;
              itemRecordCache.set(id, { id, slot: slots[index], names: { ko: labels[index], en: `Silhouette Gear ${index + 1}` } });
              look.outfits.forEach(outfit => { outfit[slots[index]] = id; });
            }
            look.extraEquipment = Array.from({ length: 5 }, (_, characterIndex) => [
              ["earrings", "달빛 진주 귀걸이", "Moonlit Pearl Earrings"],
              ["necklace", "은하수 목걸이", "Milky Way Necklace"],
              ["bracelet", "작은 별 팔찌", "Little Star Bracelet"],
              ["ringLeft", "푸른 새벽 반지", "Blue Dawn Ring"],
              ["facewear", "얇은 테 안경", "Fine Frame Glasses"],
              ["fashion", "비 오는 날의 우산", "Rainy Day Parasol"],
            ].map(([slot, ko, en], gearIndex) => ({
              id: `extra-silhouette-${characterIndex}-${gearIndex}`,
              slot,
              names: { ko, en },
              source: "manual",
              itemId: null,
              showOnCard: true,
            })));
            look.cardComposition = { layer: "person-front", protectText: true, infoGap: 20 };
            syncSelectedCharacter();
            renderAll();
          }, { count, config, imageFixture });

          await page.waitForFunction(expectedCount => {
            const board = document.querySelector("#canvasBoard");
            const images = [...document.querySelectorAll("#portraitWrap .character-figure img")];
            return board?.dataset.compositionCustom === "true"
              && images.length === expectedCount
              && images.every(image => image.complete && image.naturalWidth > 0 && image.dataset.compositionPlaced === "true")
              && typeof compositionPlan !== "undefined"
              && compositionPlan.imageRects?.length >= expectedCount;
          }, count);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });

          const result = await page.evaluate(({ expectedCount }) => {
            const plan = compositionPlan;
            const board = document.querySelector("#canvasBoard");
            const boardRect = board.getBoundingClientRect();
            const scale = boardRect.width / plan.dimensions.layoutWidth;
            const rectInLayout = rect => ({
              x: (rect.left - boardRect.left) / scale,
              y: (rect.top - boardRect.top) / scale,
              width: rect.width / scale,
              height: rect.height / scale,
            });
            const imageElements = [...document.querySelectorAll("#portraitWrap .character-figure img")];
            const imageRects = imageElements.map((image, index) => ({
              index,
              dom: rectInLayout(image.getBoundingClientRect()),
              planned: plan.imageRects[index],
            }));
            const noteRects = plan.items.map(item => {
              const note = document.querySelector(`#boardGearList [data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`);
              if (!note) throw new Error(`missing rendered note ${item.characterIndex}/${item.gearIndex}`);
              return { item, dom: rectInLayout(note.getBoundingClientRect()) };
            });

            // Repaint only the source image alpha, using the browser's actual
            // IMG box rather than trusting the model's planned rectangle.
            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = plan.dimensions.layoutWidth;
            maskCanvas.height = plan.dimensions.layoutHeight;
            const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
            imageElements.forEach((image, index) => {
              const rect = imageRects[index].dom;
              maskContext.save();
              // Image overflow is visible on this surface; the raster follows
              // the actual DOM rectangle and clips only at the board edges.
              maskContext.drawImage(image, rect.x, rect.y, rect.width, rect.height);
              maskContext.restore();
            });
            const alpha = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
            const overlapPixels = noteRects.map(({ item }) => {
              const margin = 24 + plan.infoGap;
              const left = Math.max(0, Math.floor(item.copyBounds.x - margin));
              const top = Math.max(0, Math.floor(item.copyBounds.y - margin));
              const right = Math.min(maskCanvas.width, Math.ceil(item.copyBounds.x + item.copyBounds.width + margin));
              const bottom = Math.min(maskCanvas.height, Math.ceil(item.copyBounds.y + item.copyBounds.height + margin));
              let pixels = 0;
              for (let y = top; y < bottom; y += 1) {
                for (let x = left; x < right; x += 1) {
                  if (alpha[(y * maskCanvas.width + x) * 4 + 3] > 8) pixels += 1;
                }
              }
              return { characterIndex: item.characterIndex, gearIndex: item.gearIndex, pixels };
            });
            const columns = [];
            const pairedRows = [];
            const slotRows = [];
            const slotAnchors = noteRects.map(({ item }) => {
              const note = document.querySelector(`#boardGearList [data-character-index="${item.characterIndex}"][data-gear-index="${item.gearIndex}"]`);
              const slot = note.querySelector(".gear-slot-label");
              return { characterIndex: item.characterIndex, row: item.row, gearIndex: item.gearIndex, top: rectInLayout(slot.getBoundingClientRect()).y, expectedTop: item.copyBounds.y };
            });
            for (let characterIndex = 0; characterIndex < expectedCount; characterIndex += 1) {
              const characterItems = plan.items.filter(item => item.characterIndex === characterIndex);
              const byColumn = new Map();
              for (const item of characterItems) {
                const columnKey = `${item.railSide || "rail"}:${item.column}`;
                const columnItems = byColumn.get(columnKey) || [];
                columnItems.push(item);
                byColumn.set(columnKey, columnItems);
              }
              for (const [column, items] of byColumn) {
                columns.push({ characterIndex, column, xs: items.map(item => item.x) });
              }
              const rows = new Map();
              for (const item of characterItems) {
                const rowItems = rows.get(item.row) || [];
                rowItems.push(item);
                rows.set(item.row, rowItems);
              }
              for (const [row, items] of rows) pairedRows.push({ characterIndex, row, ys: items.map(item => item.y) });
            }
            const slotGroups = new Map();
            for (const slot of slotAnchors) {
              const key = `${slot.characterIndex}:${slot.row}`;
              const values = slotGroups.get(key) || [];
              values.push(slot);
              slotGroups.set(key, values);
            }
            for (const [key, slots] of slotGroups) slotRows.push({ key, tops: slots.map(slot => slot.top), expectedTops: slots.map(slot => slot.expectedTop) });
            return {
              layout: plan.dimensions,
              imageRects,
              noteRects,
              overlapPixels,
              itemCount: plan.items.length,
              columns,
              pairedRows,
              slotRows,
              slotAnchors,
              allSelectedEntries: getCardGearByCharacter().slice(0, expectedCount).map(entries => entries.length),
              mode: state.characters[0].imageFit,
            };
          }, { expectedCount: count });

          const label = `${count} character(s) at ${viewportWidth}px`;
          assert.equal(result.itemCount, count * gearCount, `${label}: every selected item must have a rendered placement (${JSON.stringify({ itemCount: result.itemCount, allSelectedEntries: result.allSelectedEntries, mode: result.mode })})`);
          assert.deepEqual(result.allSelectedEntries, Array(count).fill(gearCount), `${label}: all selections stay in the source model`);
          for (const image of result.imageRects) {
            for (const key of ["x", "y", "width", "height"]) {
              assert.ok(Math.abs(image.dom[key] - image.planned[key]) < 1, `${label}: rendered image ${image.index} ${key} must match its adjusted plan (${image.dom[key]} vs ${image.planned[key]})`);
            }
          }
          for (const { item, dom } of result.noteRects) {
            for (const [actual, planned, dimension] of [[dom.x, item.x, "x"], [dom.y, item.y, "y"], [dom.width, item.width, "width"], [dom.height, item.height, "height"]]) {
              assert.ok(Math.abs(actual - planned) < 1, `${label}: rendered note ${item.characterIndex}/${item.gearIndex} ${dimension} must stay at its planned rail location`);
            }
          }
          result.columns.forEach(column => {
            assert.ok(column.xs.every(x => Math.abs(x - column.xs[0]) < 0.1), `${label}: rail column ${column.characterIndex}/${column.column} left edge must be stable`);
          });
          result.pairedRows.forEach(row => {
            assert.ok(row.ys.every(y => Math.abs(y - row.ys[0]) < 0.1), `${label}: notes in row ${row.characterIndex}/${row.row} must share their top edge`);
          });
          result.slotAnchors.forEach(slot => {
            assert.ok(Math.abs(slot.top - slot.expectedTop) < 2, `${label}: slot glyph ${slot.characterIndex}/${slot.gearIndex} must begin at its planned copyBounds top (${slot.top} vs ${slot.expectedTop})`);
          });
          result.slotRows.forEach(row => {
            assert.ok(row.tops.every(top => Math.abs(top - row.tops[0]) < 1), `${label}: slot glyphs in paired row ${row.key} must share their rendered top edge`);
          });
          const overlaps = result.overlapPixels.filter(value => value.pixels > 0);
          assert.deepEqual(overlaps, [], `${label}: rendered silhouette alpha intersects expanded copy bounds: ${JSON.stringify(overlaps.slice(0, 5))}`);
          assert.deepEqual(pageErrors, [], `${label}: browser rendering must not throw`);
          summaries.push(`${label}: ${result.itemCount} notes, ${result.mode}, no silhouette pixels in copy areas`);
        }
      } finally {
        await context.close();
      }
    }
    assert.deepEqual([...modesSeen].sort(), ["contain", "cover"], "the browser matrix must exercise contain and cover image fitting");
    console.log(`PASS: silhouette clearance, adjusted image placement, rail geometry, and selected-item retention.\n${summaries.join("\n")}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
