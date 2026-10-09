import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../scripts/build-health-report.mjs",import.meta.url));
function runFixture({withHold}){
  const cwd=mkdtempSync(join(tmpdir(),"abvm-report-review-"));
  try{
    const stamp="2026-10-09T19:00:00.000Z";
    const runs={workflow_runs:[{
      id:925,name:"Refresh ABVM teacher pages",status:"completed",
      conclusion:"failure",head_branch:"main",event:"schedule",
      created_at:stamp,updated_at:stamp,html_url:"https://github.com/example/run/925"
    }]};
    const jobs={run_id:925,jobs:[{steps:[{
      name:withHold?"Block publication while curriculum candidates are unresolved":"Scan and validate the public teacher pages",
      conclusion:"failure"
    }]}]};
    const prs=[{number:270,state:"open",draft:true,
      html_url:"https://github.com/example/repo/pull/270",
      head:{ref:"curriculum-candidate-gaps-abc"}}];
    const workflowPath=join(cwd,"runs.json"),jobsPath=join(cwd,"jobs.json"),prsPath=join(cwd,"prs.json");
    writeFileSync(workflowPath,JSON.stringify(runs));
    writeFileSync(jobsPath,JSON.stringify(jobs));
    writeFileSync(prsPath,JSON.stringify(prs));
    const execution=spawnSync(process.execPath,[script],{cwd,encoding:"utf8",
      env:{...process.env,WORKFLOW_RUNS_FILE:workflowPath,
        REFRESH_JOBS_FILE:jobsPath,OPEN_PULLS_FILE:prsPath,
        GITHUB_SHA:"fixture-main-sha"}});
    assert.ok([0,1].includes(execution.status),"health reporter should generate a receipt, exit "+execution.status+": "+execution.stderr);
    const status=JSON.parse(readFileSync(join(cwd,"health-output/abvm-health-status.json"),"utf8"));
    const summary=readFileSync(join(cwd,"health-output/abvm-health-summary.md"),"utf8");
    return {status,summary};
  }finally{rmSync(cwd,{recursive:true,force:true});}
}

test("a held new curriculum refresh cannot be erased by the historical published-pack unsupported count",()=>{
  const {status,summary}=runFixture({withHold:true});
  assert.equal(status.contentPipeline.snapshotScope,"last-published-pack");
  assert.equal(status.curriculumReview.state,"approval-blocked");
  assert.equal(status.curriculumReview.candidatePrNumber,270);
  assert.equal(status.curriculumReview.automatedPromotion,false);
  assert.match(summary,/Published-pack generator-unsupported topics \(snapshot\)/);
  assert.match(summary,/NOT a claim about the newest teacher refresh/);
  assert.match(summary,/Latest refresh curriculum gate:.*BLOCKED.*draft PR #270/);
  assert.doesNotMatch(summary,/Unsupported teacher skills:\*\* none/);
  assert.equal(status.overall,"critical","the hold cannot hide stale source data");
});

test("missing or contradictory failed-step evidence cannot assert educator approval or a clean current refresh",()=>{
  const {status,summary}=runFixture({withHold:false});
  assert.equal(status.curriculumHold,null);
  assert.equal(status.curriculumReview.state,"not-established");
  assert.equal(status.curriculumReview.candidatePrNumber,null);
  assert.equal(status.curriculumReview.automatedPromotion,false);
  assert.match(summary,/No verified hold evidence; newest teacher coverage is not established/);
  assert.equal(status.overall,"critical");
});
