const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.join(__dirname, "..", ".github", "workflows", "verify.yml");
assert.ok(fs.existsSync(workflowPath), "push/PR verification workflow is required");
const workflow = fs.readFileSync(workflowPath, "utf8");

assert.match(workflow, /(^|\n)\s*push:\s*$/m, "verification must run on pushes");
assert.match(workflow, /(^|\n)\s*pull_request:\s*$/m, "verification must run on pull requests");
assert.match(workflow, /runs-on:\s*windows-latest/, "browser checks need the installed Microsoft Edge channel");
assert.match(workflow, /run:\s*npm ci/, "CI must use the lockfile install");
assert.match(workflow, /run:\s*npm run check/, "CI must run syntax and contract checks");
assert.match(workflow, /run:\s*npm test/, "CI must run browser regression checks");
assert.match(workflow, /run:\s*npm run build:pages/, "CI must verify the deployable Pages build");
assert.match(workflow, /run:\s*git diff --check/, "CI must reject whitespace errors");
console.log("PASS: push/PR CI covers locked install, checks, browser regressions, Pages build, and diff hygiene.");
