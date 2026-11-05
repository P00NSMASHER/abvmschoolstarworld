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

test('strict publication includes only a new family with page-exact teacher evidence',()=>{
  const pack=sourcePack();
  const pipeline=buildGrade2ContentPipeline(pack,{
    sourceHash:pack.sourceHash,
    requirePageExactLineage:true,
    sourcePages:[{
      title:'Tests',
      url:'https://sites.google.com/view/abvmgr2/tests',
      contentHash:'a'.repeat(64),
      checkedAt:'2026-11-03T18:45:52.000Z',
      lines:['Friday Nov. 13: Spelling (3 letter blends)/Handwriting'],
    }],
  });
  assert.equal(pipeline.questions.filter(q=>q.skill==='three-letter-blends').length,8);
  assert.equal(pipeline.questions.some(q=>q.skill==='singular-plural-nouns'),false,
    'a current-topic summary is not independent teacher-page proof');
  const held=pipeline.coverage.find(row=>row.status==='SOURCE_INSUFFICIENT' && /singular.*plural/i.test(row.topic));
  assert.ok(held,'unproven candidate must be explicitly held, not claimed covered');
  assert.equal(pipeline.safetyState,'SAFE_PARTIAL');
  assert.equal(pipeline.qa.status,'pass');
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
  assert.ok(pipeline.questions.every(q=>q.sourceLineage?.quality==='page-exact'));
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
  const rules=registeredCurriculumFamilyRules();
  assert.equal(rules.find(x=>x.id==='singular-plural-nouns')?.sourceReviewRequired,true);
  assert.equal(rules.find(x=>x.id==='three-letter-blends')?.sourceReviewRequired,true);
  assert.equal(rules.find(x=>x.id==='long-short-u')?.sourceReviewRequired,false,
    'historical candidate families retain their established explicit lineage path');
  assert.equal(matchCurriculumFamily('Math','3 letter blends'),null);
  assert.equal(matchCurriculumFamily('Religion','singular & plural nouns'),null);
  assert.equal(registeredSupplementalQuestionFamily('three-letter-blends').length,7);
});


test('all eight noun keys are independently valid and the cats reasoning key is grammatical',()=>{
  const bank=[SINGULAR_PLURAL_NOUNS_FAMILY.baseQuestion,...SINGULAR_PLURAL_NOUNS_FAMILY.supplementalQuestions];
  assert.equal(bank.length,8);
  assert.ok(bank.every(question=>
    question.choices.length===3 &&
    question.choices.filter(choice=>choice===question.answer).length===1
  ),'each noun item must have exactly one independently valid key');
  assert.ok(bank.every(question=>!/\bCats (?:names|tells)\b/.test(JSON.stringify(question))),
    'plural subject/verb agreement errors must not reach questions or keys');
  const cats=bank.find(question=>/Why is “cats” plural/i.test(question.prompt));
  assert.ok(cats,'the reasoning item must remain in the eight-question family');
  assert.equal(cats.answer,'Cats name more than one cat.');
  assert.deepEqual(cats.choices,[
    'Cats name more than one cat.',
    'Cats name only one cat.',
    'Cats tell what an animal does.',
  ]);
});
