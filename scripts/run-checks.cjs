const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const files=fs.readdirSync(__dirname).filter(name=>/^check-.*\.cjs$/.test(name)&&name!=='check-title-halo.cjs');
files.push('audit-contrast.cjs');
let next=0;const results=[];
async function worker(){while(next<files.length){const file=files[next++];await new Promise(resolve=>{
 const child=spawn(process.execPath,[path.join(__dirname,file)],{env:process.env});let output='';
 child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 child.on('close',code=>{results.push({file,code,output});console.log(`${code===0?'PASS':'FAIL'} ${file}`);if(code!==0)console.log(output);resolve()});
})}}
Promise.all(Array.from({length:4},worker)).then(()=>{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/check-results.json',JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.code===0).length}/${results.length} passed`);process.exitCode=results.some(r=>r.code!==0)?1:0});
