const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const cutoutPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const searchRoutes = new Map();
    async function waitForSearchRoute(query, timeout = 2000) {
      const deadline = Date.now() + timeout;
      while (!searchRoutes.has(query) && Date.now() < deadline) await page.waitForTimeout(25);
      assert.ok(searchRoutes.has(query), `${query} search request was not captured`);
      return searchRoutes.get(query);
    }
    await page.route("**/api/items/search?*", async (route) => {
      const query = new URL(route.request().url()).searchParams.get("q");
      if (!["alpha", "beta"].includes(query)) {
        await route.fulfill({ json: { results: [] } });
        return;
      }
      await new Promise((resolve) => searchRoutes.set(query, { route, resolve }));
    });
    let cutoutRoute;
    await page.route("**/api/background-removal", (route) => {
      cutoutRoute = route;
    });

    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#castSelector button");
    await page.locator('[data-cast-count="3"]').click();
    await page.locator("#imageInput").setInputFiles({ name: "async-source.png", mimeType: "image/png", buffer: cutoutPng });
    await page.waitForFunction(() => document.querySelector("#imageState")?.dataset.state === "original");
    await page.locator("#itemsTab").click();

    const search = page.locator("#itemSearch");
    await search.fill("alpha");
    await page.waitForFunction(() => document.querySelector("#catalogResults")?.getAttribute("aria-busy") === "true");
    await page.waitForFunction(() => document.querySelector("#itemSearch").value === "alpha");
    await waitForSearchRoute("alpha");

    await search.fill("beta");
    const beta = await waitForSearchRoute("beta");
    await beta.route.fulfill({
      json: { results: [{ id: "2002", slot: "head", names: { ko: "Beta 결과", en: "Beta result" } }] },
    });
    beta.resolve();
    await page.waitForSelector('.catalog-result[data-item-id="2002"]');

    const alpha = searchRoutes.get("alpha");
    await alpha.route.fulfill({
      json: { results: [{ id: "1001", slot: "head", names: { ko: "Alpha 지연 결과", en: "Late alpha result" } }] },
    }).catch(() => {});
    alpha.resolve();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.catalog-result[data-item-id="2002"]').count(), 1);
    assert.equal(await page.locator('.catalog-result[data-item-id="1001"]').count(), 0);
    assert.match(await page.locator("#catalogStatus").textContent(), /1개의 검색 결과/);

    await page.locator("#styleTab").click();
    await page.locator("#cutoutButton").click();
    await page.waitForFunction(() => document.querySelector("#cutoutButton").getAttribute("aria-busy") === "true");
    for (let attempt = 0; !cutoutRoute && attempt < 250; attempt += 1) await page.waitForTimeout(20);
    assert.ok(cutoutRoute, "background-removal request was not captured");
    await page.locator('[data-character-select="1"]').click();
    assert.equal(await page.locator("#cutoutButton").getAttribute("aria-busy"), "true");
    await cutoutRoute.fulfill({ status: 200, contentType: "image/png", body: cutoutPng });
    await page.waitForFunction(() => !document.querySelector("#cutoutButton").disabled);
    assert.deepEqual(await page.locator(".character-figure").evaluateAll((figures) => figures.map((figure) => figure.dataset.cutout)), ["true", "false", "false"]);
    assert.equal(await page.locator('[data-character-select="1"]').getAttribute("aria-pressed"), "true");

    assert.deepEqual(pageErrors, []);
    console.log("PASS: stale search result isolation, pending cutout target isolation, busy state, focus and page errors.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
