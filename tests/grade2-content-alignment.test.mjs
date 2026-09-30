import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGrade2ContentPipeline } from '../scripts/grade2-content-pipeline.mjs';
import {
  validateGrade2PipelineAlignment,
  validateGrade2QuestionAlignment,
} from '../scripts/grade2-content-alignment.mjs';

function currentLikePack() {
  return {
    sourceHash: 'alignment-fixture',
    subjects: [
      {
        subject: 'Reading / ELA',
        topics: ['Grammar: types of sentences', 'Phonics: CVC words', 'Word structure: adding -ed, -ing'],
        studyNotes: ['Reading comprehension: theme, visualize'],
      },
      {
        subject: 'Spelling / Handwriting',
        topics: ['short a / long a', 'consonant blends'],
        studyNotes: [],
      },
      {
        subject: 'Math',
        topics: ['Subtraction to 12'],
        studyNotes: [],
      },
      {
        subject: 'Religion',
        topics: ['Trinity: 3 persons in one God'],
        studyNotes: ["We are made in God's image and likeness; we can think, choose, love", "Take care of God's gifts of creation"],
      },
    ],
    vocabulary: [],
  };
}

test('independent alignment gate accepts a correctly generated Grade 2 pipeline', () => {
  const pipeline = buildGrade2ContentPipeline(currentLikePack(), { sourceHash: 'alignment-fixture' });
  assert.deepEqual(validateGrade2PipelineAlignment(pipeline), []);
});

test('independent alignment gate rejects a wrong subject/standard/domain mapping', () => {
  const pipeline = buildGrade2ContentPipeline(currentLikePack(), { sourceHash: 'alignment-fixture' });
  const question = structuredClone(pipeline.questions.find(row => row.skill === 'subtraction-within-12'));
  question.subject = 'Reading / ELA';
  question.standards = ['CCSS.RL.2.1'];
  question.domain = 'Analyzing literary text';

  const issues = validateGrade2QuestionAlignment(question).map(row => row.issue);
  assert.ok(issues.includes('skill-subject-mismatch'));
  assert.ok(issues.includes('skill-standard-mismatch'));
  assert.ok(issues.includes('skill-domain-mismatch'));
});

test('independent alignment gate checks semantic evidence in the actual item, not the skill ID alone', () => {
  const pipeline = buildGrade2ContentPipeline(currentLikePack(), { sourceHash: 'alignment-fixture' });
  const question = structuredClone(pipeline.questions.find(row => row.skill === 'theme'));
  question.prompt = 'Choose the best answer from the three choices below.';
  question.explanation = 'That choice is correct.';
  question.hint = 'Read carefully.';
  question.sourceFact = 'Verified material.';

  const issues = validateGrade2QuestionAlignment(question).map(row => row.issue);
  assert.ok(issues.includes('semantic-anchor-missing'));
});
