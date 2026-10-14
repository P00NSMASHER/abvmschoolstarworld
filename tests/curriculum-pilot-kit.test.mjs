import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { auditHeldCurriculumPilot, readHeldCandidates } from '../scripts/audit-held-curriculum-pilot.mjs';
import {
  buildHeldPilotKit,
  renderStudentPilot,
  renderEducatorKey,
  renderPilotObservation,
} from '../scripts/build-held-curriculum-pilot-kit.mjs';

const clone = () => structuredClone(readHeldCandidates());
const count = (content, token) => content.split(token).length - 1;
const output = buildHeldPilotKit();
const STUDENT = 'curriculum-candidates/pilot-kit/PR270_STUDENT_PRACTICE.html';
const KEY = 'curriculum-candidates/pilot-kit/PR270_EDUCATOR_KEY.html';
const OBSERVATION = 'curriculum-candidates/pilot-kit/PR270_OBSERVATION.html';

test('a source-locked, deterministic, black-and-white printable pilot kit is in sync', () => {
  assert.deepEqual(Object.keys(output).sort(), [STUDENT, KEY, OBSERVATION].sort());
  for (const [path, text] of Object.entries(output)) {
    const versioned = readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(versioned, text, 'Stale or altered file: ' + path);
    assert.ok(text.startsWith('<!doctype html>'));
    assert.match(text, /@media print/);
    assert.match(text, /@page/);
    assert.match(text, /OFFLINE \/ EDUCATOR-SUPERVISED DRAFT/);
    assert.match(text, /NOT PILOT EVIDENCE/);
    assert.doesNotMatch(text, /<script\b|<iframe\b|<img\b|<link\b|fetch\s*\(|XMLHttpRequest|localStorage|https?:\/\//i,
      'Private pilot must not embed remote assets, tracking or client data writes');
  }
  assert.equal(output[STUDENT], renderStudentPilot());
  assert.equal(output[KEY], renderEducatorKey());
  assert.equal(output[OBSERVATION], renderPilotObservation());
});

test('student print booklet contains all 32 questions and 96 options, without answer markings', () => {
  const source = readHeldCandidates();
  const student = output[STUDENT];
  assert.equal(count(student, 'class="question"'), 32);
  assert.equal(count(student, '<li>'), 96);
  assert.doesNotMatch(student, /<strong>Answer:<\/strong>|Strategy hint:|<strong>Explanation:<\/strong>/);
  assert.doesNotMatch(student, /data-(?:correct|answer|score)|aria-correct/);
  for (const family of source) {
    for (const question of family.proposedQuestions) {
      const escaped = value => value.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      assert.ok(student.includes(escaped(question.prompt)));
      for (const choice of question.choices) assert.ok(student.includes('<li>' + escaped(choice) + '</li>'));
    }
  }
});

test('educator-only key preserves all 32 answers, hints and explanations', () => {
  const all = readHeldCandidates().flatMap(family => family.proposedQuestions);
  const key = output[KEY];
  assert.equal(count(key, 'class="answer-row"'), 32);
  all.forEach((question, n) => {
    const answerPosition = 'ABC'[question.choices.indexOf(question.answer)];
    assert.ok(key.includes('Question ' + (n + 1) + ': ' + answerPosition));
    assert.ok(key.includes('<strong>Answer:</strong>'));
  });
  assert.equal(count(key, '<strong>Explanation:</strong>'), 32);
  assert.equal(count(key, '<strong>Strategy hint:</strong>'), 32);
});

test('observations are completely blank, do not impersonate actual learners or educator signoff', () => {
  const observation = output[OBSERVATION];
  assert.equal(count(observation, '<tr>'), 33);
  assert.equal(count(observation, 'class="blank"'), 128);
  assert.doesNotMatch(observation, /name of student|date of birth|email address|learner results collected/i);
  assert.match(observation, /Do not upload personally identifying student data/);
  assert.match(observation, /Do not treat a blank sheet as evidence/);
});

test('all three printables contain the same fingerprint of the exactly held question set', () => {
  const report = auditHeldCurriculumPilot();
  assert.match(report.contentFingerprint, /^[0-9a-f]{64}$/);
  for (const page of Object.values(output)) assert.ok(page.includes(report.contentFingerprint));
  assert.equal(report.realSafeUsageEvidence, 'NOT_PROVIDED');
  assert.equal(report.publication, 'HOLD');
});

test('disabled defaults and missing source evidence reject generation', () => {
  const switched = clone();
  switched[0].enabledByDefault = true;
  assert.throws(() => buildHeldPilotKit(switched), /Invalid or unheld practice set/);
  const badKey = clone();
  badKey[1].proposedQuestions[3].answer = 'not one of the choices';
  assert.throws(() => buildHeldPilotKit(badKey), /Invalid or unheld practice set/);
  const noSource = clone();
  noSource[2].sourceContext.sourceCaptureHash = '';
  assert.throws(() => buildHeldPilotKit(noSource), /Invalid or unheld practice set/);
});

test('any edits to even valid question wording invalidate the committed printable snapshots', () => {
  const revised = clone();
  revised[0].proposedQuestions[0].prompt += ' (new wording)';
  const changedBook = renderStudentPilot(revised);
  assert.notEqual(changedBook, output[STUDENT]);
  assert.equal(revised[0].readiness.status, 'HOLD');
});
