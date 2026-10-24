const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const placementFixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

async function assertOpenMenuHitTesting(page, viewportLabel) {
  await page.locator("#languagePickerToggle").click();
  await page.waitForFunction(() => document.querySelector("#languagePickerToggle")?.getAttribute("aria-expanded") === "true");
  const result = await page.locator("#languagePickerMenu").evaluate((menu) => {
    const inside = (rect) => rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    const options = [...menu.querySelectorAll(".u267-op")].map((option) => {
      const rect = option.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { lang: option.lang, inViewport: inside(rect), receivesHit: Boolean(hit && option.contains(hit)) };
    });
    return { menuInViewport: inside(menu.getBoundingClientRect()), options };
  });
  assert.equal(result.menuInViewport, true, `${viewportLabel}: menu bounds stay inside the viewport`);
  assert.deepEqual(result.options.map(({ lang, inViewport, receivesHit }) => ({ lang, inViewport, receivesHit })), [
    { lang: "ko", inViewport: true, receivesHit: true },
    { lang: "en", inViewport: true, receivesHit: true },
    { lang: "ja", inViewport: true, receivesHit: true },
  ], `${viewportLabel}: all three locale options remain visible and hit-testable`);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-expanded"), "false");
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".u267-picker #languagePickerToggle");

    assert.equal(await page.locator("#languageSelect").count(), 1, "the native language select keeps its ID");
    assert.equal(await page.locator("#languageSelect option").count(), 3, "the native select keeps its locale options");
    assert.equal(await page.locator(".u267-op[lang=ko]").count(), 1);
    assert.equal(await page.locator(".u267-op[lang=en]").count(), 1);
    assert.equal(await page.locator(".u267-op[lang=ja]").count(), 1);
    assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-haspopup"), "listbox");
    assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#languagePickerMenu").getAttribute("role"), "listbox");
    assert.equal(await page.locator("#languagePickerMenu").getAttribute("aria-hidden"), "true");
    await page.locator("#languageSelect").selectOption("ko", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "ko" && document.querySelector("#languageSelect")?.value === "ko");
    await assertOpenMenuHitTesting(page, "1280px desktop");

    await page.locator("#cardTitleInput").fill("My Original Outfit");
    await page.waitForFunction(() => document.querySelector("#boardTitle")?.textContent === "My Original Outfit");
    const gearBefore = await page.locator("#boardGearList").textContent();
    const boardTitleBefore = await page.locator("#boardTitle").textContent();
    const oldHeaderCopy = await page.locator(".wordmark-copy strong").textContent();

    await page.locator("#languageSelect").selectOption("en", { force: true });
    await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("#languageSelect")?.value === "en");
    assert.equal(await page.locator("#languagePickerToggle .u267-cd").textContent(), "EN");
    assert.equal(await page.locator(".u267-op[lang=en]").getAttribute("aria-selected"), "true");
    await page.waitForFunction((previous) => {
      const heading = document.querySelector(".wordmark-copy strong");
      return heading && heading.textContent !== previous && heading.querySelector(".u267-sw.is-go, .u267-sw.is-in");
    }, oldHeaderCopy);
    await page.waitForFunction(() => !document.querySelector(".u267-sw.is-go, .u267-sw.is-in"));
    assert.equal(await page.locator("#boardTitle").textContent(), boardTitleBefore, "language transitions leave the user's card title untouched");
    assert.equal(await page.locator("#boardGearList").textContent(), gearBefore, "language transitions leave card gear copy untouched");
    assert.equal(await page.locator("#canvasBoard .u267-sw").count(), 0, "animation wrappers stay outside the exported card");

    await page.evaluate(() => {
      const select = document.querySelector("#languageSelect");
      select.value = "ja";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#itemsTab").click();
    });
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    const itemsTitle = await page.locator("#inspectorTitle").textContent();
    await page.evaluate(() => {
      const button = document.querySelector("#exportButton");
      button.setAttribute("aria-busy", "true");
      button.querySelector("span[data-i18n]").textContent = "Preparing…";
    });
    await page.waitForTimeout(900);
    assert.equal(await page.locator("#inspectorTitle").textContent(), itemsTitle, "delayed copy motion cannot replace a newly selected panel title");
    assert.equal(await page.locator("#exportButton span[data-i18n]").textContent(), "Preparing…", "delayed copy motion cannot replace an export busy label");
    await page.locator("#exportButton").evaluate((button) => button.removeAttribute("aria-busy"));
    await page.evaluate(() => I18n.apply(document, "en"));
    await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("#languageSelect")?.value === "en");
    await page.waitForFunction(() => !document.querySelector(".u267-sw.is-go, .u267-sw.is-in"));

    const lightSurface = await page.locator(".u267-picker").evaluate((element) => getComputedStyle(element).getPropertyValue("--ux-surface").trim());
    await page.locator("#editorThemeToggle").click();
    await page.waitForFunction(() => document.documentElement.dataset.editorTheme === "dark");
    const darkSurface = await page.locator(".u267-picker").evaluate((element) => getComputedStyle(element).getPropertyValue("--ux-surface").trim());
    assert.notEqual(darkSurface, lightSurface, "Lucian picker tokens follow the editor's dark surface");
    await page.locator("#editorThemeToggle").click();
    await page.waitForFunction(() => document.documentElement.dataset.editorTheme === "light");

    await page.locator("#languagePickerToggle").focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("lang")), "en", "opening the listbox focuses the current locale");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("lang")), "ja", "ArrowDown advances through options");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.documentElement.lang === "ja" && document.querySelector("#languageSelect")?.value === "ja");
    assert.equal(await page.locator("#languagePickerToggle .u267-cd").textContent(), "JA");
    assert.equal(await page.evaluate(() => document.activeElement.id), "languagePickerToggle", "selection returns focus to the globe button");

    await page.locator("#languagePickerToggle").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement.id), "languagePickerToggle", "Escape closes and restores focus");
    await page.locator("#languagePickerToggle").click();
    await page.locator("#canvas").click({ position: { x: 30, y: 200 } });
    assert.equal(await page.locator("#languagePickerToggle").getAttribute("aria-expanded"), "false", "outside pointer input closes the menu");

    await page.evaluate(() => I18n.apply(document, "ko"));
    await page.waitForFunction(() => document.documentElement.lang === "ko" && document.querySelector("#languageSelect")?.value === "ko");
    assert.equal(await page.locator("#languagePickerToggle .u267-cd").textContent(), "KO", "programmatic language updates synchronize the native select and picker");

    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "language picker fits a 375px viewport");
    await assertOpenMenuHitTesting(page, "375px mobile");
    assert.deepEqual(pageErrors, []);

    const reducedPage = await browser.newPage({ viewport: { width: 375, height: 812 }, colorScheme: "light" });
    const reducedErrors = [];
    reducedPage.on("pageerror", (error) => reducedErrors.push(error.message));
    await reducedPage.addInitScript(() => localStorage.clear());
    await reducedPage.emulateMedia({ reducedMotion: "reduce" });
    await reducedPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await reducedPage.waitForSelector("#languagePickerToggle");
    await reducedPage.locator("#languageSelect").selectOption("ja", { force: true });
    await reducedPage.waitForFunction(() => document.documentElement.lang === "ja");
    assert.equal(await reducedPage.locator("#languagePickerToggle .u267-cd").textContent(), "JA");
    assert.equal(await reducedPage.locator(".u267-sw.is-go, .u267-sw.is-in").count(), 0, "reduced motion applies translated copy directly");
    assert.equal(await reducedPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(reducedErrors, []);

    const placementPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    placementPage.on("pageerror", (error) => pageErrors.push(error.message));
    await placementPage.addInitScript(() => localStorage.clear());
    await placementPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await placementPage.waitForSelector("#canvasBoard");
    const imageChooser = placementPage.waitForEvent("filechooser");
    await placementPage.locator(".character-figure.is-empty").click();
    await (await imageChooser).setFiles({ name: "language-placement.png", mimeType: "image/png", buffer: placementFixturePng });
    await placementPage.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");
    await placementPage.locator("#openImageEditorButton").click();
    await placementPage.waitForFunction(() => document.body.classList.contains("image-placement-mode"));
    assert.equal(await placementPage.locator(".u267-picker").isVisible(), false, "the language action leaves image placement mode");
    assert.equal(await placementPage.locator("#editorTourButton").isVisible(), false, "global tour action leaves image placement mode");
    assert.equal(await placementPage.locator("#exportButton").isVisible(), false, "global export action leaves image placement mode");
    await placementPage.locator("#cancelImageEditorButton").click();
    assert.deepEqual(pageErrors, []);

    console.log("PASS: #267 language picker, native select bridge, safe copy animation, keyboard/outside close, programmatic locale sync, reduced motion, 375px layout, and image-placement focus mode.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
