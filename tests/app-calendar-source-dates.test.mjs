import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the real source parsing functions without booting the production PWA,
// reading student state, or introducing test-only exports in the browser bundle.
const source=readFileSync(new URL('../pages/app.js',import.meta.url),'utf8');
const parser=source.match(/^function parseDate\(text\)\{[\s\S]*?^\}/m)?.[0];
const range=source.match(/^function eventDateRange\(text\)\{[\s\S]*?^\}/m)?.[0];
assert.ok(parser&&range,'source calendar functions must remain under regression coverage');
function api(year=2026){
  const scope={Date};
  vm.runInNewContext(`
    const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
    function today(){return new Date(${year},9,31,12)}
    ${parser}
    ${range}
    globalThis.sourceDates={parseDate,eventDateRange};
  `,scope);
  return scope.sourceDates;
}
const dayKey=date=>date?[
  date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')
].join('-'):null;
const rangeKeys=dates=>dates?Array.from(dates,dayKey):null;

test('malformed source month days never become invented school dates',()=>{
  const dates=api();
  for(const invalid of ['Feb 29','Feb 30','Apr 31','Jun 31','Oct 0','Oct 32','Nov 31','Feb 00']){
    assert.equal(dayKey(dates.parseDate(invalid)),null,invalid);
    assert.equal(rangeKeys(dates.eventDateRange(invalid)),null,invalid);
  }
});

test('year crossover, leap day, and valid source date controls survive',()=>{
  const dates=api();
  assert.equal(dayKey(dates.parseDate('Oct 31')),'2026-10-31');
  assert.equal(dayKey(dates.parseDate('Jan 1')),'2027-01-01');
  assert.equal(dayKey(dates.parseDate('Feb 28')),'2027-02-28');
  assert.equal(dayKey(api(2027).parseDate('Feb 29')),'2028-02-29');
  assert.deepEqual(rangeKeys(dates.eventDateRange('Sep 21–25')),['2026-09-21','2026-09-25']);
  assert.deepEqual(rangeKeys(dates.eventDateRange('Dec 31–Jan 2')),['2026-12-31','2027-01-02']);
  assert.deepEqual(rangeKeys(dates.eventDateRange('Oct 31–Nov 2')),['2026-10-31','2026-11-02']);
});

test('impossible or backwards source ranges are excluded entirely',()=>{
  const dates=api();
  for(const input of ['Feb 27–30','Oct 30–Oct 1','Oct 31–Nov 32','Apr 31–May 2','Nov 30–31','Oct 0–2']){
    assert.equal(rangeKeys(dates.eventDateRange(input)),null,input);
  }
  assert.deepEqual(rangeKeys(dates.eventDateRange('Oct 30–31')),['2026-10-30','2026-10-31']);
});
