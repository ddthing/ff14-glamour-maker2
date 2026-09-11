const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const koreanIndexSlots = ['head', 'body', 'hands', 'legs', 'feet', 'weapon'];
const publicPageDirectories = ['terms', 'privacy', 'guide', 'contact', 'support'];

const outputArgumentIndex = process.argv.indexOf('--output-dir');
const outputArgument = outputArgumentIndex === -1 ? '' : process.argv[outputArgumentIndex + 1];
if (outputArgumentIndex !== -1 && !outputArgument) {
  throw new Error('Missing value for --output-dir');
}

const configuredOutput = outputArgument || process.env.PAGES_OUTPUT_DIR;
const output = configuredOutput
  ? path.resolve(root, configuredOutput)
  : (() => {
      fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
      return fs.mkdtempSync(path.join(root, '.runtime', 'site-'));
    })();

if (configuredOutput && output !== root && !output.startsWith(`${root}${path.sep}`)) {
  throw new Error(`Build output must stay inside the repository: ${output}`);
}
if (output === root) throw new Error('Build output must be a child directory of the repository.');

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
