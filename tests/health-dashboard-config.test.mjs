import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(new URL("../.github/workflows/health-dashboard.yml",import.meta.url),"utf8");
const report=readFileSync(new URL("../scripts/build-health-report.mjs",import.meta.url),"utf8");

test("operational dashboard waits for the post-deploy watchdog",()=>{
  const workflowRun=workflow.match(/workflow_run:\r?\n([\s\S]*?)\r?\n  schedule:/)?.[1]||"";
  assert.match(workflowRun,/Monitor ABVM refresh health/);
  assert.doesNotMatch(workflowRun,/ABVM App QA/);
  assert.doesNotMatch(workflowRun,/Deploy ABVM to GitHub Pages/);
  assert.doesNotMatch(workflowRun,/Refresh ABVM teacher pages/);
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
