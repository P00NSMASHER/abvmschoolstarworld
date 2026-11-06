import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
function job(name) {
  const start=workflow.indexOf('\n  '+name+':\n');
  assert.ok(start>=0,'Missing job '+name);
  const rest=workflow.slice(start+4+name.length);
  const end=rest.search(/\n  [a-z][a-z-]*:\n/);
  return end<0?rest:rest.slice(0,end);
}
const verify=job('verify'),deploy=job('deploy');

test('full QA and site generation remain inside the workflow-wide school-state transaction',()=>{
  assert.match(verify,/Admit exact current protected-main commit/);
  assert.match(verify,/ref:\s*\$\{\{ steps\.admit\.outputs\.sha \}\}/);
  assert.match(verify,/test "\$\(git rev-parse HEAD\)" = "\$ADMITTED_SHA"/);
  assert.match(verify,/Run release QA\n\s+run: npm run qa/);
  assert.match(verify,/Build static site/);
  assert.match(verify,/Upload site/);
  assert.match(workflow.split('\\njobs:')[0],/concurrency:\\n\\s+group: abvm-verified-school-state\\n\\s+cancel-in-progress: false\\n\\s+queue: max/);
  assert.doesNotMatch(verify,/\\n\\s+concurrency:\\n/);
  assert.equal((workflow.match(/run: npm run qa/g)||[]).length,1,
    'exact-head full release QA must never be silently skipped or duplicated');
});

test('the same workflow mutex excludes source commits throughout QA and final deploy',()=>{
  assert.match(deploy,/needs: verify/);
  assert.match(workflow.split('\\njobs:')[0],/concurrency:\\n\\s+group: abvm-verified-school-state\\n\\s+cancel-in-progress: false\\n\\s+queue: max/);
  assert.doesNotMatch(deploy,/\\n\\s+concurrency:\\n/);
  assert.match(deploy,/Check completed QA is still bound to current protected main/);
  assert.match(deploy,/Main advanced after full release QA; refusing untested publication/);
  assert.match(deploy,/ref:\s*\$\{\{ needs\.verify\.outputs\.sha \}\}/);
  assert.match(deploy,/Prove the deployment workspace matches passed QA/);
  assert.match(deploy,/Recheck protected-main before publishing/);
  assert.match(deploy,/Main advanced while QA ran/);
  assert.ok(deploy.indexOf('Recheck protected-main before publishing')<deploy.indexOf('\n      - name: Deploy\n'),
    'no stale or untested commit can reach Pages');
  assert.match(deploy,/Verify live lunch data and visible mobile flows/);
  assert.match(deploy,/Retain exact live publication proof/);
});

test('publication and live comparison consume the same immutable QA-generated assets',()=>{
  assert.match(verify,/name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(deploy,/artifact_name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ needs\.verify\.outputs\.qa_attempt \}\}/);
  assert.match(verify,/name: abvm-release-generated-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(deploy,/name: abvm-release-generated-\$\{\{ github\.run_id \}\}-\$\{\{ needs\.verify\.outputs\.qa_attempt \}\}/);
  for(const f of ['study-pack-runtime.json','study-archive.json']){
    assert.ok(verify.includes('pages/data/'+f),'missing QA-generated proof '+f);
    assert.ok(deploy.includes('test -s pages/data/'+f),'missing exact deployed proof '+f);
  }
  assert.ok(deploy.indexOf('Restore QA-generated runtime assets') < deploy.indexOf('Verify live lunch data and visible mobile flows'));
  assert.doesNotMatch(deploy,/npm run qa/,'publisher must not duplicate expensive full QA after the atomic workflow verified it');
});

test('stale/replaced verification cannot be mistaken for an accepted release',()=>{
  assert.match(verify,/outputs:\s*\n\s+sha: \$\{\{ steps\.admit\.outputs\.sha \}\}/);
  assert.match(verify,/qa_attempt: \$\{\{ steps\.artifact-identity\.outputs\.attempt \}\}/);
  assert.match(verify,/attempt=\$\{\{ github\.run_attempt \}\}/);
  assert.match(deploy,/ADMITTED_SHA: \$\{\{ needs\.verify\.outputs\.sha \}\}/);
  assert.ok(deploy.indexOf('Check completed QA is still bound to current protected main') <
    deploy.indexOf('Checkout QA-bound release commit'));
  assert.ok(deploy.indexOf('Check completed QA is still bound to current protected main') <
    deploy.indexOf('Configure Pages'));
  assert.match(workflow,/cancel-in-progress: false\n  queue: max/);
});

test('a publish-only rerun reuses the exact successful QA attempt instead of looking for missing new artifacts',()=>{
  assert.match(verify,/name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(deploy,/artifact_name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ needs\.verify\.outputs\.qa_attempt \}\}/);
  assert.match(deploy,/name: abvm-release-generated-\$\{\{ github\.run_id \}\}-\$\{\{ needs\.verify\.outputs\.qa_attempt \}\}/);
  assert.doesNotMatch(deploy,/artifact_name: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
});
