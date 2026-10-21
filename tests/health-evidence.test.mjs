import test from "node:test";
import assert from "node:assert/strict";
import {assessHomeworkPollingCadence,assessMainBranchProtection,selectEffectiveWorkflowRun,selectGovernedCurriculumHold,selectPublicationEvidence,selectRefreshFailureEvidence,selectRecoveredRefreshRace} from "../scripts/health-evidence.mjs";

const run=(name,conclusion,updated_at)=>({name,conclusion,updated_at,created_at:updated_at});

const successfulStep=name=>({name,status:"completed",conclusion:"success"});
const recoveredRaceFixture=()=>{
  const refreshRun={id:101,name:"Refresh ABVM teacher pages",head_branch:"main",
    status:"completed",conclusion:"failure",created_at:"2026-10-18T04:00:00Z",updated_at:"2026-10-18T04:40:00Z"};
  const refreshJobs={run_id:101,jobs:[
    {name:"refresh",status:"completed",conclusion:"success",steps:[
      successfulStep("Verify page-exact source parity and isolate unsupported curriculum"),
      successfulStep("Verify refreshed source health"),successfulStep("Validate the candidate app before changing main"),
      successfulStep("Commit refreshed pack against latest main")]},
    {name:"Refresh reviewed lunch week independently of held curriculum",
      status:"completed",conclusion:"success",steps:[
        successfulStep("Refresh only previously reviewed source-backed lunch fields"),
        successfulStep("Prove lunch isolation and negative-case integrity")]},
    {name:"deploy verified refresh through Pages workflow / deploy",
      status:"completed",conclusion:"failure",steps:[
        successfulStep("Admit exact current protected-main commit"),
        successfulStep("Verify checked-out source identity"),
        successfulStep("Run release QA"),
        {name:"Recheck protected-main before publishing",status:"completed",conclusion:"failure"},
        {name:"Deploy",status:"completed",conclusion:"skipped"},
        {name:"Verify live lunch data and visible mobile flows",status:"completed",conclusion:"skipped"}]}
  ]};
  const publicationRun={id:102,name:"Refresh current ABVM homework",publisherJobId:909,
    head_branch:"main",status:"completed",conclusion:"success",updated_at:"2026-10-18T06:00:00Z"};
  const watchdogRun={id:103,name:"Monitor ABVM refresh health",head_branch:"main",
    status:"completed",conclusion:"success",created_at:"2026-10-18T06:01:00Z"};
  return {refreshRun,refreshJobs,publicationRun,watchdogRun,sourceCheckedAt:"2026-10-18T04:03:00Z"};
};
test("a guarded main race recovers only after complete source QA, later proven publication, and live watchdog",()=>{
  assert.deepEqual(selectRecoveredRefreshRace(recoveredRaceFixture()),{
    state:"recovered",refreshRunId:101,publisherRunId:102,watchdogRunId:103,
    failedStep:"Recheck protected-main before publishing"});
});
test("unproven or genuinely failed teacher refreshes never recover",()=>{
  const modifications=[
    f=>{f.publicationRun=null;},
    f=>{f.publicationRun.publisherJobId=null;},
    f=>{f.publicationRun.name="Refresh ABVM teacher pages";},
    f=>{f.publicationRun.status="in_progress";},
    f=>{f.publicationRun.conclusion="failure";},
    f=>{f.publicationRun.head_branch="feature";},
    f=>{f.publicationRun.updated_at="invalid";},
    f=>{f.publicationRun.updated_at="2026-10-18T04:30:00Z";},
    f=>{f.watchdogRun.status="in_progress";},
    f=>{f.watchdogRun.conclusion="failure";},
    f=>{f.watchdogRun.created_at="2026-10-18T05:58:00Z";},
    f=>{f.refreshJobs.run_id=999;},
    f=>{f.refreshJobs.jobs[0].conclusion="failure";},
    f=>{f.refreshJobs.jobs[1].steps=[];},
    f=>{f.refreshJobs.jobs[2].steps[2].conclusion="failure";},
    f=>{f.refreshJobs.jobs[2].steps[4].conclusion="success";},
    f=>{f.refreshJobs.jobs[2].steps.push({name:"Deploy",status:"completed",conclusion:"failure"});},
    f=>{f.sourceCheckedAt="2026-10-18T04:55:00Z";}
  ];
  for(const [i,modify] of modifications.entries()){
    const fixture=recoveredRaceFixture();modify(fixture);
    assert.equal(selectRecoveredRefreshRace(fixture),null,"unsafe scenario "+i);
  }
});
test("later successful standalone Pages release still requires an even later independent watchdog",()=>{
  const f=recoveredRaceFixture();
  f.publicationRun={id:207,name:"Deploy ABVM to GitHub Pages",head_branch:"main",
    status:"completed",conclusion:"success",updated_at:"2026-10-18T05:05:00Z"};
  assert.equal(selectRecoveredRefreshRace(f)?.publisherRunId,207);
  f.watchdogRun.created_at="2026-10-18T05:00:00Z";
  assert.equal(selectRecoveredRefreshRace(f),null);
});


test("newer successful refresh supersedes older cancelled standalone deploy",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","cancelled","2026-10-02T13:30:00Z");
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),refresh);
});

test("newer standalone deploy remains publication evidence",()=>{
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  const deploy=run("Deploy ABVM to GitHub Pages","success","2026-10-02T13:35:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),deploy);
});

test("failed refresh never replaces standalone publication evidence",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","success","2026-10-02T13:30:00Z");
  const refresh=run("Refresh ABVM teacher pages","failure","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),deploy);
});

test("successful refresh is valid publication evidence when no standalone deploy exists",()=>{
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(null,refresh),refresh);
});


test("newer successful homework publication supersedes an older guarded Pages failure",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","failure","2026-10-16T15:05:47Z");
  const refresh=run("Refresh ABVM teacher pages","failure","2026-10-16T15:27:01Z");
  const homework={...run("Refresh current ABVM homework","success","2026-10-16T15:21:23Z"),publisherJobId:88};
  assert.equal(selectPublicationEvidence(deploy,refresh,homework),homework);
});

test("failed or unresolved homework runs cannot replace standalone publication evidence",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","success","2026-10-16T15:05:47Z");
  const refresh=run("Refresh ABVM teacher pages","failure","2026-10-16T15:27:01Z");
  for(const conclusion of ["failure",null]){
    const homework=run("Refresh current ABVM homework",conclusion,"2026-10-16T15:21:23Z");
    assert.equal(selectPublicationEvidence(deploy,refresh,homework),deploy);
  }
});

test("the newest successful source-bound publication wins when both source workflows succeed",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","failure","2026-10-16T15:05:47Z");
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-16T15:18:00Z");
  const homework={...run("Refresh current ABVM homework","success","2026-10-16T15:21:23Z"),publisherJobId:88};
  assert.equal(selectPublicationEvidence(deploy,refresh,homework),homework);
});


test("governed curriculum hold requires the exact unresolved-coverage failed step and an open draft candidate",()=>{
  const refresh={id:42,name:"Refresh ABVM teacher pages",conclusion:"failure",created_at:"2026-10-02T16:00:00Z"};
  const jobs={run_id:42,jobs:[{steps:[
    {name:"Open governed curriculum candidate PR when coverage gaps exist",conclusion:"success"},
    {name:"Block publication while curriculum candidates are unresolved",conclusion:"failure"},
  ]}]};
  const pulls=[{number:172,state:"open",draft:true,html_url:"https://github.com/example/repo/pull/172",head:{ref:"curriculum-candidate-gaps-abc"}}];
  assert.deepEqual(selectGovernedCurriculumHold(refresh,jobs,pulls),{
    runId:42,
    failedStep:"Block publication while curriculum candidates are unresolved",
    candidatePrNumber:172,
    candidatePrUrl:"https://github.com/example/repo/pull/172",
    candidateBranch:"curriculum-candidate-gaps-abc",
  });
});

test("governed curriculum hold never masks other refresh failures",()=>{
  const refresh={id:42,name:"Refresh ABVM teacher pages",conclusion:"failure"};
  const pulls=[{number:172,state:"open",draft:true,head:{ref:"curriculum-candidate-gaps-abc"}}];
  for(const failedStep of [
    "Scan and validate the public teacher pages",
    "Verify refreshed source health",
    "Validate the candidate app before changing main",
    "Commit refreshed pack against latest main",
  ]){
    const jobs={run_id:42,jobs:[{steps:[{name:failedStep,conclusion:"failure"}]}]};
    assert.equal(selectGovernedCurriculumHold(refresh,jobs,pulls),null,failedStep);
  }
});

test("governed curriculum hold requires matching run evidence and a draft curriculum candidate PR",()=>{
  const refresh={id:42,name:"Refresh ABVM teacher pages",conclusion:"failure"};
  const jobs={run_id:42,jobs:[{steps:[{name:"Block publication while curriculum candidates are unresolved",conclusion:"failure"}]}]};
  assert.equal(selectGovernedCurriculumHold(refresh,{...jobs,run_id:41},[{number:172,state:"open",draft:true,head:{ref:"curriculum-candidate-gaps-abc"}}]),null);
  assert.equal(selectGovernedCurriculumHold(refresh,jobs,[{number:172,state:"open",draft:false,head:{ref:"curriculum-candidate-gaps-abc"}}]),null);
  assert.equal(selectGovernedCurriculumHold(refresh,jobs,[{number:172,state:"open",draft:true,head:{ref:"feature-not-curriculum"}}]),null);
});


test("refresh failure evidence stays bound to the fetched run while a newer refresh is active",()=>{
  const runs=[
    {id:43,name:"Refresh ABVM teacher pages",status:"in_progress",conclusion:null,created_at:"2026-10-02T17:37:33Z"},
    {id:42,name:"Refresh ABVM teacher pages",status:"completed",conclusion:"failure",created_at:"2026-10-02T17:25:40Z"},
  ];
  const jobs={run_id:42,jobs:[{steps:[{name:"Block publication while curriculum candidates are unresolved",conclusion:"failure"}]}]};
  const selected=selectRefreshFailureEvidence(runs,jobs);
  assert.equal(selected?.id,42);
  const pulls=[{number:172,state:"open",draft:true,head:{ref:"curriculum-candidate-gaps-abc"}}];
  assert.equal(selectGovernedCurriculumHold(selected,jobs,pulls)?.candidatePrNumber,172);
});

test("refresh failure evidence is null when the fetched run id is absent",()=>{
  assert.equal(selectRefreshFailureEvidence([{id:43,conclusion:"failure"}],{run_id:42,jobs:[]}),null);
});

test("successful completion supersedes a duplicate cancellation created seconds later",()=>{
  const success={id:118,name:"Refresh ABVM teacher pages",status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:17Z"};
  const cancelled={id:119,name:"Refresh ABVM teacher pages",status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:02:10Z",updated_at:"2026-10-07T22:02:20Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:cancelled,latestDecisive:success,latestSuccess:success}),success);
});

test("newest cancellation remains unhealthy when it is the latest completed evidence",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:17Z"};
  const cancelled={id:119,status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:40:00Z",updated_at:"2026-10-07T22:40:10Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:cancelled,latestDecisive:success,latestSuccess:success}),cancelled);
});

test("active rerun falls back to the latest success while it is unresolved",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:17Z"};
  const active={id:120,status:"in_progress",conclusion:null,created_at:"2026-10-07T22:40:00Z",updated_at:"2026-10-07T22:40:00Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:active,latestDecisive:success,latestSuccess:success}),success);
});

test("missing workflow evidence remains unhealthy and does not invent success",()=>{
  assert.equal(selectEffectiveWorkflowRun({latestCreated:null,latestDecisive:null,latestSuccess:null}),null);
});

test("active rerun does not conceal an earlier genuinely failed refresh",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:15Z"};
  const failure={id:119,status:"completed",conclusion:"failure",created_at:"2026-10-07T22:40:00Z",updated_at:"2026-10-07T22:41:00Z"};
  const active={id:120,status:"in_progress",conclusion:null,created_at:"2026-10-07T22:42:00Z",updated_at:"2026-10-07T22:42:00Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:active,latestDecisive:failure,latestSuccess:success}),failure);
});

test("equal completion timestamps are contradictory and cancellation stays unhealthy",()=>{
  const timestamp="2026-10-07T22:39:15Z";
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:timestamp};
  const cancelled={id:119,status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:02:10Z",updated_at:timestamp};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:cancelled,latestDecisive:success,latestCompleted:cancelled}),cancelled);
});

test("missing cancellation completion timestamp cannot be silently superseded",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:15Z"};
  const cancelled={id:119,status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:02:10Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:cancelled,latestDecisive:success,latestCompleted:cancelled}),cancelled);
});

test("a late-finished cancellation is detected despite an earlier creation timestamp",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:40:00Z",updated_at:"2026-10-07T22:45:00Z"};
  const cancelled={id:119,status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:39:00Z",updated_at:"2026-10-07T22:46:00Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:success,latestCompleted:cancelled,latestDecisive:success,latestSuccess:success}),cancelled);
});

test("an active rerun never masks a completed cancellation",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z",updated_at:"2026-10-07T22:39:15Z"};
  const cancelled={id:119,status:"completed",conclusion:"cancelled",created_at:"2026-10-07T22:40:00Z",updated_at:"2026-10-07T22:41:00Z"};
  const active={id:120,status:"in_progress",conclusion:null,created_at:"2026-10-07T22:42:00Z",updated_at:"2026-10-07T22:42:00Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:active,latestCompleted:cancelled,latestDecisive:success,latestSuccess:success}),cancelled);
});

test("a successful workflow with missing completion evidence cannot establish health",()=>{
  const success={id:118,status:"completed",conclusion:"success",created_at:"2026-10-07T22:02:03Z"};
  assert.equal(selectEffectiveWorkflowRun({latestCreated:success,latestCompleted:success,latestDecisive:success,latestSuccess:success}),null);
});

test('homework freshness is required even when all curriculum checks pass',async()=>{
  const {assessHomeworkHealth}=await import('../scripts/health-evidence.mjs');
  const now='2026-10-15T23:30:00Z';
  const posting={schemaVersion:1,status:'assignments',checkedAt:'2026-10-15T23:00:00Z'};
  assert.equal(typeof assessHomeworkHealth,'function');
  assert.equal(assessHomeworkHealth(posting,now).healthy,true);
  for(const changed of [
    {...posting,checkedAt:'2026-10-15T14:00:00Z'},
    {...posting,checkedAt:'invalid'},
    {...posting,checkedAt:'2026-10-16T00:00:00Z'},
    {...posting,status:'unknown'},
    {...posting,schemaVersion:0},
  ])assert.equal(assessHomeworkHealth(changed,now).healthy,false);
  assert.equal(assessHomeworkHealth(null,now).healthy,false);
  assert.equal(assessHomeworkHealth(posting,'invalid').healthy,false);
});

test('the complete dashboard turns critical for stale homework despite healthy workflow evidence',async()=>{
  const {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const root=mkdtempSync(join(tmpdir(),'abvm-health-'));
  try{
    for(const dir of ['scripts','pages/data'])mkdirSync(join(root,dir),{recursive:true});
    for(const file of ['scripts/build-health-report.mjs','scripts/health-evidence.mjs',
      'scripts/source-freshness-recovery.mjs','scripts/school-week-label.mjs','pages/sw.js','package.json']){
      copyFileSync(new URL('../'+file,import.meta.url),join(root,file));
    }
    const now=new Date().toISOString();
    const {schoolWeekLabel,displayedSchoolWeekDates}=await import('../scripts/school-week-label.mjs');
    const pack=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
    pack.sourceLastCheckedAt=now;
    // Stabilize the isolated fixture against weekend rollover and future lunch
    // horizons. This test isolates workflow and Homework health behavior.
    pack.pack.teacherPostingWeekLabel=schoolWeekLabel(now);
    pack.pack.weekLabel=schoolWeekLabel(now,{calendarDisplay:true});
    pack.pack.lunchArchive=displayedSchoolWeekDates(now).map(date=>({date}));
    // This test controls health inputs; a future teacher topic must not alter
    // its intentionally healthy pipeline baseline.
    pack.pack.contentPipeline={safetyState:'READY',coverage:[],
      sourcePolicy:{requirePageExactLineage:true},qa:{status:'pass',skillCount:1,
        questionCount:1,unsupportedSkillCount:0,pageExactLineageCount:1,unresolvedLineageCount:0}};
    pack.pack.lunchMenuSource.retrievalState='verified';
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    const names=['Refresh ABVM teacher pages','ABVM App QA','Deploy ABVM to GitHub Pages','Monitor ABVM refresh health'];
    const workflowFile=join(root,'runs.json');
    writeFileSync(workflowFile,JSON.stringify({workflow_runs:names.map((name,id)=>({
      id,name,head_branch:'main',event:'schedule',status:'completed',conclusion:'success',
      created_at:now,updated_at:now,html_url:'https://example.invalid/run/'+id,
    }))}));
    const postingPath=join(root,'pages/data/homework-current.json');
    const posting={schemaVersion:1,status:'assignments',checkedAt:now};
    const refreshJobsPath=join(root,'refresh-jobs.json');
    writeFileSync(refreshJobsPath,JSON.stringify({run_id:null,jobs:[]}));
    const run=()=>{
      const result=spawnSync(process.execPath,['scripts/build-health-report.mjs'],{
        cwd:root,encoding:'utf8',env:{...process.env,WORKFLOW_RUNS_FILE:workflowFile,
          REFRESH_JOBS_FILE:refreshJobsPath,OPEN_PULLS_FILE:'',HOMEWORK_PUBLICATIONS_FILE:join(root,'publications.json')},
      });
      const report=JSON.parse(readFileSync(join(root,'health-output/abvm-health-status.json'),'utf8'));
      return {result,report};
    };
    writeFileSync(postingPath,JSON.stringify(posting));
    writeFileSync(join(root,'publications.json'),'[]');
    const fresh=run();
    assert.equal(fresh.result.status,0,fresh.result.stderr);
    assert.equal(fresh.report.homework.healthy,true);
    const history=JSON.parse(readFileSync(workflowFile,'utf8'));
    const deploy=history.workflow_runs.find(r=>r.name==='Deploy ABVM to GitHub Pages');
    deploy.conclusion='failure';
    deploy.updated_at=new Date(Date.now()-60000).toISOString();
    history.workflow_runs.find(r=>r.name==='Refresh ABVM teacher pages').updated_at=new Date(Date.now()-120000).toISOString();
    writeFileSync(workflowFile,JSON.stringify(history));
    writeFileSync(join(root,'publications.json'),JSON.stringify([{
      id:77,name:'Refresh current ABVM homework',head_branch:'main',status:'completed',
      conclusion:'success',created_at:now,updated_at:now,publisherJobId:88,
    }]));
    const recovered=run();
    assert.equal(recovered.result.status,0,recovered.result.stderr);
    assert.equal(recovered.report.publicationEvidence.id,77);
    assert.equal(recovered.report.overall,'healthy');
    // Reproduce the October 18 race, not just the pure helper: teacher and
    // lunch jobs pass, the stale Pages SHA is rejected, and the later publisher
    // plus watchdog independently verify recovery. A real source failure must
    // still terminate CRITICAL.
    const ago=sec=>new Date(Date.now()-sec*1000).toISOString();
    const historyForRace=JSON.parse(readFileSync(workflowFile,'utf8'));
    const refresh=historyForRace.workflow_runs.find(x=>x.name==='Refresh ABVM teacher pages');
    const pages=historyForRace.workflow_runs.find(x=>x.name==='Deploy ABVM to GitHub Pages');
    const watchdog=historyForRace.workflow_runs.find(x=>x.name==='Monitor ABVM refresh health');
    refresh.conclusion='failure';refresh.created_at=ago(900);refresh.updated_at=ago(600);
    pages.conclusion='failure';pages.created_at=ago(900);pages.updated_at=ago(700);
    watchdog.created_at=ago(60);watchdog.updated_at=ago(30);
    writeFileSync(workflowFile,JSON.stringify(historyForRace));
    pack.sourceLastCheckedAt=ago(720);pack.pack.sourceCheckedAt=ago(720);
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    const provenPublisher={id:77,name:'Refresh current ABVM homework',head_branch:'main',
      status:'completed',conclusion:'success',created_at:ago(260),
      updated_at:ago(120),publisherJobId:88};
    writeFileSync(join(root,'publications.json'),JSON.stringify([provenPublisher]));
    const recordedRace=recoveredRaceFixture().refreshJobs;
    recordedRace.run_id=refresh.id;
    writeFileSync(refreshJobsPath,JSON.stringify(recordedRace));
    const verifiedRace=run();
    assert.equal(verifiedRace.result.status,0,verifiedRace.result.stderr);
    assert.equal(verifiedRace.report.overall,'attention');
    assert.equal(verifiedRace.report.refreshRecovery?.state,'recovered');
    assert.equal(verifiedRace.report.workflows.refresh.latestDecisive.conclusion,'failure');
    assert.match(verifiedRace.report.warnings.join(' '),/later gated publication/);
    writeFileSync(join(root,'publications.json'),'[]');
    const missingPublisher=run();
    assert.equal(missingPublisher.result.status,1);
    assert.equal(missingPublisher.report.overall,'critical');
    writeFileSync(join(root,'publications.json'),JSON.stringify([provenPublisher]));
    recordedRace.jobs[0].conclusion='failure';
    writeFileSync(refreshJobsPath,JSON.stringify(recordedRace));
    const sourceFailure=run();
    assert.equal(sourceFailure.result.status,1);
    assert.equal(sourceFailure.report.overall,'critical');
    // Restore the synthetic healthy baseline before unrelated pipeline tests.
    refresh.conclusion='success';refresh.updated_at=ago(550);
    writeFileSync(workflowFile,JSON.stringify(historyForRace));
    writeFileSync(refreshJobsPath,JSON.stringify({run_id:null,jobs:[]}));

    pack.pack.contentPipeline.coverage.push({subject:'Spelling / Handwriting',
      topic:'long / short u',status:'GENERATOR_UNSUPPORTED'});
    pack.pack.contentPipeline.qa.unsupportedSkillCount=1;
    pack.pack.contentPipeline.safetyState='SAFE_PARTIAL';
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    const isolated=run();
    assert.equal(isolated.result.status,0,isolated.result.stderr);
    assert.equal(isolated.report.overall,'attention');
    assert.match(isolated.report.warnings.join(' '),/Verified source facts remain publishable/);
    pack.pack.contentPipeline.safetyState='UNSAFE';
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    const unsupported=run();
    assert.equal(unsupported.result.status,1);
    assert.equal(unsupported.report.overall,'critical');
    pack.pack.contentPipeline.qa.unsupportedSkillCount=0;
    pack.pack.contentPipeline.safetyState='READY';
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    writeFileSync(postingPath,JSON.stringify({...posting,checkedAt:new Date(Date.now()-9*3600000).toISOString()}));
    const stale=run();
    assert.equal(stale.result.status,1);
    assert.equal(stale.report.overall,'critical');
    assert.equal(stale.report.homework.healthy,false);
  }finally{rmSync(root,{recursive:true,force:true});}
});


test("main branch protection requires affirmative GitHub evidence and never guesses success",()=>{
  assert.deepEqual(assessMainBranchProtection({name:"main",protected:true}),{state:"protected",protected:true});
  assert.deepEqual(assessMainBranchProtection({name:"main",protected:false}),{state:"unprotected",protected:false});
  for(const source of [null,{}, {name:"main"}, {name:"main",protected:"true"},
    {name:"other",protected:true}, {name:"main",protected:null}]){
    assert.deepEqual(assessMainBranchProtection(source),{state:"unknown",protected:null});
  }
});

test("hourly Homework schedule delivery cannot be concealed by a newer successful push or recovery",()=>{
  const recent=[
    {name:"Refresh current ABVM homework",event:"schedule",head_branch:"main",
      status:"completed",conclusion:"success",created_at:"2026-10-21T15:21:42Z"},
    {name:"Refresh current ABVM homework",event:"push",head_branch:"main",
      status:"completed",conclusion:"success",created_at:"2026-10-21T19:17:42Z"},
    {name:"Refresh current ABVM homework",event:"workflow_dispatch",head_branch:"main",
      status:"completed",conclusion:"success",created_at:"2026-10-21T19:18:00Z"}
  ];
  const delayed=assessHomeworkPollingCadence(recent,"2026-10-21T19:35:00Z");
  assert.equal(delayed.state,"delayed");
  assert.equal(delayed.lastScheduledAt,"2026-10-21T15:21:42Z");
  assert.ok(delayed.ageHours>4);
  recent.push({name:"Refresh current ABVM homework",event:"schedule",head_branch:"main",
    status:"completed",conclusion:"success",created_at:"2026-10-21T19:23:00Z"});
  assert.equal(assessHomeworkPollingCadence(recent,"2026-10-21T19:35:00Z").state,"current");
});

test("polling cadence handles missing evidence, off hours and future timestamps",()=>{
  assert.equal(assessHomeworkPollingCadence([],"2026-10-21T19:35:00Z").state,"unknown");
  assert.equal(assessHomeworkPollingCadence([],"2026-10-22T04:20:00Z").state,"off-hours");
  assert.equal(assessHomeworkPollingCadence([{name:"Refresh current ABVM homework",
    event:"schedule",head_branch:"main",created_at:"2026-10-21T23:50:00Z"}],
    "2026-10-21T19:35:00Z").state,"unknown");
  assert.equal(assessHomeworkPollingCadence(null,"2026-10-21T19:35:00Z").state,"unknown");
  assert.equal(assessHomeworkPollingCadence([],"bad-time").state,"unknown");
  assert.equal(assessHomeworkPollingCadence([
    {name:"Refresh current ABVM homework",event:"schedule",head_branch:"other",
      created_at:"2026-10-21T19:34:00Z"}
  ],"2026-10-21T19:35:00Z").state,"unknown");
});
