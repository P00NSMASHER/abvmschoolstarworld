import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSchoolworkReviewReport} from '../scripts/schoolwork-review-report.mjs';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';
import {mergeSchoolwork} from '../scripts/integrate-schoolwork.mjs';

const sample=()=>({
  schemaVersion:1,uploadedPhotoCount:1,
  sourceManifest:[{id:'reviewed.jpeg',sha256:'a'.repeat(64),status:'integrated'}],
  lessons:[{
    id:'sentences',title:'Sentence practice',subject:'Reading / ELA',
    sources:['reviewed.jpeg'],skills:['sentence-writing'],
    notes:['Start with a capital letter.'],studiedOn:null,
    addedOn:'2026-10-08',dateStatus:'Undated schoolwork',
    questions:[{
      id:'q-sentences-1',subject:'Reading / ELA',skill:'sentence-writing',
      prompt:'Which sentence is complete?',answer:'We went home.',
      choices:['We went home.','we went home','We went home'],
      explanation:'The complete sentence starts with a capital and ends with a period.',
      sourceFact:'Capital letters and punctuation',
      provenance:'original-practice-from-uploaded-schoolwork'
    }]
  }]
});

test('read-only report reconciles the exact published cumulative library',async()=>{
  const pack=JSON.parse(await readFile(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
  const original=JSON.stringify(pack);
  const report=buildSchoolworkReviewReport(pack);
  assert.equal(JSON.stringify(pack),original,'no mutation of the supplied source object');
  assert.deepEqual(report.totals,{photos:23,lessons:13,questions:67});
  assert.deepEqual(report.statusCounts,{
    integratedSources:22,exactDuplicates:0,semanticRephotographs:1,heldSources:0,
    verifiedDayLessons:0,verifiedWeekOnlyLessons:1,undatedLessons:12
  });
  assert.equal(report.sourceReviewQueue.length,23);
  assert.equal(report.lessonReviewQueue.length,13);
  assert.deepEqual(report.attention.verifiedWeekOnlyLessonIds,['spelling-oct-09-2026']);
  assert.equal(report.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
  assert(Object.values(report.humanReleaseGates).every(value=>value==='EXTERNAL_REVIEW_REQUIRED'));
  assert.equal(report.lessonReviewQueue.reduce((count,lesson)=>count+lesson.questionIds.length,0),67);
  assert.equal(report.sourceReviewQueue.filter(source=>source.status!=='held')
    .every(source=>source.lessonIds.length>0),true);
});

test('held photos remain in the queue without inventing lessons or approval',()=>{
  const pack=sample();
  pack.sourceManifest.push({id:'pending.jpeg',sha256:'b'.repeat(64),status:'held',
    reason:'Original photograph needs a reviewer.'});
  pack.uploadedPhotoCount=2;
  const report=buildSchoolworkReviewReport(pack);
  assert.deepEqual(report.attention.heldSourceIds,['pending.jpeg']);
  assert.deepEqual(report.sourceReviewQueue.find(source=>source.sourceId==='pending.jpeg').lessonIds,[]);
  assert.equal(report.totals.questions,1);
  assert.equal(report.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
});

test('semantic rephotographs are not silently represented as byte-identical',()=>{
  const pack=sample();
  pack.sourceManifest.push({id:'other-view.jpeg',sha256:'b'.repeat(64),
    status:'duplicate',duplicateOf:'reviewed.jpeg',reason:'Reviewed as same assignment from a different angle.'});
  pack.lessons[0].sources.push('other-view.jpeg');
  pack.uploadedPhotoCount=2;
  const report=buildSchoolworkReviewReport(pack);
  assert.deepEqual(report.attention.semanticRephotographIds,['other-view.jpeg']);
  assert.equal(report.statusCounts.semanticRephotographs,1);
  assert.equal(report.sourceReviewQueue.find(source=>source.sourceId==='other-view.jpeg').canonicalSourceId,'reviewed.jpeg');
  pack.sourceManifest[1].sha256='a'.repeat(64);
  const exact=buildSchoolworkReviewReport(pack);
  assert.equal(exact.statusCounts.exactDuplicates,1);
  assert.deepEqual(exact.attention.semanticRephotographIds,[]);
});

test('date evidence keeps an exact studied day distinct from the known school week',()=>{
  const pack=sample();
  pack.lessons[0].weekOf='2026-10-05';
  let report=buildSchoolworkReviewReport(pack);
  assert.equal(report.lessonReviewQueue[0].dateEvidence,'verified-week-only');
  assert.equal(report.lessonReviewQueue[0].studiedOn,null);
  pack.lessons[0].studiedOn='2026-10-07';
  pack.lessons[0].dateStatus='Verified worksheet day';
  report=buildSchoolworkReviewReport(pack);
  assert.equal(report.lessonReviewQueue[0].dateEvidence,'verified-day');
  assert.equal(report.statusCounts.verifiedDayLessons,1);
});

test('report never includes learner responses, question content or source explanations',()=>{
  const pack=sample();
  pack.lessons[0].notes.push('SYNTHETIC_PRIVATE_LEARNING_RESPONSE');
  pack.lessons[0].questions[0].explanation='SYNTHETIC_PRIVATE_EXPLANATION';
  pack.sourceManifest[0].reason='SYNTHETIC_PRIVATE_SOURCE_DESCRIPTION';
  const report=JSON.stringify(buildSchoolworkReviewReport(pack));
  for(const secret of ['SYNTHETIC_PRIVATE_LEARNING_RESPONSE','SYNTHETIC_PRIVATE_EXPLANATION',
    'SYNTHETIC_PRIVATE_SOURCE_DESCRIPTION'])assert(!report.includes(secret));
  assert.equal(JSON.parse(report).releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
});

test('uploaded-schoolwork questions cannot silently claim unsupported provenance or change subjects',()=>{
  const valid=sample();
  assert.deepEqual(validateSchoolwork(valid,{requireManifest:true}),{lessons:1,questions:1,photos:1});
  for(const [field,value,pattern] of [
    ['subject','Math',/question subject must match lesson subject/],
    ['provenance','teacher-official-test-questions',/unsupported provenance for uploaded schoolwork/]
  ]){
    const changed=structuredClone(valid);
    changed.lessons[0].questions[0][field]=value;
    assert.throws(()=>validateSchoolwork(changed,{requireManifest:true}),pattern);
    assert.throws(()=>buildSchoolworkReviewReport(changed),pattern);
    assert.throws(()=>mergeSchoolwork(valid,changed),pattern);
  }
});
