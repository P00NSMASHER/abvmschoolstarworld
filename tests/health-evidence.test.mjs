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
