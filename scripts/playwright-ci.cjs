const playwright = require("playwright");

const launch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = (options = {}) => {
  const args = Array.from(new Set([...(options.args || []), "--lang=ko-KR"]));
  return launch({ ...options, args });
};

module.exports = playwright;
