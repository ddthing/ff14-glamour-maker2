const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function exportSuggestedFilename(page, title) {
  await page.locator('#cardTitleInput').fill(title);
  await page.locator('#cardTitleInput').blur();
  await page.waitForFunction(expected => document.querySelector('#boardTitle')?.textContent === expected, title);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportButton').click();
  await page.evaluate(() => window.releaseFont());
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  await download.cancel();
  await page.waitForFunction(() => !document.querySelector('#exportButton').hasAttribute('aria-busy'));
  return filename;
}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});
try {const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.goto(process.env.TEST_BASE_URL||'http://localhost:4173');
await page.waitForFunction(()=>document.querySelector('#canvasBoard').dataset.cast==='1');
const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=180;const x=c.getContext('2d');x.fillStyle='#b9d4d5';x.fillRect(0,0,120,180);return c.toDataURL().split(',')[1]}),'base64');
await page.locator('#imageInput').setInputFiles({name:'export-fixture.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.querySelector('#portraitWrap img')?.naturalWidth>0);
const filenamePolicy=await page.evaluate(()=>({
  normalized:buildExportFilename('새벽 안개 룩'),
  reserved:buildExportFilename('CON'),
  unsafe:buildExportFilename('A\u0000B<>:"/\\|?*\u0001'),
  trailing:buildExportFilename('look. '),
  empty:buildExportFilename('  '),
  long:buildExportFilename('룩'.repeat(200)),
}));
assert.equal(filenamePolicy.normalized,'새벽-안개-룩.png','filenames should normalize canonically equivalent Korean text');
assert.equal(filenamePolicy.reserved,'look-CON.png','Windows device filenames should be made safe');
assert.equal(filenamePolicy.unsafe,'A-B.png','filesystem and control characters should be removed safely');
assert.equal(filenamePolicy.trailing,'look.png','filenames should not end with a dot or space');
assert.equal(filenamePolicy.empty,'tuyeong-set-maker2-look.png','empty filenames should use a stable fallback');
assert.equal(filenamePolicy.long.length,84,'filename stem should stay bounded to 80 UTF-16 code units plus .png');
const title='제목 전체를 빠짐없이 보존하며 줄바꿈과 외곽선까지 확인하는 긴 문장입니다';
await page.locator('#cardTitleInput').fill(title);await page.locator('#cardTitleInput').blur();
const subtitle='Subtitle font must finish loading before export geometry is measured';
await page.locator('#styleTab').click();
await page.locator('#boardSubtitle').fill(subtitle);await page.locator('#boardSubtitle').blur();
await page.waitForFunction(expected=>getSelectedLook()?.subtitle===expected,subtitle);
await page.locator('#boardSubtitle').click();
await page.waitForFunction(()=>document.querySelector('#canvasBoard')?.dataset.copyTarget==='subtitle');
await page.locator('#textEditorFontTrigger').click();
await page.locator('#textEditorFontMenu [data-font-key="zen-serif"]').click();
await page.waitForFunction(()=>getSelectedLook()?.subtitleFont==='zen-serif'
  && document.querySelector('#canvasBoard')?.dataset.copyFontPending!=='true');
assert.equal(await page.locator('#canvasBoard').getAttribute('data-copy-font-pending'),null,'subtitle font should be ready before the export-only font gate is installed');
await page.locator('[data-floating-align="center"]').click();
await page.waitForFunction(() => document.querySelector('#canvasBoard')?.dataset.copyRendered === 'true');
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await page.evaluate(()=>{window.drawnCopy=[];window.drawnCopyDetails=[];const old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...rest){window.drawnCopy.push(text);window.drawnCopyDetails.push({text,x:rest[0],textAlign:this.textAlign,font:this.font,width:this.canvas.width,height:this.canvas.height});return old.call(this,text,...rest)}});
await page.evaluate(() => {
  window.copyCaptures = 0;
  const capture = captureExportCopy;
  captureExportCopy = () => { window.copyCaptures++; return capture(); };
  const load = document.fonts.load.bind(document.fonts);
  const createGate = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve, released: false, requests: 0 };
  };
  window.fontLoadRequests = [];
  window.subtitleFontGate = createGate();
  window.resetSubtitleFontGate = () => { window.subtitleFontGate = createGate(); };
  window.releaseFont = () => {
    const gate = window.subtitleFontGate;
    if (gate.released) return;
    gate.released = true;
    gate.resolve();
  };
  document.fonts.load = (...args) => {
    const descriptor = String(args[0] || '');
    window.fontLoadRequests.push(descriptor);
    const gate = window.subtitleFontGate;
    if (descriptor.includes('ZenSerif') && !gate.released) {
      gate.requests++;
      return gate.promise.then(() => load(...args));
    }
    return load(...args);
  };
});
const capturesBeforeExport=await page.evaluate(() => window.copyCaptures);
let downloadCount=0;page.on('download',()=>{downloadCount++});
const downloadPromise=page.waitForEvent('download');await page.locator('#exportButton').click();
await page.waitForFunction(()=>window.subtitleFontGate?.requests>0&&document.querySelector('#exportButton')?.getAttribute('aria-busy')==='true');
assert.ok(await page.evaluate(()=>window.fontLoadRequests.some(descriptor=>descriptor.includes('Pretendard'))),'title font load should remain independent from the gated subtitle font');
assert.equal(await page.evaluate(() => window.copyCaptures), capturesBeforeExport, 'Export measured copy while the subtitle font was still pending');
assert.equal(downloadCount,0,'Export downloaded before the pending subtitle font resolved');
await page.evaluate(() => window.releaseFont());
const download=await downloadPromise;
assert.equal(download.suggestedFilename(),'제목-전체를-빠짐없이-보존하며-줄바꿈과-외곽선까지-확인하는-긴-문장입니다.png','Korean card titles should produce readable PNG filenames');
await download.saveAs('artifacts/redesign-export.png');
const copied=await page.evaluate(()=>window.drawnCopy.join(''));
assert.ok(copied.includes(title), `Output omitted title text: ${copied}`);
const centeredCopyCalls=await page.evaluate((expectedTitle)=>window.drawnCopyDetails.filter(({text})=>text.length>5&&expectedTitle.includes(text)),title);
assert.ok(centeredCopyCalls.length>0&&centeredCopyCalls.every(({textAlign})=>textAlign==='center'),`PNG title copy lost centered alignment: ${JSON.stringify(centeredCopyCalls)}`);
const subtitleCopyCalls=await page.evaluate(expected=>window.drawnCopyDetails.filter(({text})=>String(text).includes(expected)),subtitle);
assert.ok(subtitleCopyCalls.length>0,`PNG omitted subtitle copy: ${JSON.stringify(await page.evaluate(()=>window.drawnCopyDetails))}`);
assert.ok(subtitleCopyCalls.some(({font})=>font.includes('ZenSerif')),`PNG subtitle did not use its selected font: ${JSON.stringify(subtitleCopyCalls)}`);
assert.equal(await page.locator('#exportButton').getAttribute('aria-busy'),null);
assert.equal(await page.evaluate(() => window.copyCaptures), capturesBeforeExport + 1, 'Export should capture its copy exactly once after the font is ready');
const localizedFilenames=[];
for(const [filenameTitle,expected] of [
  ['새벽 안개 룩 2','새벽-안개-룩-2.png'],
  ['星空の旅人','星空の旅人.png'],
  ['Unsafe:/Title?*','Unsafe-Title.png'],
]) {
  const actual=await exportSuggestedFilename(page,filenameTitle);
  localizedFilenames.push(actual);
  assert.equal(actual,expected,`unexpected export filename for ${filenameTitle}: ${actual}`);
}
assert.equal(new Set(localizedFilenames).size,3,'different localized titles should keep distinct PNG filenames');
let unexpectedDownload = false;
page.on('download', () => { unexpectedDownload = true; });
const capturesBeforeCancelledExport=await page.evaluate(() => window.copyCaptures);
const downloadsBeforeCancelledExport=downloadCount;
await page.evaluate(() => window.resetSubtitleFontGate());
await page.locator('#exportButton').click();
await page.waitForFunction(()=>window.subtitleFontGate?.requests>0&&document.querySelector('#exportButton')?.getAttribute('aria-busy')==='true');
assert.equal(await page.evaluate(() => window.copyCaptures),capturesBeforeCancelledExport,'Export measured copy before the pending subtitle font resolved');
await page.locator('#boardSubtitle').fill('Subtitle changed while its font was pending');
await page.locator('#boardSubtitle').blur();
await page.waitForFunction(() => document.querySelector('#canvasBoard')?.dataset.copyRendered === 'true');
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capturesAfterRevisionEdit=await page.evaluate(() => window.copyCaptures);
await page.evaluate(() => window.releaseFont());
await page.waitForFunction(() => !document.querySelector('#exportButton').hasAttribute('aria-busy'));
assert.equal(unexpectedDownload, false, 'Export mixed a stale snapshot with updated copy');
assert.equal(downloadCount,downloadsBeforeCancelledExport,'A revision change during the subtitle-font wait must cancel the stale PNG download');
assert.equal(await page.evaluate(() => window.copyCaptures),capturesAfterRevisionEdit,'A revision change during font preparation must cancel before export captures stale copy geometry');
console.log('PASS: PNG preserves full copy, waits for its font, and cancels safely when edits change during preparation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
