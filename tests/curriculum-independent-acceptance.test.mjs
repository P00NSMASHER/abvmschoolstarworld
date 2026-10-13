import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const independent = read('.github/workflows/qa-reproduction.yml');
const privacy = read('.github/workflows/public-privacy-visual-acceptance.yml');
const triggeredPaths = [
  "'curriculum-candidates/**'",
  "'scripts/audit-held-curriculum-pilot.mjs'",
  "'scripts/build-held-curriculum-pilot-kit.mjs'",
  "'tests/curriculum-*.test.mjs'",
  "'scripts/build-private-curriculum-pilot.mjs'",
  "'tests/private-curriculum-pilot.*'",
];

test('candidate-only changes trigger independent exact-head full QA', () => {
  for (const path of triggeredPaths) assert.ok(independent.includes(path), path);
  assert.ok(independent.includes('ref: $' + '{{ github.event.pull_request.head.sha || github.sha }}'));
  assert.ok(independent.includes('git archive --format=tar HEAD'));
  assert.ok(independent.includes('npm run qa:static'));
  assert.ok(independent.includes('npm run qa:unit'));
  assert.ok(independent.includes('npm run qa:e2e'));
  assert.ok(independent.includes('Verify publication checker against candidate app'));
  assert.ok(independent.includes('timeout-minutes: 30'));
  assert.ok(!independent.includes('continue-on-error: true'));
});

test('separate independent gate tests held questions without claiming real pilot evidence', () => {
  assert.ok(independent.includes("hashFiles('curriculum-candidates/REVIEW_PR270.md') != ''"));
  for (const name of [
    'tests/curriculum-pilot-gates.test.mjs',
    'tests/curriculum-pilot-kit.test.mjs',
    'tests/curriculum-review-packet.test.mjs',
    'tests/curriculum-review-source-parity.test.mjs',
  ]) assert.ok(independent.includes(name), name);
  assert.ok(independent.includes('node scripts/audit-held-curriculum-pilot.mjs'));
});

test('held candidates independently trigger privacy acceptance without dropping previous privacy checks', () => {
  for (const path of triggeredPaths) assert.ok(privacy.includes(path), path);
  assert.ok(privacy.includes('ref: $' + '{{ github.event.pull_request.head.sha || github.sha }}'));
  assert.ok(privacy.includes('Verify exact review-head commit'));
  assert.ok(privacy.includes('tests/public-learner-privacy.test.mjs'));
  assert.ok(privacy.includes('tests/public-learner-privacy.spec.mjs --project=mobile --project=iphone-webkit'));
  assert.ok(privacy.includes('newly imported Yahoo notices'));
  assert.ok(privacy.includes("hashFiles('curriculum-candidates/REVIEW_PR270.md') != ''"));
  assert.ok(privacy.includes('tests/curriculum-pilot-kit.test.mjs'));
  assert.ok(privacy.includes('abvm-held-educator-kit-$' + '{{ github.run_id }}'));
  assert.ok(privacy.includes('node --test tests/private-curriculum-pilot.test.mjs'), 'Private preview safety step required');
  assert.ok(!privacy.includes('continue-on-error: true'));
});

test('no curriculum release or private learner record is introduced by independent check expansion', () => {
  for (const filename of [
    'curriculum-reading-ela-ask-answer-questions-b08b218ff1.json',
    'curriculum-reading-ela-long-i-i-e-and-short-i-08bac3c7d8.json',
    'curriculum-reading-ela-main-idea-details-0a409e562c.json',
    'curriculum-reading-ela-possessives-s-de6f518f2a.json',
  ]) {
    const candidate = JSON.parse(read('curriculum-candidates/' + filename));
    assert.equal(candidate.readiness.status, 'HOLD');
    assert.equal(candidate.enabledByDefault, false);
    assert.equal(candidate.rollout.automaticPromotion, false);
    assert.equal(candidate.rollout.safeUsageEvidenceRequired, true);
  }
  const student = read('curriculum-candidates/pilot-kit/PR270_STUDENT_PRACTICE.html');
  const key = read('curriculum-candidates/pilot-kit/PR270_EDUCATOR_KEY.html');
  assert.ok(student.includes('NOT PILOT EVIDENCE'));
  assert.ok(!student.includes('<strong>Answer:</strong>'));
  assert.equal(key.split('<strong>Answer:</strong>').length - 1, 32);
});
