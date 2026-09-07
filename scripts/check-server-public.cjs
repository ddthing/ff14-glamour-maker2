const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {stopChild}=require('./test-process.cjs');
(async()=>{
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'4197',HOST:'127.0.0.1'}});
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),5000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve()})});
  for(const file of ['/', '/styles/editor-controls.css', '/models/look-editor.js', '/models/look-book.js', '/models/image-assets.js', '/models/item-search.js', '/models/card-layout.js', '/models/color-contrast.js', '/models/card-png.js', '/models/editor-navigation.js', '/models/background-presets.js', '/models/title-typography.js', '/models/background-removal.js','/assets/icons/equipment.svg']) assert.equal((await fetch(`http://127.0.0.1:4197${file}`)).status,200,file);
  for(const file of ['/server.js','/package.json','/scripts/check-server-public.cjs']) assert.equal((await fetch(`http://127.0.0.1:4197${file}`)).status,404,file);
  assert.equal((await fetch('http://127.0.0.1:4197/%ZZ')).status,400);
  assert.equal((await fetch('http://127.0.0.1:4197/')).status,200);
  const itemResponse = await fetch(`http://127.0.0.1:4197/api/items/search?q=${encodeURIComponent('구식')}&slot=head&language=ko`);
  assert.equal(itemResponse.status, 200, 'Korean item search should use the bundled snapshot');
  const itemPayload = await itemResponse.json();
  assert.ok(itemPayload.results.length > 0, 'Korean item search returned no snapshot records');
  assert.match(itemPayload.results[0].iconUrl, /^https:\/\/xivapi\.com\/i\/\d+\/\d+\.png$/, 'Korean search results must carry a real XIVAPI icon URL');
  console.log('PASS: public file allowlist, malformed URL recovery, required assets, and real item icon metadata.');
 } finally {await stopChild(child);}
})().catch(error=>{console.error(error);process.exitCode=1});
