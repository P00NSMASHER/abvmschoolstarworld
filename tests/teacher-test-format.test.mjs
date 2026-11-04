import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherTestReferenceForGuide,canRenderTeacherLetterChoice,teacherFormatSummary} from '../pages/teacher-test-format.mjs';
import {renderTestWorksheet,renderTestStudyGuide} from '../pages/test-study-pair.mjs';

const sample=(label,practice,extra={})=>({
  label,subject:'Religion',date:'2026-11-03',
  facts:['Reviewed Grade 2 lesson content.'],
  practice,
  sourceLabel:'Original classroom-aligned practice, not teacher test questions',
  warnings:[],
  ...extra
});

const item=(id,choices=['a checked first idea','a checked second idea','a checked third idea'])=>({
  id:'original-'+id,skill:'original-topic-'+id,
  prompt:'Which new explanation fits lesson idea '+id+'?',
  choices,answer:choices[1],
  explanation:'A reviewed original explanation.',
});

test('past actual test references retain only anonymous structural information',()=>{
  const unit=teacherTestReferenceForGuide(sample('Religion Ch. 4',[]));
  assert.deepEqual(
    [unit.kind,unit.optionCount,unit.referenceCount,unit.columns,unit.response],
    ['letter-choice',3,20,2,'write-letter']);
  const chapter1=teacherTestReferenceForGuide(sample('Religion Chapter 1',[]));
  assert.equal(chapter1.kind,'word-bank');
  assert.equal(chapter1.referenceCount,10);
  const spelling=teacherTestReferenceForGuide(sample('Spelling and Handwriting',[],{subject:'Spelling / Handwriting'}));
  assert.equal(spelling.kind,'dictation');
  assert.equal(spelling.referenceCount,15);
  assert.equal(spelling.bonusObserved,true);
  assert.equal(teacherTestReferenceForGuide(sample('Reading Unit 1 Text Set 4',[],{subject:'Reading / ELA'})),null);
});

test('future explicit references must be verified and structurally bounded',()=>{
  const guide=sample('Religion Chapter 7',[],{teacherTestFormat:{
    verifiedFrom:'actual-teacher-test',kind:'letter-choice',columns:2,optionCount:4,referenceCount:24,
    studentName:'KEEP_PRIVATE',teacherAnswerText:'KEEP_PRIVATE'
  }});
  const profile=teacherTestReferenceForGuide(guide);
  assert.equal(profile.kind,'letter-choice');
  assert.equal(profile.optionCount,4);
  assert.equal(profile.referenceCount,24);
  assert.equal(profile.columns,2);
  assert.doesNotMatch(JSON.stringify(profile),/KEEP_PRIVATE/);
  assert.equal(teacherTestReferenceForGuide({...guide,teacherTestFormat:{kind:'letter-choice'}}),null);
  assert.equal(teacherTestReferenceForGuide({...guide,teacherTestFormat:{
    verifiedFrom:'actual-teacher-test',kind:'unsupported',optionCount:3}}),null);
});

test('the actual teacher-style print layout keeps every original question and answer option',()=>{
  const questions=Array.from({length:20},(_,i)=>item(i+1));
  const guide=sample('Religion Ch. 4',questions);
  assert.equal(canRenderTeacherLetterChoice(guide,questions),true);
  const html=renderTestWorksheet(guide);
  const student=html.split('<section class="sheet adult-key">')[0];
  const parent=html.split('<section class="sheet adult-key">')[1];
  assert.match(student,/class="sheet student-test teacher-letter-choice"/);
  assert.match(student,/class="teacher-answer-blank"/);
  assert.match(student,/teacher-letter-choice-problems/);
  assert.match(student,/columns:2/);
  assert.match(student,/Write the letter of the best answer on the line/);
  assert.doesNotMatch(student,/class="bubble"/,'letter-on-line replaces bubbling');
  assert.equal((student.match(/class="teacher-letter-choice-item"/g)||[]).length,20);
  assert.equal((student.match(/class="teacher-choice-row"/g)||[]).length,60);
  assert.ok(student.includes('20.'),'the 20th question must not disappear');
  assert.doesNotMatch(student,/A reviewed original explanation/,'student paper does not reveal answer explanation');
  assert.match(parent,/Parent Answer Key/);
  assert.match(parent,/A reviewed original explanation/);
  for(const q of questions)assert.ok(student.includes(q.prompt),q.prompt+' retained');
});

test('study guide identifies observed exam format as example rather than forecasting an unseen test',()=>{
  const guide=sample('Religion Ch. 4',[item(1)]);
  const html=renderTestStudyGuide(guide);
  assert.match(html,/Previous actual test format \(example only\)/);
  assert.match(html,/three|3 choices/i);
  assert.match(html,/not a guarantee about the next test/i);
});

test('unknown or mismatched formats never rewrite the question or manufacture content',()=>{
  const guide=sample('Religion Ch. 4',[item(1),item(2,['red','blue'])]);
  assert.equal(canRenderTeacherLetterChoice(guide,guide.practice),false);
  const html=renderTestWorksheet(guide);
  const student=html.split('<section class="sheet adult-key">')[0];
  assert.doesNotMatch(student,/class="teacher-letter-choice-item"/);
  assert.ok(student.includes(guide.practice[1].prompt));
  assert.equal((student.match(/class="problem pick-problem"/g)||[]).length,2);
  assert.match(teacherFormatSummary(guide),/observed format/);
});
