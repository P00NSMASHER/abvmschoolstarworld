import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(
  new URL("../.github/workflows/preview-source-parity.yml",import.meta.url),
  "utf8",
);
// Exercise the actual workflow expression against historical and future branches.
const expression=source.match(/    if: >-\n([\s\S]*?)    runs-on:/)?.[1];
const selected=(head_ref,base_ref='main',event_name='pull_request')=>
  Function('github','startsWith','return ('+expression+')')(
    {head_ref,base_ref,event_name},(value,prefix)=>String(value||'').startsWith(prefix));

test("source parity covers review namespaces without a stale dated branch allowlist",()=>{
  assert.ok(expression);
  assert.doesNotMatch(expression,/202610|2026-10/);
  for(const branch of [
    'release/abvm-unified-preview-20261009',
    'integration/abvm-premium-schoolwork-qa-20261011',
    'schoolwork/offline-review-workbook-20261011',
    'ux/calendar-date-wayfinding-20261010',
    'design/calendar-reimagined-20261012',
    'qa/abvm-exact-review-head-20261010',
    'curriculum-candidate-gaps-d1be1039a3249f0be976e785',
    'release/future-preview','integration/future-review','schoolwork/future-intake',
  ]){
    assert.equal(selected(branch),true,branch+' head');
    assert.equal(selected('fix/nested',branch),true,branch+' base');
  }
  assert.equal(selected('main','main','workflow_dispatch'),true);
  for(const branch of ['main','fix/source-refresh','repair/health','not-release/preview'])
    assert.equal(selected(branch),false,branch);
});
test("source parity compares exact review head to latest main in read-only mode",()=>{
  assert.match(source,/ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/,
    "checkout must select the exact PR head or the explicitly chosen workflow_dispatch commit, never a stale preview branch");
  assert.match(source,/git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/,
    "reference main must be refreshed before comparison");
  assert.match(source,/ABVM_MAIN_REF: refs\/remotes\/origin\/main/);
  assert.match(source,/ABVM_PREVIEW_REF: HEAD/);
  assert.match(source,/node scripts\/assert-release-preview-parity\.mjs/);
  assert.match(source,/permissions:\s*\n\s+contents: read/,
    "workflow must keep read-only repository permissions");
});
