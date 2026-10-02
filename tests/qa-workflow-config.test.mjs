import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const qa=fs.readFileSync(".github/workflows/qa.yml","utf8");
const pages=fs.readFileSync(".github/workflows/pages.yml","utf8");

test("deploy-covered main pushes are not QA'd twice",()=>{
  assert.match(qa,/pull_request:/);
  assert.match(qa,/workflow_dispatch:/);
  assert.match(qa,/push:\n\s+branches: \[main\][\s\S]*curriculum-candidates\/\*\*/);
  assert.match(qa,/\.github\/workflows\/health-dashboard\.yml/);

  const push=qa.match(/\n  push:\n([\s\S]*?)\n  workflow_dispatch:/)?.[1]||"";
  for(const duplicate of [
    "pages/**","scripts/**","tests/**","package.json","package-lock.json",
    "playwright.config.mjs",".github/workflows/pages.yml",
    ".github/workflows/sync-study-pack.yml",".github/workflows/refresh-health.yml"
  ]) assert.equal(push.includes("'"+duplicate+"'"),false,"duplicate post-merge QA path: "+duplicate);

  assert.match(pages,/name: Run release QA[\s\S]*run: npm run qa/);
});
