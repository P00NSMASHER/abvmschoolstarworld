import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('teacher refresh isolates held candidate questions but continues with verified teacher data', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /--autopilot-report=\.curriculum-coverage-plan\.json/);
  assert.match(workflow, /gh pr create --draft/);
  assert.match(workflow, /curriculum-candidate-\$\{SAFE_KEY\}/);
  assert.match(workflow, /Verify page-exact source parity and isolate unsupported curriculum/);
  assert.match(workflow, /assert-safe-teacher-refresh\.mjs --report=\.curriculum-coverage-plan\.json/);
  assert.doesNotMatch(workflow, /node scripts\/assert-curriculum-coverage-resolved\.mjs/);
  assert.doesNotMatch(workflow, /gh pr merge|--auto-merge|enable-auto-merge/i);
});

test('teacher refresh CI reruns when its isolated-source safety guard or regressions change', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /scripts\/assert-safe-teacher-refresh\.mjs/);
  assert.match(workflow, /tests\/assert-safe-teacher-refresh\.test\.mjs/);
});

test('curriculum coverage evidence artifact includes the hidden report and fails closed if it disappears', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /name: Retain curriculum coverage evidence/);
  assert.match(workflow, /path: \.curriculum-coverage-plan\.json/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /if-no-files-found: error/);
});

test('teacher refresh tracks modular curriculum family changes', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /scripts\/curriculum-families\/\*\*/);
});

test('candidate curriculum flags require a separate non-production preview output', () => {
  const refresh = readFileSync('scripts/refresh-teacher-pages.mjs', 'utf8');
  const guard = readFileSync('scripts/curriculum-preview-options.mjs', 'utf8');
  assert.match(refresh, /parseCurriculumPreviewOptions\(process\.argv/);
  assert.match(refresh, /activeCurriculumFeatureFlags,/);
  assert.match(refresh, /production study pack was not changed/);
  assert.match(guard, /--curriculum-feature-flag=/);
  assert.match(guard, /--curriculum-preview-output=/);
  assert.match(guard, /Candidate curriculum feature flags require --curriculum-preview-output=/);
  assert.match(guard, /Curriculum preview flags must identify disabled CANDIDATE families/);
  assert.match(guard, /family\?\.rolloutStatus === 'CANDIDATE'/);
  assert.match(guard, /Curriculum preview output cannot overwrite the production study pack/);
});

test('candidate-only pull requests still receive the full QA workflow', () => {
  const qa = readFileSync('.github/workflows/qa.yml', 'utf8');
  assert.match(qa, /curriculum-candidates\/\*\*/);
});

test('static QA validates candidate manifests before browser testing', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['qa:static'], /validate-curriculum-candidates\.mjs/);
});

test('teacher refresh reruns when its browser-QA contract changes', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  for (const path of [
    'tests/calendar-edge.spec.mjs',
    'tests/content-pipeline.spec.mjs',
    'tests/gold-standard.spec.mjs',
    'tests/recovered-learning-loop.spec.mjs',
    'tests/study-games-rich-content.spec.mjs',
  ]) {
    assert.ok(workflow.includes(path), `Missing refresh trigger for ${path}`);
  }
});

test('health-only workflow changes do not trigger teacher source refresh', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.doesNotMatch(workflow, /\.github\/workflows\/health-dashboard\.yml/);
  assert.doesNotMatch(workflow, /\.github\/workflows\/refresh-health\.yml/);
  assert.match(workflow, /\.github\/workflows\/sync-study-pack\.yml/);
});

test('candidate PR lifecycle cannot stall on a pre-existing branch or closed draft', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /gh pr list --head "\$CANDIDATE_BRANCH" --state all/);
  assert.match(workflow, /Candidate branch exists without a PR; recreating the governed draft PR/);
  assert.match(workflow, /gh pr reopen "\$PR_NUMBER"/);
  assert.match(workflow, /gh pr ready "\$PR_NUMBER" --undo/);
  assert.match(workflow, /retry-\$\{GITHUB_RUN_ID\}/);
  assert.doesNotMatch(workflow, /gh pr merge|--auto-merge|enable-auto-merge/i);
});
test('blocked Actions candidate PR bookkeeping cannot bypass source-safe isolation', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /if gh pr create --draft/);
  assert.match(workflow, /GitHub Actions could not create the governed draft PR/);
  assert.match(workflow, /if ! create_candidate_pr/);
  assert.match(workflow, /continuing to the source-safe isolation gate; candidate questions remain disabled/);
  assert.match(workflow, /Verify page-exact source parity and isolate unsupported curriculum/);
  assert.match(workflow, /assert-safe-teacher-refresh\.mjs --report=\.curriculum-coverage-plan\.json/);
});

test('candidate branch identity is stable across unrelated source-hash churn', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /p\.candidateSetKey\|\|"unknown"/);
  assert.match(workflow, /CANDIDATE_KEY=/);
  assert.match(workflow, /SAFE_KEY=.*CANDIDATE_KEY/);
  assert.match(workflow, /curriculum-candidate-\$\{SAFE_KEY\}/);
  assert.match(workflow, /Source revision: \$SOURCE_HASH/);
});

test('refresh publication reconciles main races without force-pushing unverified state',()=>{
  const workflow=readFileSync('.github/workflows/sync-study-pack.yml','utf8');
  const source=workflow.split('\n  refresh:\n')[1]?.split('\n  publish:\n')[0]||'';
  const publisher=workflow.split('\n  publish:\n')[1]?.split('\n  deploy:\n')[0]||'';
  assert.match(source,/refresh-teacher-pages\.mjs --autopilot-report=/);
  assert.match(source,/node scripts\/assert-safe-teacher-refresh\.mjs --report=\.curriculum-coverage-plan\.json/);
  assert.match(source,/Validate the candidate app before changing main\n\s+run: npm run qa/);
  assert.match(source,/SHA256SUMS/);
  assert.doesNotMatch(source,/group: abvm-verified-school-state/);
  assert.match(publisher,/git fetch --no-tags origin main/);
  assert.match(publisher,/git merge-base --is-ancestor/);
  assert.match(publisher,/git diff --name-only "\$VERIFIED_BASE" "\$current"/);
  assert.match(publisher,/Main changed outside isolated Homework/);
  assert.match(publisher,/git reset --hard "\$current"/);
  assert.match(publisher,/sha256sum --check SHA256SUMS/);
  assert.match(publisher,/Reject stale teacher data after a publication queue delay/);
  assert.match(publisher,/git push origin HEAD:main/);
  assert.doesNotMatch(publisher,/npm run qa/,'no long QA under the source-publication mutex');
  assert.doesNotMatch(workflow,/git push[^\n]*--force/);
});

test('teacher full QA keeps its timeout while short locked publication has a separate bounded budget',()=>{
  const workflow=readFileSync('.github/workflows/sync-study-pack.yml','utf8');
  const source=workflow.split('\n  refresh:\n')[1]?.split('\n  publish:\n')[0]||'';
  const publisher=workflow.split('\n  publish:\n')[1]?.split('\n  deploy:\n')[0]||'';
  assert.match(source,/timeout-minutes:\s*45/);
  assert.match(source,/Install Chromium and WebKit for candidate QA/);
  assert.match(publisher,/timeout-minutes:\s*10/);
  assert.match(publisher,/needs: refresh/);
  assert.match(publisher,/group: abvm-verified-school-state/);
  assert.match(publisher,/steps\.confirm-published-sha\.outputs\.sha/);
});
