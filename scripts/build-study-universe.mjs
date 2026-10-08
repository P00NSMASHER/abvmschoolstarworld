import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {schoolDay,weekBounds} from '../pages/study-model.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {validateSchoolwork} from './validate-schoolwork.mjs';

const normalize=v=>v.normalize('NFKC').replace(/\s+/g,' ').trim();
const key=v=>normalize(v).toLowerCase();
const slug=v=>key(v).replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const text=(v,label)=>{if(typeof v!=='string'||!normalize(v))throw new Error(`Invalid ${label}`);return normalize(v);};
const privateKey=/^(?:learnerResponses?|teacherMarks?|studentName|studentId|privateHistory|targetingReasons?|grades?|marks|rawPhotos?|ocrDump|email)$/i;
function privacyCheck(value){
  if(!value||typeof value!=='object')return;
  for(const [k,v] of Object.entries(value)){
    if(privateKey.test(k))throw new Error(`Private field ${k} is forbidden`);
    if(typeof v==='string'&&/^data:image\//i.test(v))throw new Error('Raw image data is forbidden');
    privacyCheck(v);
  }
}
function schoolDate(value,year){
  if(typeof value!=='string')return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value?value:null;
  const match=value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})\b/i);
  if(!match)return null;
  const month={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11}[match[1].toLowerCase()];
  const d=new Date(Date.UTC(year,month,Number(match[2]),12));
  return d.getUTCMonth()===month&&d.getUTCDate()===Number(match[2])?d.toISOString().slice(0,10):null;
}
function checkedQuestion(row,tier,provenance){
  privacyCheck(row);
  const out=Object.fromEntries(['id','subject','skill','prompt','answer','explanation','sourceFact'].map(f=>[f,text(row?.[f],f)]));
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(out.id))throw new Error('Invalid question ID');
  if(!Array.isArray(row.choices)||row.choices.length<2||row.choices.length>4)throw new Error(`Question ${out.id} has invalid choices`);
  const choices=row.choices.map(c=>text(c,'choice'));
  if(new Set(choices).size!==choices.length)throw new Error(`Question ${out.id} has duplicate choices`);
  if(choices.filter(c=>c===out.answer).length!==1)throw new Error(`Question ${out.id} answer is not exactly one choice`);
  for(const [f,max] of [['difficulty',5],['dok',4]])if(row[f]!==undefined&&(!Number.isInteger(row[f])||row[f]<1||row[f]>max))throw new Error(`Invalid ${f}`);
  if(row.richContent||row.image||row.media||row.passage)throw new Error('Rich questions need a reviewed text adapter before export');
  return {...out,choices,hint:row.hint===undefined?'Read the question again and look for a helpful clue.':text(row.hint,'hint'),
    questionType:row.questionType===undefined?'practice':text(row.questionType,'questionType'),difficulty:row.difficulty??2,dok:row.dok??1,tier,provenance};
}
function unique(rows){
  const ids=new Map(),prompts=new Map(),seen=new Set();
  return rows.filter(q=>{
    const signature=JSON.stringify([q.subject,q.skill,q.prompt,q.answer,[...q.choices].sort(compare)]);
    if(ids.has(q.id)&&ids.get(q.id)!==signature)throw new Error(`Conflicting question ID ${q.id}`);
    ids.set(q.id,signature);
    const prompt=key(q.subject)+'\0'+key(q.prompt);
    if(prompts.has(prompt)&&prompts.get(prompt)!==q.answer)throw new Error(`Conflicting answer for ${q.id}`);
    prompts.set(prompt,q.answer);
    const fingerprint=prompt+'\0'+q.answer;
    if(seen.has(fingerprint))return false;seen.add(fingerprint);return true;
  });
}
function roundRobin(rows){
  const subjects=[...new Set(rows.map(q=>q.subject))].sort(compare);
  const pools=subjects.map(s=>rows.filter(q=>q.subject===s)),out=[];
  while(pools.some(p=>p.length))for(const pool of pools)if(pool.length)out.push(pool.shift());
  return out;
}
// Reuse the web app's test boundaries. Tighten operation scope and support the
// teacher's Ch. spelling; never infer a chapter from unrelated religion topics.
function forTest(test,rows){
  const label=test.label.replace(/\bCh\.?\s*(\d+)/gi,'Chapter $1');
  let matched=questionsForTest({...test,label},rows);
  if(/\bmath\b/i.test(label)&&/subtraction|addition/i.test(label)){
    const operation=/subtraction/i.test(label)?'subtraction':'addition';
    matched=matched.filter(q=>q.skill.includes(operation));
  }
  // Incomplete teacher spelling scope must remain unavailable, not all spelling.
  if(/spelling/i.test(label)&&/short\s*\)/i.test(label))return [];
  return matched.filter(q=>q.tier!=='star-fallback');
}
export function buildStudyUniverse({pack:wrapper,archive={},fallbackQuestions=[],schoolwork}={}){
  const pack=wrapper?.pack||wrapper;
  if(pack?.sourceSufficient!==true||pack?.contentPipeline?.qa?.status!=='pass')throw new Error('A source-sufficient, QA-passed study pack is required');
  const generatedAt=text(pack.generatedAt||pack.sourceCapturedAt,'generatedAt');
  if(!Number.isFinite(Date.parse(generatedAt)))throw new Error('Invalid generatedAt');
  const asOfDay=schoolDay(generatedAt),year=Number(asOfDay.slice(0,4)),sourceHash=text(pack.sourceHash,'sourceHash');
  const current=(pack.contentPipeline.questions||[]).map(row=>{
    const l=row.sourceLineage;
    if(l?.quality!=='page-exact'||!/^https:\/\/sites\.google\.com\//.test(l.sourceUrl||'')||!/^\w{64}$/.test(l.sourceCaptureHash||'')||!/^sha256:[a-f0-9]{64}$/.test(l.evidenceExcerptHash||''))throw new Error(`Missing governed lineage for ${row.id}`);
    return checkedQuestion(row,'current',{kind:'teacher-page',sourceHash,captureHash:l.sourceCaptureHash,evidenceHash:l.evidenceExcerptHash,sourceUrl:l.sourceUrl});
  });
  const archiveRows=(archive.questions||[]).filter(row=>!row.firstSeenAt||schoolDay(row.firstSeenAt)<=asOfDay).map(row=>{
    const hashes=[...new Set((row.provenance||[]).filter(p=>typeof p.capturedAt==='string'&&p.capturedAt<=asOfDay).map(p=>archive.sources?.[p.sourceRef]?.sourceHash).filter(h=>typeof h==='string'&&h))].sort(compare);
    if(!hashes.length)throw new Error(`Missing reviewed archive provenance for ${row.id}`);
    return checkedQuestion(row,'archive',{kind:'reviewed-archive',sourceHashes:hashes});
  });
  const workRows=[];
  if(schoolwork){
    validateSchoolwork(schoolwork,{requireManifest:true});
    const {start,end}=weekBounds(generatedAt);
    for(const lesson of schoolwork.lessons){
      if(lesson.studiedOn&&lesson.studiedOn>asOfDay)continue;
      const tier=lesson.studiedOn&&lesson.studiedOn>=start&&lesson.studiedOn<=end?'current':'archive';
      for(const row of lesson.questions)workRows.push(checkedQuestion(row,tier,{kind:'reviewed-original-schoolwork',lessonId:lesson.id}));
    }
  }
  const fallback=fallbackQuestions.map(row=>{
    if(!/^original-star-\d+$/.test(row.id||'')||row.tier!=='star-fallback'||row.sourceFact!=='Original Grade 2 STAR-style practice')throw new Error('Only original STAR-style fallback is accepted');
    return checkedQuestion(row,'star-fallback',{kind:'original-star-style'});
  });
  // Validate collisions before any deduplication. A repeated ID cannot overwrite
  // the correct key while references still point to its earlier version.
  unique([...current,...workRows,...archiveRows,...fallback]);
  const questions=unique([
    ...[...current,...workRows.filter(q=>q.tier==='current')].sort((a,b)=>compare(a.id,b.id)||compare(digest(a),digest(b))),
    ...[...archiveRows,...workRows.filter(q=>q.tier==='archive')].sort((a,b)=>compare(a.id,b.id)||compare(digest(a),digest(b))),
    ...fallback.sort((a,b)=>compare(a.id,b.id)||compare(digest(a),digest(b))),
  ]);
  if(!questions.length)throw new Error('Reviewed questions are required');
  const subjects=[...new Set(questions.map(q=>q.subject))].sort(compare);
  const practice=Object.fromEntries(subjects.map(s=>[s,questions.filter(q=>q.subject===s).map(q=>q.id)]));
  const seenTests=new Set();
  const tests=(pack.importantDates||[]).filter(t=>t.kind==='test').map(t=>({label:text(t.label,'test label'),date:schoolDate(t.date,year),source:typeof t.source==='string'?text(t.source,'test source'):'governed-school-source'}))
    .filter(t=>t.date&&t.date>=asOfDay).sort((a,b)=>compare(a.date,b.date)||compare(a.label,b.label))
    .filter(t=>{const id=t.date+'|'+t.label;if(seenTests.has(id))return false;seenTests.add(id);return true;});
  const selectableTestPrep=tests.map(t=>{
    const questionIds=forTest(t,questions).map(q=>q.id);
    return {id:`test-${t.date}-${slug(t.label)}`,date:t.date,label:t.label,source:t.source,questionIds,supported:questionIds.length>0,
      disclaimer:'Original reviewed skill practice; not hidden teacher-test content or official STAR items.'};
  });
  const printableGuides=subjects.map(subject=>({id:`guide-${slug(subject)}`,subject,title:`${subject} one-page study guide`,
    focusSkills:[...new Set(questions.filter(q=>q.subject===subject).map(q=>q.skill))].slice(0,6),questionIds:practice[subject].slice(0,6)}));
  const verticalScripts=subjects.map(subject=>({id:`vertical-${slug(subject)}`,subject,title:`60-second ${subject} practice`,format:'9:16 storyboard',
    beats:practice[subject].slice(0,3).map((id,index)=>{const q=questions.find(q=>q.id===id);return {seconds:['0-18','18-38','38-58'][index],prompt:q.prompt,pause:'Pause and choose an answer.',answer:q.answer,explanation:q.explanation};})}));
  const curriculumPackets=subjects.map(subject=>({id:`roblox-${slug(subject)}`,subject,questionIds:practice[subject],answerAuthority:'server-only',sourceOrder:['current','archive','star-fallback']}));
  const out={schemaVersion:2,contentOnly:true,generatedAt,schoolTimeZone:'America/New_York',source:{repository:'P00NSMASHER/abvmschoolstarworld',sourceHash,weekLabel:text(pack.weekLabel,'weekLabel')},
    policy:{priorityOrder:['current-school-material','cumulative-reviewed-material','original-star-style-fallback'],privateLearnerDataIncluded:false,officialStarItems:false,hiddenTeacherTestItemsClaimed:false},
    questions,currentSubjectPractice:practice,mixedReview:['current','archive','star-fallback'].flatMap(tier=>roundRobin(questions.filter(q=>q.tier===tier)).map(q=>q.id)),selectableTestPrep,printableGuides,verticalScripts,curriculumPackets};
  return {...out,contentSha256:digest(out)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,'pages/data',name),'utf8'));
  const {buildStarBank}=await import('../pages/star-practice.mjs');
  const out=buildStudyUniverse({pack:read('study-pack.json'),archive:read('study-archive.json'),schoolwork:read('schoolwork.json'),fallbackQuestions:buildStarBank()});
  const destination=path.resolve(process.argv[2]||path.join(root,'artifacts/study-universe.json'));
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({questions:out.questions.length,tests:out.selectableTestPrep.map(t=>({label:t.label,count:t.questionIds.length})),contentSha256:out.contentSha256}));
}
