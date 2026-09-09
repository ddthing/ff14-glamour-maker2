const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {stopChild}=require('./test-process.cjs');
(async()=>{
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4197',HOST:'127.0.0.1'}});
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),5000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve()})});
  for(const file of ['/', '/styles/editor-controls.css', '/models/look-editor.js', '/models/look-book.js', '/models/image-assets.js', '/models/image-validation.js', '/models/draft-storage.js', '/models/i18n.js', '/models/item-records.js', '/models/item-search.js', '/models/card-layout.js', '/models/card-copy.js', '/models/color-contrast.js', '/models/card-png.js', '/models/editor-navigation.js', '/models/title-typography.js', '/models/background-removal.js','/assets/icons/equipment.svg', '/assets/icons/ui.svg', '/google96c42eb007c2a9a8.html']) assert.equal((await fetch(`http://127.0.0.1:4197${file}`)).status,200,file);
  const verificationBody = await (await fetch('http://127.0.0.1:4197/google96c42eb007c2a9a8.html')).text();
  assert.equal(verificationBody.trimEnd(), 'google-site-verification: google96c42eb007c2a9a8.html', 'Google Search Console verification content must remain exact');
  assert.equal((await fetch('http://127.0.0.1:4197/favicon.svg')).status,404,'the rejected favicon must not be served');
  for(const file of ['/server.js','/package.json','/scripts/check-server-public.cjs']) assert.equal((await fetch(`http://127.0.0.1:4197${file}`)).status,404,file);
  for(const file of ['/terms/','/privacy/','/guide/','/contact/','/support/']) {
    const response = await fetch(`http://127.0.0.1:4197${file}`);
    assert.equal(response.status,200,file);
    assert.match(response.headers.get('content-type') || '',/text\/html/,file);
    assert.match(await response.text(),/data-public-page=/,file);
  }
  assert.equal((await fetch('http://127.0.0.1:4197/%ZZ')).status,400);
  assert.equal((await fetch('http://127.0.0.1:4197/')).status,200);
  const itemResponse = await fetch(`http://127.0.0.1:4197/api/items/search?q=${encodeURIComponent('구식')}&slot=head&language=ko`);
  assert.equal(itemResponse.status, 200, 'Korean item search should use the bundled snapshot');
  const itemPayload = await itemResponse.json();
  assert.ok(itemPayload.results.length > 0, 'Korean item search returned no snapshot records');
  assert.equal(itemPayload.source, 'ffxiv-ko-snapshot', 'local search should use the shared snapshot adapter contract');
  assert.match(itemPayload.results[0].iconUrl, /^https:\/\/xivapi\.com\/i\/\d+\/\d+\.png$/, 'Korean search results must carry a real XIVAPI icon URL');
  assert.equal(itemPayload.results[0].meta.ko.startsWith('머리'), true, 'shared item metadata should include the normalized slot label');
  const costumeResponse = await fetch(`http://127.0.0.1:4197/api/items/search?q=${encodeURIComponent('아기돼지 의상')}&slot=body&language=ko`);
  assert.equal((await costumeResponse.json()).results[0]?.id, '15479', 'special body costume categories must survive local snapshot search');
  const spellingResponse = await fetch(`http://127.0.0.1:4197/api/items/search?q=${encodeURIComponent('송아지 가죽 라이더 자켓')}&slot=body&language=ko`);
  assert.equal((await spellingResponse.json()).results[0]?.id, '32799', 'local search should preserve shared Korean spelling normalization');
  console.log('PASS: public file allowlist, malformed URL recovery, required assets, and real item icon metadata.');
 } finally {await stopChild(child);}
})().catch(error=>{console.error(error);process.exitCode=1});
