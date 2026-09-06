const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, '.runtime', 'site-'));
for (const entry of ['index.html', 'app.js', 'styles.css', 'styles', 'assets', 'functions', 'models']) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:models\/|styles\/|assets\/|app\.js|styles\.css)[^"?]*)(?:\?[^\"]*)?"/g)) {
  if (!fs.existsSync(path.join(output, match[1]))) throw new Error(`Missing build asset: ${match[1]}`);
}
console.log(`Verified public site: ${output}`);
