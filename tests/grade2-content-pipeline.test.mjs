import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGrade2ContentPipeline,
  mergeGrade2StudyNotes,
  validateGeneratedQuestionSpec,
  validateGrade2ContentPipeline,
} from '../scripts/grade2-content-pipeline.mjs';

const DATA_PATH = new URL('../pages/data/study-pack.json', import.meta.url);

test('current Grade 2 pack automatically yields source-backed skills and questions', () => {
  const envelope = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const pack = structuredClone(envelope.pack);
  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt: '2026-09-30T08:00:00.000Z',
    sourceHash: pack.sourceHash,
  });

  const ids = new Set(pipeline.skills.map(skill => skill.id));
  for (const expected of [
    'subtraction-within-12',
    'sentence-types',
    'consonant-blends',
    'cvc-structure',
    'long-short-a',
    'suffix-ed-ing',
    'theme',
    'visualize',
    'religion-trinity',
    'religion-image-likeness',
    'religion-creation-care',
    'religion-jesus-savior',
    'religion-gifts-choices',
    'vocabulary-in-context',
  ]) {
    assert.equal(ids.has(expected), true, `missing current skill: ${expected}`);
  }

  assert.equal(pipeline.qa.status, 'pass');
  assert.equal(pipeline.qa.rejectedCount, 0);
  assert.deepEqual(pipeline.qa.subjectCoverage, ['Math', 'Reading / ELA', 'Religion', 'Spelling / Handwriting']);
  assert.ok(pipeline.questions.length >= pipeline.skills.length);
  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);

  const signatures = pipeline.questions.map(question => question.prompt.toLowerCase() + '|' + question.answer.toLowerCase());
  assert.equal(new Set(signatures).size, signatures.length);
});

test('future teacher skills are detected without hand-editing the app', () => {
  const pack = {
    sourceHash: 'future-week',
    subjects: [
      {
        subject: 'Reading / ELA',
        topics: ['Word structure: adding -s and -es'],
        studyNotes: ['Reading comprehension: cause and effect, setting, inference, genre'],
      },
      {
        subject: 'Math',
        topics: ['Place value', 'Money'],
        studyNotes: [],
      },
      {
        subject: 'Religion',
        topics: [],
        studyNotes: ["We are made in God's image and likeness; we can think, choose, love"],
      },
    ],
    vocabulary: [],
  };

  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt: '2026-10-05T12:00:00.000Z',
    sourceHash: pack.sourceHash,
  });
  const ids = new Set(pipeline.skills.map(skill => skill.id));

  for (const expected of ['suffix-s-es', 'cause-effect', 'setting', 'inference', 'genre', 'place-value', 'money', 'religion-image-likeness']) {
    assert.equal(ids.has(expected), true, `missing future skill: ${expected}`);
  }
  assert.equal(pipeline.qa.status, 'pass');
});

test('generated study notes are merged into the matching Study subjects without duplicates', () => {
  const pack = {
    sourceHash: 'notes-test',
    subjects: [
      { subject: 'Reading / ELA', topics: ['Phonics: long a (a_e) and short a'], studyNotes: ['Keep this teacher note.'] },
      { subject: 'Math', topics: ['Subtraction to 12'], studyNotes: [] },
    ],
    vocabulary: [],
  };
  const pipeline = buildGrade2ContentPipeline(pack, { sourceHash: pack.sourceHash });
  mergeGrade2StudyNotes(pack, pipeline);

  const reading = pack.subjects.find(row => row.subject === 'Reading / ELA');
  assert.ok(reading.studyNotes.includes('Keep this teacher note.'));
  assert.ok(reading.studyNotes.some(note => /short a words/i.test(note)));
  assert.equal(new Set(reading.studyNotes.map(note => note.toLowerCase())).size, reading.studyNotes.length);
});

test('bad generated question specs are rejected before publication', () => {
  const issues = validateGeneratedQuestionSpec({
    id: 'bad',
    subject: 'Math',
    skill: 'test',
    prompt: 'Too short',
    choices: ['1', '1', '2'],
    answer: '3',
    explanation: '',
    hint: '',
    standards: [],
    domain: '',
    dok: 7,
    difficulty: 9,
  });
  assert.ok(issues.includes('prompt-too-short'));
  assert.ok(issues.includes('choices-duplicate'));
  assert.ok(issues.includes('answer-not-in-choices'));
  assert.ok(issues.includes('standards-missing'));
  assert.ok(issues.includes('dok-invalid'));
});
