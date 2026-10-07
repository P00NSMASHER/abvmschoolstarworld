import assert from 'node:assert/strict';
import test from 'node:test';

import {
  curriculumFamilyRuntimeEnabled,
  matchCurriculumFamily,
  registeredRuntimeMetadata,
  registeredSupplementalQuestionFamily,
} from '../scripts/curriculum-family-registry.mjs';
import {
  buildGrade2ContentPipeline,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

function sourcePack() {
  return {
    sourceHash: 'teacher-pages-short-i-long-i',
    subjects: [{
      subject: 'Spelling / Handwriting',
      topics: ['Test focus: short i / long i'],
      studyNotes: [],
    }],
    vocabulary: [],
  };
}

const sourcePages = [{
  title: 'Tests',
  url: 'https://sites.google.com/view/abvmgr2/tests',
  checkedAt: '2026-10-05T19:19:41.665Z',
  contentHash: 'c91cc1e62eea30c82595cbad75abd174f3811a4cb56b30097113df6dc487db1f',
  lines: [
    'Friday Oct. 9: Spelling (short i/long i)/Handwriting',
  ],
}];

test('short-i/long-i is approved and enabled by default', () => {
  const family = matchCurriculumFamily('Spelling / Handwriting', 'short i / long i');

  assert.ok(family);
  assert.equal(family.id, 'short-i-long-i');
  assert.equal(family.rolloutStatus, 'APPROVED');
  assert.equal(family.enabledByDefault, true);
  assert.equal(curriculumFamilyRuntimeEnabled(family), true);
  assert.equal(registeredRuntimeMetadata('short-i-long-i')?.id, 'short-i-long-i');
  assert.equal(registeredSupplementalQuestionFamily('short-i-long-i').length, 8);
});

test('approved short-i/long-i resolves raw teacher slash formatting with exact lineage', () => {
  const pipeline = buildGrade2ContentPipeline(sourcePack(), {
    sourceHash: 'production-short-i-long-i',
    generatedAt: '2026-10-05T19:19:41.665Z',
    sourcePages,
    requirePageExactLineage: true,
  });

  assert.deepEqual(validateGrade2ContentPipeline(pipeline), []);
  assert.equal(
    pipeline.coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED'),
    false
  );

  const skill = pipeline.skills.find(row => row.id === 'short-i-long-i');
  assert.ok(skill);
  assert.deepEqual(skill.standards, ['CCSS.RF.2.3']);
  assert.equal(skill.domain, 'Foundational reading');

  const questions = pipeline.questions.filter(row => row.skill === 'short-i-long-i');
  assert.equal(questions.length, 9);
  assert.deepEqual(
    [...new Set(questions.map(row => row.questionType))].sort(),
    ['direct', 'reasoning', 'transfer']
  );
  assert.ok(questions.every(row => row.choices.includes(row.answer)));
  assert.ok(questions.every(row => Number.isInteger(row.difficulty) && row.difficulty >= 2 && row.difficulty <= 3));
  assert.ok(questions.every(row => row.sourceLineage?.quality === 'page-exact'));
  assert.ok(questions.every(row => row.sourceLineage?.sourceTitle === 'Tests'));
  assert.ok(
    questions.every(row =>
      /short i.*long i/i.test((row.sourceLineage?.matchedEvidence || []).join(' '))
    )
  );
});


test('page-exact lineage remains fail-closed for reordered or fuzzy evidence', () => {
  const reorderedPages = [{
    ...sourcePages[0],
    lines: ['Friday Oct. 9: Spelling (long i/short i)/Handwriting'],
  }];
  const fuzzyPages = [{
    ...sourcePages[0],
    lines: ['Friday Oct. 9: Spelling vowel contrasts and handwriting'],
  }];

  for (const pages of [reorderedPages, fuzzyPages]) {
    assert.throws(
      () => buildGrade2ContentPipeline(sourcePack(), {
        sourceHash: 'production-short-i-long-i-negative-lineage',
        generatedAt: '2026-10-05T19:19:41.665Z',
        sourcePages: pages,
        requirePageExactLineage: true,
      }),
      /skill-lineage-unresolved:short-i-long-i/
    );
  }
});
