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
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/);
});

test("health verdict prefers the most recently updated rerun evidence",()=>{
  assert.match(report,/const runEvidenceAt=run=>Date\.parse\(run\?\.updated_at\|\|run\?\.created_at\|\|0\)\|\|0/);
  assert.match(report,/const rankedRuns=name=>productionRuns\.filter\(run=>run\.name===name\)\.sort\(\(a,b\)=>runEvidenceAt\(b\)-runEvidenceAt\(a\)\)/);
  assert.match(report,/const latestDecisive=name=>rankedRuns\(name\)\.find\(run=>decisiveConclusions\.has\(run\.conclusion\)\)\|\|null/);
  assert.match(report,/const latestSuccess=name=>rankedRuns\(name\)\.find\(run=>run\.conclusion==="success"\)\|\|null/);
});

test("health verdict ignores superseded cancellation noise but flags the newest unsuperseded cancellation",()=>{
  assert.match(report,/decisiveConclusions=new Set\(\["success","failure","timed_out","action_required","startup_failure"\]\)/);
  assert.match(report,/const latestCreated=name=>createdRuns\(name\)\[0\]\|\|null/);
  assert.match(report,/const newestCreated=workflow\.latestCreated/);
  assert.match(report,/const newerActive=newestCreated&&activeStatuses\.has\(newestCreated\.status\)/);
  assert.match(report,/if\(newerActive\)return workflow\.latestSuccess/);
  assert.match(report,/if\(newestCreated\?\.conclusion==="cancelled"\)return newestCreated/);
  assert.match(report,/return decisive/);
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


test("operational health uses the same overnight freshness allowance as the watchdog",()=>{
  assert.match(report,/const SOURCE_FRESH_HOURS=16/);
  assert.match(report,/sourceAgeHours<=SOURCE_FRESH_HOURS/);
  assert.match(report,/fresh <=\$\{SOURCE_FRESH_HOURS\}h/);
  assert.doesNotMatch(report,/sourceAgeHours<=8/);
});


test("operational health treats complete reviewed lunch coverage as attention, not critical failure",()=>{
  assert.match(report,/const lunchReviewedCoverageComplete=Boolean\(/);
  assert.match(report,/status\.lunch\.retrievalState==="unavailable"&&lunchReviewedCoverageComplete/);
  assert.match(report,/const lunchOperationallyUsable=Boolean\(/);
  assert.match(report,/status\.overall=criticalHealthy\?\(warnings\.length\?"attention":"healthy"\):"critical"/);
  assert.match(report,/if\(status\.overall==="critical"\)process\.exitCode=1/);
  assert.doesNotMatch(report,/if\(!healthy\)process\.exitCode=1/);
  assert.match(report,/Lunch source bridge is unavailable; complete previously reviewed coverage remains usable/);
});
