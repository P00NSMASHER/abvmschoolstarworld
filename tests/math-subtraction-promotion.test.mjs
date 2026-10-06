import assert from 'node:assert/strict';
import test from 'node:test';

import {
  curriculumFamilyRuntimeEnabled,
  matchCurriculumFamily,
  registeredSupplementalQuestionFamily,
} from '../scripts/curriculum-family-registry.mjs';
import {
  buildCurriculumCoveragePlan,
  curriculumCandidateIntrinsicBlockers,
} from '../scripts/curriculum-coverage-autopilot.mjs';
import {
  buildGrade2ContentPipeline,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

const FLAG='curriculum-family:math-subtraction-v1';

function sourcePack(){
  return {
    sourceHash:'teacher-pages-generic-subtraction',
    subjects:[{
      subject:'Math',
      topics:['Math (subtraction)','Place value'],
      studyNotes:[],
    }],
    vocabulary:[],
  };
}

const sourcePages=[{
  title:'Tests',
  url:'https://sites.google.com/view/abvmgr2/tests',
  checkedAt:'2026-10-06T20:06:28.937Z',
  contentHash:'3b6c7c29c8ab66c162fa942f012a9c780392b4bf20b024d91f620efd53eee80c',
  lines:['Thursday Oct. 15: Math (subtraction)','Math: place value'],
}];

test('generic subtraction stays disabled unless its exact candidate flag is present',()=>{
  const family=matchCurriculumFamily('Math','Math (subtraction)');
  assert.ok(family);
  assert.equal(family.id,'math-subtraction');
  assert.equal(family.rolloutStatus,'CANDIDATE');
  assert.equal(family.enabledByDefault,false);
  assert.equal(curriculumFamilyRuntimeEnabled(family),false);
  assert.equal(curriculumFamilyRuntimeEnabled(family,{activeFeatureFlags:['curriculum-family:other']}),false);
  assert.equal(curriculumFamilyRuntimeEnabled(family,{activeFeatureFlags:[FLAG]}),true);
  assert.equal(registeredSupplementalQuestionFamily('math-subtraction').length,0);
  assert.equal(registeredSupplementalQuestionFamily('math-subtraction',{activeFeatureFlags:[FLAG]}).length,8);
});

test('coverage autopilot can materialize the generic subtraction family without re-authoring',()=>{
  const plan=buildCurriculumCoveragePlan({
    pipeline:{
      sourceHash:'teacher-pages-7f58b7555d1b71750727',
      coverage:[{subject:'Math',topic:'Math (subtraction)',status:'GENERATOR_UNSUPPORTED'}],
    },
    sourcePages,
    sourceHash:'teacher-pages-7f58b7555d1b71750727',
    generatedAt:'2026-10-06T20:06:28.937Z',
  });
  assert.equal(plan.unsupportedCount,1);
  const [candidate]=plan.candidates;
  assert.equal(candidate.familyId,'math-subtraction');
  assert.equal(candidate.registryMatch?.rolloutStatus,'CANDIDATE');
  assert.equal(candidate.sourceContext.quality,'page-exact');
  assert.equal(candidate.sourceContext.sourceLine,'Thursday Oct. 15: Math (subtraction)');
  assert.equal(candidate.proposedQuestions.length,9);
  assert.deepEqual([...new Set(candidate.proposedQuestions.map(row=>row.questionType))].sort(),['direct','reasoning','transfer']);
  assert.deepEqual(curriculumCandidateIntrinsicBlockers(candidate),[]);
});

test('feature-gated generic subtraction closes the exact teacher coverage gap safely',()=>{
  const baseline=buildGrade2ContentPipeline(sourcePack(),{
    sourceHash:'baseline-generic-subtraction',
    generatedAt:'2026-10-06T20:06:28.937Z',
  });
  assert.ok(baseline.coverage.some(row=>row.status==='GENERATOR_UNSUPPORTED'&&/subtraction/i.test(row.topic)));

  const preview=buildGrade2ContentPipeline(sourcePack(),{
    sourceHash:'preview-generic-subtraction',
    generatedAt:'2026-10-06T20:06:28.937Z',
    sourcePages,
    requirePageExactLineage:true,
    activeCurriculumFeatureFlags:[FLAG],
  });
  assert.deepEqual(validateGrade2ContentPipeline(preview),[]);
  assert.equal(preview.coverage.some(row=>row.status==='GENERATOR_UNSUPPORTED'),false);

  const skill=preview.skills.find(row=>row.id==='math-subtraction');
  assert.ok(skill);
  assert.deepEqual(skill.standards,['CCSS.2.OA.B.2']);
  assert.equal(skill.domain,'Numbers and operations');
  assert.ok(skill.studyNotes.some(note=>/does not state a numeric range/i.test(note)));

  const questions=preview.questions.filter(row=>row.skill==='math-subtraction');
  assert.equal(questions.length,9);
  assert.deepEqual([...new Set(questions.map(row=>row.questionType))].sort(),['direct','reasoning','transfer']);
  assert.ok(questions.every(row=>row.choices.includes(row.answer)));
  assert.ok(questions.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert.ok(questions.every(row=>row.sourceLineage?.sourceTitle==='Tests'));
  assert.ok(questions.every(row=>/Math \(subtraction\)/.test((row.sourceLineage?.matchedEvidence||[]).join(' '))));

  const numbers=questions.flatMap(row=>(row.prompt.match(/\b\d+\b/g)||[]).map(Number));
  assert.ok(numbers.every(value=>value<=20),'generic subtraction preview must stay conservatively within 20');
});


test('range-specific subtraction remains canonical instead of activating the generic family',()=>{
  const pack={
    sourceHash:'range-specific-subtraction',
    subjects:[{subject:'Math',topics:['Subtraction within 12'],studyNotes:[]}],
    vocabulary:[],
  };
  const pipeline=buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash});
  const ids=new Set(pipeline.skills.map(row=>row.id));
  assert.ok(ids.has('subtraction-within-12'));
  assert.equal(ids.has('math-subtraction'),false);
  assert.equal(pipeline.coverage.some(row=>row.status==='GENERATOR_UNSUPPORTED'),false);
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
});
