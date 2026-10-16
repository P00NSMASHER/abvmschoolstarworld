import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const WORKFLOW = readFileSync(new URL('../.github/workflows/preview-source-parity.yml', import.meta.url), 'utf8');
const GUARD = readFileSync(new URL('../scripts/assert-release-preview-parity.mjs', import.meta.url), 'utf8');
const HELD_REVIEW_BRANCH = 'curriculum-candidate-gaps-d1be1039a3249f0be976e785';

test('held PR #270 runs exact-head authoritative source parity rather than skipping it', () => {
  assert.match(WORKFLOW, /^on:\s*\n\s+pull_request:/m);
  const gate = WORKFLOW.match(/^    if: (.+)$/m)?.[1] || '';
  assert.ok(gate.includes("github.head_ref == '" + HELD_REVIEW_BRANCH + "'"));
  assert.ok(gate.includes("github.base_ref == '" + HELD_REVIEW_BRANCH + "'"), 'Nested private review must run source parity');
  assert.ok(!gate.includes('true ||'), 'The gate may not bypass branch-scoped review');
  assert.match(WORKFLOW, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(WORKFLOW, /git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/);
  assert.match(WORKFLOW, /ABVM_MAIN_REF: refs\/remotes\/origin\/main/);
  assert.match(WORKFLOW, /ABVM_PREVIEW_REF: HEAD/);
  assert.match(WORKFLOW, /run: node scripts\/assert-release-preview-parity\.mjs/);
  assert.doesNotMatch(WORKFLOW, /continue-on-error:\s*true/);
  assert.doesNotMatch(WORKFLOW, /if:\s*always\(\)\s*\n\s*run: node scripts\/assert-release-preview-parity\.mjs/);
});

test('source parity continues checking real main against unchanged school sources', () => {
  for (const protectedPath of [
    'pages/data',
    'pages/school-updates.js',
    'pages/weekly-learning.js',
    'pages/assets/school',
    'pages/assets/lunch-art',
    'scripts/refresh-teacher-pages.mjs',
  ]) {
    assert.ok(GUARD.includes('"' + protectedPath + '"'),
      'Protected source unexpectedly missing: ' + protectedPath);
  }
  assert.match(GUARD, /git\("diff","--no-renames","--name-status",mainSha,previewSha/);
  assert.match(GUARD, /if\(diff\)fail\(/);
  assert.match(GUARD, /teacher freshness must use source-specific teacher-page check timestamps/);
  assert.match(GUARD, /notice arrivals or pack generation falsely imply teacher verification/);
  assert.doesNotMatch(GUARD, /process\.exit\(0\)/);
});

test('new held curriculum review does not change the publication controls', () => {
  const files = [
    'curriculum-reading-ela-ask-answer-questions-b08b218ff1.json',
    'curriculum-reading-ela-long-i-i-e-and-short-i-08bac3c7d8.json',
    'curriculum-reading-ela-main-idea-details-0a409e562c.json',
    'curriculum-reading-ela-possessives-s-de6f518f2a.json',
  ];
  for (const filename of files) {
    const entry = JSON.parse(readFileSync(new URL('../curriculum-candidates/' + filename, import.meta.url), 'utf8'));
    assert.equal(entry.readiness.status, 'HOLD');
    assert.equal(entry.enabledByDefault, false);
    assert.equal(entry.rollout.automaticPromotion, true);
    assert.equal(entry.rollout.manualPromotionRequired, false);
    assert.equal(entry.rollout.safeUsageEvidenceRequired, false);
    assert.equal(entry.sourceContext.quality, 'page-exact');
    assert.ok(entry.sourceContext.sourceCaptureHash);
  }
});
