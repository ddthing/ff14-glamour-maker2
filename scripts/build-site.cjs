const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

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

if (configuredOutput) fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of ['index.html', 'app.js', 'styles.css', 'styles', 'assets', 'functions', 'models', 'robots.txt', 'sitemap.xml']) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:models\/|styles\/|assets\/|app\.js|styles\.css)[^"?]*)(?:\?[^\"]*)?"/g)) {
  if (!fs.existsSync(path.join(output, match[1]))) throw new Error(`Missing build asset: ${match[1]}`);
}
console.log(`Verified public site: ${output}`);
