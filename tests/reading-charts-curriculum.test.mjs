import assert from 'node:assert/strict';
import test from 'node:test';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {buildCurriculumCoveragePlan} from '../scripts/curriculum-coverage-autopilot.mjs';
import {matchCurriculumFamily} from '../scripts/curriculum-family-registry.mjs';

const checkedAt='2026-10-14T22:40:00.000Z';
const sourceHash='teacher-pages-'+'c'.repeat(20);
const line='Reading Comprehension: ask & answer questions; main idea/details; charts';
const page={title:'Reading Work',url:'https://sites.google.com/view/abvmgr2/reading-work',
  checkedAt,contentHash:'d'.repeat(64),lines:[line]};
function lesson({note=line,sourcePages=[page]}={}) {
  const pack={sourceHash,subjects:[{subject:'Reading / ELA',topics:[],studyNotes:[note]}],vocabulary:[]};
  return buildGrade2ContentPipeline(pack,{generatedAt:checkedAt,sourceHash,sourcePages,requirePageExactLineage:true});
}

test('Reading/ELA charts generate nine original, correct, source-traceable variants with no educator approval',()=>{
  const family=matchCurriculumFamily('Reading / ELA','charts');
  assert(family);
  assert.equal(family.id,'reading-charts');
  assert.equal(family.rolloutStatus,'APPROVED');
  assert.equal(family.enabledByDefault,true);
  const pipeline=lesson();
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
  const questions=pipeline.questions.filter(row=>row.skill==='reading-charts');
  assert.equal(questions.length,9);
  assert.deepEqual([...new Set(questions.map(row=>row.questionType))].sort(),['direct','reasoning','transfer']);
  assert.equal(new Set(questions.map(row=>row.variantFingerprint)).size,9);
  assert(questions.every(row=>row.choices.length===3&&row.choices.filter(choice=>choice===row.answer).length===1));
  assert(questions.every(row=>row.sourceLineage?.quality==='page-exact'
    &&row.sourceLineage.sourceUrl===page.url
    &&row.sourceLineage.sourceCaptureHash===page.contentHash
    &&row.sourceLineage.sourceCheckedAt===checkedAt
    &&row.sourceLineage.matchedEvidence.includes(line)));
  assert(pipeline.coverage.some(row=>row.skillId==='reading-charts'&&row.status==='COVERED'));
  assert(!pipeline.coverage.some(row=>row.topic==='charts'&&row.status==='GENERATOR_UNSUPPORTED'));
  const plan=buildCurriculumCoveragePlan({pipeline,sourcePages:[page],sourceHash,generatedAt:checkedAt});
  assert.equal(plan.unsupportedCount,0);
  assert.equal(plan.candidates.length,0);
});

test('unannounced charts never enter study packs and cannot be inferred from generic reading',()=>{
  const plain='Reading Comprehension: ask & answer questions; main idea/details';
  const pipeline=lesson({note:plain,sourcePages:[{...page,lines:[plain]}]});
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
  assert(!pipeline.questions.some(row=>row.skill==='reading-charts'));
});

test('announced charts fail closed when their public teacher source lineage is unavailable',()=>{
  assert.throws(()=>lesson({sourcePages:[{...page,lines:['Reading Work but no charts source line'] }]}),
    /pipeline validation failed|lineage/i);
});
