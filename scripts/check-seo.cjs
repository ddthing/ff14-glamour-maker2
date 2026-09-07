const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const siteUrl = "https://ff14-glamour-maker2.pages.dev/";
const title = "투영세트메이커2 | FFXIV 코디 카드 만들기";
const description = "파이널판타지 XIV 캐릭터 스크린샷에 장비와 문구를 더해 코디 카드를 만들어 보세요. 여러 캐릭터를 한 장에 배치하고 완성한 룩을 PNG로 저장할 수 있습니다.";
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

assert.match(html, new RegExp(`<title>${escaped(title)}<\\/title>`), "the document title should use the current product name");
assert.match(html, new RegExp(`<meta\\s+name="description"\\s+content="${escaped(description)}"\\s*\\/>`), "the description should be natural and product-specific");
assert.match(html, /<meta\s+name="robots"\s+content="index,follow"\s*\/>/);
assert.match(html, new RegExp(`<link\\s+rel="canonical"\\s+href="${escaped(siteUrl)}"\\s*\\/>`), "the Pages URL should be canonical");
assert.match(html, new RegExp(`<meta\\s+property="og:title"\\s+content="${escaped(title)}"\\s*\\/>`));
assert.match(html, new RegExp(`<meta\\s+property="og:description"\\s+content="${escaped(description)}"\\s*\\/>`));
assert.match(html, new RegExp(`<meta\\s+property="og:url"\\s+content="${escaped(siteUrl)}"\\s*\\/>`));
assert.doesNotMatch(html, /글래머 아틀리에/);
assert.doesNotMatch(html, /AI로 작성|AI가 작성|인공지능이 작성/);

(async () => {
  const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsResponse.status, 200, "robots.txt should be publicly readable");
  const robots = await robotsResponse.text();
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Allow:\s*\//);
  assert.match(robots, /Disallow:\s*\/api\//);
  assert.match(robots, new RegExp(`Sitemap:\\s*${escaped(`${siteUrl}sitemap.xml`)}`));

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200, "sitemap.xml should be publicly readable");
  assert.match(sitemapResponse.headers.get("content-type") || "", /application\/xml/);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /<urlset[\s>]/);
  assert.match(sitemap, new RegExp(`<loc>${escaped(siteUrl)}<\\/loc>`));

  console.log("PASS: public branding, natural metadata, canonical URL, robots.txt, and sitemap.xml are aligned.");
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
