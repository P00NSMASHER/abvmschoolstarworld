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
  const sourceSubjects = new Set((pack.subjects || []).map(row => row.subject));
  assert.ok(pipeline.skills.length > 0, 'current verified source must yield at least one supported skill');
  assert.ok(pipeline.skills.every(skill => sourceSubjects.has(skill.subject)), 'every generated skill must map to a current source subject');
  assert.ok(pipeline.skills.every(skill => Array.isArray(skill.evidence) && skill.evidence.length > 0), 'every generated skill must retain source evidence');
  assert.ok(pipeline.questions.every(question => ids.has(question.skill)), 'every generated question must resolve to a current supported skill');

  assert.equal(pipeline.qa.status, 'pass');
  assert.equal(pipeline.qa.rejectedCount, 0);
  assert.equal(pipeline.qa.minimumQuestionsPerSkill, 2);
  for (const skill of pipeline.skills) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill.id] || 0) >= 2, `${skill.id} must have a sibling item for Comeback practice`);
  }
  assert.match(pipeline.bankFingerprint, /^[0-9a-f]{8}$/);
  assert.equal(pipeline.qa.unsupportedSkillCount, 0, `unsupported generated coverage: ${JSON.stringify(pipeline.coverage.filter(row => row.status === 'GENERATOR_UNSUPPORTED'))}`);
  assert.equal(pipeline.schemaVersion, 2);
  assert.ok(['SAFE_PARTIAL', 'READY'].includes(pipeline.safetyState));
  assert.deepEqual(
    pipeline.qa.subjectCoverage,
    [...new Set(pipeline.skills.map(skill => skill.subject))].sort(),
    'reported subject coverage must exactly match the currently generated source-backed skills'
  );

  const reading = (pack.subjects || []).find(row => row.subject === 'Reading / ELA');
  const religion = (pack.subjects || []).find(row => row.subject === 'Religion');
  const readingTopics = reading?.topics || [];
  const readingNotes = reading?.studyNotes || [];
  const sightTopic = readingTopics.find(topic => /^Sight words\s*:/i.test(String(topic || '')));
  if (sightTopic) {
    const sightQuestions = pipeline.questions.filter(question => question.skill === 'high-frequency-word-use');
    if (ids.has('high-frequency-word-use')) {
      assert.ok(sightQuestions.length >= 2);
      assert.ok(pipeline.coverage.some(row => row.status === 'COVERED' && row.skillId === 'high-frequency-word-use'));
      assert.ok(sightQuestions.every(question => question.evidenceContract?.doesNotClaim?.includes('spelling')));
      assert.ok(sightQuestions.every(question => question.evidenceContract?.doesNotClaim?.includes('isolated-print-recognition')));
    } else {
      assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /high-frequency|sight/i.test(row.topic)));
    }
  }
  if (readingTopics.some(topic => /^Story\s*:/i.test(String(topic || '')))) {
    assert.ok(pipeline.coverage.some(row => row.status === 'NOT_PRACTICED_BY_DESIGN' && /^Story:/i.test(row.topic)));
  }
  if (/vine and the branches|vine and branches/i.test([...(religion?.topics || []), ...(religion?.studyNotes || [])].join(' | '))) {
    assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vine and the branches/i.test(row.topic)));
  }
  const hasVerifiedVocabularyMeanings = (pack.vocabulary || []).some(row => String(row?.meaning || '').trim() && !/^(?:tbd|unknown|not provided|not posted)$/i.test(String(row?.meaning || '').trim()));
  if (!hasVerifiedVocabularyMeanings && (pack.vocabulary || []).length) {
    assert.equal(ids.has('vocabulary-in-context'), false, 'must not invent vocabulary definitions absent from source');
    assert.ok(pipeline.coverage.some(row => row.status === 'SOURCE_INSUFFICIENT' && /vocabulary definitions/i.test(row.topic)));
  }
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
  for (const skill of pipeline.skills.filter(row => /^subtraction-within-\d+$/.test(row.id))) {
    assert.deepEqual(
      [...new Set(pipeline.questions.filter(question => question.skill === skill.id).map(question => question.questionType))].sort(),
      ['direct','reasoning','transfer'],
      `${skill.id} must retain direct, reasoning, and transfer variants while it is present in current source material`
    );
  }

  const priorityFamilies = [
    'sentence-types','consonant-blends','cvc-structure','long-short-a','suffix-ed-ing',
    'dialogue','subtraction-within-12',
    'religion-trinity','religion-image-likeness','religion-creation-care','religion-jesus-savior',
    'religion-disciples','religion-mary-church','religion-seed-new-life','religion-five-senses','religion-gifts-choices',
  ];
  for (const skill of priorityFamilies.filter(skill => ids.has(skill))) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill] || 0) >= 3, `expected renewable three-item family for active skill ${skill}`);
    const types = new Set(pipeline.questions.filter(question => question.skill === skill).map(question => question.questionType));
    assert.deepEqual([...types].sort(), ['direct','reasoning','transfer'], `${skill} must include direct, transfer, and reasoning siblings while source-backed`);
  }
  const expandedFamilies = ['sentence-types','consonant-blends','cvc-structure','long-short-a','suffix-ed-ing','theme','visualize','dialogue','subtraction-within-12'];
  for (const skill of expandedFamilies.filter(skill => ids.has(skill))) {
    assert.ok((pipeline.qa.questionsPerSkill?.[skill] || 0) >= 8, `${skill} should have at least eight genuine semantic variants while source-backed`);
  }
  assert.ok(pipeline.qa.questionCount >= 100, 'current verified pack should expose at least 100 playable questions after renewable expansion');
  assert.ok((pipeline.qa.questionTypeCounts?.transfer || 0) > 0);
  assert.ok((pipeline.qa.questionTypeCounts?.reasoning || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[1] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[2] || 0) > 0);
  assert.ok((pipeline.qa.dokCounts?.[3] || 0) > 0);
});

test('source rollover drops lesson skills that are no longer present instead of carrying stale questions forward', () => {
  const pack = {
    sourceHash: 'rollover-source',
    subjects: [
      { subject: 'Reading / ELA', topics: ['Phonics: long a (a_e) and short a'], studyNotes: [] },
      { subject: 'Math', topics: [], studyNotes: [] },
    ],
    vocabulary: [],
  };
  const pipeline = buildGrade2ContentPipeline(pack, { sourceHash: pack.sourceHash });
  const ids = new Set(pipeline.skills.map(skill => skill.id));
  assert.equal(ids.has('subtraction-within-12'), false);
  assert.equal(ids.has('sentence-types'), false);
  assert.ok(ids.has('long-short-a'));
  assert.ok(pipeline.questions.every(question => question.skill !== 'subtraction-within-12' && question.skill !== 'sentence-types'));
  assert.equal(validateGrade2ContentPipeline(pipeline).length, 0);
});

test('Religion banks stay source-framed and avoid the rejected ambiguous/cross-subject distractor patterns', () => {
  const envelope = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const pipeline = buildGrade2ContentPipeline(structuredClone(envelope.pack), {
    generatedAt: '2026-09-30T12:15:00.000Z',
    sourceHash: envelope.pack.sourceHash,
  });

  const religion = pipeline.questions.filter(question => question.subject === 'Religion');
  const image = religion.filter(question => question.skill === 'religion-image-likeness');
  const gifts = religion.filter(question => question.skill === 'religion-gifts-choices');

  assert.ok(image.length >= 3);
  assert.ok(gifts.length >= 3);
  for (const skill of [...new Set(religion.map(question => question.skill))]) {
    const rows = religion.filter(question => question.skill === skill);
    assert.ok(rows.length >= 3, `${skill} should have at least three semantic siblings`);
    assert.deepEqual(
      [...new Set(rows.map(question => question.questionType))].sort(),
      ['direct','reasoning','transfer'],
      `${skill} should cover direct, transfer, and reasoning practice`
    );
  }
  assert.ok(image.every(question => question.sourceMode === 'STRICT_SOURCE'));
  assert.ok(gifts.every(question => question.sourceMode === 'STRICT_SOURCE'));

  const strictReligion = religion.filter(question => question.sourceMode === 'STRICT_SOURCE');
  assert.ok(strictReligion.every(question => /current Religion lesson/i.test(question.prompt)));

  const forbidden = /invented the seasons|every book in the Bible|unrelated gods|school subject|text feature|current Reading story|consonant blends|captions|school schedule|how to spell/i;
  assert.equal(
    religion.some(question => [question.prompt, ...question.choices].some(value => forbidden.test(String(value)))),
    false
  );
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
  for (const skillId of ['suffix-s-es', 'cause-effect', 'setting', 'inference', 'genre', 'sequence', 'caption', 'addition-within-20', 'place-value', 'compare-numbers', 'time', 'money', 'religion-image-likeness']) {
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
  const reading = pack.subjects.find(row => row.subject === 'Reading / ELA') || { topics: [], studyNotes: [] };
  const spelling = pack.subjects.find(row => row.subject === 'Spelling / Handwriting') || { topics: [], studyNotes: [] };
  const math = pack.subjects.find(row => row.subject === 'Math') || { topics: [], studyNotes: [] };
  const religion = pack.subjects.find(row => row.subject === 'Religion') || { topics: [], studyNotes: [] };
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
  for (const [skill, sourceTitle] of Object.entries({
    'subtraction-within-12': 'Tests',
    'sentence-types': 'Tests',
    'theme': 'Reading Work',
    'religion-trinity': 'Religion',
  })) {
    if (pipeline.skills.some(row => row.id === skill)) assert.equal(sourceFor(skill)?.sourceTitle, sourceTitle);
  }

  const normalizeLine = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const skill of pipeline.skills) {
    const evidence = (skill.evidence || []).map(normalizeLine).filter(Boolean);
    const matched = (skill.sourceLineage?.matchedEvidence || []).map(normalizeLine).filter(Boolean);
    assert.ok(
      matched.some(line => evidence.some(item => line.includes(item))),
      `source lineage for ${skill.id} must contain its actual skill evidence`
    );
  }

  const suffixLineage = sourceFor('suffix-ed-ing');
  if (suffixLineage) {
    assert.ok(suffixLineage.matchedEvidence?.some(line => /adding\s+-ed,\s*-ing/i.test(line)));
    assert.equal(suffixLineage.matchedEvidence?.some(line => /Reading Comprehension:/i.test(line)), false);
  }
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
  const familySkill = pipeline.skills.find(skill => {
    const rows = pipeline.questions.filter(question => question.skill === skill.id);
    const types = new Set(rows.map(question => question.questionType));
    return rows.length >= 3 && ['direct','transfer','reasoning'].every(type => types.has(type));
  });
  assert.ok(familySkill, 'current source-backed bank must contain at least one multi-type semantic family');

  const duplicate = structuredClone(pipeline);
  const duplicateFamily = duplicate.questions.filter(question => question.skill === familySkill.id);
  duplicateFamily[1].variantFingerprint = duplicateFamily[0].variantFingerprint;
  assert.ok(validateGrade2ContentPipeline(duplicate).some(issue => issue === `semantic-variant-duplicate:${familySkill.id}`));

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
  const missingTypeIssues = validateGrade2ContentPipeline(missingType);
  assert.ok(missingTypeIssues.includes(`semantic-family-type-missing:${typeSkill.id}:reasoning`));
  assert.ok(missingTypeIssues.includes(`priority-family-type-missing:${typeSkill.id}:reasoning`));
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
