import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditHeldCurriculumPilot,
  heldCandidateIssues,
  readHeldCandidates,
  scoreSyntheticChoice,
} from '../scripts/audit-held-curriculum-pilot.mjs';

const copy = () => structuredClone(readHeldCandidates());

test('read-only synthetic preflight covers all 32 held questions and 96 answer choices', () => {
  const report = auditHeldCurriculumPilot();
  assert.equal(report.candidateFamilies, 4);
  assert.equal(report.questions, 32);
  assert.equal(report.syntheticChoiceTrials, 96);
  assert.equal(report.syntheticCorrectCases, 32);
  assert.equal(report.syntheticIncorrectCases, 64);
  assert.equal(report.syntheticHintsInspected, 32);
  assert.match(report.contentFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.evidenceClass, 'SYNTHETIC_TEST_ONLY');
  assert.equal(report.learnerResultsCollected, false);
  assert.equal(report.realSafeUsageEvidence, 'NOT_PROVIDED');
  assert.equal(report.publication, 'HOLD');
});

test('all draft answers have exactly one correct synthetic choice per question', () => {
  for (const candidate of readHeldCandidates()) {
    for (const item of candidate.proposedQuestions) {
      assert.equal(item.choices.filter(choice => scoreSyntheticChoice(item, choice)).length, 1);
    }
  }
});

test('a fabricated choice cannot be scored as a legitimate trial', () => {
  const item = readHeldCandidates()[0].proposedQuestions[0];
  assert.throws(() => scoreSyntheticChoice(item, 'a made-up answer'), /not in the item/);
});

test('every curriculum family remains disabled and on hold', () => {
  for (const [field, invalid] of [
    ['enabledByDefault', true],
    ['readiness.status', 'READY_FOR_AUTOMATIC_PROMOTION'],
    ['readiness.automaticPromotion', true],
    ['rollout.automaticPromotion', false],
    ['rollout.manualPromotionRequired', true],
  ]) {
    const records = copy();
    const [candidate] = records;
    if (field.includes('.')) {
      const [section, key] = field.split('.');
      candidate[section][key] = invalid;
    } else {
      candidate[field] = invalid;
    }
    assert.ok(heldCandidateIssues(records).some(issue => issue.includes('release-hold')), field);
    assert.throws(() => auditHeldCurriculumPilot(records), /release-hold/);
  }
});

test('a missing family, lost question, or wrong candidate identity fails closed', () => {
  const missingFamily = copy().slice(0, 3);
  assert.deepEqual(heldCandidateIssues(missingFamily), ['expected-exactly-four-held-families']);
  const missingQuestion = copy();
  missingQuestion[0].proposedQuestions.pop();
  assert.ok(heldCandidateIssues(missingQuestion).some(issue => issue.includes('question-count')));
  const wrongId = copy();
  wrongId[0].candidateId = 'impostor';
  assert.ok(heldCandidateIssues(wrongId).some(issue => issue.includes('candidate-identity')));
});

test('changed choices, wrong key, leaked hint, and repeated question are rejected', () => {
  const duplicateOption = copy();
  duplicateOption[0].proposedQuestions[0].choices[0] = duplicateOption[0].proposedQuestions[0].choices[1];
  assert.ok(heldCandidateIssues(duplicateOption).some(issue => issue.includes('duplicate-choices')));
  const wrongKey = copy();
  wrongKey[1].proposedQuestions[0].answer = 'not in this question';
  assert.ok(heldCandidateIssues(wrongKey).some(issue => issue.includes('invalid-answer-key')));
  const leakedHint = copy();
  const item = leakedHint[1].proposedQuestions[2];
  item.hint = 'The answer is: ' + item.answer;
  assert.ok(heldCandidateIssues(leakedHint).some(issue => issue.includes('answer-leaking-hint')));
  const duplicatePrompt = copy();
  duplicatePrompt[1].proposedQuestions[1].prompt = duplicatePrompt[0].proposedQuestions[0].prompt;
  assert.ok(heldCandidateIssues(duplicatePrompt).some(issue => issue.includes('repeated-prompt')));
});

test('source-lineage loss and inflated DOK labels block preflight', () => {
  const sourceMissing = copy();
  sourceMissing[0].sourceContext.sourceLine = '';
  assert.ok(heldCandidateIssues(sourceMissing).some(issue => issue.includes('source-lineage')));
  const inflated = copy();
  inflated[3].proposedQuestions[4].dok = 3;
  assert.ok(heldCandidateIssues(inflated).some(issue => issue.includes('assessment-metadata')));
});

test('successful synthetic trials never constitute actual learner-use evidence', () => {
  const report = auditHeldCurriculumPilot();
  assert.equal(report.publication, 'HOLD');
  assert.equal(report.realSafeUsageEvidence, 'NOT_PROVIDED');
  assert.equal(report.independentEducatorDocumentation, 'NOT_VERIFIED_BY_THIS_TEST');
  assert.equal(report.productionRegistryIntegration, 'NOT_AUTHORIZED_BY_THIS_TEST');
  assert.equal(report.exactHeadActionResult, 'VERIFY_IN_GITHUB_ACTIONS');
});
