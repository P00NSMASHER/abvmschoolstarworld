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
  assert.equal(candidate.sourceContext.matchMethod, 'exact-topic-phrase');
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

test('candidate manifest rejects stale authoring metadata that overstates its question family', () => {
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash: 'gap-metadata',
      coverage: [{topic:'syllable types',subject:'Reading / ELA',status:'GENERATOR_UNSUPPORTED'}],
    },
    sourcePages: [{
      title:'Tests',url:'https://sites.google.com/view/abvmgr2/tests',checkedAt:'2026-10-01T12:00:00.000Z',
      contentHash:'tests-hash',lines:['Grammar: syllable types'],
    }],
    sourceHash:'gap-metadata',
    generatedAt:'2026-10-01T12:00:00.000Z',
  });
  const candidate = structuredClone(plan.candidates[0]);
  candidate.authoring.generatedQuestionCount = 8;
  candidate.authoring.status = 'DRAFT_FAMILY_PRESENT';
  const issues = validateCurriculumCoveragePlan({...plan,candidates:[candidate]});
  assert.ok(issues.some(issue => issue.includes('authoring-question-count-mismatch')));
  assert.ok(issues.some(issue => issue.includes('authoring-status-count-mismatch')));
});

test('page-exact curriculum candidates retain the exact source URL and source line', () => {
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash: 'gap-evidence',
      coverage: [{topic:'syllable types',subject:'Reading / ELA',status:'GENERATOR_UNSUPPORTED'}],
    },
    sourcePages: [{
      title:'Tests',
      url:'https://sites.google.com/view/abvmgr2/tests',
      checkedAt:'2026-10-01T12:00:00.000Z',
      contentHash:'tests-hash',
      lines:['Grammar: syllable types'],
    }],
    sourceHash:'gap-evidence',
    generatedAt:'2026-10-01T12:00:00.000Z',
  });
  const noLine = structuredClone(plan.candidates[0]);
  delete noLine.sourceContext.sourceLine;
  const noUrl = structuredClone(plan.candidates[0]);
  delete noUrl.sourceContext.sourceUrl;
  const lineIssues = validateCurriculumCoveragePlan({...plan,candidates:[noLine]});
  const urlIssues = validateCurriculumCoveragePlan({...plan,candidates:[noUrl]});
  assert.ok(lineIssues.some(issue => issue.includes('source-line-missing')));
  assert.ok(urlIssues.some(issue => issue.includes('source-url-missing')));
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

test('disabled characters registry family supplies a complete candidate without entering production inventory', () => {
  const family = matchCurriculumFamily('Reading / ELA', 'characters');
  assert.ok(family);
  assert.equal(family.rolloutStatus, 'CANDIDATE');
  assert.equal(family.enabledByDefault, false);
  assert.equal(family.supplementalQuestions.length + 1, 8);
  assert.deepEqual(
    [...new Set([family.baseQuestion, ...family.supplementalQuestions].map(question => question.questionType))].sort(),
    ['direct', 'reasoning', 'transfer']
  );

  const pack = {
    sourceHash: 'characters-week',
    subjects: [{
      subject:'Reading / ELA',
      topics:['Grammar: subject & predicate','Reading Comprehension: characters'],
      studyNotes:[],
    }],
    vocabulary: [],
  };
  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt:'2026-10-02T12:00:00.000Z',
    sourceHash:pack.sourceHash,
  });
  assert.equal(pipeline.coverage.some(row => row.topic === 'characters' && row.status === 'GENERATOR_UNSUPPORTED'), true);

  const plan = buildCurriculumCoveragePlan({
    pipeline,
    sourcePages:[{
      title:'Reading Work',
      url:'https://sites.google.com/view/abvmgr2/reading-work',
      checkedAt:'2026-10-02T12:00:00.000Z',
      contentHash:'characters-source-hash',
      lines:['Reading Comprehension: visualize, theme, dialogue, characters'],
    }],
    sourceHash:pack.sourceHash,
    generatedAt:'2026-10-02T12:00:00.000Z',
  });
  assert.equal(plan.candidates[0].authoring.status, 'DRAFT_FAMILY_PRESENT');
  assert.equal(plan.candidates[0].proposedQuestions.length, 8);
  assert.deepEqual(curriculumCandidateIntrinsicBlockers(plan.candidates[0]), []);
});

test('source evidence stays unresolved when teacher lines only partially overlap the unsupported topic', () => {
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash: 'partial-overlap-gap',
      coverage: [{
        topic: 'syllable types',
        subject: 'Reading / ELA',
        status: 'GENERATOR_UNSUPPORTED',
      }],
    },
    sourcePages: [{
      title: 'Tests',
      url: 'https://sites.google.com/view/abvmgr2/tests',
      checkedAt: '2026-10-01T12:00:00.000Z',
      contentHash: 'tests-hash',
      lines: ['Syllables review this week', 'Types of sentences quiz Friday'],
    }],
    generatedAt: '2026-10-01T12:00:00.000Z',
  });
  assert.deepEqual(validateCurriculumCoveragePlan(plan), []);
  const [candidate] = plan.candidates;
  assert.equal(candidate.sourceContext.quality, 'unresolved');
  assert.equal(candidate.sourceContext.matchMethod, 'none');
  assert.ok(candidate.readiness.blockers.includes('page-exact-source-context-required'));
});

test('source evidence can match reordered complete topic tokens without accepting partial matches', () => {
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash: 'token-order-gap',
      coverage: [{
        topic: 'syllable types',
        subject: 'Reading / ELA',
        status: 'GENERATOR_UNSUPPORTED',
      }],
    },
    sourcePages: [{
      title: 'Reading Work',
      url: 'https://sites.google.com/view/abvmgr2/reading',
      checkedAt: '2026-10-01T12:00:00.000Z',
      contentHash: 'reading-hash',
      lines: ['Review the types of syllable patterns from class.'],
    }],
    generatedAt: '2026-10-01T12:00:00.000Z',
  });
  assert.deepEqual(validateCurriculumCoveragePlan(plan), []);
  const [candidate] = plan.candidates;
  assert.equal(candidate.sourceContext.quality, 'page-exact');
  assert.equal(candidate.sourceContext.matchMethod, 'all-topic-tokens');
  assert.match(candidate.sourceContext.sourceLine, /types of syllable/i);
});
test('candidate set key ignores unrelated whole-pack hash changes for the same exact gap evidence', () => {
  const pipeline = {
    coverage: [{ topic: 'syllable types', subject: 'Reading / ELA', status: 'GENERATOR_UNSUPPORTED' }],
  };
  const sourcePages = [{
    title: 'Tests',
    url: 'https://sites.google.com/view/abvmgr2/tests',
    checkedAt: '2026-10-01T12:00:00.000Z',
    contentHash: 'tests-hash',
    lines: ['Friday Oct. 16: Grammar (syllable types)'],
  }];
  const a = buildCurriculumCoveragePlan({pipeline, sourcePages, sourceHash:'whole-pack-a', generatedAt:'2026-10-01T12:00:00.000Z'});
  const b = buildCurriculumCoveragePlan({pipeline, sourcePages, sourceHash:'whole-pack-b', generatedAt:'2026-10-01T12:05:00.000Z'});
  assert.notEqual(a.sourceHash, b.sourceHash);
  assert.equal(a.candidateSetKey, b.candidateSetKey);
  assert.match(a.candidateSetKey, /^gaps-[a-f0-9]{24}$/);
});

test('candidate set key changes when the exact supporting teacher evidence changes', () => {
  const pipeline = {
    coverage: [{ topic: 'syllable types', subject: 'Reading / ELA', status: 'GENERATOR_UNSUPPORTED' }],
  };
  const planFor = line => buildCurriculumCoveragePlan({
    pipeline,
    sourcePages: [{
      title: 'Tests',
      url: 'https://sites.google.com/view/abvmgr2/tests',
      checkedAt: '2026-10-01T12:00:00.000Z',
      contentHash: 'tests-hash',
      lines: [line],
    }],
    sourceHash: 'same-whole-pack-label',
    generatedAt: '2026-10-01T12:00:00.000Z',
  });
  const a = planFor('Friday Oct. 16: Grammar (syllable types)');
  const b = planFor('Friday Oct. 23: Grammar (syllable types)');
  assert.notEqual(a.candidates[0].sourceContext.evidenceExcerptHash, b.candidates[0].sourceContext.evidenceExcerptHash);
  assert.notEqual(a.candidateSetKey, b.candidateSetKey);
});
