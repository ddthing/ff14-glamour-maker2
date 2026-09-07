const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:4173');
    await page.waitForSelector('#castSelector button');
    const undo = page.locator('#undoButton'), redo = page.locator('#redoButton');
    const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('tuyeong-set-maker2-draft-v3')));
    assert.equal(await undo.getAttribute('aria-disabled'), 'true');
    assert.equal(await redo.getAttribute('aria-disabled'), 'true');
    await page.locator('button[data-background="mist"]').click();
    assert.equal(await undo.getAttribute('aria-disabled'), 'false');
    await undo.click();
    assert.equal((await draft()).background, 'paper');
    assert.equal(await redo.getAttribute('aria-disabled'), 'false');
    assert.equal(await undo.getAttribute('aria-disabled'), 'true');
    assert.equal(await undo.evaluate(el => el === document.activeElement), true);
    await redo.click();
    assert.equal((await draft()).background, 'mist');
    await undo.click();
    await page.locator('button[data-background="rose"]').click();
    assert.equal(await redo.getAttribute('aria-disabled'), 'true');
    const title = page.locator('#boardTitle');
    const original = await title.textContent();
    await title.fill('취소할 제목');
    await title.press('Escape');
    assert.equal(await title.textContent(), original);
    assert.equal((await draft()).title, original);
    await title.fill('저장할 제목');
    await title.press('Enter');
    await undo.click();
    assert.equal(await title.textContent(), original);
    assert.equal((await draft()).title, original);
    await redo.click();
    assert.equal(await title.textContent(), '저장할 제목');
    assert.equal((await draft()).title, '저장할 제목');
    await page.locator('#styleAdvancedToggle').click();
    const range = page.locator('#outlineRange');
    const initial = Number(await range.inputValue());
    await range.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal((await draft()).outline.width, initial + 1);
    await undo.click();
    assert.equal(Number(await range.inputValue()), initial);
    await range.evaluate(el => {
      for (const value of [2, 3, 4]) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await undo.click();
    assert.equal(Number(await range.inputValue()), initial, 'one undo restores entire slider gesture');
    await redo.click();
    assert.equal((await draft()).outline.width, 4);
    await page.reload();
    await page.waitForSelector('#castSelector button');
    assert.equal(await title.textContent(), '저장할 제목');
    assert.equal(Number(await range.inputValue()), 4);
    assert.equal(await undo.getAttribute('aria-disabled'), 'true');
    console.log('PASS: history states, focus, undo/redo persistence, redo invalidation, Escape cancellation, title history, keyboard/gesture slider history, reload.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
