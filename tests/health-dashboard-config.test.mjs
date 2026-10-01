import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(new URL("../.github/workflows/health-dashboard.yml",import.meta.url),"utf8");
const report=readFileSync(new URL("../scripts/build-health-report.mjs",import.meta.url),"utf8");

test("operational dashboard waits for the post-deploy watchdog",()=>{
  const workflowRun=workflow.match(/workflow_run:\n([\s\S]*?)\n  schedule:/)?.[1]||"";
  assert.match(workflowRun,/Monitor ABVM refresh health/);
  assert.doesNotMatch(workflowRun,/ABVM App QA/);
  assert.doesNotMatch(workflowRun,/Deploy ABVM to GitHub Pages/);
  assert.doesNotMatch(workflowRun,/Refresh ABVM teacher pages/);
});

test("health verdict prefers the most recently updated rerun evidence",()=>{
  assert.match(report,/const runEvidenceAt=run=>Date\.parse\(run\?\.updated_at\|\|run\?\.created_at\|\|0\)\|\|0/);
  assert.match(report,/const rankedRuns=name=>productionRuns\.filter\(run=>run\.name===name\)\.sort\(\(a,b\)=>runEvidenceAt\(b\)-runEvidenceAt\(a\)\)/);
  assert.match(report,/const latestDecisive=name=>rankedRuns\(name\)\.find\(run=>decisiveConclusions\.has\(run\.conclusion\)\)\|\|null/);
  assert.match(report,/const latestSuccess=name=>rankedRuns\(name\)\.find\(run=>run\.conclusion==="success"\)\|\|null/);
});

test("health verdict ignores skipped and cancelled orchestration noise",()=>{
  assert.match(report,/decisiveConclusions=new Set\(\["success","failure","timed_out","action_required","startup_failure"\]\)/);
  assert.match(report,/const newerActive=latestRun&&activeStatuses\.has\(latestRun\.status\)/);
  assert.match(report,/return newerActive\?workflow\.latestSuccess:decisive/);
  assert.match(report,/const run=effectiveRun\(workflow\)/);
  assert.doesNotMatch(report,/const run=workflow\.latestCompleted;\n  if\(!run\|\|run\.conclusion!==\"success\"\)/);
});

test("health summary displays the same effective evidence used by the verdict",()=>{
  assert.match(report,/## Workflow evidence used for health verdict/);
  assert.match(report,/line\("Teacher refresh",effectiveRun\(status\.workflows\.refresh\)\)/);
  assert.match(report,/line\("App QA",effectiveRun\(status\.workflows\.qa\)\)/);
  assert.match(report,/line\("Pages deploy",effectiveRun\(status\.workflows\.deploy\)\)/);
  assert.match(report,/line\("Refresh watchdog",effectiveRun\(status\.workflows\.watchdog\)\)/);
  assert.doesNotMatch(report,/## Latest workflow state/);
});


test("operational health surfaces Grade 2 pipeline coverage without treating known source gaps as unsupported",()=>{
  assert.match(report,/const contentPipeline=packData\.pack\?\.contentPipeline\|\|null/);
  assert.match(report,/status\.contentPipeline\.qaStatus==="pass"/);
  assert.match(report,/status\.contentPipeline\.unsupportedSkillCount===0/);
  assert.match(report,/status\.contentPipeline\.unresolvedLineageCount===0/);
  assert.match(report,/status\.contentPipeline\.pageExactLineageCount===status\.contentPipeline\.questionCount/);
  assert.match(report,/Grade 2 content pipeline/);
  assert.match(report,/Question lineage/);
  assert.match(report,/Partially covered study topics/);
  assert.match(report,/Source-insufficient study topics/);
  assert.match(report,/Intentionally not practiced/);
  assert.match(report,/Unsupported teacher skills/);
});
