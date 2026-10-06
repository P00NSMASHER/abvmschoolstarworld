import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('teacher refresh opens only draft curriculum candidates and blocks publication on unresolved coverage', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /--autopilot-report=\.curriculum-coverage-plan\.json/);
  assert.match(workflow, /gh pr create --draft/);
  assert.match(workflow, /curriculum-candidate-\$\{SAFE_KEY\}/);
  assert.match(workflow, /Block publication while curriculum candidates are unresolved/);
  assert.match(workflow, /assert-curriculum-coverage-resolved\.mjs/);
  assert.doesNotMatch(workflow, /gh pr merge|--auto-merge|enable-auto-merge/i);
});

test('curriculum coverage evidence artifact includes the hidden report and fails closed if it disappears', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /name: Retain curriculum coverage evidence/);
  assert.match(workflow, /path: \.curriculum-coverage-plan\.json/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /if-no-files-found: error/);
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
test('blocked Actions PR bookkeeping cannot bypass the unresolved coverage gate', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /if gh pr create --draft/);
  assert.match(workflow, /GitHub Actions could not create the governed draft PR/);
  assert.match(workflow, /if ! create_candidate_pr/);
  assert.match(workflow, /continuing so the explicit unresolved-coverage gate can report the curriculum blocker/);
  assert.match(workflow, /Block publication while curriculum candidates are unresolved/);
  assert.match(workflow, /Unresolved curriculum coverage:/);
});

test('candidate branch identity is stable across unrelated source-hash churn', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /p\.candidateSetKey\|\|"unknown"/);
  assert.match(workflow, /CANDIDATE_KEY=/);
  assert.match(workflow, /SAFE_KEY=.*CANDIDATE_KEY/);
  assert.match(workflow, /curriculum-candidate-\$\{SAFE_KEY\}/);
  assert.match(workflow, /Source revision: \$SOURCE_HASH/);
});

test('refresh publication reconciles main races without force-pushing unverified state', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /for ATTEMPT in 1 2 3/);
  assert.match(workflow, /git fetch origin main/);
  assert.match(workflow, /git reset --hard "\$REMOTE_MAIN"/);
  assert.match(workflow, /refresh-teacher-pages\.mjs --autopilot-report=/);
  assert.match(workflow, /--context="Unresolved curriculum coverage after main advanced"/);
  assert.match(workflow, /npm run qa/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.doesNotMatch(workflow, /git push[^\n]*--force/);
});
