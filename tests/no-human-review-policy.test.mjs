import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';

const root = new URL('../',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');

test('ABVM standing authorization forbids mandatory human reviewer gates',()=>{
  const authority=read('AGENTS.md');
  const overview=read('README.md');
  const runbook=read('docs/ABVM_REFRESH_INCIDENT_RUNBOOK.md');
  const rules=read('docs/GITHUB_MAIN_PROTECTION_2026-10-17.md');
  assert.match(authority,/Standing ABVM release authorization/);
  assert.match(authority,/without any\s+mandatory human reviewer/);
  assert.match(authority,/without any\s+mandatory human reviewer[\s\S]*?human advice, visual feedback and pilots are optional/i);
  assert.match(overview,/without mandatory human reviewers or case-by-case owner\s+approval/i);
  assert.match(runbook,/human\s+code, design, teacher, privacy and source reviewers are optional/i);
  assert.match(rules,/required approving human reviews to zero/);
  assert.match(rules,/Do not enable code-owner\s+review requirements/i);
});

test('future protected-main instructions and CI cannot require approving people',()=>{
  const files=readdirSync(new URL('.github/workflows/',root)).filter(path=>/\.ya?ml$/.test(path));
  assert.ok(files.length>=15);
  for(const path of files){
    const workflow=read('.github/workflows/'+path);
    assert.doesNotMatch(workflow,/required_approving_review_count\s*:\s*[1-9]/i,path);
    assert.doesNotMatch(workflow,/required_reviewers\s*:/i,path);
    assert.doesNotMatch(workflow,/^\s*reviewers\s*:/mi,path);
  }
  for(const path of ['CODEOWNERS','.github/CODEOWNERS','docs/CODEOWNERS'])
    assert.equal(existsSync(new URL(path,root)),false,'Mandatory codeowner assignments are not part of ABVM release policy');
  assert.match(read('.github/workflows/qa.yml'),/npm run qa/);
  assert.match(read('.github/workflows/pages.yml'),/Run release QA/);
  assert.match(read('.github/workflows/sync-study-pack.yml'),/assert-safe-teacher-refresh/);
});

test('optional curriculum feedback and historical checklists cannot override current rules',()=>{
  const pilot=read('curriculum-candidates/PILOT_PROTOCOL_PR270.md');
  assert.match(pilot,/not a prerequisite for curriculum or application publication/i);
  assert.match(pilot,/The owner's standing authorization permits promotion without human reviewers/i);
  assert.match(pilot,/Unknown or disputed factual claims remain held/i);
  for(const path of [
    'docs/ABVM_PREMIUM_CONSOLIDATED_RELEASE_REVIEW_2026-10-11.md',
    'docs/ABVM_PREMIUM_SCHOOLWORK_JOINT_QA_2026-10-11.md',
    'docs/PREMIUM_PRIVACY_INTEGRATION_2026-10-10.md',
    'docs/ABVM_PREMIUM_SIGN_COMPOSITE_REVIEW_2026-10-12.md'
  ]){
    assert.match(read(path).slice(0,1000),/HISTORICAL|ARCHIVED/i,path);
  }
});
