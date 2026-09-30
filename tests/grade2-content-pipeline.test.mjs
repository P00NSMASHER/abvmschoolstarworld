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
    'high-frequency-word-use',
    'theme',
    'visualize',
    'dialogue',
    'religion-trinity',
    'religion-image-likeness',
    'religion-creation-care',
    'religion-five-senses',
    'religion-jesus-savior',
    'religion-disciples',
    'religion-mary-church',
    'religion-seed-new-life',
    'religion-gifts-choices',
  ]) {
    assert.equal(ids.has(expected), true, `missing current skill: ${expected}`);
  }

  assert.equal(pipeline.qa.status, 'pass');
  assert.equal(pipeline.qa.rejectedCount, 0);
  assert.equal(pipeline.qa.minimumQuestionsPerSkill, 2);
  for (const skill of pipeline.skills) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill.id] || 0) >= 2, `${skill.id} must have a sibling item for Comeback practice`);
  }
  assert.match(pipeline.bankFingerprint, /^[0-9a-f]{8}$/);
  assert.equal(pipeline.qa.unsupportedSkillCount, 0);
  assert.equal(pipeline.schemaVersion, 2);
  assert.equal(pipeline.safetyState, 'SAFE_PARTIAL');
  assert.deepEqual(pipeline.qa.subjectCoverage, ['Math', 'Reading / ELA', 'Religion', 'Spelling / Handwriting']);
  assert.equal(ids.has('vocabulary-in-context'), false, 'must not invent vocabulary definitions absent from source');
  assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vocabulary definitions/i.test(row.topic)));
  assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vine and the branches/i.test(row.topic)));
  assert.ok(pipeline.coverage.some(row => row.status === 'COVERED' && row.skillId === 'high-frequency-word-use'));
  assert.ok(pipeline.coverage.some(row => row.status === 'NOT_PRACTICED_BY_DESIGN' && /^Story:/i.test(row.topic)));
  const sightQuestions = pipeline.questions.filter(question => question.skill === 'high-frequency-word-use');
  assert.ok(sightQuestions.length >= 2);
  assert.ok(sightQuestions.every(question => question.evidenceContract?.doesNotClaim?.includes('spelling')));
  assert.ok(sightQuestions.every(question => question.evidenceContract?.doesNotClaim?.includes('isolated-print-recognition')));
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
  for (const skill of ['religion-trinity','religion-disciples','religion-mary-church','religion-seed-new-life']) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill] || 0) >= 2, `${skill} intentionally keeps a small strict-source sibling bank`);
  }
  assert.ok((pipeline.qa.questionTypeCounts?.transfer || 0) > 0);
  assert.ok((pipeline.qa.questionTypeCounts?.reasoning || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[1] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[2] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[3] || 0) > 0);
});

test('source-bound sight-word contexts restore the older StarBlox high-frequency practice without claiming spelling mastery', () => {
  const pack = {
    sourceHash: 'older-sight-word-week',
    subjects: [{
      subject: 'Reading / ELA',
      topics: ['Sight words: put, why, blue, help, for, yellow, both, there, even, ball, or, green, how, little, one, see, sounds, funny, find, could'],
      studyNotes: [],
    }],
    vocabulary: [],
  };

  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt: '2026-09-30T12:00:00.000Z',
    sourceHash: pack.sourceHash,
  });

  const questions = pipeline.questions.filter(question => question.skill === 'high-frequency-word-use');
  assert.equal(pipeline.safetyState, 'READY');
  assert.equal(pipeline.coverage.some(row => row.status === 'PARTIALLY_COVERED'), false);
  assert.equal(questions.length, 20);
  assert.ok(questions.every(question => question.sourceMode === 'CURATED_CONTEXT'));
  assert.ok(questions.every(question => question.questionType === 'transfer'));
  assert.ok(questions.every(question => question.evidenceContract?.strongestClaim === 'contextual-high-frequency-word-use'));
  assert.ok(questions.every(question => question.evidenceContract?.doesNotClaim?.includes('spelling')));
  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);
});

test('future teacher skills are detected without hand-editing the app', () => {
  const pack = {
    sourceHash: 'future-week',
    subjects: [
      {
        subject: 'Reading / ELA',
        topics: ['Word structure: adding -s and -es'],
        studyNotes: ['Reading comprehension: cause and effect, setting, inference, genre, sequence, captions'],
      },
      {
        subject: 'Math',
        topics: ['Addition within 20', 'Place value', 'Compare numbers', 'Time', 'Money'],
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

  for (const expected of ['suffix-s-es', 'cause-effect', 'setting', 'inference', 'genre', 'sequence', 'caption', 'addition-within-20', 'place-value', 'compare-numbers', 'time', 'money', 'religion-image-likeness']) {
    assert.equal(ids.has(expected), true, `missing future skill: ${expected}`);
  }
  assert.equal(pipeline.qa.status, 'pass');
  for (const skillId of ['suffix-s-es', 'cause-effect', 'setting', 'inference', 'genre', 'sequence', 'caption', 'addition-within-20', 'place-value', 'compare-numbers', 'time', 'money']) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skillId] || 0) >= 3, `${skillId} should receive a three-item semantic family`);
    const familyTypes = new Set(pipeline.questions.filter(question => question.skill === skillId).map(question => question.questionType));
    assert.deepEqual([...familyTypes].sort(), ['direct', 'reasoning', 'transfer'], `${skillId} should include direct, transfer, and reasoning practice`);
  }
  assert.equal(pipeline.safetyState, 'READY');
  assert.equal(pipeline.qa.unsupportedSkillCount, 0);
  assert.equal(pipeline.coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED'), false);
});

test('publication rejects a skill bank that cannot supply a different sibling Comeback item', () => {
  const envelope = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const pipeline = buildGrade2ContentPipeline(structuredClone(envelope.pack), { sourceHash: 'sibling-gate-test' });
  const target = pipeline.skills.find(skill => (pipeline.qa.questionsPerSkill?.[skill.id] || 0) >= 2);
  assert.ok(target);

  const broken = structuredClone(pipeline);
  let kept = false;
  broken.questions = broken.questions.filter(question => {
    if (question.skill !== target.id) return true;
    if (!kept) {
      kept = true;
      return true;
    }
    return false;
  });
  broken.qa.questionsPerSkill[target.id] = 1;
  broken.qa.questionCount = broken.questions.length;

  assert.ok(
    validateGrade2ContentPipeline(broken).some(issue => issue === `skill-sibling-bank-too-small:${target.id}:1/2`)
  );
});

test('production lineage resolves every question to an exact teacher page capture', () => {
  const envelope = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const pack = structuredClone(envelope.pack);
  const reading = pack.subjects.find(row => row.subject === 'Reading / ELA');
  const spelling = pack.subjects.find(row => row.subject === 'Spelling / Handwriting');
  const math = pack.subjects.find(row => row.subject === 'Math');
  const religion = pack.subjects.find(row => row.subject === 'Religion');
  const sourcePages = [
    {
      title: 'Reading Work',
      url: 'https://sites.google.com/view/abvmgr2/reading-work',
      checkedAt: '2026-09-30T08:00:00.000Z',
      contentHash: 'reading-capture-hash',
      lines: [...reading.topics.filter(line => !/^Grammar:/i.test(line)), ...reading.studyNotes],
    },
    {
      title: 'Weekly Spelling List',
      url: 'https://sites.google.com/view/abvmgr2/weekly-spelling-list',
      checkedAt: '2026-09-30T08:00:00.000Z',
      contentHash: 'spelling-capture-hash',
      lines: spelling.studyNotes,
    },
    {
      title: 'Tests',
      url: 'https://sites.google.com/view/abvmgr2/tests',
      checkedAt: '2026-09-30T08:00:00.000Z',
      contentHash: 'tests-capture-hash',
      lines: [
        ...reading.topics.filter(line => /^Grammar:/i.test(line)),
        ...spelling.topics,
        ...math.topics,
        ...math.studyNotes,
      ],
    },
    {
      title: 'Religion',
      url: 'https://sites.google.com/view/abvmgr2/religion',
      checkedAt: '2026-09-30T08:00:00.000Z',
      contentHash: 'religion-capture-hash',
      lines: [...religion.topics, ...religion.studyNotes],
    },
  ];

  const pipeline = buildGrade2ContentPipeline(pack, {
    generatedAt: '2026-09-30T08:00:00.000Z',
    sourceHash: pack.sourceHash,
    sourcePages,
    requirePageExactLineage: true,
  });

  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);
  assert.equal(pipeline.sourcePolicy.requirePageExactLineage, true);
  assert.equal(pipeline.qa.unresolvedLineageCount, 0);
  assert.equal(pipeline.qa.pageExactLineageCount, pipeline.qa.questionCount);
  assert.ok(pipeline.questions.every(question => question.sourceLineage?.quality === 'page-exact'));
  assert.ok(pipeline.questions.every(question => /^sha256:[0-9a-f]{64}$/.test(question.sourceLineage?.evidenceExcerptHash || '')));

  const sourceFor = skill => pipeline.questions.find(question => question.skill === skill)?.sourceLineage;
  assert.equal(sourceFor('subtraction-within-12')?.sourceTitle, 'Tests');
  assert.equal(sourceFor('sentence-types')?.sourceTitle, 'Tests');
  assert.equal(sourceFor('theme')?.sourceTitle, 'Reading Work');
  assert.equal(sourceFor('religion-trinity')?.sourceTitle, 'Religion');
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

test('page-exact publication fails closed when a detected skill has no matching source page evidence', () => {
  const pack = {
    sourceHash: 'missing-lineage-source',
    subjects: [
      { subject: 'Math', topics: ['Subtraction to 12'], studyNotes: [] },
    ],
    vocabulary: [],
  };
  assert.throws(
    () => buildGrade2ContentPipeline(pack, {
      sourceHash: pack.sourceHash,
      sourcePages: [{
        title: 'Tests',
        url: 'https://example.test/tests',
        checkedAt: '2026-09-30T08:00:00.000Z',
        contentHash: 'capture-hash',
        lines: ['Unrelated teacher content'],
      }],
      requirePageExactLineage: true,
    }),
    /lineage-unresolved/
  );
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

  const missingType = structuredClone(pipeline);
  const typeSkill = missingType.skills.find(skill => {
    const rows = missingType.questions.filter(question => question.skill === skill.id);
    return rows.length >= 3 && rows.some(question => question.questionType === 'reasoning');
  });
  assert.ok(typeSkill);
  for (const question of missingType.questions.filter(question => question.skill === typeSkill.id && question.questionType === 'reasoning')) {
    question.questionType = 'transfer';
  }
  assert.ok(validateGrade2ContentPipeline(missingType).includes(`semantic-family-type-missing:${typeSkill.id}:reasoning`));
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
