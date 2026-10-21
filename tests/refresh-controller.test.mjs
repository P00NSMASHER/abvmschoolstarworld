import test from 'node:test';
import assert from 'node:assert/strict';
import * as recovery from '../scripts/source-freshness-recovery.mjs';

// Exercise the public recovery interface; missing behavior fails an assertion.
function due(kind,now,checkedAt){
  assert.equal(typeof recovery.scheduledSourceDue,'function','schedule-aware recovery policy is required');
  return recovery.scheduledSourceDue({kind,now,checkedAt});
}
const base=()=>({curriculumFresh:true,homeworkFresh:true,refreshCurriculum:false,refreshHomework:false,redeploy:false,caution:[]});
function plan(assessment,now,checkedAt){
  assert.equal(typeof recovery.reconcileScheduledSources,'function','a recovery controller is required');
  return recovery.reconcileScheduledSources(assessment,{now,checkedAt});
}
test('missed afternoon teacher scan is due before the old 20-hour stale limit',()=>{
  const result=due('curriculum','2026-10-21T22:00:00Z','2026-10-21T13:50:00Z');
  assert.equal(result.due,true);
  assert.equal(result.expectedSchoolDate,'2026-10-21');
  assert.equal(result.expectedLocalTime,'15:47');
});
test('missed hourly Homework polling is due before the old 8-hour limit',()=>{
  assert.equal(due('homework','2026-10-21T20:00:00Z','2026-10-21T16:30:00Z').due,true);
});
test('delayed but completed scan receives its full 90-minute schedule grace',()=>{
  assert.equal(due('curriculum','2026-10-21T19:00:00Z','2026-10-21T17:20:00Z').due,false);
  assert.equal(due('homework','2026-10-21T20:00:00Z','2026-10-21T18:25:00Z').due,false);
});
test('midnight does not invent a new scheduled source deadline',()=>{
  const result=due('curriculum','2026-10-22T04:30:00Z','2026-10-21T20:00:00Z');
  assert.equal(result.expectedSchoolDate,'2026-10-21');
  assert.equal(result.due,false);
});
test('morning deadline and Sunday DST follow New York time, not fixed UTC',()=>{
  assert.equal(due('curriculum','2026-11-01T12:46:00Z','2026-10-31T20:00:00Z').due,false);
  assert.equal(due('curriculum','2026-11-01T12:48:00Z','2026-10-31T20:00:00Z').due,true);
  assert.equal(due('curriculum','2026-03-08T11:48:00Z','2026-03-07T21:00:00Z').due,true);
});
test('invalid and future evidence never satisfies a scheduled check',()=>{
  for(const checkedAt of [undefined,'invalid','2026-10-22T20:00:00Z']){
    assert.equal(due('homework','2026-10-21T20:00:00Z',checkedAt).due,true);
  }
});
test('an invalid clock blocks rather than authorizing actions',()=>{
  const result=plan({...base(),refreshCurriculum:true},'invalid',{});
  assert.equal(result.phase,'evidence-incomplete');
  assert.equal(result.refreshCurriculum,false);
  assert.equal(result.refreshHomework,false);
  assert.equal(result.redeploy,false);
  assert.ok(result.caution.includes('invalid-controller-clock'));
});
test('controller requests missing scans without editing accepted evidence',()=>{
  const input=base(),original=structuredClone(input);
  const checkedAt={curriculum:'2026-10-21T13:50:00Z',homework:'2026-10-21T16:30:00Z'};
  const result=plan(input,'2026-10-21T22:00:00Z',checkedAt);
  assert.equal(result.refreshCurriculum,true);
  assert.equal(result.refreshHomework,true);
  assert.equal(result.phase,'refresh-required');
  assert.deepEqual(input,original);
  assert.equal(checkedAt.curriculum,'2026-10-21T13:50:00Z');
});
test('fresh verified source plus publication mismatch requests only publication',()=>{
  const result=plan({...base(),redeploy:true},'2026-10-21T22:00:00Z',{
    curriculum:'2026-10-21T21:50:00Z',homework:'2026-10-21T21:50:00Z'});
  assert.equal(result.phase,'publish-required');
  assert.equal(result.refreshCurriculum,false);
  assert.equal(result.refreshHomework,false);
});
test('missing public evidence is not reported as current or repaired',()=>{
  const result=plan({...base(),caution:['live-homework-unavailable']},'2026-10-21T22:00:00Z',{
    curriculum:'2026-10-21T21:50:00Z',homework:'2026-10-21T21:50:00Z'});
  assert.equal(result.phase,'evidence-incomplete');
  assert.equal(result.redeploy,false);
});
test('healthy parity is an explicit no-op',()=>{
  const result=plan(base(),'2026-10-21T22:00:00Z',{
    curriculum:'2026-10-21T21:50:00Z',homework:'2026-10-21T21:50:00Z'});
  assert.equal(result.phase,'current');
  assert.equal(result.refreshCurriculum||result.refreshHomework||result.redeploy,false);
});
