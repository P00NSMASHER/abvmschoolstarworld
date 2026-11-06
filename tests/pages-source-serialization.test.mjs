import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=read('.github/workflows/pages.yml');
const teacher=read('.github/workflows/sync-study-pack.yml');
const homework=read('.github/workflows/refresh-current-homework.yml');

test('the complete Pages release holds the same lock as every cooperating source writer',()=>{
  const preJobs=pages.split('\njobs:')[0];
  assert.match(preJobs,/concurrency:\s*\n\s+group: abvm-verified-school-state\s*\n\s+cancel-in-progress: false\s*\n\s+queue: max/);
  assert.match(teacher,/publish:\s*\n[\s\S]*?group: abvm-verified-school-state/);
  assert.match(homework,/homework:\s*\n[\s\S]*?group: abvm-verified-school-state/);
  assert.doesNotMatch(preJobs,/group:\s*["']?pages["']?/);
});

test('do not self-deadlock a workflow-wide mutex with a nested Pages deploy lock',()=>{
  const verify=pages.slice(pages.indexOf('\n  verify:'),pages.indexOf('\n  deploy:'));
  const deploy=pages.slice(pages.indexOf('\n  deploy:'));
  assert.ok(verify.includes('Run release QA'));
  assert.ok(deploy.includes('needs: verify'));
  assert.doesNotMatch(verify,/\n\s+concurrency:\s*\n/);
  assert.doesNotMatch(deploy,/\n\s+concurrency:\s*\n/);
});

test('atomic releases still reject untested SHA drift, preserve actual live readback and no bypass',()=>{
  assert.match(pages,/current_main.*ADMITTED_SHA/);
  assert.match(pages,/Main advanced after full release QA; refusing untested publication/);
  assert.match(pages,/Recheck protected-main before publishing/);
  assert.match(pages,/Verify live lunch data and visible mobile flows/);
  assert.match(pages,/Retain exact live publication proof/);
  assert.match(pages,/reconcile_latest_main:/);
  assert.match(pages,/queue: max/);
  assert.doesNotMatch(pages,/cancel-in-progress: true/);
});
