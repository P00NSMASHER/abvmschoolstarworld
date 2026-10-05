import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {weekBounds,schoolDay} from '../pages/study-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const normalize=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0,20);
const questionFields = ['id','subject','skill','assessedSkillIds','prompt','choices','answer','explanation','hint','sourceFact','difficulty','questionType','richContent','passage','image','media','chapter','sourceUrl'];
function compactQuestion(q) { return Object.fromEntries(questionFields.filter(k=>q[k]!==undefined).map(k=>[k,q[k]])); }
function compactProvenance(entries) {
  const weeks=new Map();
  for(const p of entries){const key=weekBounds(p.capturedAt).start;const group=weeks.get(key)||[];group.push(p);weeks.set(key,group);}
  return [...weeks.values()].flatMap(group=>{group.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));return group.length===1?[group[0]]:[group[0],group.at(-1)];});
}
export function mergeStudyPack(archive,wrapper,{commit,capturedAt}={}) {
  const pack=wrapper.pack||wrapper;
  const at=capturedAt||pack.sourceCapturedAt||pack.generatedAt||wrapper.sourceCapturedAt;
  if(!at||!Number.isFinite(Date.parse(at))) return archive;
  const stamp=new Date(at).toISOString();
  archive.sources ||= {};
  const source={sourceHash:pack.sourceHash||'unknown',weekLabel:pack.weekLabel||'',...(commit?{commit}:{})};
  const sourceRef=hash([source.sourceHash,source.weekLabel]).slice(0,10);archive.sources[sourceRef] ||= source;
  const provenance={sourceRef,capturedAt:schoolDay(stamp)};
  function merge(kind,entry,key){
    const id=`archive-${hash([kind,...key])}`,items=archive[kind];let old=items.find(x=>(x.archiveId||x.id)===id);
    if(!old){old={...entry,...(kind==='questions'?{archiveId:id}:{id}),firstSeenAt:stamp,lastSeenAt:stamp,provenance:[]};items.push(old);}
    old.firstSeenAt=old.firstSeenAt<stamp?old.firstSeenAt:stamp;old.lastSeenAt=old.lastSeenAt>stamp?old.lastSeenAt:stamp;
    if(!old.provenance.some(p=>p.sourceRef===provenance.sourceRef&&p.capturedAt===provenance.capturedAt))old.provenance.push(provenance);
    old.provenance=compactProvenance(old.provenance);
  }
  for(const s of pack.subjects||[])for(const [field,kind] of [['studyNotes','note'],['topics','topic']])for(const text of s[field]||[])if(normalize(text))merge('notes',{subject:s.subject,kind,text:normalize(text)},[s.subject,kind,normalize(text).toLowerCase()]);
  for(const v of pack.vocabulary||[])if(normalize(v.term))merge('vocabulary',{...v},[v.subject,normalize(v.term).toLowerCase(),normalize(v.meaning).toLowerCase()]);
  // Only accept the reviewed pipeline, never raw/generated candidates.
  if(pack.contentPipeline?.qa?.status==='pass')for(const q of pack.contentPipeline.questions||[]){
    if(!q.prompt||!q.answer||!Array.isArray(q.choices)||!q.choices.includes(q.answer)||new Set(q.choices).size!==q.choices.length)continue;
    merge('questions',compactQuestion(q),[q.subject,normalize(q.prompt).toLowerCase(),normalize(q.answer).toLowerCase()]);
  }
  return archive;
}
export async function rebuildStudyArchive({history=false,repoRoot=root}={}) {
  const target=path.join(repoRoot,'pages/data/study-archive.json');let archive;
  try{archive=JSON.parse(await readFile(target,'utf8'));}catch{archive=null;}
  if(history||!archive?.historyBootstrapped){
    archive={schemaVersion:1,historyBootstrapped:false,notes:[],vocabulary:[],questions:[]};
    const commits=execFileSync('git',['log','--reverse','--format=%H','HEAD','--','pages/data/study-pack.json'],{cwd:repoRoot,encoding:'utf8'}).trim().split('\n').filter(Boolean);
    let snapshots=0;
    for(const commit of commits){let text;try{text=execFileSync('git',['show',`${commit}:pages/data/study-pack.json`],{cwd:repoRoot,encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});}catch{continue;}
      try{mergeStudyPack(archive,JSON.parse(text),{commit});snapshots++;}catch(error){throw new Error(`Invalid historical study pack ${commit}: ${error.message}`);}}
    archive.historyBootstrapped=true;archive.historySnapshots=snapshots;
  }
  const wrapper=JSON.parse(await readFile(path.join(repoRoot,'pages/data/study-pack.json'),'utf8'));
  mergeStudyPack(archive,wrapper);
  archive.generatedAt=wrapper.pack?.generatedAt||wrapper.sourceCapturedAt||new Date().toISOString();
  for(const key of ['notes','vocabulary','questions'])archive[key].sort((a,b)=>a.firstSeenAt.localeCompare(b.firstSeenAt)||(a.archiveId||a.id).localeCompare(b.archiveId||b.id));
  // Existing archives are migrated on normal builds without a full history scan.
  archive.sources ||= {};
  for(const kind of ['notes','vocabulary','questions'])for(const item of archive[kind])item.provenance=item.provenance.map(p=>{
    if(p.sourceRef)return {...p,capturedAt:schoolDay(p.capturedAt)};
    const {capturedAt,...source}=p,sourceRef=hash(source).slice(0,10);archive.sources[sourceRef]=source;
    return {sourceRef,capturedAt:schoolDay(capturedAt)};
  });
  const used=new Set(['notes','vocabulary','questions'].flatMap(kind=>archive[kind].flatMap(item=>compactProvenance(item.provenance).map(p=>p.sourceRef))));
  archive.sources=Object.fromEntries(Object.entries(archive.sources).filter(([id])=>used.has(id)));
  archive.questions=archive.questions.map(q=>({...compactQuestion(q),archiveId:q.archiveId,firstSeenAt:q.firstSeenAt,lastSeenAt:q.lastSeenAt,provenance:compactProvenance(q.provenance)}));
  for(const kind of ['notes','vocabulary'])for(const item of archive[kind])item.provenance=compactProvenance(item.provenance);
  await writeFile(target,JSON.stringify(archive)+'\n');return archive;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const a=await rebuildStudyArchive({history:process.argv.includes('--history')});
  console.log(`Study archive: ${a.notes.length} notes/topics, ${a.vocabulary.length} vocabulary, ${a.questions.length} reviewed questions (${a.historySnapshots} historical snapshots).`);
}
