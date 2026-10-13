import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateSchoolwork} from './validate-schoolwork.mjs';

// Read-only reconciliation aid. A valid public manifest is NOT evidence that
// anyone examined the original photographs or approved classroom rights.
export function buildSchoolworkReviewReport(pack) {
  const validation=validateSchoolwork(pack,{requireManifest:true});
  const sourceToLessons=new Map(pack.sourceManifest.map(source=>[source.id,[]]));
  for(const lesson of pack.lessons) {
    for(const sourceId of lesson.sources) sourceToLessons.get(sourceId).push(lesson.id);
  }
  const bySource=new Map(pack.sourceManifest.map(source=>[source.id,source]));
  const sources=pack.sourceManifest.map(source=>{
    const canonical=source.duplicateOf===undefined?null:bySource.get(source.duplicateOf);
    return {
      sourceId:source.id,
      status:source.status,
      canonicalSourceId:source.duplicateOf||null,
      duplicateKind:source.status!=='duplicate'?null:
        source.sha256===canonical.sha256?'exact-byte':'semantic-rephotograph',
      lessonIds:[...sourceToLessons.get(source.id)].sort()
    };
  }).sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0);
  const lessons=pack.lessons.map(lesson=>({
    lessonId:lesson.id,
    subject:lesson.subject,
    sourceIds:[...lesson.sources].sort(),
    skillIds:[...lesson.skills].sort(),
    questionIds:lesson.questions.map(q=>q.id).sort(),
    dateEvidence:lesson.studiedOn?'verified-day':
      lesson.weekOf?'verified-week-only':'undated',
    studiedOn:lesson.studiedOn,
    weekOf:lesson.weekOf||null,
    addedOn:lesson.addedOn
  })).sort((a,b)=>a.lessonId<b.lessonId?-1:a.lessonId>b.lessonId?1:0);
  const ids=(rows,predicate,field)=>rows.filter(predicate).map(row=>row[field]);
  const statusCounts={
    integratedSources:sources.filter(source=>source.status==='integrated').length,
    exactDuplicates:sources.filter(source=>source.duplicateKind==='exact-byte').length,
    semanticRephotographs:sources.filter(source=>source.duplicateKind==='semantic-rephotograph').length,
    heldSources:sources.filter(source=>source.status==='held').length,
    verifiedDayLessons:lessons.filter(lesson=>lesson.dateEvidence==='verified-day').length,
    verifiedWeekOnlyLessons:lessons.filter(lesson=>lesson.dateEvidence==='verified-week-only').length,
    undatedLessons:lessons.filter(lesson=>lesson.dateEvidence==='undated').length
  };
  return {
    schemaVersion:1,
    contentValidation:'PASSED',
    totals:validation,
    statusCounts,
    sourceReviewQueue:sources,
    lessonReviewQueue:lessons,
    attention:{
      heldSourceIds:ids(sources,source=>source.status==='held','sourceId'),
      semanticRephotographIds:ids(sources,source=>source.duplicateKind==='semantic-rephotograph','sourceId'),
      undatedLessonIds:ids(lessons,lesson=>lesson.dateEvidence==='undated','lessonId'),
      verifiedWeekOnlyLessonIds:ids(lessons,lesson=>lesson.dateEvidence==='verified-week-only','lessonId')
    },
    // These gates are intentionally never inferred from manifest statuses,
    // CI success or the lack of held/undated sources.
    humanReleaseGates:{
      originalPhotosAndTranscription:'EXTERNAL_REVIEW_REQUIRED',
      childPrivacyAndPublicText:'EXTERNAL_REVIEW_REQUIRED',
      sourceRightsAndEducatorApproval:'EXTERNAL_REVIEW_REQUIRED',
      physicalIphoneSafariIfRequired:'EXTERNAL_REVIEW_REQUIRED',
      exactScopeReleaseAuthorization:'EXTERNAL_REVIEW_REQUIRED'
    },
    releaseStatus:'HOLD_EXTERNAL_SIGNOFF'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=process.argv[2]||'pages/data/schoolwork.json';
  if(process.argv.length>3){
    console.error('Usage: node scripts/schoolwork-review-report.mjs [reviewed-public-schoolwork.json]');
    process.exitCode=1;
  }else{
    try{
      const report=buildSchoolworkReviewReport(JSON.parse(await readFile(file,'utf8')));
      console.log(JSON.stringify(report,null,2));
    }catch(error){
      console.error(error.message);
      process.exitCode=1;
    }
  }
}
