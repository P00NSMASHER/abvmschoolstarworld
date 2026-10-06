/** Apply the reviewed preparation only in the authorized implementation worktree.
 * Default is validation only. No network, Git ref changes, or publication.
 * Refuses changed input files rather than overwriting another producer's work.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
if(args.some(a=>!['--write','--check'].includes(a)))throw new Error('Usage: node apply.mjs [--check|--write] from the repository root');
const root=process.cwd(),dir=path.dirname(fileURLToPath(import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');
const single=path.join(dir,'bundle.json.gz.b64');
const encoded=fs.existsSync(single)?fs.readFileSync(single,'utf8').trim():[1,2,3,4,5].map(i=>fs.readFileSync(path.join(dir,`bundle.part${i}.b64`),'utf8').trim()).join('');
const data=gunzipSync(Buffer.from(encoded,'base64'));
if(sha(data)!=='bb0d77b7c0c7b7221f007be7785a6b0ce79c09b31eb90add9e0a6d8124c8e56d')throw new Error('Preparation payload checksum mismatch');
const bundle=JSON.parse(data);
const allowed=new Set(['pages/THIRD_PARTY_NOTICES.md','pages/app.js','pages/index.html','pages/study-games-materials.css','pages/styles.css','pages/sw.js','tests/visual-foundation.spec.mjs','tests/visual-foundation.test.mjs']);
if(bundle.changes.length!==allowed.size)throw new Error('Unexpected file set');
const seen=new Set();
const pending=bundle.changes.map(change=>{
  if(!allowed.has(change.path)||seen.has(change.path))throw new Error('Unexpected or duplicate path');seen.add(change.path);
  const target=path.join(root,change.path),exists=fs.existsSync(target);
  if(exists&&fs.lstatSync(target).isSymbolicLink())throw new Error('Refusing symlink target');
  const original=exists?fs.readFileSync(target):null;
  if((original===null?null:sha(original))!==change.before_sha256)throw new Error('Input changed: '+change.path+'. Reconcile with the accepted release; do not force.');
  let next=original?.toString('utf8')??'';
  if(change.operation==='write')next=change.text;
  else if(change.operation==='append')next+=change.text;
  else if(change.operation==='replace')for(const [before,after] of change.pairs){
    if(!next.includes(before))throw new Error('Missing replacement input in '+change.path);
    next=next.split(before).join(after);
  }
  else if(change.operation==='unlock_game_layout')next=next.replace(/([^{}]+)\{([^{}]*)\}/g,(whole,selector,body)=>{
    if(!/\.study-game-(?:grid|tile)(?![\w-])/.test(selector))return whole;
    return selector+'{'+body.replace(/((?:min-height|grid-template-columns|grid-template-rows)\s*:[^;{}]*?)\s*!important/g,'$1')+'}';
  });
  else throw new Error('Unknown transformation');
  const output=Buffer.from(next);
  if(sha(output)!==change.after_sha256)throw new Error('Output checksum mismatch: '+change.path);
  return {path:change.path,target,original,output};
});
if(args.includes('--write')){
  const written=[];
  try{
    for(const file of pending){fs.mkdirSync(path.dirname(file.target),{recursive:true});fs.writeFileSync(file.target,file.output);written.push(file)}
  }catch(error){for(const file of written.reverse()){if(file.original===null)fs.rmSync(file.target,{force:true});else fs.writeFileSync(file.target,file.original)}throw error}
}
console.log(JSON.stringify({mode:args.includes('--write')?'APPLIED':'CHECK_ONLY',base_head:bundle.base_head,files:pending.map(file=>file.path),status:'SOURCE_CHECKSUMS_PASS',next:'Run static/unit/full browser QA and independent review on the accepted integration head; this is not release approval.'},null,2));
