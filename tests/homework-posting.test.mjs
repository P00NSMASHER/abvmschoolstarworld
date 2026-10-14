import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeTeacherHomework,shouldPublishHomework,HOMEWORK_SOURCE_URL} from '../scripts/homework-posting.mjs';

const checkedAt='2026-10-13T23:00:00.000Z';
const routine=['Read','Parents: cover books',
  'Reading log (please keep Reading log & Behavior chart in the HW folder)',
  'Everything should be returned in the HW folder'];
test('current undated teacher posting exposes specific Math and Spelling assignments only',()=>{
  const rows=summarizeTeacherHomework(['Homework','Math pg. 22','Spelling Choice Board activity',...routine],checkedAt);
  assert.equal(rows.sourceUrl,HOMEWORK_SOURCE_URL);
  assert.equal(rows.sourceDateProvided,false);
  assert.equal(rows.status,'assignments');
  assert.deepEqual(rows.assignments,[{subject:'Math',task:'Page 22'},{subject:'Spelling',task:'Spelling Choice Board activity'}]);
  assert.equal(rows.contentHash,'5632e315601ca9969a13a72c942f0abe52861d76793c51040678f4e8175b2e6a');
});
test('no-specific posting is not falsely reported as no homework',()=>{
  const rows=summarizeTeacherHomework(['Homework',...routine],checkedAt);
  assert.equal(rows.status,'no-specific-posting');
  assert.deepEqual(rows.assignments,[]);
});
test('explicit teacher no-homework wording is distinct from missing specifics',()=>{
  const rows=summarizeTeacherHomework(['Homework','No homework!'],checkedAt);
  assert.equal(rows.status,'no-homework');
});
test('missing heading and unparseable page fail closed',()=>{
  assert.throws(()=>summarizeTeacherHomework(['Different page','Math pg. 22'],checkedAt),/heading/);
  assert.throws(()=>summarizeTeacherHomework(['Homework','Unrelated notice only'],checkedAt),/verifiable academic/);
});
test('unchanged posting updates daily, or immediately when assignments change',()=>{
  const first=summarizeTeacherHomework(['Homework','Math pg. 22',...routine],checkedAt);
  const same=summarizeTeacherHomework(['Homework','Math pg. 22',...routine],'2026-10-14T07:00:00.000Z',first);
  assert.equal(same.firstObservedAt,checkedAt);
  assert.equal(shouldPublishHomework(same,first),false);
  const tomorrow=summarizeTeacherHomework(['Homework','Math pg. 22',...routine],'2026-10-14T18:00:00.000Z',first);
  assert.equal(shouldPublishHomework(tomorrow,first),true);
  const changed=summarizeTeacherHomework(['Homework','Math pg. 23',...routine],'2026-10-14T00:00:00.000Z',first);
  assert.equal(shouldPublishHomework(changed,first),true);
});
