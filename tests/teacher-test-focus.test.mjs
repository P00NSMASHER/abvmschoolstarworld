import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingTeacherTests} from '../scripts/teacher-test-focus.mjs';

function parser(item) {
  const match = String(item?.date || '').match(/\bOct\.?\s+(\d{1,2})\b/i);
  return match ? Date.UTC(2026,9,Number(match[1])) : Number.MAX_SAFE_INTEGER;
}
const exams=[
  {date:'Friday, Oct. 9',label:'Spelling (short i / long i) / Handwriting'},
  {date:'Friday, Oct. 16',label:'Phonics (short vowels)'},
  {date:'Thursday, Oct. 15',label:'Math (subtraction)'},
  {date:'Thursday, Oct. 15',label:'Religion Ch. 3'},
  {date:'Friday, Oct. 16',label:'Spelling (long o / Short ) / Handwriting'},
];
test('current test focus skips expired tests and sorts the next valid Eastern dates', () => {
  const upcoming = upcomingTeacherTests(exams,'2026-10-14T23:00:00Z',parser);
  assert.deepEqual(upcoming.map(item=>item.label),[
    'Math (subtraction)','Religion Ch. 3','Phonics (short vowels)',
    'Spelling (long o / Short ) / Handwriting',
  ]);
  assert(!upcoming.some(item=>item.label.includes('short i')));
});
test('Eastern school day does not advance early in the UTC evening', () => {
  const late = upcomingTeacherTests(exams,'2026-10-16T03:30:00Z',parser);
  assert(late.some(item=>item.label==='Math (subtraction)'),'still Oct. 15 in Eastern time');
  const nextDay = upcomingTeacherTests(exams,'2026-10-16T04:30:00Z',parser);
  assert(!nextDay.some(item=>item.label==='Math (subtraction)'));
  assert(nextDay.some(item=>item.label.includes('long o')));
});
test('rejects invalid timestamps and does not treat unknown dates as upcoming', () => {
  assert.deepEqual(upcomingTeacherTests([{date:'???',label:'Unknown'}],'2026-10-14T12:00:00Z',parser),[]);
  assert.throws(()=>upcomingTeacherTests(exams,'not-a-date',parser),/Invalid teacher source check timestamp/);
});
