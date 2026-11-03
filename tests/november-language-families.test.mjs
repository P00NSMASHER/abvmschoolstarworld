import assert from 'node:assert/strict';
import test from 'node:test';
import {SINGULAR_PLURAL_NOUNS_FAMILY,THREE_LETTER_BLENDS_FAMILY} from '../scripts/curriculum-families/november-language.mjs';
import {automaticCurriculumFamilyEligible,matchCurriculumFamily,registeredCurriculumFamilyRules,registeredSupplementalQuestionFamily} from '../scripts/curriculum-family-registry.mjs';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';

const sourcePack=()=>({
  sourceHash:'synthetic-current-november-school-topics',
  subjects:[
    {subject:'Reading / ELA',topics:['Grammar: singular & plural nouns (test Thursday, Nov. 12)'],studyNotes:[]},
    {subject:'Spelling / Handwriting',topics:['3 letter blends'],studyNotes:[]},
  ], vocabulary:[],
});

test('both November language families contain eight original distinct valid variants',()=>{
  for(const family of [SINGULAR_PLURAL_NOUNS_FAMILY,THREE_LETTER_BLENDS_FAMILY]){
    assert.equal(automaticCurriculumFamilyEligible(family),true, family.id+' must independently qualify for automatic safe promotion');
    const bank=[family.baseQuestion,...family.supplementalQuestions];
    assert.equal(bank.length,8);
    assert.deepEqual([...new Set(bank.map(q=>q.questionType))].sort(),['direct','reasoning','transfer']);
    assert.equal(new Set(bank.map(q=>q.prompt.toLowerCase())).size,8);
    assert.ok(bank.every(q=>q.choices.length===3&&q.choices.filter(x=>x===q.answer).length===1));
    assert.ok(family.studyNotes.some(note=>/original Grade 2 teaching/i.test(note)),'original teaching must be identified');
  }
});

test('exact teacher topic activates Grade 2 originals, without treating practice as a teacher test',()=>{
  const pack=sourcePack();
  const matched=[
    matchCurriculumFamily('Reading / ELA',pack.subjects[0].topics[0]),
    matchCurriculumFamily('Spelling / Handwriting',pack.subjects[1].topics[0]),
  ];
  assert.deepEqual(matched.map(x=>x?.id),['singular-plural-nouns','three-letter-blends']);
  const pipeline=buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash});
  for(const id of matched.map(x=>x.id)){
    const qs=pipeline.questions.filter(q=>q.skill===id);
    assert.equal(qs.length,8,id+' must produce eight source-locked originals');
    assert.deepEqual([...new Set(qs.map(q=>q.questionType))].sort(),['direct','reasoning','transfer']);
    assert.ok(qs.every(q=>q.provenance==='verified-abvm-skill-template'));
    assert.ok(qs.every(q=>q.evidenceContract?.doesNotClaim?.includes('global-subject-mastery')));
    assert.ok(qs.every(q=>!/what will be on the test|teacher (?:asked|wrote|chose)/i.test(q.prompt)),'original practice must not claim actual teacher test items');
  }
  assert.equal(pipeline.qa.status,'pass');
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
});

test('withdrawing teacher topic removes its corresponding original question bank',()=>{
  const pack=sourcePack();
  pack.subjects[0].topics=[];
  let pipeline=buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash});
  assert.equal(pipeline.questions.some(q=>q.skill==='singular-plural-nouns'),false);
  assert.equal(pipeline.questions.filter(q=>q.skill==='three-letter-blends').length,8);
  pack.subjects[1].topics=[];
  // An entirely empty source pack intentionally fails closed. It must not
  // silently reintroduce withdrawn material just to satisfy the QA minimum.
  assert.throws(() => buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash}),
    /skills-empty|questions-empty/);
});

test('eligible family rules are limited to exact named subjects and do not enable a fake spelling word list',()=>{
  const ids=registeredCurriculumFamilyRules().map(x=>x.id);
  assert.ok(ids.includes('singular-plural-nouns'));
  assert.ok(ids.includes('three-letter-blends'));
  assert.equal(matchCurriculumFamily('Math','3 letter blends'),null);
  assert.equal(matchCurriculumFamily('Religion','singular & plural nouns'),null);
  assert.equal(registeredSupplementalQuestionFamily('three-letter-blends').length,7);
});
