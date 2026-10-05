import {readFile,writeFile,rename,unlink,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateSchoolwork,normalize} from './validate-schoolwork.mjs';

// Input must be a human/agent-reviewed, source-backed batch. This does not OCR images.
function content(lesson) {
  const {sources,addedOn,...rest}=lesson;
  return JSON.stringify(rest);
}
export function mergeSchoolwork(current,batch) {
  validateSchoolwork(current,{requireManifest:true});
  validateSchoolwork(batch,{requireManifest:true});
  const next=structuredClone(current);
  const manifest=new Map(next.sourceManifest.map(s=>[s.id,s]));
  for (const source of batch.sourceManifest) {
    const old=manifest.get(source.id);
    if (old) {
      const sameHash=old.sha256===source.sha256;
      const replayOfAutomaticDuplicate=sameHash&&old.status==='duplicate'&&old.reason==='Exact SHA-256 duplicate of an existing source.'&&source.status==='integrated';
      const resolveHeld=sameHash&&old.status==='held'&&(source.status==='integrated'||source.status==='duplicate');
      if (JSON.stringify(old)!==JSON.stringify(source) && !replayOfAutomaticDuplicate && !resolveHeld) throw new Error(`Source ID collision: ${source.id}; preserve the existing record or resolve a held source with the same ID and SHA-256.`);
      if(resolveHeld)manifest.set(source.id,structuredClone(source));
      continue;
    }
    const priorHash=[...manifest.values()].find(s=>s.sha256===source.sha256 && s.status==='integrated');
    const incoming=structuredClone(source);
    if(priorHash) {incoming.status='duplicate';incoming.duplicateOf=priorHash.id;incoming.reason='Exact SHA-256 duplicate of an existing source.';}
    manifest.set(incoming.id,incoming);
  }
  const lessons=new Map(next.lessons.map(l=>[l.id,l]));
  for (const lesson of batch.lessons) {
    const old=lessons.get(lesson.id);
    if (old) {
      if(content(old)!==content(lesson)) throw new Error(`Lesson ID collision: ${lesson.id}; review the existing lesson explicitly instead of overwriting cumulative history.`);
      old.sources=[...new Set([...old.sources,...lesson.sources])];
    } else {
      const semantic=[...lessons.values()].find(l=>normalize(l.title)===normalize(lesson.title) && normalize(l.subject)===normalize(lesson.subject) && l.studiedOn===lesson.studiedOn);
      if(semantic) throw new Error(`Potential duplicate lesson ${lesson.id} / ${semantic.id}; consolidate the reviewed batch first.`);
      lessons.set(lesson.id,structuredClone(lesson));
    }
  }
  next.lessons=[...lessons.values()];next.sourceManifest=[...manifest.values()];next.uploadedPhotoCount=next.sourceManifest.length;
  validateSchoolwork(next,{requireManifest:true});
  return next;
}
export async function integrateFile(target,batchPath,{write=false}={}) {
  const targetPath=resolve(target),lockPath=`${targetPath}.intake.lock`,tmpPath=`${targetPath}.intake-${process.pid}.tmp`;
  let lock, ownsTemporary = false;
  try {
    if(write)lock=await open(lockPath,'wx');
    const before=await readFile(targetPath,'utf8');
    const merged=mergeSchoolwork(JSON.parse(before),JSON.parse(await readFile(batchPath,'utf8')));
    const output=`${JSON.stringify(merged,null,2)}\n`;
    const changed=JSON.stringify(JSON.parse(before))!==JSON.stringify(merged);
    if(write && changed){
      await writeFile(tmpPath,output,{flag:'wx'}); ownsTemporary = true;
      if(await readFile(targetPath,'utf8')!==before)throw new Error('Schoolwork changed during intake; retry against the latest file.');
      await rename(tmpPath,targetPath);
    }
    return {mode:write?'write':'dry-run',changed,...validateSchoolwork(merged,{requireManifest:true})};
  } finally {
    if(lock){await lock.close();await unlink(lockPath);}
    if(ownsTemporary) await unlink(tmpPath).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),write=args.includes('--write'),paths=args.filter(a=>a!=='--write');
  try{
    if(paths.length!==2)throw new Error('Usage: node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json reviewed-batch.json [--write]');
    console.log(JSON.stringify(await integrateFile(paths[0],paths[1],{write})));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
