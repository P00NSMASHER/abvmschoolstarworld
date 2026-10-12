import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateSchoolwork,isDate} from './validate-schoolwork.mjs';
import {assertPrivateRealPath} from './learning-history.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Schoolwork intake dates are New York calendar days, not UTC dates.
export function newYorkSchoolDay(instant=new Date()){
  const parts=Object.fromEntries(
    new Intl.DateTimeFormat('en-US',{
      timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(instant)
      .filter(part=>['year','month','day'].includes(part.type))
      .map(part=>[part.type,part.value])
  );
  return parts.year+'-'+parts.month+'-'+parts.day;
}

const CHECKS=[
  'originalPhotoInspected',
  'printedWorkCompared',
  'originalPracticeAnswersChecked',
  'childPrivacyReviewed',
  'sourceRightsReviewed'
];
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const compare=(a,b)=>a<b?-1:a>b?1:0;
function assertShape(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+': expected object');
  for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(label+': unknown field '+key);
}
function stableJson(value){
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort(compare)
      .map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
const sha=value=>createHash('sha256').update(value).digest('hex');

// This checklist is a record-binding aid, not a review certificate.
// Preserve all of the educational content in the fingerprint, but never
// print its answers, wording, child data or raw photo bytes.
export function buildSchoolworkPhotoChecklist(pack){
  const totals=validateSchoolwork(pack,{requireManifest:true});
  const entries=pack.sourceManifest.map(source=>{
    const lessons=pack.lessons.filter(lesson=>lesson.sources.includes(source.id))
      .sort((a,b)=>compare(a.id,b.id));
    return {
      sourceId:source.id,
      status:source.status,
      duplicateOf:source.duplicateOf||null,
      expectedPhotoSha256:source.sha256,
      lessonContentSha256:sha(stableJson({source,lessons})),
      lessonIds:lessons.map(lesson=>lesson.id),
      questionIds:[...new Set(lessons.flatMap(lesson=>lesson.questions.map(question=>question.id)))].sort(compare),
      lastLessonIntakeOn:lessons.length
        ?lessons.map(lesson=>lesson.addedOn).sort(compare).at(-1):null
    };
  }).sort((a,b)=>compare(a.sourceId,b.sourceId));
  return {
    schemaVersion:1,totals,entries,
    humanReviewIsRequired:true,
    releaseStatus:'HOLD_EXTERNAL_SIGNOFF'
  };
}

// The blank template is *not* evidence of review. It must only be saved
// outside the public repository and populated after real human examination.
export function buildPrivatePhotoReviewTemplate(pack){
  const checklist=buildSchoolworkPhotoChecklist(pack);
  return {schemaVersion:1,receipts:checklist.entries
    .filter(entry=>entry.status!=='held').map(entry=>({
      sourceId:entry.sourceId,
      expectedPhotoSha256:entry.expectedPhotoSha256,
      lessonContentSha256:entry.lessonContentSha256,
      reviewedOn:null,
      reviewerId:null,
      checks:Object.fromEntries(CHECKS.map(check=>[check,false]))
    }))};
}
function checkReceipts(book,checklist){
  assertShape(book,['schemaVersion','receipts'],'private review receipt book');
  if(book.schemaVersion!==1||!Array.isArray(book.receipts))throw new Error('Unsupported photo-review receipt book');
  const allowed=new Set(checklist.entries.filter(entry=>entry.status!=='held').map(entry=>entry.sourceId));
  const out=new Map();
  for(const receipt of book.receipts){
    assertShape(receipt,['sourceId','expectedPhotoSha256','lessonContentSha256','reviewedOn','reviewerId','checks'],'photo-review receipt');
    if(!nonempty(receipt.sourceId)||!allowed.has(receipt.sourceId))throw new Error('Receipt references unknown or held source');
    if(out.has(receipt.sourceId))throw new Error('Duplicate source review receipt');
    if(!hex(receipt.expectedPhotoSha256)||!hex(receipt.lessonContentSha256))throw new Error('Invalid photo-review evidence digest');
    if(receipt.reviewedOn!==null&&!isDate(receipt.reviewedOn))throw new Error('Invalid photo-review date');
    if(receipt.reviewerId!==null&&!nonempty(receipt.reviewerId))throw new Error('Invalid private reviewer identifier');
    assertShape(receipt.checks,CHECKS,'photo-review checklist');
    if(CHECKS.some(check=>typeof receipt.checks[check]!=='boolean'))throw new Error('Incomplete photo-review checklist schema');
    out.set(receipt.sourceId,receipt);
  }
  return out;
}
async function shaFile(file){
  const digest=createHash('sha256');
  for await (const chunk of createReadStream(file))digest.update(chunk);
  return digest.digest('hex');
}
async function checkPrivatePhoto(directory,sourceId){
  // Public source IDs are metadata, not trusted filesystem paths.
  if(sourceId==='.'||sourceId==='..'||!/^[A-Za-z0-9_.-]+$/.test(sourceId)){
    throw new Error('Unsafe source photo identifier');
  }
  const candidate=path.resolve(directory,sourceId);
  if(path.dirname(candidate)!==directory)throw new Error('Source photo escaped its private directory');
  try{
    const info=await lstat(candidate);
    if(!info.isFile()||info.isSymbolicLink())return {status:'UNSAFE_PHOTO_FILE'};
    return {status:'PHOTO_READ',sha256:await shaFile(candidate)};
  }catch(error){
    if(error.code==='ENOENT')return {status:'PHOTO_FILE_MISSING'};
    throw error;
  }
}

// Reads real photographs only from an explicitly supplied private directory.
// All output is metadata-only. No checks can sign off a production release.
export async function verifySchoolworkPhotoReviews(pack,photoDirectory,receiptPath,{repoRoot=root,asOfDay=newYorkSchoolDay()}={}){
  if(!isDate(asOfDay))throw new Error('Invalid verification date');
  const checklist=buildSchoolworkPhotoChecklist(pack);
  const photos=await assertPrivateRealPath(photoDirectory,'Private source photo directory',repoRoot);
  const privateReceipts=await assertPrivateRealPath(receiptPath,'Private review receipt book',repoRoot);
  if(!(await stat(photos)).isDirectory())throw new Error('Private photo directory must be a directory');
  const receipts=checkReceipts(JSON.parse(await readFile(privateReceipts,'utf8')),checklist);
  const sources=[];
  for(const entry of checklist.entries){
    let status='SOURCE_HELD';
    if(entry.status!=='held'){
      const original=await checkPrivatePhoto(photos,entry.sourceId);
      const receipt=receipts.get(entry.sourceId);
      if(original.status!=='PHOTO_READ')status=original.status;
      else if(original.sha256!==entry.expectedPhotoSha256)status='PHOTO_SHA256_MISMATCH';
      else if(!receipt)status='REVIEW_RECEIPT_MISSING';
      else if(receipt.expectedPhotoSha256!==entry.expectedPhotoSha256)status='STALE_PHOTO_RECEIPT';
      else if(receipt.lessonContentSha256!==entry.lessonContentSha256)status='STALE_EDUCATIONAL_CONTENT_RECEIPT';
      else if(!receipt.reviewedOn||!receipt.reviewerId||receipt.reviewedOn>asOfDay||
        (entry.lastLessonIntakeOn&&receipt.reviewedOn<entry.lastLessonIntakeOn)){
        status='REVIEW_DATE_OR_REVIEWER_INCOMPLETE';
      }else if(CHECKS.some(check=>receipt.checks[check]!==true))status='HUMAN_CHECKLIST_INCOMPLETE';
      else status='PHOTO_DIGEST_AND_ATTESTATION_RECORDED';
    }
    sources.push({sourceId:entry.sourceId,status});
  }
  const recorded=sources.filter(source=>source.status==='PHOTO_DIGEST_AND_ATTESTATION_RECORDED').length;
  return {
    schemaVersion:1,totals:checklist.totals,
    recordedEvidenceCount:recorded,
    unresolvedSourceCount:sources.length-recorded,
    sources,
    // A human assertion in a private JSON file is not independently
    // authenticated and cannot itself satisfy a release authorization.
    humanPhotoReviewAuthenticity:'NOT_INDEPENDENTLY_VERIFIED',
    humanReleaseGates:{
      originalPhotoTranscription:'EXTERNAL_REVIEW_REQUIRED',
      childPrivacyAndCurriculumRights:'EXTERNAL_REVIEW_REQUIRED',
      requiredPhysicalIphoneSafari:'EXTERNAL_REVIEW_REQUIRED',
      exactScopeReleaseAuthorization:'EXTERNAL_REVIEW_REQUIRED'
    },
    releaseStatus:'HOLD_EXTERNAL_SIGNOFF'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  try{
    if(args[0]==='--checklist'&&args.length===2){
      console.log(JSON.stringify(buildSchoolworkPhotoChecklist(JSON.parse(await readFile(args[1],'utf8'))),null,2));
    }else if(args[0]==='--template'&&args.length===2){
      console.log(JSON.stringify(buildPrivatePhotoReviewTemplate(JSON.parse(await readFile(args[1],'utf8'))),null,2));
    }else if(args[0]==='--verify'&&args.length===4){
      const pack=JSON.parse(await readFile(args[1],'utf8'));
      const report=await verifySchoolworkPhotoReviews(pack,args[2],args[3]);
      console.log(JSON.stringify(report,null,2));
      if(report.unresolvedSourceCount>0)process.exitCode=2;
    }else throw new Error('Usage: --checklist PUBLIC_PACK | --template PUBLIC_PACK | --verify PUBLIC_PACK PRIVATE_PHOTO_DIR PRIVATE_RECEIPTS');
  }catch(error){
    console.error(error.message);process.exitCode=1;
  }
}
