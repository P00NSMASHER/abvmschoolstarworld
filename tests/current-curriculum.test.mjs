import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCurriculumFamily} from '../scripts/curriculum-family-registry.mjs';
import {buildGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';

const skills = [
  {subject:'Reading / ELA',topic:'charts',id:'reading-charts'},
  {subject:'Spelling / Handwriting',topic:'long o / Short )',id:'long-o'},
  {subject:'Reading / ELA',topic:'short vowels',id:'short-vowels'},
];
test('original owner-authorized teacher-topic question families have eight valid nonduplicate variants', () => {
  for (const {subject,topic,id} of skills) {
    const family=matchCurriculumFamily(subject,topic);
    assert.equal(family.id,id);
    assert.equal(family.rolloutStatus,'APPROVED');
    assert.equal(family.enabledByDefault,true);
    const questions=[family.baseQuestion,...family.supplementalQuestions];
    assert.equal(questions.length,8);
    assert.deepEqual([...new Set(questions.map(q=>q.questionType))].sort(),['direct','reasoning','transfer']);
    assert.equal(new Set(questions.map(q=>q.prompt)).size,8);
    for (const question of questions) {
      assert.equal(question.choices.length,3);
      assert.equal(new Set(question.choices).size,3);
      assert.equal(question.choices.filter(choice=>choice===question.answer).length,1);
      assert(question.explanation.length>20);
      assert(question.hint.length>15);
      assert(question.prompt.length>20);
    }
  }
});

test('source-covered chart, long-o, and short-vowel practice flows into current Test Prep without fake short-vowel specificity', () => {
  const timestamp='2026-10-14T23:00:00.000Z';
  const readingHash='1'.repeat(64), testsHash='2'.repeat(64);
  const pack = {
    sourceHash:'teacher-pages-'+'f'.repeat(20),
    subjects:[
      {subject:'Reading / ELA',topics:['Reading comprehension: charts','Phonics: short vowels (test Friday, Oct. 16)'],studyNotes:[]},
      {subject:'Spelling / Handwriting',topics:['Friday, Oct. 16 test focus: long o / Short )'],studyNotes:[]},
    ],
    vocabulary:[],
  };
  const pages=[
    {title:'Reading Work',url:'https://sites.google.com/view/abvmgr2/reading-work',checkedAt:timestamp,contentHash:readingHash,lines:['Reading Comprehension: charts']},
    {title:'Tests',url:'https://sites.google.com/view/abvmgr2/tests',checkedAt:timestamp,contentHash:testsHash,lines:['Friday Oct. 16: Spelling (long o / Short ) / Handwriting','Friday Oct. 16: Phonics (short vowels)']},
  ];
  const out=buildGrade2ContentPipeline(pack,{
    sourceHash:pack.sourceHash,generatedAt:timestamp,sourcePages:pages,requirePageExactLineage:true,
  });
  assert.equal(out.qa.status,'pass');
  assert.equal(out.qa.rejectedCount,0);
  for (const {id} of skills) {
    const qs=out.questions.filter(q=>q.skill===id);
    assert.equal(qs.length,8,id);
    assert(qs.every(q=>q.sourceLineage?.quality==='page-exact'),id);
  }
  const spelling=questionsForTest({label:'Spelling (long o / Short ) / Handwriting',date:'2026-10-16'},out.questions);
  const phonics=questionsForTest({label:'Phonics (short vowels)',date:'2026-10-16'},out.questions);
  assert.equal(spelling.length,8);
  assert(spelling.every(q=>q.skill==='long-o'));
  assert.equal(phonics.length,8);
  assert(phonics.every(q=>q.skill==='short-vowels'));
  assert(!out.questions.some(q=>q.sourceLineage?.quality!=='page-exact'));
});
