import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const PACKET_PATH = new URL('curriculum-candidates/REVIEW_PR270.md', ROOT);
const CANDIDATE_FILES = [
  'curriculum-reading-ela-ask-answer-questions-b08b218ff1.json',
  'curriculum-reading-ela-long-i-i-e-and-short-i-08bac3c7d8.json',
  'curriculum-reading-ela-main-idea-details-0a409e562c.json',
  'curriculum-reading-ela-possessives-s-de6f518f2a.json',
];

const packet = readFileSync(PACKET_PATH, 'utf8');
const candidates = CANDIDATE_FILES.map(name =>
  JSON.parse(readFileSync(new URL('curriculum-candidates/' + name, ROOT), 'utf8'))
);
const normalize = value => String(value ?? '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

function packetSection(topic) {
  const marker = '### ' + topic + '\n';
  const start = packet.indexOf(marker);
  assert.ok(start !== -1, 'Missing educator section for ' + topic);
  assert.equal(packet.indexOf(marker, start + marker.length), -1, 'Duplicated educator topic ' + topic);
  const next = packet.indexOf('\n### ', start + marker.length);
  const boundary = packet.indexOf('\n## Nonpublication boundary', start + marker.length);
  const end = [next, boundary].filter(n => n >= 0).sort((a, b) => a - b)[0] ?? packet.length;
  return packet.slice(start, end);
}

function questionBlock(section, index, row) {
  const heading = '#### ' + (index + 1) + '. ' + row.questionType +
    ' (DOK ' + row.dok + ', difficulty ' + row.difficulty + ')';
  const start = section.indexOf(heading);
  assert.notEqual(start, -1, 'Missing or stale question header: ' + heading);
  assert.equal(section.indexOf(heading, start + heading.length), -1, 'Duplicated header: ' + heading);
  const next = section.indexOf('\n#### ', start + heading.length);
  return section.slice(start, next < 0 ? section.length : next);
}

function assertPacketMatchesCandidate(candidate, section) {
  assert.equal(candidate.proposedQuestions.length, 8, candidate.topic + ' requires eight variants');
  assert.equal(candidate.sourceContext.quality, 'page-exact');
  assert.equal(candidate.readiness.status, 'HOLD');
  assert.equal(candidate.enabledByDefault, false);
  assert.equal(candidate.rollout.automaticPromotion, false);
  assert.equal(candidate.rollout.manualPromotionRequired, true);
  assert.ok(section.includes('**Source line:** ' + candidate.sourceContext.sourceLine));
  assert.ok(section.includes('**Evidence:** ' + candidate.sourceContext.sourceUrl));
  assert.ok(section.includes('**Candidate ID:** \`' + candidate.candidateId + '\`'));

  const normalizedPrompts = new Set();
  const types = new Set();
  candidate.proposedQuestions.forEach((q, i) => {
    types.add(q.questionType);
    assert.equal(q.choices.length, 3, 'Exactly 3 choices in ' + candidate.topic + ' Q' + (i + 1));
    assert.equal(new Set(q.choices.map(normalize)).size, 3, 'Non-distinct choices ' + candidate.topic + ' Q' + (i + 1));
    assert.ok(q.choices.includes(q.answer), 'Correct answer absent in ' + candidate.topic + ' Q' + (i + 1));
    const p = normalize(q.prompt);
    assert.ok(!normalizedPrompts.has(p), 'Duplicate prompt in ' + candidate.topic);
    normalizedPrompts.add(p);
    const block = questionBlock(section, i, q);
    assert.ok(block.includes('**Question:** ' + q.prompt), 'Question drift ' + candidate.topic + ' Q' + (i + 1));
    q.choices.forEach((choice, choiceIndex) => assert.ok(
      block.includes('\n' + (choiceIndex + 1) + '. ' + choice + '\n'),
      'Choice drift ' + candidate.topic + ' Q' + (i + 1)
    ));
    assert.ok(block.includes('**Correct answer:** ' + (q.choices.indexOf(q.answer) + 1) + '. ' + q.answer),
      'Answer-key drift ' + candidate.topic + ' Q' + (i + 1));
    assert.ok(block.includes('**Explanation:** ' + q.explanation), 'Explanation drift ' + candidate.topic + ' Q' + (i + 1));
    assert.ok(block.includes('**Hint:** ' + q.hint), 'Hint drift ' + candidate.topic + ' Q' + (i + 1));
    assert.ok(block.includes('- [ ] Approve  - [ ] Revise  - [ ] Reject'),
      'Missing unsigned decision fields ' + candidate.topic + ' Q' + (i + 1));
    assert.ok(!/\-\s*\[[xX]\]\s*(?:Approve|Revise|Reject)/.test(block),
      'Unsigned review packet must never impersonate an approval');
  });
  assert.deepEqual([...types].sort(), ['direct', 'reasoning', 'transfer']);
  const count = [...section.matchAll(/^#### \d+\./gm)].length;
  assert.equal(count, 8, 'Unmatched or extra questions in educator section ' + candidate.topic);
}

test('the educator packet is an exact, non-approved copy of all four source-grounded candidates', () => {
  assert.ok(packet.includes('Candidate status:** HOLD'));
  assert.ok(!packet.includes('**Reviewer:** APPROVED'));
  assert.ok(!packet.includes('**Decision:** APPROVED'));
  assert.ok(!/^\s*- \[[xX]\]/m.test(packet), 'Global release gates must not be pre-checked');
  assert.equal([...packet.matchAll(/^#### \d+\./gm)].length, 32);
  assert.equal(candidates.length, 4);
  for (const candidate of candidates) {
    assertPacketMatchesCandidate(candidate, packetSection(candidate.topic));
  }
  const canonical = candidates.map(c => ({
    candidateId: c.candidateId,
    sourceHash: c.sourceHash,
    proposedQuestions: c.proposedQuestions,
  }));
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  console.log('Held curriculum review packet: 32/32 in sync; candidate content SHA-256: ' + digest);
});

test('tampering with one question fails the immutable review-packet correspondence check', () => {
  const candidate = structuredClone(candidates[0]);
  candidate.proposedQuestions[0].answer = candidate.proposedQuestions[0].choices.find(
    choice => choice !== candidate.proposedQuestions[0].answer
  );
  assert.throws(() => assertPacketMatchesCandidate(candidate, packetSection(candidate.topic)),
    /Answer-key drift/);
});
