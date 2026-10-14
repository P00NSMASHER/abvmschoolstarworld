import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSchoolMonday} from './reviewed-week-fixture.mjs';
const doc=weekLabel=>({pack:{weekLabel}});
test('checklist evidence remains anchored to original teacher week across lunch rollover',()=>{
  assert.equal(reviewedSchoolMonday(doc('Week of October 5, 2026')),'2026-10-05');
  assert.equal(reviewedSchoolMonday(doc('Week of October 12, 2026')),'2026-10-12');
  assert.equal(reviewedSchoolMonday(doc('Week of January 4, 2027')),'2027-01-04');
});
test('never re-date unreviewed teacher content from lunch freshness',()=>{
  const old=doc('Week of October 5, 2026');
  old.pack.lunchMenu=[{date:'2026-10-12',status:'no-school',items:[]}];
  assert.equal(reviewedSchoolMonday(old),'2026-10-05');
  assert.deepEqual(old.pack.lunchMenu[0].items,[]);
});
test('malformed, absent or non-Monday source refuses fabricated checklist review dates',()=>{
  for(const label of ['',undefined,'Week of October 13, 2026','Week of October 50, 2026','Week of March 0, 2027','Next week'])
    assert.throws(()=>reviewedSchoolMonday(doc(label)));
});
