import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const homework=readFileSync(new URL('../.github/workflows/refresh-current-homework.yml',import.meta.url),'utf8');
const independent=readFileSync(new URL('../.github/workflows/qa-reproduction.yml',import.meta.url),'utf8');
test('protected-main rejection retains a verified, idempotent Homework PR instead of falsely claiming success',()=>{
  assert.match(homework,/commit_refs_rules\|GH006\|GH013\|protected branch/);
  assert.match(homework,/gh pr create --base main --head/);
  assert.match(homework,/gh pr list --head/);
  assert.match(homework,/publication_pending=true/);
  assert.match(homework,/published=false/);
  assert.doesNotMatch(homework,/git push[^\n]*--force/);
  assert.doesNotMatch(homework,/gh pr merge/);
});
test('bot-created candidate dispatches exact branch QA with required permissions',()=>{
  assert.match(homework,/actions: write/);
  assert.match(homework,/pull-requests: write/);
  assert.match(homework,/GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(homework,/gh workflow run qa\.yml --ref "\$candidate_branch"/);
  assert.match(homework,/gh workflow run qa-reproduction\.yml --ref "\$candidate_branch"/);
  assert.match(independent,/on:\n  pull_request:\n  workflow_dispatch:/);
});
