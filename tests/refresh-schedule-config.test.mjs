import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const readText=url=>readFileSync(url,"utf8").replaceAll("\r\n","\n");
const workflow=readText(new URL("../.github/workflows/sync-study-pack.yml",import.meta.url));
const watchdog=readText(new URL("../.github/workflows/refresh-health.yml",import.meta.url));
const refresh=readFileSync(new URL("../scripts/refresh-teacher-pages.mjs",import.meta.url),"utf8");

test("teacher refresh covers the school day and self-triggers only for refresh-relevant workflow changes",()=>{
  for(const cron of ["17 6 * * *","47 9 * * *","17 13 * * *","47 15 * * *"])assert.match(workflow,new RegExp(cron.replace(/\*/g,"\\*")));
  assert.match(workflow,/\.github\/workflows\/sync-study-pack\.yml/);
  assert.doesNotMatch(workflow,/\.github\/workflows\/refresh-health\.yml/);
  assert.doesNotMatch(workflow,/\.github\/workflows\/health-dashboard\.yml/);
});

test("published sync policy matches the workflow schedule",()=>{
  assert.match(refresh,/scheduledAt: \['6:17 AM', '9:47 AM', '1:17 PM', '3:47 PM'\]/);
  assert.match(refresh,/primaryAt: '6:17 AM'/);
  assert.match(refresh,/backupAt: '9:47 AM'/);
});


test("overnight watchdog covers the 14.5-hour scheduled refresh gap",()=>{
  const watchdogCommand=watchdog.match(/node scripts\/check-refresh-health\.mjs[^\n]+/)?.[0]||"";
  assert.match(watchdogCommand,/--max-age-hours 16/);
  assert.doesNotMatch(watchdogCommand,/--require-today/);

  const refreshCommand=workflow.match(/node scripts\/check-refresh-health\.mjs[^\n]+/)?.[0]||"";
  assert.match(refreshCommand,/--require-today/);
  assert.match(refreshCommand,/--max-age-hours 1/);
});


test("watchdog follows both standalone deploys and completed teacher refresh workflows",()=>{
  const workflowRun=watchdog.match(/workflow_run:\n([\s\S]*?)\n  schedule:/)?.[1]||"";
  assert.match(workflowRun,/Deploy ABVM to GitHub Pages/);
  assert.match(workflowRun,/Refresh ABVM teacher pages/);
  assert.doesNotMatch(watchdog,/workflow_run\.conclusion == 'success'/);
  assert.match(watchdog,/github\.event\.workflow_run\.head_branch == 'main'/);
});

test("unchanged reviewed lunch never repeats full browser QA; changed lunch still requires it",()=>{
  const lane=workflow.split("\n  reviewed-lunch:\n")[1]||"";
  assert.ok(lane,"reviewed-lunch job missing");
  assert.match(lane,/name: Prove lunch isolation and negative-case integrity/);
  assert.match(lane,/name: Detect verified lunch publication changes\n\s+id: lunch-change/);
  assert.match(lane,/git diff --quiet -- pages\/data\/study-pack\.json/);
  assert.match(lane,/echo "changed=false" >> "\$GITHUB_OUTPUT"/);
  assert.match(lane,/echo "changed=true" >> "\$GITHUB_OUTPUT"/);
  for(const name of ["Independent full app QA before any main write","Commit only verified changed lunch pack on exact main"]){
    const section=lane.split("      - name: "+name+"\n")[1]||"";
    assert.match(section,/^\s+if: steps\.lunch-change\.outputs\.changed == 'true'/);
  }
  assert.match(lane,/npx playwright install --with-deps chromium webkit\n\s+npm run qa/);
  assert.match(lane,/git ls-remote --exit-code origin refs\/heads\/main/);
});
