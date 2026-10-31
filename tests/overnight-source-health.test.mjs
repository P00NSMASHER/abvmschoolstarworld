import test from 'node:test';
import assert from 'node:assert/strict';
import {assessDailySchoolSources} from '../scripts/source-freshness-recovery.mjs';
function input(now,checked){
  const curriculum={delivery:'verified',sourceLastCheckedAt:checked,
    sourcePages:['Home','Homework','Reading Work','Weekly Spelling List','Tests','Religion']
      .map(title=>({title,checkedAt:checked,contentHash:'verified-'+title})),
    pack:{sourceSufficient:true,sourceCheckedAt:checked,sourceHash:'verified-source'}};
  const homework={schemaVersion:1,status:'assignments',checkedAt:checked,
    firstObservedAt:'2026-10-20T14:00:00Z',contentChangedAt:'2026-10-20T14:00:00Z',
    contentHash:'verified-homework',assignments:[{subject:'Math',task:'Page 29-30'}]};
  return {now,curriculum,homework,publishedCurriculum:structuredClone(curriculum),publishedHomework:structuredClone(homework)};
}
test('Eastern midnight cannot make a ten-minute-old verified check stale before the next school poll',()=>{
  const data=input('2026-10-22T04:05:00Z','2026-10-22T03:55:00Z'),before=structuredClone(data);
  const result=assessDailySchoolSources(data);
  assert.equal(result.easternDate,'2026-10-22');
  assert.equal(result.curriculumFresh,true);
  assert.equal(result.homeworkFresh,true);
  assert.equal(result.refreshCurriculum||result.refreshHomework||result.redeploy,false);
  assert.deepEqual(data,before,'do not rewrite observation, content-change or assignment dates');
});
test('overnight acceptance works across spring DST, fall DST and year boundaries',()=>{
  for(const [now,checked] of [
    ['2026-03-08T05:05:00Z','2026-03-08T04:55:00Z'],
    ['2026-11-01T04:05:00Z','2026-11-01T03:55:00Z'],
    ['2026-11-01T06:05:00Z','2026-11-01T03:55:00Z'],
    ['2027-01-01T05:05:00Z','2027-01-01T04:55:00Z'],
  ]){
    const result=assessDailySchoolSources(input(now,checked));
    assert.equal(result.curriculumFresh,true,now);
    assert.equal(result.homeworkFresh,true,now);
  }
});
test('previous-day proof expires at the first scheduled morning deadline, not at midnight',()=>{
  const checked='2026-10-22T03:55:00Z';
  const before=assessDailySchoolSources(input('2026-10-22T11:36:00Z',checked));
  assert.equal(before.curriculumFresh,true);assert.equal(before.homeworkFresh,true);
  const teacherDue=assessDailySchoolSources(input('2026-10-22T11:48:00Z',checked));
  assert.equal(teacherDue.curriculumFresh,false);
  const homeworkDue=assessDailySchoolSources(input('2026-10-22T11:38:00Z',checked));
  assert.equal(homeworkDue.homeworkFresh,false);
});
test('a genuinely missed last scan stays stale overnight',()=>{
  const result=assessDailySchoolSources(input('2026-10-22T04:05:00Z','2026-10-21T19:00:00Z'));
  assert.equal(result.curriculumFresh,false,'missed 3:47 p.m. teacher scan');
  assert.equal(result.homeworkFresh,false,'missed later Homework scans');
});
test('overnight handling preserves hard age, future-time and source identity checks',()=>{
  assert.equal(assessDailySchoolSources(input('2026-10-22T11:30:00Z','2026-10-22T03:23:00Z')).homeworkFresh,false,'eight-hour maximum unchanged');
  for(const checked of ['invalid','2026-10-22T04:30:00Z']){
    const result=assessDailySchoolSources(input('2026-10-22T04:05:00Z',checked));
    assert.equal(result.curriculumFresh||result.homeworkFresh,false);
  }
  const invalid=input('2026-10-22T04:05:00Z','2026-10-22T03:55:00Z');
  invalid.curriculum.sourcePages[0].contentHash='';invalid.homework.schemaVersion=0;
  const result=assessDailySchoolSources(invalid);
  assert.equal(result.curriculumFresh||result.homeworkFresh,false);
});
