import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildGrade2ContentPipeline } from './grade2-content-pipeline.mjs';

const GENERIC_TOKENS = new Set(['grammar','reading','comprehension','phonics','word','words','structure','skill','skills','test','focus','and','the','with','from']);

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(value) {
  return normalize(value).replace(/\s+/g, '-').replace(/^-|-$/g, '') || 'unsupported-skill';
}

function sha256(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(token => token.length >= 3 && !GENERIC_TOKENS.has(token));
}

function subjectRow(pack, subject) {
  return (pack?.subjects || []).find(row => normalize(row?.subject) === normalize(subject)) || null;
}

function evidenceLines(pack, subject, topic) {
  const row = subjectRow(pack, subject);
  const lines = [...(row?.topics || []), ...(row?.studyNotes || [])].map(text).filter(Boolean);
  const wanted = tokens(topic);
  return lines
    .map(line => {
      const haystack = new Set(tokens(line));
      const score = wanted.reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0);
      return { line, score };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.line.localeCompare(b.line))
    .slice(0, 5)
    .map(row => row.line);
}

function sourcePriority(subject) {
  if (subject === 'Religion') return ['Religion'];
  if (subject === 'Math') return ['Tests', 'Homework'];
  if (subject === 'Spelling / Handwriting') return ['Weekly Spelling List', 'Tests', 'Reading Work'];
  return ['Tests', 'Reading Work', 'Homework'];
}

function sourcePageRefs(envelope, subject) {
  const priorities = sourcePriority(subject);
  const pages = Array.isArray(envelope?.sourcePages) ? envelope.sourcePages : [];
  return priorities
    .map(title => pages.find(page => text(page?.title) === title))
    .filter(Boolean)
    .map(page => ({
      title: text(page.title),
      url: text(page.url),
      contentHash: text(page.contentHash),
      checkedAt: text(page.checkedAt),
    }));
}

function familySizeFor(subject) {
  return ['Reading / ELA', 'Spelling / Handwriting'].includes(subject) ? 8 : 3;
}

export function buildCoverageCandidatePacket(envelope, { generatedAt } = {}) {
  const pack = envelope?.pack || {};
  const pipeline = pack.contentPipeline?.coverage
    ? pack.contentPipeline
    : buildGrade2ContentPipeline(structuredClone(pack), {
        generatedAt,
        sourceHash: pack.sourceHash,
      });
  const unsupported = (pipeline.coverage || []).filter(row => row?.status === 'GENERATOR_UNSUPPORTED');
  const sourceHash = text(pack.sourceHash || pipeline.sourceHash || 'unknown-source');
  const candidates = unsupported.map(row => {
    const subject = text(row.subject);
    const topic = text(row.topic);
    const candidateId = 'coverage-' + sha256(sourceHash + '|' + subject + '|' + topic).slice(0, 16);
    return {
      candidateId,
      slug: slug(subject + '-' + topic),
      status: 'HOLD',
      featureFlagged: true,
      subject,
      topic,
      sourceHash,
      sourceCapturedAt: text(pack.sourceCapturedAt || envelope?.sourceCapturedAt),
      reason: text(row.reason),
      evidenceLines: evidenceLines(pack, subject, topic),
      sourcePages: sourcePageRefs(envelope, subject),
      generationContract: {
        minimumSemanticVariants: 3,
        preferredSemanticVariants: familySizeFor(subject),
        requiredQuestionTypes: ['direct', 'transfer', 'reasoning'],
        requirePageExactLineage: true,
        requireDistinctContentFingerprints: true,
        requireDistinctVariantFingerprints: true,
        requireComebackSibling: true,
        requireAnswerPositionBalance: true,
        requireNoAnswerLeak: true,
      },
      requiredGates: [
        'source-lineage',
        'alignment',
        'question-spec-validation',
        'semantic-variety',
        'answer-position-balance',
        'rotation-and-privacy-regression',
        'mobile-and-desktop-browser-qa',
        'accessibility',
        'offline-pwa',
        'publication-checker',
        'sufficient-safe-usage-evidence',
        'manual-promotion',
      ],
      promotionPolicy: {
        automaticPromotion: false,
        automaticRuntimeWrite: false,
        automaticDelete: false,
        automaticRewrite: false,
        requiresManualPromotion: true,
      },
      implementationTargets: [
        'scripts/grade2-content-pipeline.mjs',
        'scripts/grade2-content-alignment.mjs',
        'pages/study-games.js',
        'tests/grade2-content-pipeline.test.mjs',
        'tests/content-pipeline.spec.mjs',
      ],
    };
  });
  return {
    schemaVersion: 1,
    generatedAt: generatedAt || new Date().toISOString(),
    sourceHash,
    status: candidates.length ? 'ACTION_REQUIRED' : 'CLEAR',
    unsupportedSkillCount: candidates.length,
    candidates,
  };
}

export function validateCoverageCandidatePacket(packet) {
  const issues = [];
  if (packet?.schemaVersion !== 1) issues.push('schema-version-invalid');
  if (!text(packet?.sourceHash)) issues.push('source-hash-missing');
  if (!Array.isArray(packet?.candidates)) issues.push('candidates-missing');
  if ((packet?.unsupportedSkillCount || 0) !== (packet?.candidates || []).length) issues.push('candidate-count-mismatch');
  const ids = new Set();
  for (const candidate of packet?.candidates || []) {
    if (!/^coverage-[0-9a-f]{16}$/.test(text(candidate.candidateId))) issues.push('candidate-id-invalid');
    if (ids.has(candidate.candidateId)) issues.push('candidate-id-duplicate');
    ids.add(candidate.candidateId);
    if (candidate.status !== 'HOLD') issues.push('candidate-not-held');
    if (candidate.featureFlagged !== true) issues.push('feature-flag-missing');
    if (candidate.promotionPolicy?.automaticPromotion !== false) issues.push('automatic-promotion-enabled');
    if (candidate.promotionPolicy?.automaticRuntimeWrite !== false) issues.push('automatic-runtime-write-enabled');
    if (candidate.promotionPolicy?.requiresManualPromotion !== true) issues.push('manual-promotion-missing');
    if (!text(candidate.subject) || !text(candidate.topic)) issues.push('candidate-source-context-missing');
    if (!Array.isArray(candidate.requiredGates) || !candidate.requiredGates.includes('manual-promotion')) issues.push('promotion-gates-missing');
    if (!Array.isArray(candidate.generationContract?.requiredQuestionTypes)
      || candidate.generationContract.requiredQuestionTypes.join('|') !== 'direct|transfer|reasoning') issues.push('question-types-invalid');
    const serialized = JSON.stringify(candidate);
    for (const forbidden of ['"prompt":','"answer":','"choices":']) {
      if (serialized.includes(forbidden)) issues.push('preauthored-question-content-present');
    }
  }
  return [...new Set(issues)];
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function writeSummary(packet, output) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const rows = packet.candidates.length
    ? packet.candidates.map(candidate => `- **${candidate.subject}** — ${candidate.topic} (`${candidate.candidateId}`)`).join('\n')
    : '- No unsupported Grade 2 instructional skills detected.';
  appendFileSync(file, `## Curriculum coverage autopilot\n\nStatus: **${packet.status}**  \nUnsupported skills: **${packet.unsupportedSkillCount}**  \nArtifact: `${output}`\n\n${rows}\n`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCli) {
  const input = argValue('--input', 'pages/data/study-pack.json');
  const output = argValue('--output', 'artifacts/grade2-coverage-candidates.json');
  const envelope = JSON.parse(readFileSync(input, 'utf8'));
  const packet = buildCoverageCandidatePacket(envelope);
  const issues = validateCoverageCandidatePacket(packet);
  if (issues.length) throw new Error('Coverage candidate packet invalid: ' + JSON.stringify(issues));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(packet, null, 2) + '\n');
  writeSummary(packet, output);
  console.log(JSON.stringify({
    status: packet.status,
    unsupportedSkillCount: packet.unsupportedSkillCount,
    candidateIds: packet.candidates.map(candidate => candidate.candidateId),
    output,
  }));
}
