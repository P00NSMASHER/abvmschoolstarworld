import assert from 'node:assert/strict';
import test from 'node:test';

import {
  curriculumFamilyRuntimeEnabled,
  matchCurriculumFamily,
  registeredRuntimeMetadata,
  registeredSupplementalQuestionFamily,
} from '../scripts/curriculum-family-registry.mjs';
import {
  buildGrade2ContentPipeline,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

const FLAG='curriculum-family:short-i-long-i-v1';

function sourcePack(){
  return {
    sourceHash:'teacher-pages-short-i-long-i-preview',
    subjects:[{
      subject:'Spelling / Handwriting',
      topics:['short i / long i','short a / long a'],
      studyNotes:[],
    }],
    vocabulary:[],
  };
}

const sourcePages=[{
  title:'Tests',
  url:'https://sites.google.com/view/abvmgr2/tests',
  checkedAt:'2026-10-05T19:19:41.665Z',
  contentHash:'c91cc1e62eea30c82595cbad75abd174f3811a4cb56b30097113df6dc487db1f',
  lines:['Friday Oct. 9: Spelling (short i/long i)/Handwriting','Friday Oct. 2: Spelling (short a / long a) / Handwriting'],
}];

test('short-i/long-i stays disabled unless its exact candidate flag is present',()=>{
  const family=matchCurriculumFamily('Spelling / Handwriting','short i / long i');
  assert.ok(family);
  assert.equal(family.id,'short-i-long-i');
  assert.equal(family.rolloutStatus,'CANDIDATE');
  assert.equal(family.enabledByDefault,false);
  assert.equal(curriculumFamilyRuntimeEnabled(family),false);
  assert.equal(curriculumFamilyRuntimeEnabled(family,{activeFeatureFlags:['curriculum-family:other']}),false);
  assert.equal(curriculumFamilyRuntimeEnabled(family,{activeFeatureFlags:[FLAG]}),true);
  assert.equal(registeredRuntimeMetadata('short-i-long-i'),null);
  assert.equal(registeredSupplementalQuestionFamily('short-i-long-i').length,0);
  assert.equal(registeredSupplementalQuestionFamily('short-i-long-i',{activeFeatureFlags:[FLAG]}).length,8);
});

test('feature-gated short-i/long-i preview closes the exact teacher coverage gap safely',()=>{
  const baseline=buildGrade2ContentPipeline(sourcePack(),{
    sourceHash:'baseline-short-i-long-i',
    generatedAt:'2026-10-05T19:19:41.665Z',
  });
  assert.ok(baseline.coverage.some(row=>row.status==='GENERATOR_UNSUPPORTED'));

  const preview=buildGrade2ContentPipeline(sourcePack(),{
    sourceHash:'preview-short-i-long-i',
    generatedAt:'2026-10-05T19:19:41.665Z',
    sourcePages,
    requirePageExactLineage:true,
    activeCurriculumFeatureFlags:[FLAG],
  });

  assert.deepEqual(validateGrade2ContentPipeline(preview),[]);
  assert.equal(preview.coverage.some(row=>row.status==='GENERATOR_UNSUPPORTED'),false);
  const skill=preview.skills.find(row=>row.id==='short-i-long-i');
  assert.ok(skill);
  assert.deepEqual(skill.standards,['CCSS.RF.2.3']);
  assert.equal(skill.domain,'Foundational reading');

  const questions=preview.questions.filter(row=>row.skill==='short-i-long-i');
  assert.equal(questions.length,9);
  assert.deepEqual([...new Set(questions.map(row=>row.questionType))].sort(),['direct','reasoning','transfer']);
  assert.ok(questions.every(row=>row.choices.includes(row.answer)));
  assert.ok(questions.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert.ok(questions.every(row=>row.sourceLineage?.sourceTitle==='Tests'));
  assert.ok(questions.every(row=>/short i.*long i/i.test((row.sourceLineage?.matchedEvidence||[]).join(' '))));
});
