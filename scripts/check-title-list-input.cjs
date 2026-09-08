const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto((process.env.TEST_BASE_URL || "http://localhost:4173") + "/?title-list-input-check=1");
    await page.waitForSelector("#cardTitleInput");

    const result = await page.evaluate(() => {
      while (looks.length < 250) {
        const index = looks.length + 1;
        looks.push(createBlankLook(index, `title-check-look-${index}`));
      }
      renderLookList();
      const input = document.querySelector("#cardTitleInput");
      const selector = '[data-look-id="look-1"] .look-list-copy strong';
      const beforeRender = document.querySelector(selector);
      renderAll();
      const afterRender = document.querySelector(selector);
      const before = afterRender;
      input.value = "목록 제목 갱신";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const after = document.querySelector(selector);
      return { renderSameNode: beforeRender === afterRender, sameNode: before === after, text: after?.textContent || "" };
    });
    assert.equal(result.renderSameNode, true, "unchanged renderAll should preserve the list DOM");
    assert.equal(result.sameNode, true, "title input should update the existing list row");
    assert.equal(result.text, "목록 제목 갱신");

    const fitCount = await page.evaluate(async () => {
      let count = 0;
      const original = window.fitBoardTitle;
      window.fitBoardTitle = (...args) => {
        count += 1;
        return original(...args);
      };
      const input = document.querySelector("#cardTitleInput");
      for (let index = 0; index < 40; index += 1) {
        input.value = `빠른 제목 ${index}`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return count;
    });
    assert.equal(fitCount, 1, `rapid title input should fit once per frame, got ${fitCount}`);

    await page.locator("#libraryToggleButton").click();
    await page.locator("#lookSearch").fill("일치 제목");
    await page.locator("#cardTitleInput").fill("일치 제목");
    assert.equal(await page.locator('[data-look-id="look-1"]').isHidden(), false);
    console.log("PASS: title input preserves list DOM, coalesces title fitting, and refreshes filtering only when needed.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
