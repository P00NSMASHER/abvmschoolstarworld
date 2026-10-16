import test from "node:test";
import assert from "node:assert/strict";
import {selectEffectiveWorkflowRun,selectGovernedCurriculumHold,selectPublicationEvidence,selectRefreshFailureEvidence} from "../scripts/health-evidence.mjs";

const run=(name,conclusion,updated_at)=>({name,conclusion,updated_at,created_at:updated_at});

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
      'scripts/source-freshness-recovery.mjs','pages/sw.js','package.json']){
      copyFileSync(new URL('../'+file,import.meta.url),join(root,file));
    }
    const now=new Date().toISOString();
    const pack=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
    pack.sourceLastCheckedAt=now;
    // This test controls health inputs; a future teacher topic must not alter
    // its intentionally healthy pipeline baseline.
    pack.pack.contentPipeline={safetyState:'SAFE',coverage:[],
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
    const run=()=>{
      const result=spawnSync(process.execPath,['scripts/build-health-report.mjs'],{
        cwd:root,encoding:'utf8',env:{...process.env,WORKFLOW_RUNS_FILE:workflowFile,
          REFRESH_JOBS_FILE:'',OPEN_PULLS_FILE:'',HOMEWORK_PUBLICATIONS_FILE:join(root,'publications.json')},
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
    pack.pack.contentPipeline.qa.unsupportedSkillCount=1;
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    const unsupported=run();
    assert.equal(unsupported.result.status,1);
    assert.equal(unsupported.report.overall,'critical');
    pack.pack.contentPipeline.qa.unsupportedSkillCount=0;
    writeFileSync(join(root,'pages/data/study-pack.json'),JSON.stringify(pack));
    writeFileSync(postingPath,JSON.stringify({...posting,checkedAt:new Date(Date.now()-9*3600000).toISOString()}));
    const stale=run();
    assert.equal(stale.result.status,1);
    assert.equal(stale.report.overall,'critical');
    assert.equal(stale.report.homework.healthy,false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
