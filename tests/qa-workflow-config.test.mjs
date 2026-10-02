import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const qa=fs.readFileSync(".github/workflows/qa.yml","utf8");
const pages=fs.readFileSync(".github/workflows/pages.yml","utf8");

test("main pushes route live-site changes to Pages and tooling changes to QA only",()=>{
  assert.match(qa,/pull_request:/);
  assert.match(qa,/workflow_dispatch:/);
  const push=qa.match(/\n  push:\n([\s\S]*?)\n  workflow_dispatch:/)?.[1]||"";
  for(const qaOnly of [
    "scripts/**","tests/**","curriculum-candidates/**","package.json","package-lock.json",
    "playwright.config.mjs",".github/workflows/qa.yml",
    ".github/workflows/sync-study-pack.yml",".github/workflows/refresh-health.yml",
    ".github/workflows/health-dashboard.yml"
  ]) assert.equal(push.includes("'"+qaOnly+"'"),true,"missing exact-main QA path: "+qaOnly);
  for(const deployCovered of ["pages/**",".github/workflows/pages.yml"])
    assert.equal(push.includes("'"+deployCovered+"'"),false,"duplicate QA+Pages path: "+deployCovered);
  assert.match(pages,/name: Run release QA[\s\S]*run: npm run qa/);
});


test("Pages push deploys only when live site or deployment workflow changes",()=>{
  const push=pages.match(/\n  push:\n([\s\S]*?)\n  workflow_dispatch:/)?.[1]||"";
  assert.equal(push.includes("'pages/**'"),true);
  assert.equal(push.includes("'.github/workflows/pages.yml'"),true);
  for(const nonDeployable of [
    "scripts/**","tests/**","package.json","package-lock.json","playwright.config.mjs",
    ".github/workflows/sync-study-pack.yml",".github/workflows/refresh-health.yml"
  ]) assert.equal(push.includes("'"+nonDeployable+"'"),false,"non-deployable path triggered Pages: "+nonDeployable);
});
