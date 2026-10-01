import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCoverageCandidatePacket,
  validateCoverageCandidatePacket,
} from '../scripts/grade2-coverage-autopilot.mjs';

function envelopeWith(topic) {
  return {
    sourceCapturedAt: '2026-10-01T12:00:00.000Z',
    sourcePages: [
      { title:'Tests', url:'https://example.test/tests', checkedAt:'2026-10-01T12:00:00.000Z', contentHash:'tests-hash' },
      { title:'Reading Work', url:'https://example.test/reading', checkedAt:'2026-10-01T12:00:00.000Z', contentHash:'reading-hash' },
    ],
    pack: {
      schemaVersion: 1,
      sourceHash: 'source-autopilot-test',
      sourceCapturedAt: '2026-10-01T12:00:00.000Z',
      subjects: [
        { subject:'Reading / ELA', topics:[topic], studyNotes:[] },
      ],
      vocabulary: [],
    },
  };
}

test('unknown explicit teacher skill becomes a held source-linked candidate packet', () => {
  const packet = buildCoverageCandidatePacket(envelopeWith('Grammar: possessive nouns'), {
    generatedAt:'2026-10-01T12:01:00.000Z',
  });
  assert.equal(packet.status, 'ACTION_REQUIRED');
  assert.equal(packet.unsupportedSkillCount, 1);
  assert.deepEqual(validateCoverageCandidatePacket(packet), []);
  const [candidate] = packet.candidates;
  assert.equal(candidate.status, 'HOLD');
  assert.equal(candidate.featureFlagged, true);
  assert.equal(candidate.subject, 'Reading / ELA');
  assert.equal(candidate.topic, 'possessive nouns');
  assert.ok(candidate.evidenceLines.includes('Grammar: possessive nouns'));
  assert.equal(candidate.sourcePages[0]?.title, 'Tests');
  assert.equal(candidate.generationContract.preferredSemanticVariants, 8);
  assert.deepEqual(candidate.generationContract.requiredQuestionTypes, ['direct','transfer','reasoning']);
  assert.equal(candidate.promotionPolicy.automaticPromotion, false);
  assert.equal(candidate.promotionPolicy.automaticRuntimeWrite, false);
  assert.equal(candidate.promotionPolicy.requiresManualPromotion, true);
  assert.equal(JSON.stringify(candidate).includes('"prompt":'), false);
  assert.equal(JSON.stringify(candidate).includes('"answer":'), false);
});

test('candidate identity is deterministic across runs for the same source skill', () => {
  const one = buildCoverageCandidatePacket(envelopeWith('Grammar: possessive nouns'), {
    generatedAt:'2026-10-01T12:01:00.000Z',
  });
  const two = buildCoverageCandidatePacket(envelopeWith('Grammar: possessive nouns'), {
    generatedAt:'2026-10-01T14:01:00.000Z',
  });
  assert.equal(one.candidates[0].candidateId, two.candidates[0].candidateId);
});

test('approved subject and predicate family clears instead of generating a candidate', () => {
  const packet = buildCoverageCandidatePacket(envelopeWith('Grammar: subject & predicate'), {
    generatedAt:'2026-10-01T12:01:00.000Z',
  });
  assert.equal(packet.status, 'CLEAR');
  assert.equal(packet.unsupportedSkillCount, 0);
  assert.deepEqual(packet.candidates, []);
  assert.deepEqual(validateCoverageCandidatePacket(packet), []);
});
