import test from "node:test";
import assert from "node:assert/strict";
import {selectGovernedCurriculumHold,selectPublicationEvidence} from "../scripts/health-evidence.mjs";

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
