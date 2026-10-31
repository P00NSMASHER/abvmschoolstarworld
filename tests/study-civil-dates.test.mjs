import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolDay, studyAssessmentDay, weekBounds, nextTests, visibleArchive} from '../pages/study-model.mjs';

test('date-only school inputs reject impossible civil days instead of normalizing or inventing a week', () => {
  for (const value of [
    '2026-02-29', '2026-02-30', '2026-04-31', '2026-06-31',
    '2026-00-01', '2026-13-01', '2026-10-00', '2026-10-32',
    '1900-02-29', '2100-02-29',
  ]) {
    assert.throws(() => schoolDay(value), /Invalid study date/, value);
    assert.throws(() => studyAssessmentDay(value), /Invalid study date/, value);
    assert.throws(() => weekBounds(value), /Invalid study date/, value);
    assert.throws(() => visibleArchive({notes: []}, value), /Invalid study date/, value);
  }
});

test('leap days, historical centuries, DST boundaries, and valid date-only contracts survive', () => {
  for (const value of ['2000-02-29', '2024-02-29', '2026-03-01', '2026-11-01', '2026-12-31']) {
    assert.equal(schoolDay(value), value);
    assert.equal(studyAssessmentDay(value), value);
  }
  assert.deepEqual(weekBounds('2026-11-01'), {start:'2026-10-26',end:'2026-11-01'});
  assert.equal(schoolDay('2026-11-01T06:30:00Z'), '2026-11-01');
});

test('impossible and malformed school test dates cannot displace a verified future assessment', () => {
  const events = [
    null, {}, {date:'2026-02-29',label:'Invalid February 29'},
    {date:'2026-02-30',label:'Invented school day'},
    {date:'2026-04-31',label:'Invented April 31'},
    {date:'2026-03-01',label:'Verified Sunday'},
    {date:'2026-03-02',label:'Verified Monday'},
  ];
  assert.deepEqual(nextTests(events,'2026-02-28').map(row=>row.label), ['Verified Sunday']);
  assert.deepEqual(nextTests(events,'2026-03-01').map(row=>row.label), ['Verified Sunday']);
  assert.deepEqual(nextTests(events,'2026-03-02').map(row=>row.label), ['Verified Monday']);
  assert.deepEqual(nextTests(events.slice(0,5),'2026-02-28'), []);
  assert.deepEqual(nextTests(null,'2026-02-28'), []);
});

test('the same strict civil-date guard excludes invalid archived date-only evidence', () => {
  const archive={notes:[
    {id:'bad',firstSeenAt:'2026-02-30'},
    {id:'good',firstSeenAt:'2026-02-28'},
    {id:'future',firstSeenAt:'2026-03-01'},
  ]};
  assert.deepEqual(visibleArchive(archive,'2026-02-28').notes.map(x=>x.id), ['good']);
});
