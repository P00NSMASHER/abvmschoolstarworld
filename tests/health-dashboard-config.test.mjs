import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const readText=url=>readFileSync(url,"utf8").replaceAll("\r\n","\n");
const workflow=readText(new URL("../.github/workflows/health-dashboard.yml",import.meta.url));
const report=readFileSync(new URL("../scripts/build-health-report.mjs",import.meta.url),"utf8");
const refreshHealthWorkflow=readText(new URL("../.github/workflows/refresh-health.yml",import.meta.url));

test("health classifier changes trigger an immediate main-branch dashboard run",()=>{
  assert.match(workflow,/push:\n\s+branches: \[main\]/);
  for(const path of [
    ".github/workflows/health-dashboard.yml",
    "scripts/build-health-report.mjs",
    "scripts/health-evidence.mjs",
  ]) assert.ok(workflow.includes(path),path);
});

test("operational dashboard waits for the post-deploy watchdog",()=>{
  const workflowRun=workflow.match(/workflow_run:\n([\s\S]*?)\n  schedule:/)?.[1]||"";
  assert.match(workflowRun,/Monitor ABVM refresh health/);
  assert.doesNotMatch(workflowRun,/ABVM App QA/);
  assert.doesNotMatch(workflowRun,/Deploy ABVM to GitHub Pages/);
  assert.doesNotMatch(workflowRun,/Refresh ABVM teacher pages/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/);
});

test("refresh watchdog runs for completed main refreshes even when upstream publication is intentionally blocked",()=>{
  assert.match(refreshHealthWorkflow,/workflows:\n\s+- Deploy ABVM to GitHub Pages\n\s+- Refresh ABVM teacher pages/);
  assert.match(refreshHealthWorkflow,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(refreshHealthWorkflow,/workflow_run\.conclusion == 'success'/);
  assert.match(refreshHealthWorkflow,/check-refresh-health\.mjs/);
});

test("health verdict prefers the most recently updated rerun evidence",()=>{
  assert.match(report,/const runEvidenceAt=run=>Date\.parse\(run\?\.updated_at\|\|run\?\.created_at\|\|0\)\|\|0/);
  assert.match(report,/const rankedRuns=name=>productionRuns\.filter\(run=>run\.name===name\)\.sort\(\(a,b\)=>runEvidenceAt\(b\)-runEvidenceAt\(a\)\)/);
  assert.match(report,/const latestDecisive=name=>rankedRuns\(name\)\.find\(run=>decisiveConclusions\.has\(run\.conclusion\)\)\|\|null/);
  assert.match(report,/const latestSuccess=name=>rankedRuns\(name\)\.find\(run=>run\.conclusion==="success"\)\|\|null/);
});

test("health verdict uses the unit-tested effective workflow evidence selector",()=>{
  assert.match(report,/selectEffectiveWorkflowRun/);
  assert.match(report,/const effectiveRun=workflow=>selectEffectiveWorkflowRun\(workflow\)/);
  assert.match(report,/const completedHealthy=\(workflow,maxAgeHours\)=>completedRunHealthy\(effectiveRun\(workflow\),maxAgeHours\)/);
  assert.doesNotMatch(report,/if\(newestCreated\?\.conclusion==="cancelled"\)return newestCreated/);
});

test("health summary displays the same effective evidence used by the verdict",()=>{
  assert.match(report,/## Workflow evidence used for health verdict/);
  assert.match(report,/line\("Teacher refresh",refreshDisplayRun\)/);
  assert.match(report,/line\("App QA",effectiveRun\(status\.workflows\.qa\)\)/);
  assert.match(report,/line\("Publication evidence",status\.publicationEvidence\)/);
  assert.match(report,/line\("Standalone Pages deploy",effectiveRun\(status\.workflows\.deploy\)\)/);
  assert.match(report,/line\("Refresh watchdog",effectiveRun\(status\.workflows\.watchdog\)\)/);
  assert.doesNotMatch(report,/## Latest workflow state/);
});

test("operational health uses the tested publication evidence selector",()=>{
  assert.match(report,/selectPublicationEvidence/);
  assert.match(report,/effectiveRun\(status\.workflows\.deploy\)/);
  assert.match(report,/effectiveRun\(status\.workflows\.refresh\)/);
  assert.match(report,/status\.publicationEvidence=effectivePublicationRun\(\)/);
  assert.match(report,/completedRunHealthy\(status\.publicationEvidence,48\)/);
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


test("health dashboard fetches exact refresh failure steps and open draft candidate PRs",()=>{
  assert.match(workflow,/pull-requests: read/);
  assert.match(workflow,/actions\/runs\/\$\{REFRESH_RUN_ID\}\/jobs/);
  assert.match(workflow,/pulls\?state=open&per_page=100/);
  assert.match(workflow,/REFRESH_JOBS_FILE: refresh-jobs\.json/);
  assert.match(workflow,/OPEN_PULLS_FILE: open-pulls\.json/);
});

test("governed curriculum holds become attention without masking unrelated refresh failures",()=>{
  assert.match(report,/selectGovernedCurriculumHold/);
  assert.match(report,/const curriculumHoldRefreshRun=selectRefreshFailureEvidence\(productionRuns,refreshJobsData\)/);
  assert.match(report,/status\.curriculumHold=selectGovernedCurriculumHold\(curriculumHoldRefreshRun,refreshJobsData,openPulls\)/);
  assert.match(report,/const refreshDisplayRun=status\.curriculumHold\?curriculumHoldRefreshRun:effectiveRefreshRun/);
  assert.match(report,/const refreshOperationallyHealthy=refreshHealthy\|\|Boolean\(status\.curriculumHold\)/);
  assert.match(report,/Teacher refresh is intentionally holding publication for governed curriculum candidate PR/);
  assert.match(report,/Curriculum hold:/);
  assert.match(report,/status\.overall=criticalHealthy\?\(warnings\.length\?"attention":"healthy"\):"critical"/);
});
