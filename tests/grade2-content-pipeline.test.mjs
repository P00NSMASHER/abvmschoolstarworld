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
    'dialogue',
    'religion-trinity',
    'religion-image-likeness',
    'religion-creation-care',
    'religion-five-senses',
    'religion-jesus-savior',
    'religion-gifts-choices',
  ]) {
    assert.equal(ids.has(expected), true, `missing current skill: ${expected}`);
  }

  assert.equal(pipeline.qa.status, 'pass');
  assert.equal(pipeline.qa.rejectedCount, 0);
  assert.match(pipeline.bankFingerprint, /^[0-9a-f]{8}$/);
  assert.equal(pipeline.qa.unsupportedSkillCount, 0);
  assert.equal(pipeline.schemaVersion, 2);
  assert.equal(pipeline.safetyState, 'SAFE_PARTIAL');
  assert.deepEqual(pipeline.qa.subjectCoverage, ['Math', 'Reading / ELA', 'Religion', 'Spelling / Handwriting']);
  assert.equal(ids.has('vocabulary-in-context'), false, 'must not invent vocabulary definitions absent from source');
  assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vocabulary definitions/i.test(row.topic)));
  assert.ok(pipeline.questions.length >= pipeline.skills.length);
  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);

  const signatures = pipeline.questions.map(question => question.prompt.toLowerCase() + '|' + question.answer.toLowerCase());
  assert.equal(new Set(signatures).size, signatures.length);
  assert.ok(pipeline.questions.every(question => question.provenance === 'verified-abvm-skill-template'));
  assert.ok(pipeline.questions.every(question => question.evidenceContract?.evidenceType === 'DIRECT_TARGET'));
  assert.ok(pipeline.questions.every(question => question.contentFingerprint && question.variantFingerprint && question.presentationFingerprint));
  assert.ok(Math.max(...pipeline.qa.answerPositionCounts) - Math.min(...pipeline.qa.answerPositionCounts) <= 1);
  assert.equal(pipeline.qa.semanticVariantCount, pipeline.qa.questionCount);
  assert.ok(pipeline.qa.maxConsecutiveAnswerPosition <= 2);
  assert.deepEqual(
    [...new Set(pipeline.questions.filter(question => question.skill === 'subtraction-within-12').map(question => question.questionType))].sort(),
    ['direct','reasoning','transfer']
  );

  for (const skill of ['sentence-types','consonant-blends','cvc-structure','long-short-a','suffix-ed-ing','theme','visualize','dialogue','subtraction-within-12']) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill] || 0) >= 3, `expected semantic sibling family for ${skill}`);
  }
  assert.ok((pipeline.qa.questionsPerSkill?.['religion-trinity'] || 0) >= 2, 'Trinity intentionally keeps a smaller strict-source bank');
  assert.ok((pipeline.qa.questionTypeCounts?.transfer || 0) > 0);
  assert.ok((pipeline.qa.questionTypeCounts?.reasoning || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[1] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[2] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[3] || 0) > 0);
});

test('future teacher skills are detected without hand-editing the app', () => {
  const pack = {
    sourceHash: 'future-week',
    subjects: [
      {
        subject: 'Reading / ELA',
        topics: ['Word structure: adding -s and -es'],
        studyNotes: ['Reading comprehension: cause and effect, setting, inference, genre, sequence'],
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
  assert.ok((pipeline.qa.questionsPerSkill?.inference || 0) >= 3, 'future inference skill should receive its semantic sibling family');
  assert.equal(pipeline.safetyState, 'SAFE_PARTIAL');
  assert.equal(pipeline.qa.unsupportedSkillCount, 1);
  assert.ok(pipeline.coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED' && row.topic.toLowerCase() === 'sequence'));
});

test('vocabulary definitions are generated only when the verified pack actually supplies meanings', () => {
  const pack = {
    sourceHash: 'vocab-source',
    subjects: [
      { subject: 'Reading / ELA', topics: ['Vocabulary: rescue, secret, depend'], studyNotes: [] },
    ],
    vocabulary: [
      { term: 'rescue', meaning: 'to save someone or something from danger' },
      { term: 'secret', meaning: 'something kept hidden from other people' },
      { term: 'depend', meaning: 'to rely on someone or something' },
    ],
  };
  const pipeline = buildGrade2ContentPipeline(pack, { sourceHash: pack.sourceHash });
  assert.ok(pipeline.skills.some(skill => skill.id === 'vocabulary-in-context'));
  assert.ok(pipeline.questions.some(question => question.skill === 'vocabulary-in-context'));
  assert.equal(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vocabulary definitions/i.test(row.topic)), false);
  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);
});

test('generated study notes are merged into the matching Study subjects without duplicates', () => {
  const pack = {
    sourceHash: 'notes-test',
    subjects: [
      { subject: 'Reading / ELA', topics: ['Phonics: long a (a_e) and short a'], studyNotes: ['Keep this teacher note.'] },
      { subject: 'Spelling / Handwriting', topics: ['Test focus: short a / long a'], studyNotes: [] },
      { subject: 'Math', topics: ['Subtraction to 12'], studyNotes: [] },
    ],
    vocabulary: [],
  };
  const pipeline = buildGrade2ContentPipeline(pack, { sourceHash: pack.sourceHash });
  mergeGrade2StudyNotes(pack, pipeline);

  const reading = pack.subjects.find(row => row.subject === 'Reading / ELA');
  const spelling = pack.subjects.find(row => row.subject === 'Spelling / Handwriting');
  assert.ok(reading.studyNotes.includes('Keep this teacher note.'));
  assert.ok(spelling.studyNotes.some(note => /short a words/i.test(note)));
  assert.equal(new Set(reading.studyNotes.map(note => note.toLowerCase())).size, reading.studyNotes.length);
  assert.equal(new Set(spelling.studyNotes.map(note => note.toLowerCase())).size, spelling.studyNotes.length);
});

test('pipeline validation rejects fake semantic variety and answer-position streaks', () => {
  const envelope = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const pipeline = buildGrade2ContentPipeline(structuredClone(envelope.pack), { sourceHash: 'variety-gate-test' });
  const family = pipeline.questions.filter(question => question.skill === 'sentence-types');
  assert.ok(family.length >= 3);

  const duplicate = structuredClone(pipeline);
  const duplicateFamily = duplicate.questions.filter(question => question.skill === 'sentence-types');
  duplicateFamily[1].variantFingerprint = duplicateFamily[0].variantFingerprint;
  assert.ok(validateGrade2ContentPipeline(duplicate).some(issue => issue === 'semantic-variant-duplicate:sentence-types'));

  const biased = structuredClone(pipeline);
  biased.qa.maxConsecutiveAnswerPosition = 3;
  assert.ok(validateGrade2ContentPipeline(biased).includes('answer-position-run-too-long'));
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
