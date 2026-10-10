import {chmod,mkdir,open,readFile,realpath,rename,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RESULTS=new Set(['correct','incorrect','partial','unknown']);
const ERRORS=new Set(['knowledge-gap','concept-gap','procedure-error','reading-comprehension','recall','careless-attention','unknown']);
const INDEPENDENCE=new Set(['independent','hinted','corrected','unknown']);
const BATCH_KEYS=new Set(['schemaVersion','intakeId','asOf','observations']);
const OBSERVATION_KEYS=new Set(['id','sourceId','assignmentId','questionId','subject','skill','studiedOn','addedOn','result','errorType','independence','confidence','responseSummary','teacherMarkSummary','note']);
const HISTORY_KEYS=new Set(['schemaVersion','updatedOn','observations','skills','practiceTargets']);

const text=value=>typeof value==='string'&&value.trim().length>0;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const score=result=>result==='correct'?1:result==='partial'?0.5:result==='incorrect'?0:null;
const eventDay=observation=>observation.studiedOn||observation.addedOn;
const round=value=>Math.round(value*100)/100;
function allowedKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+': expected object');
  const unknown=Object.keys(value).filter(key=>!allowed.has(key));
  if(unknown.length)throw new Error(label+': unknown field '+unknown[0]);
}
function unique(values,label){if(new Set(values).size!==values.length)throw new Error('Duplicate '+label);}
function average(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;}
function isInsideRepo(candidate,repoRoot=root){
  const resolved=path.resolve(candidate),relative=path.relative(path.resolve(repoRoot),resolved);
  return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
}
export function assertPrivatePath(candidate,label='Private learning file',repoRoot=root){
  if(isInsideRepo(candidate,repoRoot))throw new Error(label+' must stay outside the public ABVM repository.');
  return path.resolve(candidate);
}
// Resolve existing paths and ancestor symlinks before any private data read/write.
// Newly created target files still resolve through their physical parent directory.
async function physicalPath(candidate){
  let current=path.resolve(candidate),missing=[];
  while(true){
    try{return path.resolve(await realpath(current),...missing.reverse());}
    catch(error){
      if(error.code!=='ENOENT')throw error;
      const parent=path.dirname(current);
      if(parent===current)throw error;
      missing.push(path.basename(current));
      current=parent;
    }
  }
}
export async function assertPrivateRealPath(candidate,label='Private learning file',repoRoot=root){
  const lexical=assertPrivatePath(candidate,label,repoRoot);
  const [physical,publicRoot]=await Promise.all([physicalPath(lexical),physicalPath(repoRoot)]);
  if(isInsideRepo(physical,publicRoot))throw new Error(label+' must stay outside the public ABVM repository.');
  return physical;
}
export function validateObservation(observation,label='observation'){
  allowedKeys(observation,OBSERVATION_KEYS,label);
  for(const field of ['id','sourceId','subject','skill','addedOn'])if(!text(observation[field]))throw new Error(label+': invalid '+field);
  if(!day(observation.addedOn))throw new Error(label+': invalid addedOn');
  if(observation.studiedOn!==null&&observation.studiedOn!==undefined&&!day(observation.studiedOn))throw new Error(label+': invalid studiedOn');
  if(observation.studiedOn&&observation.studiedOn>observation.addedOn)throw new Error(label+': studiedOn cannot be after addedOn');
  if(!RESULTS.has(observation.result))throw new Error(label+': invalid result');
  if(!ERRORS.has(observation.errorType||'unknown'))throw new Error(label+': invalid errorType');
  if(!INDEPENDENCE.has(observation.independence||'unknown'))throw new Error(label+': invalid independence');
  if(observation.confidence!==undefined&&(!Number.isFinite(observation.confidence)||observation.confidence<0||observation.confidence>1))throw new Error(label+': invalid confidence');
  for(const field of ['assignmentId','questionId','responseSummary','teacherMarkSummary','note'])if(observation[field]!==undefined&&!text(observation[field]))throw new Error(label+': invalid '+field);
  return observation;
}
export function validateObservationBatch(batch){
  allowedKeys(batch,BATCH_KEYS,'learning batch');
  if(batch.schemaVersion!==1||!text(batch.intakeId)||!day(batch.asOf)||!Array.isArray(batch.observations))throw new Error('Unsupported learning batch');
  unique(batch.observations.map(item=>item.id),'observation IDs');
  batch.observations.forEach((item,index)=>{
    validateObservation(item,'observation '+index);
    if(item.addedOn>batch.asOf)throw new Error('observation '+index+': addedOn cannot be after batch asOf');
  });
  return {observations:batch.observations.length};
}
function skillKey(observation){return observation.subject+'\u0000'+observation.skill;}
// Rephotographing a worksheet does not constitute a second assessment.
// Assignment + question identify a reviewed item across different photo IDs.
// Older records without an assignment ID can still be checked within a photo.
const normalizeIdentity=value=>String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
function assessmentKey(item){
  if(!item.questionId)return null;
  return JSON.stringify([item.subject,item.skill,item.assignmentId?normalizeIdentity(item.assignmentId):null,item.assignmentId?null:item.sourceId,normalizeIdentity(item.questionId)]);
}
// Distinct photos of one worksheet are one body of work for mastery purposes.
function workKey(item){return item.assignmentId?normalizeIdentity(item.assignmentId):item.sourceId;}
function assertDistinctAssessments(observations){
  const seen=new Map();
  for(const item of observations){
    const key=assessmentKey(item);
    if(!key)continue;
    const prior=seen.get(key);
    if(prior&&prior!==item.id)throw new Error('Repeated assessment item: '+item.id+' duplicates '+prior+'. Consolidate rephotographed responses under the original observation ID.');
    seen.set(key,item.id);
  }
}
function skillSummary(observations,asOf){
  const groups=new Map();
  for(const observation of observations){
    const key=skillKey(observation);
    const group=groups.get(key)||[];
    group.push(observation);
    groups.set(key,group);
  }
  const summaries=[];
  for(const group of groups.values()){
    group.sort((a,b)=>eventDay(a).localeCompare(eventDay(b))||a.id.localeCompare(b.id));
    const scored=group.filter(item=>score(item.result)!==null);
    const recent=scored.slice(-5);
    const weights=recent.map((_,index)=>index+1);
    const weighted=recent.reduce((sum,item,index)=>sum+score(item.result)*weights[index],0);
    // Without verified dates, upload order has no educational time meaning.
    // Give all scored work equal weight rather than boosting re-uploaded sheets.
    const confidence=scored.some(item=>!item.studiedOn)
      ?round(average(scored.map(item=>score(item.result))))
      :weights.length?round(weighted/weights.reduce((a,b)=>a+b,0)):0;
    // Upload order cannot determine when undated worksheets were completed.
    // Only verified study dates participate in chronological mastery and trends.
    const datedScored=scored.filter(item=>item.studiedOn);
    const lastThree=datedScored.slice(-3);
    const mastery=lastThree.length===3&&lastThree.every(item=>item.result==='correct'&&(item.independence||'unknown')==='independent'&&item.studiedOn)
      &&new Set(lastThree.map(workKey)).size>=2
      &&new Set(lastThree.map(item=>item.studiedOn)).size>=2;
    let status='not-enough-evidence';
    if(scored.length>=2)status='learning';
    // Intake dates are not verified assessment dates; they cannot establish progress.
    const verifiedDates=new Set(datedScored.map(item=>item.studiedOn));
    if(datedScored.length>=3&&verifiedDates.size>=2&&average(datedScored.slice(-5).map(item=>score(item.result)))>=0.5)status='improving';
    if(mastery)status='mastered';
    let trend='insufficient-data';
    if(datedScored.length>=4&&new Set(datedScored.slice(-4).map(item=>item.studiedOn)).size>=2){
      const previous=average(datedScored.slice(-4,-2).map(item=>score(item.result)));
      const latest=average(datedScored.slice(-2).map(item=>score(item.result)));
      trend=latest-previous>0.2?'improving':previous-latest>0.2?'slipping':'steady';
    }
    const errors={};
    for(const item of scored)if(item.result!=='correct'){const type=item.errorType||'unknown';errors[type]=(errors[type]||0)+1;}
    const latest=group.at(-1);
    summaries.push({
      subject:latest.subject,
      skill:latest.skill,
      evidenceCount:group.length,
      scoredCount:scored.length,
      independentCorrect:scored.filter(item=>item.result==='correct'&&(item.independence||'unknown')==='independent').length,
      latestObservedOn:eventDay(latest),
      status,
      confidence,
      trend,
      commonErrorTypes:Object.entries(errors).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([type,count])=>({type,count}))
    });
  }
  summaries.sort((a,b)=>a.subject.localeCompare(b.subject)||a.skill.localeCompare(b.skill));
  return summaries;
}
function differenceInDays(later,earlier){
  return Math.floor((Date.parse(later+'T12:00:00Z')-Date.parse(earlier+'T12:00:00Z'))/86400000);
}
function practiceTargets(skills,observations,asOf){
  const latestVerified=new Map(),undatedErrors=new Map();
  for(const observation of observations){
    const key=skillKey(observation);
    if(observation.studiedOn)latestVerified.set(key,observation);
    else if(observation.result==='incorrect'||observation.result==='partial'){
      const previous=undatedErrors.get(key);
      if(!previous||observation.addedOn>previous)undatedErrors.set(key,observation.addedOn);
    }
  }
  return skills.map(skill=>{
    const key=skill.subject+'\u0000'+skill.skill;
    const latest=latestVerified.get(key);
    // Later verified mastery can close an older undated-review concern.
    // Same-day evidence or an undated photo uploaded after mastery stays held.
    const unresolvedUndated=undatedErrors.has(key)&&!(
      skill.status==='mastered'&&latest?.studiedOn>undatedErrors.get(key)
    );
    let priority=0,reason='monitor';
    if(latest?.result==='incorrect'){priority=100;reason='recent-miss';}
    else if(latest?.result==='partial'){priority=90;reason='recent-partial';}
    else if(unresolvedUndated){priority=80;reason='review-undated';}
    else if(skill.status==='learning'){priority=75;reason='learning';}
    else if(skill.status==='not-enough-evidence'){priority=60;reason='collect-more-evidence';}
    else if(skill.status==='improving'){priority=50;reason='reinforce';}
    else if(skill.status==='mastered'&&latest?.studiedOn&&differenceInDays(asOf,latest.studiedOn)>=14){priority=20;reason='retention-check';}
    return {...skill,priority,reason};
  }).filter(item=>item.priority>0).sort((a,b)=>b.priority-a.priority||a.subject.localeCompare(b.subject)||a.skill.localeCompare(b.skill))
    .slice(0,8).map(({subject,skill,priority,reason,status,confidence,trend})=>({subject,skill,priority,reason,status,confidence,trend}));
}
export function validateLearningHistory(history){
  allowedKeys(history,HISTORY_KEYS,'learning history');
  if(history.schemaVersion!==1||!Array.isArray(history.observations)||!Array.isArray(history.skills)||!Array.isArray(history.practiceTargets))throw new Error('Unsupported learning history');
  if(history.updatedOn!==null&&!day(history.updatedOn))throw new Error('Invalid learning history updatedOn');
  unique(history.observations.map(item=>item.id),'history observation IDs');
  history.observations.forEach((item,index)=>validateObservation(item,'history observation '+index));
  return {observations:history.observations.length,skills:history.skills.length,practiceTargets:history.practiceTargets.length};
}
export function mergeLearningHistory(current,batch){
  validateObservationBatch(batch);
  const history=current||{schemaVersion:1,updatedOn:null,observations:[],skills:[],practiceTargets:[]};
  validateLearningHistory(history);
  const merged=new Map(history.observations.map(item=>[item.id,structuredClone(item)]));
  for(const observation of batch.observations){
    const old=merged.get(observation.id);
    if(old&&JSON.stringify(old)!==JSON.stringify(observation))throw new Error('Observation ID collision: '+observation.id);
    if(!old)merged.set(observation.id,structuredClone(observation));
  }
  const observations=[...merged.values()].sort((a,b)=>eventDay(a).localeCompare(eventDay(b))||a.id.localeCompare(b.id));
  assertDistinctAssessments(observations);
  // Replaying an older photo batch must not rewind retention review or the ledger date.
  const asOf=history.updatedOn&&history.updatedOn>batch.asOf?history.updatedOn:batch.asOf;
  const skills=skillSummary(observations,asOf);
  const next={schemaVersion:1,updatedOn:asOf,observations,skills,practiceTargets:practiceTargets(skills,observations,asOf)};
  validateLearningHistory(next);
  return next;
}
export async function integrateLearningHistory(historyPath,batchPath,{write=false,repoRoot=root}={}){
  const target=await assertPrivateRealPath(historyPath,'Learning history',repoRoot);
  const batchFile=await assertPrivateRealPath(batchPath,'Reviewed observation batch',repoRoot);
  const batch=JSON.parse(await readFile(batchFile,'utf8'));
  validateObservationBatch(batch);
  let lock,tmp,ownsTmp=false;
  try{
    // A writer must lock BEFORE reading the current ledger. Otherwise, two
    // independent intakes could compute against the same stale initial state.
    if(write){
      await mkdir(path.dirname(target),{recursive:true,mode:0o700});
      lock=await open(target+'.lock','wx',0o600);
    }
    let current=null;
    try{current=JSON.parse(await readFile(target,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    const next=mergeLearningHistory(current,batch);
    const changed=(current?JSON.stringify(current):null)!==JSON.stringify(next);
    if(write){
      if(changed){
        tmp=target+'.tmp-'+process.pid;
        await writeFile(tmp,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
        ownsTmp=true;
        await rename(tmp,target);
        ownsTmp=false;
      }else if(current&&process.platform!=='win32'){
        // Replays also repair old 0644 permissions without modifying evidence.
        await chmod(target,0o600);
      }
    }
    return {mode:write?'write':'dry-run',changed,observations:next.observations.length,skills:next.skills.length,practiceTargets:next.practiceTargets.length,updatedOn:next.updatedOn};
  }finally{
    // Clean a failed temporary replacement before another writer takes the lock.
    if(ownsTmp&&tmp)await unlink(tmp).catch(()=>{});
    if(lock){await lock.close();await unlink(target+'.lock').catch(()=>{});}
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),write=args.includes('--write'),paths=args.filter(arg=>arg!=='--write');
  try{
    if(paths.length!==2)throw new Error('Usage: node scripts/learning-history.mjs /private/path/history.json /private/path/reviewed-observations.json [--write]');
    console.log(JSON.stringify(await integrateLearningHistory(paths[0],paths[1],{write})));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
