const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
  await page.waitForFunction(()=>document.querySelector('#canvasBoard').dataset.cast==='1');
  const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=120;c.getContext('2d').fillRect(0,0,80,120);return c.toDataURL().split(',')[1]}),'base64');
  const upload=async(name)=>{await page.locator('#imageInput').setInputFiles({name,mimeType:'image/png',buffer:image});await page.waitForFunction(name=>document.querySelector('#sourceFileName').textContent===name,name);await page.waitForTimeout(100)};
  const loaded=()=>page.waitForFunction(()=>{const i=document.querySelector('#portraitWrap img');return i?.complete&&i.naturalWidth>0});
  await upload('A.png');await loaded();
  await page.locator('#libraryToggleButton').click();await page.locator('#addLookButton').click();
  assert.equal(await page.locator('#portraitWrap img').count(),0);
  await upload('B.png');await loaded();
  await page.locator('[data-look-id="look-1"]').click();
  assert.equal(await page.locator('#sourceFileName').textContent(),'A.png');await loaded();
  await page.locator('#resetButton').click();await page.locator('#resetCardButton').click();
  await page.waitForTimeout(1300); // Let asset cleanup run before restoring.
  await page.locator('#undoButton').click();await loaded();
  await upload('A-replaced.png');await page.locator('#undoButton').click();await loaded();
  assert.equal(await page.locator('#sourceFileName').textContent(),'A.png');
  await page.reload();await loaded();
  assert.equal(await page.locator('#sourceFileName').textContent(),'A.png');
  await page.locator('.look-list-item').last().click();await loaded();
  assert.equal(await page.locator('#sourceFileName').textContent(),'B.png');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#copyEditorSection').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#copyEditorSection h2').textContent(), '문구');
  await page.waitForTimeout(300);
  await page.screenshot({path:'artifacts/redesign-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='tuyeong-set-maker2-draft-v3')throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('#cardTitleInput').fill('저장 실패 확인');await page.locator('#cardTitleInput').blur();
  assert.equal(await page.locator('#saveStatus').getAttribute('data-failed'),'true');
  console.log('PASS: independent card images, reset/replace undo, reload, and mobile reflow.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
