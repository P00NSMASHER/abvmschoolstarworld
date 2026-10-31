import assert from 'node:assert/strict';
import test from 'node:test';

import {matchCurriculumFamily} from '../scripts/curriculum-family-registry.mjs';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {printableStudyGuideHtml,printableWorksheetHtml} from '../pages/study-games-materials-view.mjs';

const timestamp='2026-10-31T17:56:01.707Z';
const sourceHash='teacher-pages-reading-long-short-o';
const topic='Phonics: long o (o_e) and short o';
const sourcePages=[{
  title:'Reading Work',
  url:'https://sites.google.com/view/abvmgr2/reading-work',
  checkedAt:timestamp,
  contentHash:'9'.repeat(64),
  lines:[topic],
}];

test('current Reading long-o/short-o topic has a complete automatic family',()=>{
  const family=matchCurriculumFamily('Reading / ELA',topic);
  assert.equal(family?.id,'reading-long-short-o');
  assert.equal(family?.rolloutStatus,'APPROVED');
  assert.equal(family?.enabledByDefault,true);
  assert.equal([family.baseQuestion,...family.supplementalQuestions].length,8);
});

test('Reading test receives exact long-o/short-o practice and printable keys',()=>{
  const pack={sourceHash,subjects:[{subject:'Reading / ELA',topics:[topic],studyNotes:[]}],vocabulary:[]};
  const out=buildGrade2ContentPipeline(pack,{sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true});
  assert.deepEqual(validateGrade2ContentPipeline(out),[]);
  const skill=out.skills.find(row=>row.id==='reading-long-short-o');
  const practice=questionsForTest({label:'Reading',date:'2026-11-11'},out.questions);
  assert.ok(skill);
  assert.equal(practice.length,8);
  assert(practice.every(row=>row.skill==='reading-long-short-o'));
  assert.deepEqual([...new Set(practice.map(row=>row.questionType))].sort(),['direct','reasoning','transfer']);
  assert(practice.every(row=>row.choices.filter(choice=>choice===row.answer).length===1));
  assert(practice.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert.match(skill.studyNotes.join(' '),/Teacher-style supplemental practice/i);
  assert.match(skill.studyNotes.join(' '),/silent e/i);

  const guide={label:'Reading',date:'2026-11-11',subject:'Reading / ELA',facts:skill.studyNotes,
    teacherFacts:[],vocabulary:[],practice,warnings:[],sourceLabel:'Current Reading Work topic with teacher-style supplemental practice',
    sourceCheckedAt:timestamp,coverage:{missingGuideSkills:[]}};
  const guideHtml=printableStudyGuideHtml(guide),worksheetHtml=printableWorksheetHtml(guide);
  assert.match(guideHtml,/Teacher-style supplemental practice/i);
  assert.match(worksheetHtml,/Answer Key/i);
  assert.match(worksheetHtml,/\.work-area\{min-height:\.5in/);
  assert.match(worksheetHtml,/@media print/);
  for(const question of practice){
    assert(guideHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.prompt),question.id);
  }
});
