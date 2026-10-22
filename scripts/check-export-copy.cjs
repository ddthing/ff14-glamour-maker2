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
await page.locator('[data-floating-align="center"]').click();
await page.waitForFunction(() => document.querySelector('#canvasBoard')?.dataset.copyRendered === 'true');
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await page.evaluate(()=>{window.drawnCopy=[];window.drawnCopyDetails=[];const old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...rest){window.drawnCopy.push(text);window.drawnCopyDetails.push({text,x:rest[0],textAlign:this.textAlign});return old.call(this,text,...rest)}});
await page.evaluate(() => {
  window.copyCaptures = 0;
  const capture = captureExportCopy;
  captureExportCopy = () => { window.copyCaptures++; return capture(); };
  const load = document.fonts.load.bind(document.fonts);
  document.fonts.load = (...args) => new Promise(resolve => { window.releaseFont = resolve; }).then(() => load(...args));
});
const capturesBeforeExport=await page.evaluate(() => window.copyCaptures);
const downloadPromise=page.waitForEvent('download');await page.locator('#exportButton').click();
assert.equal(await page.evaluate(() => window.copyCaptures), capturesBeforeExport, 'Export measured copy before selected font was ready');
await page.evaluate(() => window.releaseFont());
const download=await downloadPromise;
assert.equal(download.suggestedFilename(),'제목-전체를-빠짐없이-보존하며-줄바꿈과-외곽선까지-확인하는-긴-문장입니다.png','Korean card titles should produce readable PNG filenames');
await download.saveAs('artifacts/redesign-export.png');
const copied=await page.evaluate(()=>window.drawnCopy.join(''));
assert.ok(copied.includes(title), `Output omitted title text: ${copied}`);
const centeredCopyCalls=await page.evaluate((expectedTitle)=>window.drawnCopyDetails.filter(({text})=>text.length>5&&expectedTitle.includes(text)),title);
assert.ok(centeredCopyCalls.length>0&&centeredCopyCalls.every(({textAlign})=>textAlign==='center'),`PNG title copy lost centered alignment: ${JSON.stringify(centeredCopyCalls)}`);
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
await page.locator('#exportButton').click();
await page.locator('#cardTitleInput').fill('서체 대기 중 수정한 제목');
await page.locator('#cardTitleInput').blur();
await page.evaluate(() => window.releaseFont());
await page.waitForFunction(() => !document.querySelector('#exportButton').hasAttribute('aria-busy'));
assert.equal(unexpectedDownload, false, 'Export mixed a stale snapshot with updated copy');
assert.ok(await page.evaluate(() => window.copyCaptures) >= capturesBeforeCancelledExport, 'Changed export should not regress copy rendering while cancelling');
console.log('PASS: PNG preserves full copy, waits for its font, and cancels safely when edits change during preparation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
