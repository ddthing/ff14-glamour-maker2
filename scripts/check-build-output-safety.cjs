const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourceRoot = path.resolve(__dirname, "..");
const buildScript = path.join(sourceRoot, "scripts", "build-site.cjs");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glamour-build-output-safety-"));

function makeFixture() {
  const root = fs.mkdtempSync(path.join(fixtureRoot, "repo-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.copyFileSync(buildScript, path.join(root, "scripts", "build-site.cjs"));
  return root;
}

function populateBuildSources(root) {
  for (const directory of ["styles", "models", "assets/data", "terms", "privacy", "guide", "contact", "support"]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  for (const file of ["index.html", "app.js", "styles.css", "robots.txt", "sitemap.xml", "site.webmanifest", "google96c42eb007c2a9a8.html"]) {
    fs.writeFileSync(path.join(root, file), "fixture");
  }
  for (const page of ["terms", "privacy", "guide", "contact", "support"]) {
    fs.writeFileSync(path.join(root, page, "index.html"), "<main>fixture</main>");
  }
  const slots = ["head", "body", "hands", "legs", "feet", "weapon"];
  fs.writeFileSync(
    path.join(root, "assets", "data", "items-ko.json"),
    JSON.stringify(slots.map((slot, index) => ({ id: index + 1, slot }))),
  );
}

function runBuild(root, output) {
  const args = [path.join(root, "scripts", "build-site.cjs")];
  if (output) args.push("--output-dir", output);
  return spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, PAGES_OUTPUT_DIR: "" },
    encoding: "utf8",
  });
}

try {
  {
    const root = makeFixture();
    const gitMetadata = path.join(root, ".git");
    fs.mkdirSync(gitMetadata);
    const sentinel = path.join(gitMetadata, "repository-sentinel");
    fs.writeFileSync(sentinel, "keep");

    const result = runBuild(root, ".GIT");
    assert.notEqual(result.status, 0, "build output must not be the repository metadata directory");
    assert.match(result.stderr, /must not overlap repository source or metadata/);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "keep", "rejected output must preserve repository metadata");
  }

  {
    const root = makeFixture();
    fs.mkdirSync(path.join(root, ".runtime"), { recursive: true });
    const external = path.join(fixtureRoot, "external-target");
    fs.mkdirSync(external, { recursive: true });
    const sentinel = path.join(external, "keep.txt");
    fs.writeFileSync(sentinel, "keep");
    const link = path.join(root, ".runtime", "site-link");
    try {
      fs.symlinkSync(external, link, "junction");
    } catch (error) {
      if (!new Set(["EPERM", "EACCES", "ENOSYS"]).has(error.code)) throw error;
      console.log("SKIP: this environment does not allow creating a directory junction.");
    }

    if (fs.existsSync(link)) {
      const result = runBuild(root, path.join(".runtime", "site-link", "build"));
      assert.notEqual(result.status, 0, "build output must not traverse a directory junction");
      assert.match(result.stderr, /must not pass through a symbolic link/);
      assert.equal(fs.readFileSync(sentinel, "utf8"), "keep", "rejected output must preserve files outside the repository");
      assert.equal(fs.existsSync(path.join(external, "build")), false, "rejected output must not create files through the junction");
    }
  }

  {
    const root = makeFixture();
    const external = path.join(fixtureRoot, "external-runtime");
    fs.mkdirSync(external, { recursive: true });
    const sentinel = path.join(external, "keep.txt");
    fs.writeFileSync(sentinel, "keep");
    const runtimeLink = path.join(root, ".runtime");
    try {
      fs.symlinkSync(external, runtimeLink, "junction");
    } catch (error) {
      if (!new Set(["EPERM", "EACCES", "ENOSYS"]).has(error.code)) throw error;
      console.log("SKIP: this environment does not allow creating a runtime directory junction.");
    }

    if (fs.existsSync(runtimeLink)) {
      const result = runBuild(root);
      assert.notEqual(result.status, 0, "the default build path must reject a runtime junction before creating output");
      assert.match(result.stderr, /must not pass through a symbolic link/);
      assert.deepEqual(fs.readdirSync(external), ["keep.txt"], "default output must not create directories through the runtime junction");
      assert.equal(fs.readFileSync(sentinel, "utf8"), "keep");
    }
  }

  {
    const root = makeFixture();
    populateBuildSources(root);
    const runtimeOutput = path.join(".runtime", "site-regression");
    fs.mkdirSync(path.join(root, runtimeOutput), { recursive: true });
    fs.writeFileSync(path.join(root, runtimeOutput, "stale.txt"), "remove me");

    const runtimeBuild = runBuild(root, runtimeOutput);
    assert.equal(runtimeBuild.status, 0, `${runtimeBuild.stdout}\n${runtimeBuild.stderr}`);
    assert.equal(fs.existsSync(path.join(root, runtimeOutput, "stale.txt")), false, "known temporary build output should be refreshed");
    assert.equal(fs.existsSync(path.join(root, runtimeOutput, "assets", "data", "items-ko-head.json")), true);

    const defaultBuild = runBuild(root);
    assert.equal(defaultBuild.status, 0, `${defaultBuild.stdout}\n${defaultBuild.stderr}`);
    assert.match(defaultBuild.stdout, /\.runtime[\\/]site-/i, "the default temporary site destination should remain available");

    const pagesBuild = runBuild(root, "DIST");
    assert.equal(pagesBuild.status, 0, `${pagesBuild.stdout}\n${pagesBuild.stderr}`);
    assert.equal(fs.existsSync(path.join(root, "DIST", "assets", "data", "items-ko-weapon.json")), true);
  }

  console.log("PASS: build output is limited to generated destinations and refreshes those destinations safely.");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
