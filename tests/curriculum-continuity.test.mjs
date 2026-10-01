import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECENT_REVIEW_RETENTION_DAYS,
  buildRecentReviewPipeline,
  validateRecentReviewPipeline,
} from '../scripts/curriculum-continuity.mjs';

const question=(id,skill)=>({id,skill,subject:skill==='old-math'?'Math':'Reading / ELA',questionType:'direct',variantFingerprint:'v-'+id,contentFingerprint:'c-'+id});
const skill=id=>({id,subject:id==='old-math'?'Math':'Reading / ELA',label:id,studyNotes:['verified'],standards:['TEST.1']});

test('current skills leave review while omitted verified skills enter a 14-day review bank',()=>{
  const previousCurrent={generatedAt:'2026-09-30T12:00:00.000Z',sourceHash:'old-source',skills:[skill('old-reading'),skill('old-math')],questions:[question('r1','old-reading'),question('m1','old-math')]};
  const current={generatedAt:'2026-10-01T12:00:00.000Z',sourceHash:'new-source',skills:[skill('old-reading')],questions:[question('r2','old-reading')]};
  const review=buildRecentReviewPipeline({previousCurrent,current,now:'2026-10-01T12:00:00.000Z'});
  assert.deepEqual(review.skills.map(row=>row.id),['old-math']);
  assert.deepEqual(review.questions.map(row=>row.skill),['old-math']);
  assert.equal(review.retentionDays,RECENT_REVIEW_RETENTION_DAYS);
  assert.equal(review.skills[0].reviewVerifiedAt,'2026-09-30T12:00:00.000Z');
  assert.equal(review.skills[0].reviewSourceHash,'old-source');
  assert.deepEqual(validateRecentReviewPipeline(review,{current}),[]);
});

test('review verification time is never refreshed and expired review disappears',()=>{
  const previousReview={schemaVersion:1,retentionDays:14,bankFingerprint:'x',skills:[{...skill('old-reading'),reviewVerifiedAt:'2026-09-01T12:00:00.000Z',reviewExpiresAt:'2026-09-15T12:00:00.000Z',reviewSourceHash:'source-a'}],questions:[{...question('r1','old-reading'),reviewVerifiedAt:'2026-09-01T12:00:00.000Z',reviewExpiresAt:'2026-09-15T12:00:00.000Z',reviewSourceHash:'source-a'}]};
  const review=buildRecentReviewPipeline({previousReview,current:{skills:[],questions:[]},now:'2026-10-01T12:00:00.000Z'});
  assert.equal(review.skills.length,0);
  assert.equal(review.questions.length,0);
});

test('a skill that becomes current again is removed from recent review',()=>{
  const previousCurrent={generatedAt:'2026-09-30T12:00:00.000Z',sourceHash:'old',skills:[skill('old-reading')],questions:[question('r1','old-reading')]};
  const previousReview=buildRecentReviewPipeline({previousCurrent,current:{skills:[],questions:[]},now:'2026-10-01T12:00:00.000Z'});
  const current={skills:[skill('old-reading')],questions:[question('r2','old-reading')]};
  const review=buildRecentReviewPipeline({previousReview,current,now:'2026-10-02T12:00:00.000Z'});
  assert.equal(review.skills.length,0);
});
