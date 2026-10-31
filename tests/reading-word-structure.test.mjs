import assert from 'node:assert/strict';
import test from 'node:test';

import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {printableStudyGuideHtml,printableWorksheetHtml} from '../pages/study-games-materials-view.mjs';

const timestamp='2026-10-31T19:03:13.900Z';
const sourceHash='teacher-pages-reading-word-structure';
const topic='Word Structure: -ed, -ing endings (silent e & CVC words)';
const sourcePages=[{
  title:'Reading Work',
  url:'https://sites.google.com/view/abvmgr2/reading-work',
  checkedAt:timestamp,
  contentHash:'8'.repeat(64),
  lines:[topic],
}];

function build(){
  const pack={sourceHash,subjects:[{subject:'Reading / ELA',topics:[topic],studyNotes:[]}],vocabulary:[]};
  return buildGrade2ContentPipeline(pack,{sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true});
}

test('announced silent-e and CVC ending rules receive explicit practice',()=>{
  const out=build();
  assert.deepEqual(validateGrade2ContentPipeline(out),[]);
  const skill=out.skills.find(row=>row.id==='suffix-ed-ing');
  const selected=questionsForTest({label:'Reading',date:'2026-11-11'},out.questions);
  const practice=selected.filter(row=>row.skill==='suffix-ed-ing');
  assert.ok(skill);
  assert.equal(practice.length,12);
  assert(selected.some(row=>row.skill==='cvc-structure'),'the same announced topic retains its CVC recognition practice');
  assert(practice.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert(practice.every(row=>row.choices.filter(choice=>choice===row.answer).length===1));
  assert.equal(practice.find(row=>/adds -ed to “bake”/i.test(row.prompt))?.answer,'baked');
  assert.equal(practice.find(row=>/adds -ing to “bake”/i.test(row.prompt))?.answer,'baking');
  assert.equal(practice.find(row=>/adds -ing to “hop”/i.test(row.prompt))?.answer,'hopping');
  assert(practice.some(row=>/hope.*hop|hop.*hope/i.test(row.prompt) && row.questionType==='reasoning'));
  assert.match(skill.studyNotes.join(' '),/Teacher-style supplemental practice/i);
  assert.match(skill.studyNotes.join(' '),/silent e/i);
  assert.match(skill.studyNotes.join(' '),/CVC/i);
});

test('expanded word-structure practice renders in the guide and printable worksheet',()=>{
  const out=build();
  const skill=out.skills.find(row=>row.id==='suffix-ed-ing');
  const practice=questionsForTest({label:'Reading',date:'2026-11-11'},out.questions)
    .filter(row=>row.skill==='suffix-ed-ing');
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
