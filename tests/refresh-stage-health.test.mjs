import test from 'node:test';
import assert from 'node:assert/strict';
import * as evidence from '../scripts/refresh-stage-health.mjs';
import {collectHealthHistory} from '../scripts/fetch-health-history.mjs';
const sourceSteps=[
  'Scan and validate the public teacher pages',
  'Verify page-exact source parity and isolate unsupported curriculum',
  'Verify refreshed source health',
  'Validate the candidate app before changing main',
  'Commit refreshed pack against latest main',
  'Confirm exact published main SHA for gated Pages handoff',
];
function fixture(){return {
  refreshRun:{id:20,name:'Refresh ABVM teacher pages',head_branch:'main',
    status:'pending',conclusion:null,created_at:'2026-10-21T20:26:45Z'},
  refreshJobs:{run_id:20,jobs:[{
    id:30,run_id:20,name:'refresh',status:'completed',conclusion:'success',
    started_at:'2026-10-21T20:26:57Z',completed_at:'2026-10-21T20:41:42Z',
    steps:sourceSteps.map(name=>({name,status:'completed',conclusion:'success'})),
  },{id:31,run_id:20,name:'deploy verified refresh through Pages workflow / deploy',status:'pending',conclusion:null}]},
  publicationRun:{id:40,name:'Deploy ABVM to GitHub Pages',head_branch:'main',
    status:'completed',conclusion:'success',created_at:'2026-10-21T20:26:45Z',updated_at:'2026-10-21T21:03:25Z'},
  watchdogRun:{id:50,name:'Monitor ABVM refresh health',head_branch:'main',
    status:'completed',conclusion:'success',created_at:'2026-10-21T21:03:28Z',updated_at:'2026-10-21T21:03:38Z'},
  sourceCheckedAt:'2026-10-21T20:27:02.538Z',
};}
function assess(value){
  assert.equal(typeof evidence.selectPublishedRefreshStage,'function','completed source stages require their own evidence classifier');
  return evidence.selectPublishedRefreshStage(value);
}
test('real source/publication/watchdog evidence confirms service without claiming the parent finished',()=>{
  const input=fixture(),before=structuredClone(input),result=assess(input);
  assert.equal(result.state,'published-parent-pending');
  assert.equal(result.sourceJobId,30);
  assert.equal(result.refreshRunId,20);
  assert.equal(result.publisherRunId,40);
  assert.equal(result.watchdogRunId,50);
  assert.deepEqual(input,before);
  assert.equal(input.refreshRun.status,'pending');
});
test('partial or failed source stages never clear an incident',()=>{
  for(const step of sourceSteps)for(const conclusion of ['failure','skipped','cancelled',null]){
    const input=fixture();input.refreshJobs.jobs[0].steps.find(row=>row.name===step).conclusion=conclusion;
    assert.equal(assess(input),null,step+' '+conclusion);
  }
  for(const status of ['in_progress','pending']){
    const input=fixture();input.refreshJobs.jobs[0].status=status;assert.equal(assess(input),null);
  }
});
test('wrong run identity, school-data timestamp or missing chronology fails closed',()=>{
  const mutations=[
    x=>x.refreshJobs.run_id=19,x=>x.refreshJobs.jobs[0].run_id=19,
    x=>x.refreshRun.head_branch='feature',x=>x.refreshRun.name='other',
    x=>x.refreshJobs.jobs[0].completed_at=null,
    x=>x.refreshJobs.jobs[0].started_at='invalid',
    x=>x.sourceCheckedAt='2026-10-21T18:16:08Z',
    x=>x.sourceCheckedAt='2026-10-21T20:42:00Z',
    x=>x.sourceCheckedAt='invalid',
    x=>x.publicationRun.updated_at='2026-10-21T20:30:00Z',
    x=>x.watchdogRun.created_at='2026-10-21T21:00:00Z',
    x=>x.watchdogRun.updated_at='2026-10-21T20:00:00Z',
    x=>x.refreshJobs.jobs.push(structuredClone(x.refreshJobs.jobs[0])),
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.equal(assess(input),null,mutate.toString());}
});
test('failed/cancelled parent or sibling jobs and failed live proof remain incidents',()=>{
  for(const which of ['refreshRun','publicationRun','watchdogRun']){
    for(const conclusion of ['failure','cancelled','timed_out','action_required']){
      const input=fixture();input[which].conclusion=conclusion;assert.equal(assess(input),null);
    }
  }
  const input=fixture();input.refreshJobs.jobs[1].status='completed';input.refreshJobs.jobs[1].conclusion='failure';
  assert.equal(assess(input),null);
});
test('successful Homework publication needs its independently checked publisher job',()=>{
  const input=fixture();input.publicationRun.name='Refresh current ABVM homework';
  assert.equal(assess(input),null);
  input.publicationRun.publisherJobId=45;
  assert.equal(assess(input).publisherRunId,40);
});
test('unverified live runs and completed parents cannot masquerade as pending-stage recovery',()=>{
  for(const field of ['publicationRun','watchdogRun']){
    const input=fixture();input[field].status='in_progress';assert.equal(assess(input),null);
    input[field].status='completed';input[field].head_branch='feature';assert.equal(assess(input),null);
  }
  const input=fixture();input.refreshRun.status='completed';input.refreshRun.conclusion='success';assert.equal(assess(input),null);
});
test('history collects latest active source stages separately from historical failure jobs',async()=>{
  const input=fixture(),requests=[];
  const result=await collectHealthHistory({repository:'owner/app',fetchJson:async path=>{
    requests.push(path);
    if(path.includes('/workflows/sync-study-pack.yml/'))return {workflow_runs:[input.refreshRun,
      {id:10,name:'Refresh ABVM teacher pages',head_branch:'main',status:'completed',conclusion:'failure',created_at:'2026-10-21T19:00:00Z'}]};
    if(path.includes('/workflows/'))return {workflow_runs:[]};
    if(path.includes('/runs/10/jobs?'))return {jobs:[]};
    if(path.includes('/runs/20/jobs?'))return {jobs:input.refreshJobs.jobs};
    throw Error('Unexpected '+path);
  }});
  assert.equal(result.refreshJobs.run_id,10);
  assert.deepEqual(result.refreshStageJobs,input.refreshJobs);
  assert.equal(requests.filter(path=>path.includes('/runs/20/jobs?')).length,1);
});

test('actual dashboard distinguishes verified pending publication from an unresolved incident',async()=>{
  const {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const {schoolWeekLabel,displayedSchoolWeekDates}=await import('../scripts/school-week-label.mjs');
  const root=mkdtempSync(join(tmpdir(),'abvm-stage-dashboard-'));
  try{
    for(const dir of ['scripts','pages/data'])mkdirSync(join(root,dir),{recursive:true});
    for(const file of ['scripts/build-health-report.mjs','scripts/publication-parity-health.mjs','scripts/health-evidence.mjs',
      'scripts/source-freshness-recovery.mjs','scripts/refresh-controller.mjs','scripts/refresh-stage-health.mjs',
      'scripts/school-week-label.mjs','pages/sw.js','package.json']){
      copyFileSync(new URL('../'+file,import.meta.url),join(root,file));
    }
    const ago=seconds=>new Date(Date.now()-seconds*1000).toISOString();
    const now=ago(0),f=fixture();
    f.refreshRun.created_at=ago(650);f.refreshRun.updated_at=ago(200);
    f.refreshJobs.jobs[0].started_at=ago(600);f.refreshJobs.jobs[0].completed_at=ago(400);
    f.publicationRun.created_at=ago(650);f.publicationRun.updated_at=ago(120);
    f.watchdogRun.created_at=ago(60);f.watchdogRun.updated_at=ago(30);
    const pack=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
    pack.sourceLastCheckedAt=ago(500);pack.pack.sourceCheckedAt=pack.sourceLastCheckedAt;
    pack.pack.teacherPostingWeekLabel=schoolWeekLabel(now);
    pack.pack.weekLabel=schoolWeekLabel(now,{calendarDisplay:true});
    pack.pack.lunchArchive=displayedSchoolWeekDates(now).map(date=>({date}));
    pack.pack.contentPipeline={safetyState:'READY',coverage:[],qa:{status:'pass',skillCount:1,questionCount:1,unsupportedSkillCount:0}};
    pack.pack.lunchMenuSource.retrievalState='verified';
    const write=(name,data)=>writeFileSync(join(root,name),JSON.stringify(data));
    write('pages/data/study-pack.json',pack);
    write('pages/data/homework-current.json',{schemaVersion:1,status:'assignments',checkedAt:now});
    const cancelled={id:10,name:'Refresh ABVM teacher pages',head_branch:'main',event:'push',
      status:'completed',conclusion:'cancelled',created_at:ago(1200),updated_at:ago(700)};
    write('runs.json',{workflow_runs:[cancelled,f.refreshRun,f.publicationRun,f.watchdogRun,
      ...['ABVM App QA','Refresh current ABVM homework'].map((name,id)=>({
        id:100+id,name,head_branch:'main',event:'schedule',status:'completed',conclusion:'success',created_at:now,updated_at:now,
      }))]});
    write('stage.json',f.refreshJobs);write('failure.json',{run_id:null,jobs:[]});write('publications.json',[]);
    write('parity.json',{curriculumLiveMatches:true,homeworkLiveMatches:true});
    const run=()=>{
      const result=spawnSync(process.execPath,['scripts/build-health-report.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,
        WORKFLOW_RUNS_FILE:join(root,'runs.json'),REFRESH_JOBS_FILE:join(root,'failure.json'),
        REFRESH_STAGE_JOBS_FILE:join(root,'stage.json'),HOMEWORK_PUBLICATIONS_FILE:join(root,'publications.json'),
        OPEN_PULLS_FILE:'',MAIN_BRANCH_FILE:'',SOURCE_RECOVERY_PLAN_FILE:join(root,'parity.json')}});
      assert.ok(result.status===0||result.status===1,result.stderr);
      return {result,report:JSON.parse(readFileSync(join(root,'health-output/abvm-health-status.json'),'utf8'))};
    };
    const verified=run();
    assert.equal(verified.result.status,0,verified.result.stderr);
    assert.equal(verified.report.overall,'attention');
    assert.equal(verified.report.refreshStage.state,'published-parent-pending');
    assert.equal(verified.report.workflows.refresh.latestCompleted.conclusion,'cancelled');
    assert.equal(verified.report.workflows.refresh.latestCreated.status,'pending');
    assert.match(verified.report.warnings.join(' '),/parent workflow is still running/);
    f.refreshJobs.jobs[0].steps[0].conclusion='failure';write('stage.json',f.refreshJobs);
    assert.equal(run().report.overall,'critical');
    write('stage.json',{run_id:null,jobs:[]});
    assert.equal(run().report.overall,'critical');
    f.refreshJobs.jobs[0].steps[0].conclusion='success';write('stage.json',f.refreshJobs);
    write('pages/data/homework-current.json',{schemaVersion:1,status:'assignments',checkedAt:ago(9*3600)});
    assert.equal(run().report.overall,'critical','source-stage proof cannot hide stale Homework');
  }finally{rmSync(root,{recursive:true,force:true});}
});
