import test from 'node:test';
import assert from 'node:assert/strict';
import {assessUpcomingLunchCoverage,displayedSchoolWeekDates,schoolWeekLabel,preservedPostingWeek} from '../scripts/school-week-label.mjs';

test('week labels follow New York school dates and preserve the checked posting week',()=>{
  assert.equal(schoolWeekLabel('2026-10-16T22:00:00Z'), 'Week of October 12, 2026');
  assert.equal(schoolWeekLabel('2026-10-16T22:00:00Z',{calendarDisplay:true}), 'Week of October 12, 2026');
  assert.equal(schoolWeekLabel('2026-10-17T22:00:00Z'), 'Week of October 12, 2026');
  assert.equal(schoolWeekLabel('2026-10-17T22:00:00Z',{calendarDisplay:true}), 'Week of October 19, 2026');
  assert.equal(schoolWeekLabel('2026-10-18T14:00:00Z',{calendarDisplay:true}), 'Week of October 19, 2026');
  assert.equal(schoolWeekLabel('2026-10-19T14:00:00Z',{calendarDisplay:true}), 'Week of October 19, 2026');
});

test('week rollover remains correct across DST and year boundaries',()=>{
  assert.equal(schoolWeekLabel('2026-11-01T13:00:00Z',{calendarDisplay:true}), 'Week of November 2, 2026');
  assert.equal(schoolWeekLabel('2026-12-27T14:00:00Z',{calendarDisplay:true}), 'Week of December 28, 2026');
  assert.deepEqual(displayedSchoolWeekDates('2026-10-17T22:00:00Z'),[
    '2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23',
  ]);
});

test('upcoming lunch monitor checks verified archive and honors explicit school closures',()=>{
  const dates=displayedSchoolWeekDates('2026-10-17T22:00:00Z');
  const pack={lunchMenu:[{date:'2026-10-12'}],lunchArchive:dates.map(date=>({date})),importantDates:[]};
  assert.deepEqual(assessUpcomingLunchCoverage(pack,'2026-10-17T22:00:00Z').missingDates,[]);
  pack.lunchArchive=pack.lunchArchive.filter(row=>row.date!=='2026-10-22');
  assert.deepEqual(assessUpcomingLunchCoverage(pack,'2026-10-17T22:00:00Z').missingDates,['2026-10-22']);
  pack.importantDates=[{date:'Thursday, Oct. 22',label:'No School',kind:'holiday'}];
  assert.deepEqual(assessUpcomingLunchCoverage(pack,'2026-10-17T22:00:00Z').missingDates,[]);
  assert.deepEqual(assessUpcomingLunchCoverage(pack,'2026-10-17T22:00:00Z').noSchoolDates,['2026-10-22']);
});

test('invalid timestamps must fail closed rather than inventing a week',()=>{
  assert.throws(()=>schoolWeekLabel('not-a-date'),/Invalid school-week instant/);
});

test('undated homework and word lists keep their first posting week through Monday if evidence is unchanged',()=>{
  const old='Week of October 12, 2026', next='Week of October 19, 2026';
  assert.equal(preservedPostingWeek({observedWeek:next,previousWeek:old,previousFingerprint:'old-homework',currentFingerprint:'old-homework'}),old);
  assert.equal(preservedPostingWeek({observedWeek:next,previousWeek:old,previousFingerprint:'long-o-list',currentFingerprint:'long-o-list'}),old);
  assert.equal(preservedPostingWeek({observedWeek:next,previousWeek:old,previousFingerprint:'long-o-list',currentFingerprint:'new-long-u-list'}),next);
  assert.equal(preservedPostingWeek({observedWeek:next,previousWeek:old,previousFingerprint:'',currentFingerprint:'long-o-list'}),next);
  assert.throws(()=>preservedPostingWeek({observedWeek:'invalid',previousWeek:old,previousFingerprint:'a',currentFingerprint:'a'}),/Invalid observed/);
});
