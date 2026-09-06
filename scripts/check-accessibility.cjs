const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:"msedge"});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:4173');await page.waitForSelector('#castSelector button');
await page.keyboard.press('Tab');console.log('skip',await page.locator(':focus').textContent());
await page.locator('button[data-background="paper"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#backdropGrid [aria-checked="true"]').getAttribute('data-background'),'mist');assert.equal(await page.locator('#backdropGrid [tabindex="0"]').count(),1);console.log('radio navigation OK');
await page.locator('#titleWeightOptions [aria-checked="true"]').focus();await page.keyboard.press('ArrowLeft');assert.ok(await page.locator(':focus').getAttribute('data-title-weight'));console.log('weight focus preserved');
const chooser=page.waitForEvent('filechooser');await page.locator('#imageDropZone').focus();await page.keyboard.press('Enter');await chooser;console.log('upload keyboard OK');
await page.locator('#libraryToggleButton').click();await page.locator('#lookSearch').fill('hello');await page.locator('#lookSearch').evaluate(el=>{el.addEventListener('keydown',e=>setTimeout(()=>window.undoPrevented=e.defaultPrevented,0),{once:true})});await page.keyboard.press('Control+z');await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>!window.undoPrevented), true);console.log('native undo preserved');
await page.keyboard.press('Control+k');assert.equal(await page.locator(':focus').getAttribute('id'),'lookSearch');console.log('search shortcut OK');
await page.locator('#itemsTab').click();await page.locator('#itemSearch').fill('a');await page.waitForTimeout(400);console.log('status',await page.locator('#catalogStatus').textContent());
await page.setViewportSize({width:390,height:844});console.log('mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert.deepEqual(errors, []);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false);
assert.equal(await page.locator('#catalogStatus').textContent(), '두 글자 이상 입력하세요.');
assert.equal(await page.locator('#canvasBoard').getAttribute('aria-pressed'), null);
console.log('errors',errors);await page.screenshot({path:'artifacts/accessibility-mobile.png',fullPage:true});await browser.close();})().catch(e=>{console.error(e);process.exit(1)});


