import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDailySchoolSources, reviewedLunchWeekReady, easternSchoolDay, probeOfficialHomework, applyOfficialHomeworkObservation } from '../scripts/source-freshness-recovery.mjs';
import {summarizeTeacherHomework} from '../scripts/homework-posting.mjs';
import {reconcileScheduledSources} from '../scripts/refresh-controller.mjs';
import {CATALOG, catalogMeals, schoolWeek, lunchDigest} from '../scripts/lunch-publication.mjs';

const DAYS = ['Home', 'Homework', 'Reading Work', 'Weekly Spelling List', 'Tests', 'Religion'];
function teacherPack(stamp = '2026-10-15T14:00:00Z') {
  const at=Number.isFinite(Date.parse(stamp))?new Date(stamp):new Date('2026-10-15T14:00:00Z');
  const dates=schoolWeek(at);
  const menu=catalogMeals().filter(row=>dates.includes(row.date));
  const pack={
    sourceSufficient: true,sourceCheckedAt:stamp,
    sourceHash:'teacher-pages-current',uploadedNoticeHash:'reviewed-notices-current',
    lunchMenu:menu,
    lunchMenuSource:{
      school:CATALOG.school,provider:CATALOG.provider,
      weekStart:dates[0],weekEnd:dates.at(-1),
      retrievalState:'unavailable',missingDates:dates.filter(day=>!menu.some(row=>row.date===day)),
    },
  };
  pack.lunchMenuHash=lunchDigest(pack);
  return {
    delivery:'verified',sourceLastCheckedAt:stamp,
    sourcePages:DAYS.map(title=>({title,checkedAt:stamp,contentHash:title+'-hash'})),
    pack,
  };
}
function homework(stamp = '2026-10-15T17:00:00Z') {
  return {schemaVersion:1,status:'assignments',checkedAt:stamp,
    contentHash:'current-hw-hash',assignments:[{subject:'Math',task:'Math paper'}]};
}
const NOW = '2026-10-15T23:00:00Z';

test('one successful check each school day is enough without teacher or educator signoff', () => {
  const curriculum=teacherPack(), assignments=homework();
  const status=assessDailySchoolSources({now:NOW,curriculum,homework:assignments,
    publishedCurriculum:structuredClone(curriculum),publishedHomework:structuredClone(assignments)});
  assert.equal(status.easternDate,'2026-10-15');
  assert.equal(status.curriculumFresh,true);
  assert.equal(status.homeworkFresh,true);
  assert.equal(status.refreshCurriculum,false);
  assert.equal(status.refreshHomework,false);
  assert.equal(status.redeploy,false);
  assert.deepEqual(status.caution,[]);
});

test('Monday lunch rollover dispatches the isolated writer while teacher and Homework sources remain fresh',()=>{
  const now='2026-10-26T11:05:00Z';
  const curriculum=teacherPack('2026-10-25T22:47:24Z');
  const assignments=homework('2026-10-26T10:23:00Z');
  const status=assessDailySchoolSources({now,curriculum,homework:assignments,
    publishedCurriculum:structuredClone(curriculum),publishedHomework:structuredClone(assignments)});
  assert.equal(status.curriculumFresh,true,'Sunday teacher check remains fresh before Monday grace expires');
  assert.equal(status.homeworkFresh,true);
  assert.equal(status.reviewedLunchWeekCurrent,false);
  assert.equal(status.refreshCurriculum,false);
  assert.equal(status.refreshHomework,false);
  assert.equal(status.refreshReviewedLunch,true);
  assert.equal(status.redeploy,false);
  const plan=reconcileScheduledSources(status,{
    now,checkedAt:{curriculum:curriculum.sourceLastCheckedAt,homework:assignments.checkedAt},
  });
  assert.equal(plan.phase,'refresh-required');
  assert.equal(plan.refreshReviewedLunch,true);
  assert.equal(plan.refreshCurriculum,false);
});

test('a changed or missing reviewed lunch row cannot be disguised by correct week dates',()=>{
  const now='2026-10-26T13:00:00Z';
  const curriculum=teacherPack('2026-10-26T12:00:00Z');
  assert.equal(reviewedLunchWeekReady(curriculum,now),true);
  curriculum.pack.lunchMenu[0].items=['Unreviewed lunch'];
  assert.equal(reviewedLunchWeekReady(curriculum,now),false);
  const status=assessDailySchoolSources({now,curriculum,homework:homework('2026-10-26T12:05:00Z')});
  assert.equal(status.refreshReviewedLunch,true);
  assert.equal(status.refreshCurriculum,false,'do not refresh unrelated teacher content');
  assert.equal(reviewedLunchWeekReady({pack:{}},now),false,'missing lunch proof must not be accepted');
  assert.equal(reviewedLunchWeekReady(curriculum,'invalid-date'),false);
});

test('an unchanged teacher source still needs a check on the next Eastern day', () => {
  const data=assessDailySchoolSources({
    now:NOW,
    curriculum:teacherPack('2026-10-14T22:40:00Z'),
    homework:homework('2026-10-14T22:40:00Z'),
  });
  assert.equal(data.curriculumFresh,false);
  assert.equal(data.homeworkFresh,false);
  assert.equal(data.refreshCurriculum,true);
  assert.equal(data.refreshHomework,true);
});

test('source verification cannot be replaced with a fresh notice or an invented check time', () => {
  const curriculum=teacherPack();
  curriculum.sourcePages[4].contentHash='';
  const status=assessDailySchoolSources({now:NOW,curriculum,homework:homework()});
  assert.equal(status.refreshCurriculum,true);
  assert.equal(status.refreshHomework,false);
  curriculum.sourcePages[4].contentHash='fixed';
  curriculum.pack.sourceCheckedAt='2026-10-14T14:00:00Z';
  assert.equal(assessDailySchoolSources({now:NOW,curriculum,homework:homework()}).refreshCurriculum,true);
});

test('old school data or unverifiable timestamps must trigger recovery, never a fake refresh', () => {
  const stale=assessDailySchoolSources({now:NOW,curriculum:teacherPack('2026-10-15T01:00:00Z'),
    homework:homework('2026-10-15T01:00:00Z')});
  assert.equal(stale.refreshCurriculum,true);
  assert.equal(stale.refreshHomework,true);
  const invalid=assessDailySchoolSources({now:NOW,curriculum:teacherPack('not-a-date'),homework:homework('not-a-date')});
  assert.equal(invalid.refreshCurriculum,true);
  assert.equal(invalid.refreshHomework,true);
});

test('a verified repository update absent from Pages triggers redeployment without modifying source facts', () => {
  const curriculum=teacherPack(), assignments=homework();
  const oldLive=teacherPack('2026-10-14T14:00:00Z');
  const check=assessDailySchoolSources({now:NOW,curriculum,homework:assignments,
    publishedCurriculum:oldLive,publishedHomework:structuredClone(assignments)});
  assert.equal(check.refreshCurriculum,false);
  assert.equal(check.refreshHomework,false);
  assert.equal(check.curriculumLiveMatches,false);
  assert.equal(check.homeworkLiveMatches,true);
  assert.equal(check.redeploy,true);
});

test('homework-only publication lag also triggers a Pages release', () => {
  const curriculum=teacherPack(), assignments=homework();
  const check=assessDailySchoolSources({now:NOW,curriculum,homework:assignments,
    publishedCurriculum:structuredClone(curriculum),publishedHomework:homework('2026-10-14T17:00:00Z')});
  assert.equal(check.redeploy,true);
  assert.equal(check.homeworkLiveMatches,false);
});

test('an inaccessible live file is explicitly unknown and cannot authorize an invented deployment', () => {
  const check=assessDailySchoolSources({now:NOW,curriculum:teacherPack(),homework:homework()});
  assert.equal(check.redeploy,false);
  assert.equal(check.curriculumLiveMatches,null);
  assert.equal(check.homeworkLiveMatches,null);
  assert.deepEqual(check.caution,['live-curriculum-unavailable','live-homework-unavailable']);
});

test('Eastern calendar days are preserved through midnight and daylight-saving changes', () => {
  assert.equal(easternSchoolDay('2026-10-15T03:30:00Z'),'2026-10-14');
  assert.equal(easternSchoolDay('2026-10-15T04:30:00Z'),'2026-10-15');
  assert.equal(easternSchoolDay('2026-11-01T05:30:00Z'),'2026-11-01');
  assert.equal(easternSchoolDay('2026-11-01T06:30:00Z'),'2026-11-01');
});

// Execute the actual workflow dispatcher with a local GitHub CLI substitute.
// Successful owner dispatches must not exhaust the bounded failure budget.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
function dispatchRecovery(runs) {
  const workflow=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('          maybe_dispatch()');
  const end=workflow.indexOf('          curriculum=',start);
  const body=workflow.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');
  return spawnSync('bash',['-c',`set -euo pipefail
    gh() { if [[ "$1" == run ]]; then printf '%s' "$RUNS"; else echo DISPATCHED; fi; }
    ${body}
    maybe_dispatch refresh-current-homework.yml true`],{
      encoding:'utf8',env:{...process.env,RUNS:JSON.stringify(runs)},
    });
}
const recoveryRun=(conclusion,event='workflow_dispatch',status='completed')=>({
  status,event,conclusion,createdAt:new Date().toISOString(),
});
test('successful manual checks do not spend failed-recovery budget',()=>{
  const result=dispatchRecovery([recoveryRun('success'),recoveryRun('success')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/DISPATCHED/);
});
test('two failed dispatches retain the daily retry bound',()=>{
  const result=dispatchRecovery([recoveryRun('failure'),recoveryRun('cancelled')]);
  assert.equal(result.status,1);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});
test('an active source refresh prevents duplicate recovery dispatch',()=>{
  const result=dispatchRecovery([recoveryRun(null,'schedule','in_progress')]);
  assert.equal(result.status,0);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('matching source stamps cannot conceal an old question bank, false test date or lunch data',()=>{
  const curriculum=teacherPack(), assignments=homework();
  curriculum.pack.contentPipeline={bankFingerprint:'safe-bank',questions:[{id:'noun',answer:'Chicago'}]};
  curriculum.pack.importantDates=[{date:'Thursday, Oct. 29',label:'Grammar (common & proper nouns)',kind:'test'}];
  curriculum.pack.lunchMenuHash='lunch-v1';
  const corruptions=[
    live=>{live.pack.contentPipeline.questions[0].answer='city';},
    live=>{live.pack.importantDates.push({date:'Friday, Oct. 20',label:'Invalid spelling',kind:'test'});},
    live=>{live.pack.lunchMenuHash='stale-lunch';},
    live=>{live.sourcePages[4].contentHash='stale-tests-page';},
  ];
  for(const corrupt of corruptions){
    const live=structuredClone(curriculum);
    corrupt(live);
    const status=assessDailySchoolSources({now:NOW,curriculum,homework:assignments,
      publishedCurriculum:live,publishedHomework:structuredClone(assignments)});
    assert.equal(status.curriculumFresh,true);
    assert.equal(status.curriculumLiveMatches,false,'same timestamp cannot hide stale content');
    assert.equal(status.redeploy,true,'the guarded Pages workflow must recover mismatched public data');
    assert.equal(status.refreshCurriculum,false,'do not fabricate new teacher evidence');
  }
});

test('live watchdog enforces complete JSON parity and the recovery event is repository scoped',()=>{
  const check=readFileSync(new URL('../scripts/check-refresh-health.mjs',import.meta.url),'utf8');
  assert.ok(check.includes('JSON.stringify(local)===JSON.stringify(live)'));
  const workflow=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_run:\s+workflows:\s+- Monitor ABVM refresh health\s+types: \[completed\]/);
  assert.ok(workflow.includes("workflow_run.head_branch == 'main'"));
  assert.ok(workflow.includes('workflow_run.head_repository.full_name == github.repository'));
  assert.match(workflow,/attempts >= 6/);
  assert.match(workflow,/count >= 2/);
});

test('late-night Homework misses receive two independent post-grace recovery wake-ups',()=>{
  const recovery=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  const watchdog=readFileSync(new URL('../.github/workflows/refresh-health.yml',import.meta.url),'utf8');
  assert.match(recovery,/- cron: '59 0 \* \* \*'\n\s+timezone: 'America\/New_York'/);
  assert.match(watchdog,/- cron: '53 0 \* \* \*'\n\s+timezone: 'America\/New_York'/);
  assert.match(recovery,/workflow_run:\s+workflows:\s+- Monitor ABVM refresh health\s+types: \[completed\]/);
});

test('six same-day successful dispatches cannot start a watchdog feedback loop',()=>{
  const result=dispatchRecovery(Array.from({length:6},()=>recoveryRun('success')));
  assert.equal(result.status,1);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('unchanged Homework source timestamps and hashes cannot hide stale assignments',()=>{
  const curriculum=teacherPack(), assignments=homework();
  const changes=[
    live=>{live.assignments[0].task='Different worksheet';},
    live=>{live.status='no-homework';},
    live=>{live.assignments.push({subject:'Spelling',task:'Unverified extra task'});},
  ];
  for(const change of changes){
    const publishedHomework=structuredClone(assignments);
    change(publishedHomework);
    const result=assessDailySchoolSources({now:NOW,curriculum,homework:assignments,
      publishedCurriculum:structuredClone(curriculum),publishedHomework});
    assert.equal(result.homeworkFresh,true);
    assert.equal(result.homeworkLiveMatches,false);
    assert.equal(result.redeploy,true);
    assert.equal(result.refreshHomework,false);
  }
});

test('verified official Homework changes dispatch recovery even while published metadata is fresh',async()=>{
  const prior=summarizeTeacherHomework(['Homework','Math Page 28'],'2026-10-21T15:21:51Z');
  const official='https://sites.google.com/view/abvmgr2/homework';
  const readPage=task=>async()=>({
    ok:true,url:official,text:async()=>'<h1>Homework</h1><p>'+task+'</p>'
  });
  const changed=await probeOfficialHomework(prior,{fetchImpl:readPage('Math Page 29-30'),
    now:'2026-10-21T18:25:00Z'});
  assert.equal(changed.available,true);
  assert.equal(changed.changed,true);
  const fresh=assessDailySchoolSources({now:'2026-10-21T18:25:00Z',
    curriculum:teacherPack('2026-10-21T15:42:00Z'),homework:prior});
  assert.equal(fresh.refreshHomework,false,'the prior fresh timestamp alone misses changed assignments');
  const plan=applyOfficialHomeworkObservation(fresh,changed);
  assert.equal(plan.officialHomeworkChanged,true);
  assert.equal(plan.refreshHomework,true,'verified new teacher content must dispatch existing guarded refresh');
  assert.equal(plan.refreshCurriculum,false);
  const unchanged=await probeOfficialHomework(prior,{fetchImpl:readPage('Math Page 28'),
    now:'2026-10-21T18:25:00Z'});
  assert.equal(unchanged.changed,false);
  assert.equal(applyOfficialHomeworkObservation(fresh,unchanged).refreshHomework,false);
});

test('inaccessible or redirected Homework source cannot invent a verified change',async()=>{
  const prior=summarizeTeacherHomework(['Homework','Math Page 28'],'2026-10-21T15:21:51Z');
  await assert.rejects(probeOfficialHomework(prior,{fetchImpl:async()=>({
    ok:true,url:'https://sites.google.com/view/other-class/homework',
    text:async()=>'<h1>Homework</h1><p>Math Page 30</p>'
  })}),/redirected outside/);
  await assert.rejects(probeOfficialHomework(prior,{fetchImpl:async()=>({
    ok:false,status:503,url:'https://sites.google.com/view/abvmgr2/homework'
  })}),/HTTP 503/);
  const old={refreshHomework:false,caution:[]};
  const result=applyOfficialHomeworkObservation(old,{available:false,error:'unreachable'});
  assert.equal(result.refreshHomework,false);
  assert.equal(result.officialHomeworkChanged,null);
  assert.deepEqual(result.caution,['official-homework-unavailable']);
});

test('reviewed lunch cron and bounded watchdog recovery are independently wired',()=>{
  const lunch=readFileSync(new URL('../.github/workflows/refresh-reviewed-lunch-week.yml',import.meta.url),'utf8');
  const recovery=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(lunch,/cron: '11 0 \* \* \*'/);
  assert.match(lunch,/cron: '37 5 \* \* 1'/);
  assert.match(lunch,/node scripts\/refresh-reviewed-lunch\.mjs --write/);
  assert.match(lunch,/npm run qa/);
  assert.match(lunch,/git push origin HEAD:main/);
  assert.match(lunch,/reconcile_latest_main: true/);
  assert.match(recovery,/maybe_dispatch refresh-reviewed-lunch-week\.yml "\$lunch"/);
  assert.match(recovery,/&& "\$lunch" == false/);
  assert.match(pages,/Roll forward ABVM reviewed lunch week/);
});
