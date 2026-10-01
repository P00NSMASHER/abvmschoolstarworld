import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCurriculumCoveragePlan,
  curriculumCandidateIntrinsicBlockers,
  evaluateCurriculumCandidate,
  validateCurriculumCoveragePlan,
} from '../scripts/curriculum-coverage-autopilot.mjs';
import {
  matchCurriculumFamily,
  curriculumFamilyRegistrySnapshot,
} from '../scripts/curriculum-family-registry.mjs';
import {
  buildGrade2ContentPipeline,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

test('unsupported teacher skill becomes a disabled source-grounded candidate instead of silently publishing', () => {
  const pipeline = {
    sourceHash: 'teacher-pages-gap-1',
    coverage: [{
      topic: 'syllable types',
      subject: 'Reading / ELA',
      status: 'GENERATOR_UNSUPPORTED',
    }],
  };
  const sourcePages = [{
    title: 'Tests',
    url: 'https://sites.google.com/view/abvmgr2/tests',
    checkedAt: '2026-10-01T12:00:00.000Z',
    contentHash: 'tests-hash',
    lines: ['Friday Oct. 16: Grammar (syllable types)'],
  }];

  const plan = buildCurriculumCoveragePlan({
    pipeline,
    sourcePages,
    sourceHash: pipeline.sourceHash,
    generatedAt: '2026-10-01T12:00:00.000Z',
  });

  assert.equal(plan.status, 'CANDIDATES_REQUIRED');
  assert.equal(plan.unsupportedCount, 1);
  assert.deepEqual(validateCurriculumCoveragePlan(plan), []);
  const [candidate] = plan.candidates;
  assert.equal(candidate.enabledByDefault, false);
  assert.equal(candidate.sourceContext.quality, 'page-exact');
  assert.equal(candidate.sourceContext.sourceTitle, 'Tests');
  assert.match(candidate.sourceContext.sourceLine, /syllable types/i);
  assert.equal(candidate.rollout.automaticPromotion, false);
  assert.equal(candidate.authoring.status, 'AUTHORING_REQUIRED');
  assert.equal(candidate.authoring.generatedQuestionCount, 0);
  assert.deepEqual(curriculumCandidateIntrinsicBlockers(candidate), [
    'minimum-semantic-variants:0/8',
    'question-type-required:direct',
    'question-type-required:transfer',
    'question-type-required:reasoning',
  ]);
  assert.equal(candidate.readiness.status, 'HOLD');
  assert.ok(candidate.readiness.blockers.includes('automated-qa-required'));
  assert.ok(candidate.readiness.blockers.includes('safe-usage-evidence-required'));
  assert.ok(candidate.readiness.blockers.includes('manual-promotion-required'));
});

test('approved subject-predicate registry family is absorbed by normal refresh generation', () => {
  const pack = {
    sourceHash: 'subject-predicate-week',
    subjects: [{
      subject: 'Reading / ELA',
      topics: ['Grammar: subject & predicate'],
      studyNotes: [],
    }],
    vocabulary: [],
  };

  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt: '2026-10-01T12:00:00.000Z',
    sourceHash: pack.sourceHash,
  });

  assert.deepEqual(validateGrade2ContentPipeline(pipeline), []);
  assert.equal(pipeline.qa.unsupportedSkillCount, 0);
  assert.equal(pipeline.coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED'), false);
  const questions = pipeline.questions.filter(question => question.skill === 'subject-predicate');
  assert.equal(questions.length, 8);
  assert.deepEqual(
    [...new Set(questions.map(question => question.questionType))].sort(),
    ['direct', 'reasoning', 'transfer']
  );
});

test('candidate promotion requires full family, automated QA, safe usage evidence, and manual approval', () => {
  const family = matchCurriculumFamily('Reading / ELA', 'subject & predicate');
  assert.ok(family);
  const questions = [family.baseQuestion, ...family.supplementalQuestions].map((question, index) => ({
    candidateIndex: index + 1,
    questionType: question.questionType || 'direct',
    prompt: question.prompt,
    choices: [...question.choices],
    answer: question.answer,
    explanation: question.explanation,
    hint: question.hint,
    dok: question.dok,
    difficulty: question.difficulty,
  }));
  const candidate = {
    candidateId: 'curriculum-reading-subject-predicate',
    familyId: family.id,
    subject: family.subject,
    topic: family.label,
    sourceContext: {
      quality: 'page-exact',
      sourceTitle: 'Tests',
      sourceUrl: 'https://sites.google.com/view/abvmgr2/tests',
      sourceCaptureHash: 'capture-hash',
      evidenceExcerptHash: 'sha256:abc',
      sourceLine: 'Grammar: subject & predicate',
    },
    featureFlag: family.featureFlag,
    enabledByDefault: false,
    minimumSemanticVariants: family.minimumSemanticVariants,
    requiredQuestionTypes: family.requiredQuestionTypes,
    proposedQuestions: questions,
  };

  assert.deepEqual(curriculumCandidateIntrinsicBlockers(candidate), []);

  const beforeManual = evaluateCurriculumCandidate(candidate, {
    automatedQaPassed: true,
    safeUsageEvidence: 'sufficient-safe-usage',
    manualApproval: false,
  });
  assert.equal(beforeManual.status, 'HOLD');
  assert.deepEqual(beforeManual.blockers, ['manual-promotion-required']);
  assert.equal(beforeManual.automaticPromotion, false);

  const ready = evaluateCurriculumCandidate(candidate, {
    automatedQaPassed: true,
    safeUsageEvidence: 'sufficient-safe-usage',
    manualApproval: true,
  });
  assert.equal(ready.status, 'READY_FOR_MANUAL_PROMOTION');
  assert.deepEqual(ready.blockers, []);
  assert.equal(ready.automaticPromotion, false);
});

test('registry exposes feature flags and never treats draft candidates as production inventory', () => {
  const snapshot = curriculumFamilyRegistrySnapshot();
  const subjectPredicate = snapshot.find(row => row.id === 'subject-predicate');
  assert.ok(subjectPredicate);
  assert.equal(subjectPredicate.rolloutStatus, 'APPROVED');
  assert.equal(subjectPredicate.enabledByDefault, true);
  assert.match(subjectPredicate.featureFlag, /^curriculum-family:/);
  assert.equal(subjectPredicate.minimumSemanticVariants, 8);
  assert.deepEqual([...subjectPredicate.requiredQuestionTypes].sort(), ['direct', 'reasoning', 'transfer']);
});
