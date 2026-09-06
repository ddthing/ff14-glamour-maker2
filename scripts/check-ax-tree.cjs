const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

function valueOf(property) {
  return property?.value?.value ?? property?.value ?? null;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:4173");
    await page.waitForSelector("#castSelector button");
    const session = await page.context().newCDPSession(page);
    const { nodes } = await session.send("Accessibility.getFullAXTree");
    const exposed = nodes.filter((node) => !node.ignored);
    const exposedNames = new Set(exposed.map((node) => `${valueOf(node.role)}\u0000${valueOf(node.name)}`));
    const required = [
      ["main", "글래머 아틀리에 편집기"],
      ["region", "룩 캔버스"],
      ["tab", "꾸미기"],
      ["tab", "장비"],
      ["tablist", "작업 모드"],
      ["group", "캔버스 도구"],
      ["group", "캐릭터 배치 영역"],
      ["group", "편집할 캐릭터"],
      ["textbox", "카드 제목"],
      ["textbox", "룩 설명"],
      ["button", "PNG 내보내기"],
    ];
    for (const [role, name] of required) {
      assert.ok(exposedNames.has(`${role}\u0000${name}`), `AX tree missing ${role}: ${name}`);
    }

    const unnamed = await page.evaluate(() => {
      const visible = (element) => {
        if (!(element instanceof HTMLElement) || element.hidden || element.closest('[hidden]')) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      };
      const name = (element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        const references = labelledBy ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ") : "";
        const associatedLabel = element.labels ? [...element.labels].map((label) => label.textContent || "").join(" ") : "";
        return (element.getAttribute("aria-label") || references || associatedLabel || element.textContent || element.value || element.getAttribute("title") || "").replace(/\s+/g, " ").trim();
      };
      return [...document.querySelectorAll("button, input, select, textarea, [contenteditable='true']")]
        .filter(visible)
        .filter((element) => !name(element))
        .map((element) => ({ tag: element.tagName, id: element.id, className: element.className }));
    });
    assert.deepEqual(unnamed, [], `visible controls without an accessible name: ${JSON.stringify(unnamed)}`);

    const selectedTab = exposed.find((node) => valueOf(node.role) === "tab" && valueOf(node.name) === "꾸미기");
    const selectedState = selectedTab?.properties?.find((property) => property.name === "selected");
    assert.equal(valueOf(selectedState), true);
    console.log(`PASS: Edge AX tree exposes ${exposed.length} nodes; required landmarks, names, selected tab, and visible control names are valid.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
