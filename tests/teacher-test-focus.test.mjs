import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingTeacherTests,teacherTestDateMatchesWeekday} from '../scripts/teacher-test-focus.mjs';
import {readFileSync} from 'node:fs';

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

test('a mislabeled October 20 Friday exam cannot become a 2026 Tuesday test',()=>{
  const stale={date:'Friday, Oct. 20',label:'Spelling (soft c and g) / Handwriting'};
  const reading={date:'Wednesday, Oct. 21',label:'Reading (Unit 1 Text Set 3)'};
  const current={date:'Friday, Oct. 23',label:'Spelling (long / short u)'};
  assert.equal(new Date(parser(stale)).getUTCDay(),2,'October 20 2026 was Tuesday');
  assert.equal(teacherTestDateMatchesWeekday(stale,parser(stale)),false);
  assert.equal(teacherTestDateMatchesWeekday(reading,parser(reading)),true);
  assert.equal(teacherTestDateMatchesWeekday(current,parser(current)),true);
  const safe=upcomingTeacherTests([stale,reading,current],'2026-10-20T20:00:00Z',parser);
  assert.deepEqual(safe.map(row=>row.label),[reading.label,current.label],
    'no-school Tuesday cannot inherit an old Friday spelling test');
});

test('weekday/date verification rejects rollover and bad dates without shifting them',()=>{
  assert.equal(teacherTestDateMatchesWeekday({date:'Friday, Oct. 23'},Date.UTC(2026,9,23)),true);
  assert.equal(teacherTestDateMatchesWeekday({date:'Friday, Oct. 23'},Date.UTC(2026,9,20)),false);
  assert.equal(teacherTestDateMatchesWeekday({date:'Friday, Oct. 32'},Date.UTC(2026,10,1)),false);
  assert.equal(teacherTestDateMatchesWeekday({date:'???'},Date.UTC(2026,9,23)),false);
  assert.equal(teacherTestDateMatchesWeekday({date:'Friday, Oct. 23'},Number.MAX_SAFE_INTEGER),false);
  assert.equal(teacherTestDateMatchesWeekday({date:'Friday, Oct. 23'},NaN),false);
  const mondayRange={date:'Monday–Friday, Oct. 19–23'};
  assert.equal(teacherTestDateMatchesWeekday(mondayRange,Date.UTC(2026,9,19)),true);
});

test('refresh keeps original teacher source hashes but filters invalid calendar dates everywhere',()=>{
  const refresh=readFileSync(new URL('../scripts/refresh-teacher-pages.mjs',import.meta.url),'utf8');
  assert.match(refresh,/testItems = parsedTestItems\.filter\(item =>\s*teacherTestDateMatchesWeekday/);
  assert.match(refresh,/source === 'teacher-tests' && !teacherTestDateMatchesWeekday\(item, when\)/);
  assert.match(refresh,/upcomingTeacherTests\(testItems, checkedAt/);
  assert.match(refresh,/mergeTeacherEvents\(pack\.importantDates, testItems, 'teacher-tests'/);
  assert.match(refresh,/Teacher Tests weekday\/date conflict withheld from calendar and Test Prep/);
});
