import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {assertPrivateRealPath} from './learning-history.mjs';
import {buildSchoolworkReviewReport} from './schoolwork-review-report.mjs';

const REVIEW_VALUES=new Set(['pending','confirmed','blocked']);
const REVIEW_WARNING='Self-attested human checklist; this is not image transcription evidence, educator approval, or permission to release.';
const RELEASE_AUTHORITY='NOT_GRANTED_BY_THIS_PACKET';

// Object field serialization order is not academic content. The order of
// questions and answer choices is content, and therefore remains significant.
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(
    Object.keys(value).sort().map(key=>[key,canonical(value[key])])
  );
  return value;
}
export function reviewContentSha256(value){
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

const statusFields=keys=>Object.fromEntries(keys.map(key=>[key,'pending']));

export function buildPhotoReviewPacket(pack){
  const audit=buildSchoolworkReviewReport(pack);
  const bySource=new Map(pack.sourceManifest.map(source=>[source.id,source]));
  const byLesson=new Map(pack.lessons.map(lesson=>[lesson.id,lesson]));
  return {
    schemaVersion:1,
    warning:REVIEW_WARNING,
    sourcePackSha256:reviewContentSha256(pack),
    totals:audit.totals,
    sources:audit.sourceReviewQueue.map(row=>({
      sourceId:row.sourceId,
      sourceManifest:structuredClone(bySource.get(row.sourceId)),
      canonicalSourceId:row.canonicalSourceId,
      duplicateKind:row.duplicateKind,
      lessonIds:[...row.lessonIds],
      review:statusFields([
        'originalPhotoDigest','sameWorksheetOrDuplicate','printedContentToLesson','privacyAndSourceRights'
      ])
    })),
    lessons:audit.lessonReviewQueue.map(row=>{
      const lesson=byLesson.get(row.lessonId);
      const byQuestion=new Map(lesson.questions.map(question=>[question.id,question]));
      return {
        lessonId:row.lessonId,
        contentSha256:reviewContentSha256(lesson),
        title:lesson.title,
        subject:lesson.subject,
        sourceIds:[...row.sourceIds],
        dateEvidence:row.dateEvidence,
        studiedOn:row.studiedOn,
        weekOf:row.weekOf,
        addedOn:row.addedOn,
        notes:[...lesson.notes],
        skills:[...lesson.skills],
        questions:row.questionIds.map(id=>{
          const question=byQuestion.get(id);
          return {
            questionId:id,
            contentSha256:reviewContentSha256(question),
            publicQuestion:structuredClone(question),
            review:statusFields(['printedTaskMatch','answerAndDistractors','ageAndPrivacy'])
          };
        }),
        review:statusFields(['sourceMapping','notesAndSkills','dateAuthority'])
      };
    }),
    releaseAuthority:RELEASE_AUTHORITY
  };
}

// Check that no immutable evidence, canonical ID, question content, source
// digest, or checklist field was changed. Reviewer statuses are self-attested.
export function auditPhotoReviewPacket(pack,packet){
  const expected=buildPhotoReviewPacket(pack);
  if(!packet||typeof packet!=='object'||Array.isArray(packet))
    throw new Error('Invalid private schoolwork review packet');
  const copy=structuredClone(packet);
  const statuses=[];
  function resetReview(item,baseline,context){
    if(!item||!baseline||!item.review||typeof item.review!=='object'||Array.isArray(item.review))
      throw new Error('Missing review statuses at '+context);
    const keys=Object.keys(baseline.review);
    if(keys.length!==Object.keys(item.review).length||
       keys.some(key=>!Object.hasOwn(item.review,key)))
      throw new Error('Review status shape changed at '+context);
    for(const key of keys){
      if(!REVIEW_VALUES.has(item.review[key]))
        throw new Error('Invalid review status at '+context+': '+key);
      statuses.push(item.review[key]);
    }
    item.review=structuredClone(baseline.review);
  }
  if(!Array.isArray(copy.sources)||copy.sources.length!==expected.sources.length||
     !Array.isArray(copy.lessons)||copy.lessons.length!==expected.lessons.length)
    throw new Error('Stale or incomplete review packet: public source or lesson inventory changed');
  for(let index=0;index<expected.sources.length;index++)
    resetReview(copy.sources[index],expected.sources[index],'source index '+index);
  for(let index=0;index<expected.lessons.length;index++){
    const item=copy.lessons[index],baseline=expected.lessons[index];
    resetReview(item,baseline,'lesson index '+index);
    if(!Array.isArray(item.questions)||item.questions.length!==baseline.questions.length)
      throw new Error('Stale or incomplete review packet: question inventory changed');
    for(let j=0;j<baseline.questions.length;j++)
      resetReview(item.questions[j],baseline.questions[j],'question index '+index+'/'+j);
  }
  if(!isDeepStrictEqual(copy,expected))
    throw new Error('Review packet is stale or its source/question evidence was altered; regenerate a new private packet without reusing prior confirmations.');
  const counts={
    pending:statuses.filter(value=>value==='pending').length,
    confirmed:statuses.filter(value=>value==='confirmed').length,
    blocked:statuses.filter(value=>value==='blocked').length
  };
  return {
    sourcePackSha256:expected.sourcePackSha256,
    totals:expected.totals,
    reviewedSources:expected.sources.length,
    reviewedLessons:expected.lessons.length,
    reviewedQuestions:expected.lessons.reduce((sum,lesson)=>sum+lesson.questions.length,0),
    checklist:counts,
    checklistComplete:counts.pending===0&&counts.blocked===0&&
      !expected.sources.some(source=>source.sourceManifest.status==='held'),
    // Even a completely checked packet does not authenticate its signer or
    // override manual educator, privacy, real-device and release decisions.
    releaseStatus:'HOLD_EXTERNAL_SIGNOFF'
  };
}

// Never write a review file to the public repository or replace an existing
// reviewer-edited receipt. Destination is exclusive, owner-only on POSIX.
export async function createPrivatePhotoReviewPacket(pack,destination,{repoRoot}={}){
  const expected=buildPhotoReviewPacket(pack);
  const target=await assertPrivateRealPath(destination,'Private schoolwork review packet',repoRoot);
  await mkdir(path.dirname(target),{recursive:true,mode:0o700});
  const handle=await open(target,'wx',0o600);
  try{
    await handle.writeFile(JSON.stringify(expected,null,2)+'\n');
    await handle.sync();
  }catch(error){
    await handle.close();
    await unlink(target).catch(()=>{});
    throw error;
  }
  await handle.close();
  return {created:true,...auditPhotoReviewPacket(pack,expected)};
}

export async function checkPrivatePhotoReviewPacket(pack,reviewPath,{repoRoot}={}){
  const target=await assertPrivateRealPath(reviewPath,'Private schoolwork review packet',repoRoot);
  if(process.platform!=='win32'&&((await stat(target)).mode&0o077)!==0)
    throw new Error('Private review packet must be owner-only (0600).');
  return auditPhotoReviewPacket(pack,JSON.parse(await readFile(target,'utf8')));
}

// Verifies declared byte identity only. Does not interpret handwriting,
// certify transcription, approve curriculum, or record human review.
export async function verifyPrivateOriginalPhoto(pack,sourceId,photoPath,{repoRoot}={}){
  buildSchoolworkReviewReport(pack);
  const source=pack.sourceManifest.find(item=>item.id===sourceId);
  if(!source)throw new Error('Unknown source ID in public schoolwork manifest');
  const safe=await assertPrivateRealPath(photoPath,'Original worksheet image',repoRoot);
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(safe))hash.update(chunk);
  return {sourceId:source.id,sha256MatchesManifest:hash.digest('hex')===source.sha256,
    humanContentReview:'NOT_PERFORMED'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [mode,publicPath,arg1,arg2,...rest]=process.argv.slice(2);
  const usage='Usage: node scripts/schoolwork-photo-review.mjs create|check <public-schoolwork.json> <private-review.json>\n'
    +'   or: node scripts/schoolwork-photo-review.mjs photo <public-schoolwork.json> <manifest-source-id> <private-original-photo>';
  if(rest.length||!['create','check','photo'].includes(mode)||!publicPath||!arg1||
     (mode==='photo'&&!arg2)||(mode!=='photo'&&arg2)){
    console.error(usage);process.exitCode=1;
  }else{
    try{
      const pack=JSON.parse(await readFile(publicPath,'utf8'));
      const result=mode==='create'
        ?await createPrivatePhotoReviewPacket(pack,arg1)
        :mode==='check'
          ?await checkPrivatePhotoReviewPacket(pack,arg1)
          :await verifyPrivateOriginalPhoto(pack,arg1,arg2);
      console.log(JSON.stringify(result));
      if(mode==='photo'&&!result.sha256MatchesManifest)process.exitCode=1;
    }catch(error){
      console.error(error.message);process.exitCode=1;
    }
  }
}
