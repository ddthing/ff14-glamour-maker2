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
assert.match(workflow, /uses:\s*actions\/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97\s+# v7\.0\.0/, "CI must pin the Python setup action by full commit SHA");
assert.match(workflow, /python-version:\s*["']?3\.12["']?/, "background-service regression checks must use Python 3.12");
assert.match(workflow, /run:\s*python -m pip install -r requirements-background-test\.txt/, "CI must install the pinned Pillow test dependency");
assert.match(workflow, /run:\s*python scripts\/test_background_service_security\.py/, "CI must exercise cutout-service HTTP security checks");
assert.match(workflow, /run:\s*npm test/, "CI must run browser regression checks");
assert.match(workflow, /run:\s*npm run build:pages/, "CI must verify the deployable Pages build");
assert.match(workflow, /run:\s*git diff --check/, "CI must reject whitespace errors");
console.log("PASS: push/PR CI covers locked install, checks, browser regressions, Pages build, and diff hygiene.");
