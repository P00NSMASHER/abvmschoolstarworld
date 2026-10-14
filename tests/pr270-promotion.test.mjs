import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurriculumCoveragePlan } from '../scripts/curriculum-coverage-autopilot.mjs';
import { matchCurriculumFamily, registeredSupplementalQuestionFamily } from '../scripts/curriculum-family-registry.mjs';
import { auditHeldCurriculumPilot, readHeldCandidates } from '../scripts/audit-held-curriculum-pilot.mjs';

const approvedFingerprint = '2d173ac9d3f8761a48a13ac22df86460d522744fc572f95b76836ec2922ef4f0';

test('owner-approved PR270 fingerprint is registered as four complete runtime families', () => {
  assert.equal(auditHeldCurriculumPilot(readHeldCandidates()).contentFingerprint, approvedFingerprint);
  for (const candidate of readHeldCandidates()) {
    const family = matchCurriculumFamily(candidate.subject, candidate.topic);
    assert.ok(family, candidate.topic);
    assert.equal(family.rolloutStatus, 'APPROVED');
    assert.equal(family.enabledByDefault, true);
    assert.equal(registeredSupplementalQuestionFamily(family.id).length, 7);
  }
});

test('approved PR270 topics no longer produce unresolved curriculum candidates', () => {
  const candidates = readHeldCandidates();
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash: candidates[0].sourceHash,
      coverage: candidates.map(candidate => ({
        subject: candidate.subject,
        topic: candidate.topic,
        status: 'GENERATOR_UNSUPPORTED',
      })),
    },
    sourcePages: [{
      title: 'Reading Work',
      url: candidates[0].sourceContext.sourceUrl,
      checkedAt: candidates[0].sourceContext.sourceCheckedAt,
      contentHash: candidates[0].sourceContext.sourceCaptureHash,
      lines: [...new Set(candidates.map(candidate => candidate.sourceContext.sourceLine))],
    }],
    sourceHash: candidates[0].sourceHash,
    generatedAt: candidates[0].generatedAt,
  });
  assert.equal(plan.unsupportedCount, 4);
  assert.ok(plan.candidates.every(candidate => candidate.registryMatch?.rolloutStatus === 'APPROVED'));
  assert.ok(plan.candidates.every(candidate => candidate.proposedQuestions.length === 8));
});
