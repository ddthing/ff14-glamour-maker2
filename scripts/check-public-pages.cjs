const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const PublicPages = require("../models/public-pages.js");

const root = path.resolve(__dirname, "..");
const pages = ["terms", "privacy", "guide", "contact", "support"];
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const publicStyles = fs.readFileSync(path.join(root, "styles", "public-pages.css"), "utf8");

assert.match(publicStyles, /--public-bg:\s*var\(--muted\)/, "public pages must use the shared Neutral surface token");
assert.match(publicStyles, /--public-accent:\s*var\(--primary\)/, "public pages must use the shared action token");
assert.match(publicStyles, /scrollbar-width:\s*thin/, "public pages must use the shared thin-scrollbar contract");

function assertStaticPages() {
  for (const page of pages) {
    const file = path.join(root, page, "index.html");
    assert.equal(fs.existsSync(file), true, `missing public page: ${page}`);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, new RegExp(`data-public-page="${page}"`));
    assert.match(html, new RegExp(`pages\.dev/${page}/`));
    assert.match(html, new RegExp(`data-page-i18n-html="${page}\.content"`));
    assert.doesNotMatch(html, /<link rel="icon"/i, `${page} must not link the rejected favicon`);
    assert.match(html, /<meta property="og:site_name" data-page-i18n-content="common\.brand"/, `${page} must localize its Open Graph site name`);
    const tokensIndex = html.indexOf("styles/tokens.css");
    const publicStylesIndex = html.indexOf("styles/public-pages.css");
    assert.ok(tokensIndex >= 0 && tokensIndex < publicStylesIndex, `${page} must load shared tokens before public page styles`);
    for (const route of ["terms", "privacy", "guide", "contact", "support"]) {
      assert.match(html, new RegExp(`href="\.\.\/${route}\/"`), `${page} is missing ${route} footer link`);
    }
    const markerKeys = [...html.matchAll(/data-page-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
    for (const key of new Set(markerKeys)) {
      for (const language of ["ko", "en", "ja"]) {
        assert.notEqual(PublicPages.copy[language][key], undefined, `${key} is missing in ${language}`);
      }
    }
  }
  assert.equal(PublicPages.supportLinks.buymeacoffee, "https://buymeacoffee.com/coner");
  assert.equal(PublicPages.supportLinks.kofi, "https://ko-fi.com/reconeur");
}

async function assertBrowserPages() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["ko-KR"] });
      Object.defineProperty(navigator, "language", { configurable: true, get: () => "ko-KR" });
    });
    await page.goto(`${baseUrl}/terms/?public-pages-check=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.PublicPages && document.documentElement.lang));
    assert.equal(await page.locator("html").getAttribute("lang"), "ko");
    assert.equal(await page.locator("h1").innerText(), "이용약관");
    assert.equal(await page.locator("#pageLanguageSelect").inputValue(), "ko");
    assert.equal(await page.locator('[data-page-nav="terms"]').count(), 0, "terms should not need a header link");
    assert.equal(await page.locator(".public-nav").getAttribute("aria-label"), "서비스 안내");

    await page.locator("#pageLanguageSelect").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    assert.equal(await page.locator("h1").innerText(), "Terms of Use");
    assert.match(await page.locator(".public-content-card").innerText(), /What the service does/);
    assert.equal(await page.locator("title").innerText(), "Terms of Use | FF14 Glamour Maker 2");
    assert.equal(await page.locator('.public-brand strong').innerText(), "FF14 Glamour Maker 2");
    assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute("content"), "FF14 Glamour Maker 2");

    await page.locator("#pageLanguageSelect").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    assert.equal(await page.locator("h1").innerText(), "利用規約");
    assert.match(await page.locator(".public-content-card").innerText(), /サービスの範囲/);
    assert.equal(await page.locator("title").innerText(), "利用規約 | FF14ミラプリメーカー2");
    assert.equal(await page.locator('.public-brand strong').innerText(), "FF14ミラプリメーカー2");
    assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute("content"), "FF14ミラプリメーカー2");
    assert.equal(await page.locator('link[rel="icon"]').count(), 0, "public pages must not expose the rejected favicon");
    assert.equal(await page.locator("body").evaluate((element) => element.scrollWidth <= window.innerWidth), true, "public page has horizontal overflow");

    await page.goto(`${baseUrl}/support/?public-pages-check=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.publicPage === "support");
    assert.equal(await page.locator("#pageLanguageSelect").inputValue(), "ja", "language preference should carry across public pages");
    await page.locator("#supportChooserButton").click();
    const chooser = page.locator("#supportChooser");
    assert.equal(await chooser.evaluate((element) => element.open), true, "support chooser should open from the primary CTA");
    assert.match(await chooser.innerText(), /サポートサービスを選択/);
    const buyMeACoffee = chooser.locator('[data-support-key="buymeacoffee"]');
    assert.equal(await buyMeACoffee.getAttribute("href"), "https://buymeacoffee.com/coner");
    assert.equal(await buyMeACoffee.getAttribute("target"), "_blank");
    const kofi = chooser.locator('[data-support-key="kofi"]');
    assert.equal(await kofi.getAttribute("href"), "https://ko-fi.com/reconeur");
    assert.equal(await kofi.getAttribute("target"), "_blank");
    await page.locator("#supportChooserClose").click();
    await page.waitForFunction(() => !document.querySelector("#supportChooser")?.open);

    await page.goto(`${baseUrl}/contact/?public-pages-check=1`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('a[href="mailto:co.conermo@gmail.com"]').count(), 1);
    assert.equal(await page.locator('a[href="https://open.kakao.com/o/s9xXwGjg"]').count(), 1);
  } finally {
    await browser.close();
  }
}

(async () => {
  assertStaticPages();
  await assertBrowserPages();
  console.log(JSON.stringify({ status: "PASS", pages, supportLinks: PublicPages.supportLinks }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
