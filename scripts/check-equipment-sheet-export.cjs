const assert = require('node:assert/strict');
const EquipmentSheetExport = require('../models/equipment-sheet-export.js');
const ZipStore = require('../models/zip-store.js');
const png = new Blob(['png'], { type: 'image/png' });
const entry = (id, showOnCard = true) => ({ id, slot: 'custom', names: { ko: `장비 ${id}` }, showOnCard });
const pagesFor = (entries) => entries.length > 2
  ? [{ blob: png, entryIds: entries.slice(0, 2).map(e => e.id) }, { blob: png, entryIds: entries.slice(2).map(e => e.id) }]
  : [{ blob: png, entryIds: entries.map(e => e.id) }];

(async () => {
  const renderer = { render: async ({ entries }) => ({ pages: pagesFor(entries) }) };
  const one = await EquipmentSheetExport.selected({ GearSheet: renderer, ZipStore, entries: [entry('a', false)], characterIndex: 2 });
  assert.deepEqual({ ...one, blob: null }, { blob: null, format: 'png', pageCount: 1, entryCount: 1, characterCount: 1 });
  assert.equal(one.blob, png, 'One-page selection returns its original PNG');
  const many = await EquipmentSheetExport.selected({ GearSheet: renderer, ZipStore, title: '장비/시트', entries: [entry('a'), entry('b'), entry('c', false)] });
  assert.equal(many.format, 'zip'); assert.equal(many.pageCount, 2); assert.equal(many.entryCount, 3);
  assert.equal(many.blob.type, 'application/zip');
  let unsafeTitleRequest;
  let unsafeFiles;
  await EquipmentSheetExport.selected({
    GearSheet: { render: async (request) => { unsafeTitleRequest = request; return { pages: pagesFor(request.entries) }; } },
    ZipStore: { create: async (value) => { unsafeFiles = value; return ZipStore.create(value); } },
    title: '../A\\B/', entries: [entry('a'), entry('b'), entry('c')],
  });
  assert.equal(unsafeTitleRequest.title, '../A\\B/', 'Visible sheet title stays intact');
  assert.deepEqual(unsafeFiles.map(file => file.name), ['A-B-character-01/page-01.png', 'A-B-character-01/page-02.png'], 'Titles cannot create archive subdirectories or traversal segments');

  for (const wrongIds of [['a'], ['a', 'a'], ['a', 'x']]) {
    await assert.rejects(EquipmentSheetExport.selected({
      GearSheet: { render: async () => ({ pages: [{ blob: png, entryIds: wrongIds }] }) },
      ZipStore, entries: [entry('a'), entry('b')],
    }), /coverage mismatch/, 'Missing, duplicated, and unexpected entries abort the archive');
  }
  await assert.rejects(EquipmentSheetExport.selected({ GearSheet: { render: async () => ({ pages: [] }) }, ZipStore }), /no pages/);

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const captured = [];
  const files = [];
  const characters = [{ characterIndex: 0, title: '한글', entries: [entry('a', false)] }, { characterIndex: 1, title: '日本語', entries: [entry('b')] }];
  const groups = [{ id: 'custom', slots: ['custom'], labels: { ko: '기타' } }];
  let rendering = 0;
  const promise = EquipmentSheetExport.all({
    characters, groups,
    GearSheet: { render: async (request) => {
      captured.push(request);
      rendering += 1;
      assert.equal(rendering, 1, 'Characters render sequentially to bound canvas memory');
      if (captured.length === 1) await gate;
      rendering -= 1;
      return { pages: pagesFor(request.entries) };
    } },
    ZipStore: { create: async (value) => { files.push(...value); return ZipStore.create(value); } },
  });
  characters[0].entries[0].names.ko = 'changed';
  characters[1].entries.push(entry('c'));
  characters[1].title = 'changed'; groups[0].labels.ko = 'changed';
  characters.splice(0, 2);
  release();
  const all = await promise;
  assert.equal(all.characterCount, 2); assert.equal(all.entryCount, 2); assert.equal(all.pageCount, 2);
  assert.equal(captured[0].entries[0].names.ko, '장비 a');
  assert.equal(captured[0].entries[0].showOnCard, false, 'Hidden card entries remain in the full sheet');
  assert.equal(captured[1].entries.length, 1); assert.equal(captured[1].title, '日本語');
  assert.equal(captured[1].groups[0].labels.ko, '기타');
  assert.deepEqual(files.map(file => file.name), ['한글-character-01/page-01.png', '日本語-character-02/page-01.png']);
  await assert.rejects(EquipmentSheetExport.all({ GearSheet: renderer, ZipStore, characters: [] }), /at least one character/);
  console.log('PASS: complete sheet coverage, PNG/ZIP choice, hidden equipment, sequential characters, and click-time request isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
