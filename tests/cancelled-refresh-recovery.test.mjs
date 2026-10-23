import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectRecoveredCancelledRefresh} from '../scripts/health-evidence.mjs';
import {collectHealthHistory} from '../scripts/fetch-health-history.mjs';

const step=(name,conclusion='success')=>({name,status:'completed',conclusion});
function fixture(){
  const refreshRun={id:700,name:'Refresh ABVM teacher pages',head_branch:'main',
    status:'completed',conclusion:'cancelled',created_at:'2026-10-22T15:20:51Z',updated_at:'2026-10-22T17:07:46Z'};
  const source={name:'refresh',status:'completed',conclusion:'success',steps:[
    step('Verify page-exact source parity and isolate unsupported curriculum'),
    step('Verify refreshed source health'),step('Validate the candidate app before changing main'),
    step('Commit refreshed pack against latest main'),step('Confirm exact published main SHA for gated Pages handoff')]};
  const lunch={name:'Refresh reviewed lunch week independently of held curriculum',
    status:'completed',conclusion:'success',steps:[
      step('Refresh only previously reviewed source-backed lunch fields'),
      step('Prove lunch isolation and negative-case integrity'),
      step('Confirm current protected-main SHA after lunch verification')]};
  const deploy={name:'deploy verified refresh through Pages workflow / deploy',
    status:'completed',conclusion:'cancelled',steps:[
      step('Admit exact current protected-main commit'),
      step('Verify checked-out source identity'),
      step('Install Chromium and WebKit','cancelled'),step('Run release QA','skipped'),
      step('Deploy','skipped'),step('Verify live lunch data and visible mobile flows','skipped')]};
  const refreshJobs={run_id:700,jobs:[source,lunch,deploy]};
  const publicationRun={id:800,name:'Deploy ABVM to GitHub Pages',head_branch:'main',
    status:'completed',conclusion:'success',created_at:'2026-10-22T17:11:29Z',
    updated_at:'2026-10-22T17:33:04Z'};
  const watchdogRun={id:801,name:'Monitor ABVM refresh health',head_branch:'main',
    status:'completed',conclusion:'success',created_at:'2026-10-22T17:07:48Z',
    run_started_at:'2026-10-22T18:09:04Z',updated_at:'2026-10-22T18:09:16Z'};
  return {refreshRun,refreshJobs,publicationRun,watchdogRun,
    sourceCheckedAt:'2026-10-22T16:07:07Z',homeworkCheckedAt:'2026-10-22T15:30:21Z'};
}

test('cancelled nested browser setup needs later guarded release and independently successful rerun',()=>{
  const result=selectRecoveredCancelledRefresh(fixture());
  assert.deepEqual(result,{state:'recovered',refreshRunId:700,publisherRunId:800,
    watchdogRunId:801,cancelledStep:'Install Chromium and WebKit'});
});

test('a cancelled publisher never becomes healthy without every independent and source gate',()=>{
  const negatives=[
    x=>x.refreshRun.conclusion='failure',
    x=>x.refreshRun.head_branch='feature',
    x=>x.refreshRun.updated_at='',
    x=>x.refreshJobs.run_id=999,
    x=>x.refreshJobs.jobs[0].status='in_progress',
    x=>x.refreshJobs.jobs[0].steps[1].conclusion='failure',
    x=>x.refreshJobs.jobs[0].steps.splice(3,1),
    x=>x.refreshJobs.jobs[1].conclusion='failure',
    x=>x.refreshJobs.jobs[1].steps[1].conclusion='skipped',
    x=>x.refreshJobs.jobs[2].status='in_progress',
    x=>x.refreshJobs.jobs[2].conclusion='success',
    x=>x.refreshJobs.jobs[2].steps[2].conclusion='failure',
    x=>x.refreshJobs.jobs[2].steps[4].conclusion='success',
    x=>x.refreshJobs.jobs.push({name:'surprise',status:'completed',conclusion:'success',steps:[]}),
    x=>x.publicationRun=null,
    x=>x.publicationRun.conclusion='cancelled',
    x=>x.publicationRun.head_branch='feature',
    x=>x.publicationRun.updated_at='2026-10-22T17:00:00Z',
    x=>x.publicationRun.name='Refresh ABVM teacher pages',
    x=>x.watchdogRun.conclusion='failure',
    x=>x.watchdogRun.head_branch='feature',
    x=>x.watchdogRun.run_started_at=null,
    x=>x.watchdogRun.run_started_at='2026-10-22T17:25:00Z',
    x=>x.sourceCheckedAt='2026-10-22T17:40:00Z',
    x=>x.homeworkCheckedAt='2026-10-22T18:09:39Z',
  ];
  for(const change of negatives){
    const x=fixture();change(x);
    assert.equal(selectRecoveredCancelledRefresh(x),null,String(change));
  }
});

test('health history collects exact cancelled parent jobs rather than inferring a complete release',async()=>{
  const f=fixture(),calls=[];
  const result=await collectHealthHistory({repository:'owner/abvm',fetchJson:async path=>{
    calls.push(path);
    if(path.includes('/actions/workflows/'))return {workflow_runs:path.includes('sync-study-pack.yml')?[f.refreshRun]:[]};
    if(path.includes('/actions/runs/700/jobs?'))return {jobs:f.refreshJobs.jobs};
    throw Error('Unexpected evidence query '+path);
  }});
  assert.deepEqual(result.cancelledRefreshJobs,f.refreshJobs);
  assert.ok(calls.some(x=>x.includes('/runs/700/jobs?')));
  assert.deepEqual(result.refreshJobs,{run_id:null,jobs:[]});
});

test('dashboard receives exact cancellation job evidence and preserves every critical gate',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/health-dashboard.yml',import.meta.url),'utf8');
  const report=readFileSync(new URL('../scripts/build-health-report.mjs',import.meta.url),'utf8');
  const collector=readFileSync(new URL('../scripts/fetch-health-history.mjs',import.meta.url),'utf8');
  assert.match(workflow,/REFRESH_CANCELLED_JOBS_FILE: cancelled-refresh-jobs\.json/);
  assert.match(collector,/cancelled-refresh-jobs\.json/);
  assert.match(report,/selectRecoveredCancelledRefresh/);
  assert.match(report,/homeworkCheckedAt:status\.homework\.checkedAt/);
  assert.ok(report.includes('!status.curriculumHold?selectRecoveredCancelledRefresh('));
  assert.match(report,/status\.overall=criticalHealthy/);
  assert.match(workflow,/if-no-files-found: error/);
});
