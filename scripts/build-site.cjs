const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const koreanIndexSlots = ['head', 'body', 'hands', 'legs', 'feet', 'weapon'];
const publicPageDirectories = ['terms', 'privacy', 'guide', 'contact', 'support'];
const protectedOutputRoots = new Set([
  '.agents', '.git', '.github', '_workspace', 'app.js', 'assets', 'contact', 'docs', 'functions',
  'google96c42eb007c2a9a8.html', 'guide', 'index.html', 'models', 'node_modules', 'package-lock.json',
  'package.json', 'privacy', 'README.md', 'requirements-background-gpu.txt', 'requirements-background.txt',
  'robots.txt', 'scripts', 'server.js', 'site.webmanifest', 'sitemap.xml', 'skills-lock.json', 'styles',
  'styles.css', 'support', 'terms', 'wrangler.toml', 'DESIGN.md', 'artifacts',
].map((name) => name.toLowerCase()));

const outputArgumentIndex = process.argv.indexOf('--output-dir');
const outputArgument = outputArgumentIndex === -1 ? '' : process.argv[outputArgumentIndex + 1];
if (outputArgumentIndex !== -1 && !outputArgument) {
  throw new Error('Missing value for --output-dir');
}

const configuredOutput = outputArgument || process.env.PAGES_OUTPUT_DIR;
const output = configuredOutput
  ? path.resolve(root, configuredOutput)
  : (() => {
      assertSafeOutputPath(path.join(root, '.runtime', 'site-pending'));
      fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
      return fs.mkdtempSync(path.join(root, '.runtime', 'site-'));
    })();

if (configuredOutput && output !== root && !output.startsWith(`${root}${path.sep}`)) {
  throw new Error(`Build output must stay inside the repository: ${output}`);
}
if (output === root) throw new Error('Build output must be a child directory of the repository.');
assertSafeOutputPath(output);

if (configuredOutput) fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of ['index.html', 'app.js', 'styles.css', 'styles', 'assets', 'models', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'google96c42eb007c2a9a8.html', ...publicPageDirectories]) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
partitionKoreanItemIndex(output);
const htmlFiles = [path.join(output, 'index.html'), ...publicPageDirectories.map((page) => path.join(output, page, 'index.html'))];
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="((?:\.\.\/)?(?:models\/|styles\/|assets\/|app\.js|styles\.css|site\.webmanifest)[^"?]*)(?:\?[^\"]*)?"/g)) {
    const assetReference = match[1].split('#', 1)[0];
    const assetPath = path.resolve(path.dirname(htmlFile), assetReference);
    if (!assetPath.startsWith(`${output}${path.sep}`) || !fs.existsSync(assetPath)) throw new Error(`Missing build asset: ${match[1]} referenced by ${path.relative(output, htmlFile)}`);
  }
}
console.log(`Verified public site: ${output}`);

function assertSafeOutputPath(outputPath) {
  const relativePath = path.relative(root, outputPath);
  const parts = relativePath.split(path.sep).filter(Boolean);
  const rootEntry = parts[0]?.toLowerCase();
  const normalisedRelativePath = relativePath.split(path.sep).join('/').toLowerCase();
  if (!parts.length) throw new Error('Build output must not replace the repository root.');
  if (protectedOutputRoots.has(rootEntry)) {
    throw new Error(`Build output must not overlap repository source or metadata: ${outputPath}`);
  }
  const isDistOutput = normalisedRelativePath === 'dist' || normalisedRelativePath.startsWith('dist/');
  const isTemporaryOutput = /^\.runtime\/(?:site-[^/]+|pages-assets-check-[^/]+)(?:\/.*)?$/.test(normalisedRelativePath);
  if (!isDistOutput && !isTemporaryOutput) {
    throw new Error('Build output must target dist or a generated site directory under .runtime.');
  }

  let candidate = root;
  for (const part of parts) {
    candidate = path.join(candidate, part);
    let stat;
    try {
      stat = fs.lstatSync(candidate);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Build output must not pass through a symbolic link: ${candidate}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Build output path contains a non-directory entry: ${candidate}`);
    }
  }
}

function partitionKoreanItemIndex(buildRoot) {
  const sourcePath = path.join(buildRoot, 'assets', 'data', 'items-ko.json');
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing Korean item index: ${sourcePath}`);
  const records = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(records) || !records.length) throw new Error('Korean item index is empty.');
  const outputDirectory = path.dirname(sourcePath);
  for (const slot of koreanIndexSlots) {
    const slotRecords = records.filter((record) => record?.slot === slot);
    if (!slotRecords.length) throw new Error(`Korean item index has no records for slot: ${slot}`);
    fs.writeFileSync(path.join(outputDirectory, `items-ko-${slot}.json`), `${JSON.stringify(slotRecords)}\n`, 'utf8');
  }
  fs.rmSync(sourcePath, { force: true });
  console.log(`Partitioned ${records.length} Korean item records by equipment slot.`);
}
