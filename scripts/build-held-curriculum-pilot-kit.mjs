import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { auditHeldCurriculumPilot, heldCandidateIssues, readHeldCandidates } from './audit-held-curriculum-pilot.mjs';

const OUTPUTS = Object.freeze({
  student: 'curriculum-candidates/pilot-kit/PR270_STUDENT_PRACTICE.html',
  educator: 'curriculum-candidates/pilot-kit/PR270_EDUCATOR_KEY.html',
  observation: 'curriculum-candidates/pilot-kit/PR270_OBSERVATION.html',
});
const ordered = Object.freeze([
  'Ask & answer questions',
  'long i (i_e) and short i',
  'main idea / details',
  "possessives ('s)",
]);
const html = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const css = String.raw`
<style>
@page { size: letter; margin: .68in .65in; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; background: white; font-size: 11pt; line-height: 1.38; margin: 0 auto; max-width: 830px; padding: 24px 28px; }
h1 { font-size: 18pt; margin: 0 0 10px; }
h2 { font-size: 14pt; margin: 18px 0 10px; border-bottom: 1.3px solid #222; padding-bottom: 6px; }
h3 { font-size: 11.5pt; margin: 0 0 7px; }
p { margin: 5px 0 9px; }
.small { font-size: 9pt; }
.banner { border: 2px solid #222; padding: 9px 12px; font-weight: bold; font-size: 9pt; margin: 0 0 14px; }
.meta { font-size: 9pt; margin: 4px 0 12px; overflow-wrap: anywhere; }
.question, .answer-row { page-break-inside: avoid; break-inside: avoid; border-bottom: 1px solid #aaa; padding: 0 0 12px; margin: 0 0 12px; }
.choices { list-style-type: upper-alpha; padding-left: 27px; margin: 7px 0; }
.choices li { margin: 3px 0; }
.answer-row { font-size: 10pt; }
.answer-row p { margin: 4px 0; }
.topic { break-before: page; page-break-before: always; }
.topic.first { break-before: auto; page-break-before: auto; }
.review-line { border-bottom: 1px solid #888; height: 23px; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
td, th { border: 1px solid #555; vertical-align: top; text-align: left; padding: 5px; }
td.blank { height: 32px; }
@media print { body { padding: 0; max-width: none; } a { color: black; } }
</style>
`;

function document(title, body) {
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="referrer" content="no-referrer">\n' +
    '<title>' + html(title) + '</title>\n' + css +
    '</head><body>\n' + body + '\n</body></html>\n';
}
function banner() {
  return '<div class="banner">OFFLINE / EDUCATOR-SUPERVISED DRAFT — NOT PUBLISHED LEARNING MATERIAL — NOT PILOT EVIDENCE</div>';
}
function preflight(candidates) {
  const errors = heldCandidateIssues(candidates);
  if (errors.length) throw new Error('Invalid or unheld practice set: ' + errors.join('; '));
  const result = auditHeldCurriculumPilot(candidates);
  if (result.publication !== 'HOLD' || result.realSafeUsageEvidence !== 'NOT_PROVIDED') {
    throw new Error('Release boundary failed.');
  }
  for (let index = 0; index < candidates.length; index++) {
    if (candidates[index].topic !== ordered[index]) throw new Error('Topic order changed.');
  }
  return result;
}
function intro(title, fingerprint, note) {
  return banner() + '<h1>' + html(title) + '</h1><p>' + html(note) + '</p>' +
    '<p class="meta">Question-set SHA-256 fingerprint: <code>' + fingerprint + '</code><br>32 questions / four teacher-listed skills. Version-specific draft, not approval or learner results.</p>';
}
export function renderStudentPilot(candidates = readHeldCandidates()) {
  const state = preflight(candidates);
  let out = intro('Grade 2 Reading / ELA — Practice Booklet', state.contentFingerprint,
    'Read each passage and circle A, B, or C. Your teacher or adult may read the directions aloud. Do not write your name or identifying information.');
  let count = 0;
  for (const [familyIndex, family] of candidates.entries()) {
    out += '<section class="topic ' + (familyIndex === 0 ? 'first' : '') + '"><h2>' + html(family.topic) + '</h2>';
    for (const item of family.proposedQuestions) {
      count++;
      out += '<div class="question"><h3>Question ' + count + '</h3><p>' + html(item.prompt) + '</p>' +
        '<ol class="choices">' + item.choices.map(choice => '<li>' + html(choice) + '</li>').join('') + '</ol></div>';
    }
    out += '</section>';
  }
  if (count !== 32) throw new Error('Unexpected question count');
  return document('PR270 Grade 2 student practice — draft only', out);
}
export function renderEducatorKey(candidates = readHeldCandidates()) {
  const state = preflight(candidates);
  let out = intro('PR270 — Separate Educator Answer Key', state.contentFingerprint,
    'Keep this separate from the learner copy. Source-grounded original practice; not a record of real student results.');
  let n = 0;
  for (const [familyIndex, family] of candidates.entries()) {
    out += '<section class="topic ' + (familyIndex === 0 ? 'first' : '') + '"><h2>' + html(family.topic) + '</h2>';
    for (const item of family.proposedQuestions) {
      n++;
      const index = item.choices.indexOf(item.answer);
      if (index < 0) throw new Error('Answer not in choices');
      out += '<div class="answer-row"><h3>Question ' + n + ': ' + 'ABC'[index] + '</h3>' +
        '<p><strong>Answer:</strong> ' + html(item.answer) + '</p>' +
        '<p><strong>Explanation:</strong> ' + html(item.explanation) + '</p>' +
        '<p><strong>Strategy hint:</strong> ' + html(item.hint) + '</p>' +
        '<p class="small">Proposed task: ' + html(item.questionType) + '; DOK ' + item.dok + '; relative difficulty ' + item.difficulty + '</p></div>';
    }
    out += '</section>';
  }
  if (n !== 32) throw new Error('Unexpected answer count');
  return document('PR270 educator key — draft only', out);
}
export function renderPilotObservation(candidates = readHeldCandidates()) {
  const state = preflight(candidates);
  let out = intro('Educator Observation Sheet — Blank', state.contentFingerprint,
    'The private supervisor may observe and evaluate. No student names, individual scores, photos, or identifiable records belong in this public file. Do not treat a blank sheet as evidence.');
  out += '<p><strong>Private pilot authorization, privacy measures, and actual results:</strong> Must be recorded outside the public repository; not supplied here.</p>';
  out += '<table><thead><tr><th>Question</th><th>Clear wording?</th><th>Grade 2 appropriate?</th><th>Hint accurate?</th><th>Revision needed?</th></tr></thead><tbody>';
  let n=0;
  for (const family of candidates) {
    for (const item of family.proposedQuestions) {
      n++;
      out += '<tr><td>' + n + '<br>' + html(family.topic) + '</td><td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>';
    }
  }
  out += '</tbody></table><p class="small">All 32 reviews start blank. No score, attestation, evidence ID, student response, or release authorization has been entered.</p>';
  out += '<h2>Human review decision (leave unfilled in repository)</h2><p>Approved / Revise / Reject: ______ &nbsp; Observations retained privately: ______</p>';
  out += '<p>Do not upload personally identifying student data or private evaluator records. Follow the separate PILOT_PROTOCOL_PR270.md for legitimate supervised safe-usage evidence and the manual release boundary.</p>';
  if (n!==32) throw new Error('Missing observation rows');
  return document('PR270 educator observation — blank only',out);
}
export function buildHeldPilotKit(candidates = readHeldCandidates()) {
  return Object.freeze({
    [OUTPUTS.student]: renderStudentPilot(candidates),
    [OUTPUTS.educator]: renderEducatorKey(candidates),
    [OUTPUTS.observation]: renderPilotObservation(candidates),
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [path, content] of Object.entries(buildHeldPilotKit())) {
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,content,'utf8');
    console.log('Wrote educator-only draft asset: '+path);
  }
}
