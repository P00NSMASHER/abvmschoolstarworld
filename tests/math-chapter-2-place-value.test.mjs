import assert from 'node:assert/strict';
import test from 'node:test';

import {
  matchCurriculumFamily,
  registeredSupplementalQuestionFamily,
} from '../scripts/curriculum-family-registry.mjs';
import {
  buildCurriculumCoveragePlan,
  curriculumCandidateIntrinsicBlockers,
} from '../scripts/curriculum-coverage-autopilot.mjs';
import {
  buildGrade2ContentPipeline,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

const timestamp = '2026-10-31T14:15:40.514Z';
const sourceHash = 'teacher-pages-7e345f8ef837196ec349';
const sourcePages = [{
  title: 'Tests',
  url: 'https://sites.google.com/view/abvmgr2/tests',
  checkedAt: timestamp,
  contentHash: '44f7a0841183cd45dc2197ed32176e1814b4a1891d1bc5e90fef58de35d889ed',
  lines: ['Wednesday Nov. 4: Math (Ch. 2)'],
}];

test('Math Chapter 2 has a complete automatic publisher-backed family', () => {
  const family = matchCurriculumFamily('Math', 'Math (Ch. 2)');
  assert.equal(family?.id, 'math-chapter-2-place-value');
  assert.equal(family?.rolloutStatus, 'CANDIDATE');
  assert.equal(family?.enabledByDefault, false);
  assert.equal(registeredSupplementalQuestionFamily(family.id).length, 7);
});

test('coverage autopilot recognizes the exact current test source', () => {
  const plan = buildCurriculumCoveragePlan({
    pipeline: {
      sourceHash,
      coverage: [{subject: 'Math', topic: 'Math (Ch. 2)', status: 'GENERATOR_UNSUPPORTED'}],
    },
    sourcePages,
    sourceHash,
    generatedAt: timestamp,
  });
  assert.equal(plan.unsupportedCount, 1);
  const [candidate] = plan.candidates;
  assert.equal(candidate.familyId, 'math-chapter-2-place-value');
  assert.equal(candidate.sourceContext.quality, 'page-exact');
  assert.equal(candidate.sourceContext.sourceLine, 'Wednesday Nov. 4: Math (Ch. 2)');
  assert.equal(candidate.proposedQuestions.length, 8);
  assert.deepEqual(curriculumCandidateIntrinsicBlockers(candidate), []);
});

test('Math Chapter 2 publishes scoped practice with exact lineage', () => {
  const pack = {
    sourceHash,
    subjects: [{
      subject: 'Math',
      topics: ['Math (Ch. 2)'],
      studyNotes: [
        'The Tests page lists Math (Ch. 2) for Wednesday, Nov. 4.',
        'The current Homework page assigns Page 35.',
      ],
    }],
    vocabulary: [],
  };
  const pipeline = buildGrade2ContentPipeline(pack, {
    sourceHash,
    generatedAt: timestamp,
    sourcePages,
    requirePageExactLineage: true,
  });
  assert.deepEqual(validateGrade2ContentPipeline(pipeline), []);
  assert.equal(pipeline.coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED'), false);

  const skill = pipeline.skills.find(row => row.id === 'math-chapter-2-place-value');
  const questions = pipeline.questions.filter(row => row.skill === skill?.id);
  assert.ok(skill);
  assert.equal(questions.length, 8);
  assert.deepEqual([...new Set(questions.map(row => row.questionType))].sort(), ['direct', 'reasoning', 'transfer']);
  assert.ok(skill.studyNotes.some(note => /place value and expanded form/i.test(note)));
  assert.match(skill.supplementalReference?.url || '', /secure\.viewer\.zmags\.com/);
  assert.ok(questions.every(row => row.sourceMode === 'CURATED_CONTEXT'));
  assert.ok(questions.every(row => row.sourceLineage?.quality === 'page-exact'));
  assert.ok(questions.every(row => row.sourceLineage?.sourceTitle === 'Tests'));
  assert.ok(questions.every(row => row.sourceChapters?.includes(2)));
  assert.ok(questions.every(row => row.choices.includes(row.answer)));
});
