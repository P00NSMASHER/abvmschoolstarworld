import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchCurriculumFamily } from './curriculum-family-registry.mjs';

const REQUIRED_TYPES = Object.freeze(['direct', 'transfer', 'reasoning']);
const DEFAULT_MIN_VARIANTS = 8;

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalize = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = value => normalize(value).replace(/\s+/g, '-').replace(/^-|-$/g, '') || 'skill';
const sha256 = value => createHash('sha256').update(String(value ?? '')).digest('hex');

function tokens(value) {
  return new Set(normalize(value).split(' ').filter(token => token.length >= 3));
}

function overlapScore(a, b) {
  const aa = tokens(a), bb = tokens(b);
  let score = 0;
  for (const token of aa) if (bb.has(token)) score += 1;
  return score;
}

function sourceTopicMatch(topic, line) {
  const topicNormalized = normalize(topic);
  const lineNormalized = normalize(line);
  if (!topicNormalized || !lineNormalized) return null;
  if (lineNormalized.includes(topicNormalized)) {
    return { method: 'exact-topic-phrase', score: 100 + overlapScore(topic, line) };
  }
  const topicTerms = topicNormalized.split(' ').filter(Boolean);
  const meaningfulTerms = topicTerms.filter(term => term.length >= 3);
  const requiredTerms = meaningfulTerms.length ? meaningfulTerms : topicTerms;
  const lineTerms = new Set(lineNormalized.split(' ').filter(Boolean));
  if (requiredTerms.length && requiredTerms.every(term => lineTerms.has(term))) {
    return { method: 'all-topic-tokens', score: 50 + overlapScore(topic, line) };
  }
  return null;
}

export function sourceContextForGap(gap, sourcePages = []) {
  const topic = text(gap?.topic);
  const subject = text(gap?.subject);
  const candidates = [];
  for (const page of Array.isArray(sourcePages) ? sourcePages : []) {
    for (const line of Array.isArray(page?.lines) ? page.lines : []) {
      const clean = text(line);
      if (!clean) continue;
      const match = sourceTopicMatch(topic, clean);
      if (!match) continue;
      candidates.push({ score: match.score, matchMethod: match.method, page, line: clean });
    }
  }
  candidates.sort((a, b) =>
    b.score - a.score ||
    text(a.page?.title).localeCompare(text(b.page?.title)) ||
    a.line.localeCompare(b.line)
  );
  const best = candidates[0];
  if (!best) {
    return {
      quality: 'unresolved',
      matchMethod: 'none',
      subject,
      topic,
      evidenceExcerptHash: `sha256:${sha256(topic)}`,
    };
  }
  return {
    quality: 'page-exact',
    matchMethod: best.matchMethod,
    subject,
    topic,
    sourceTitle: text(best.page?.title),
    sourceUrl: text(best.page?.url),
    sourceCaptureHash: text(best.page?.contentHash),
    sourceCheckedAt: text(best.page?.checkedAt),
    sourceLine: best.line,
    evidenceExcerptHash: `sha256:${sha256(best.line)}`,
  };
}

function familyQuestions(family) {
  if (!family) return [];
  return [family.baseQuestion, ...(family.supplementalQuestions || [])].map((question, index) => ({
    candidateIndex: index + 1,
    questionType: text(question?.questionType || 'direct'),
    prompt: text(question?.prompt),
    choices: Array.isArray(question?.choices) ? question.choices.map(text) : [],
    answer: text(question?.answer),
    explanation: text(question?.explanation),
    hint: text(question?.hint),
    dok: Number(question?.dok) || 0,
    difficulty: Number(question?.difficulty) || 0,
  }));
}

function questionDraftIssues(question) {
  const issues = [];
  if (!question?.prompt || question.prompt.length < 20) issues.push('prompt-too-short');
  if (!Array.isArray(question?.choices) || question.choices.length !== 3) issues.push('choices-not-three');
  if (new Set((question?.choices || []).map(normalize)).size !== 3) issues.push('choices-duplicate');
  if (!(question?.choices || []).includes(question?.answer)) issues.push('answer-not-in-choices');
  if (!question?.explanation) issues.push('explanation-missing');
  if (!question?.hint) issues.push('hint-missing');
  if (!REQUIRED_TYPES.includes(question?.questionType)) issues.push('question-type-invalid');
  if (!Number.isInteger(question?.dok) || question.dok < 1 || question.dok > 3) issues.push('dok-invalid');
  if (!Number.isInteger(question?.difficulty) || question.difficulty < 1 || question.difficulty > 3) issues.push('difficulty-invalid');
  if (normalize(question?.answer).length >= 4 && normalize(question?.hint).includes(normalize(question?.answer))) issues.push('hint-leaks-answer');
  return [...new Set(issues)];
}

export function evaluateCurriculumCandidate(candidate, {
  automatedQaPassed = false,
  safeUsageEvidence = 'insufficient-evidence',
  manualApproval = false,
} = {}) {
  const blockers = [];
  const questions = Array.isArray(candidate?.proposedQuestions) ? candidate.proposedQuestions : [];
  const requiredTypes = Array.isArray(candidate?.requiredQuestionTypes) && candidate.requiredQuestionTypes.length
    ? candidate.requiredQuestionTypes
    : REQUIRED_TYPES;
  const minVariants = Math.max(1, Number(candidate?.minimumSemanticVariants) || DEFAULT_MIN_VARIANTS);
  const types = new Set(questions.map(row => text(row?.questionType)));
  const invalidQuestions = questions.flatMap((question, index) =>
    questionDraftIssues(question).map(issue => `question-${index + 1}:${issue}`)
  );

  if (candidate?.sourceContext?.quality !== 'page-exact') blockers.push('page-exact-source-context-required');
  if (questions.length < minVariants) blockers.push(`minimum-semantic-variants:${questions.length}/${minVariants}`);
  for (const type of requiredTypes) if (!types.has(type)) blockers.push(`question-type-required:${type}`);
  if (invalidQuestions.length) blockers.push(...invalidQuestions);
  if (!automatedQaPassed) blockers.push('automated-qa-required');
  if (safeUsageEvidence !== 'sufficient-safe-usage') blockers.push('safe-usage-evidence-required');
  if (!manualApproval) blockers.push('manual-promotion-required');

  return Object.freeze({
    status: blockers.length ? 'HOLD' : 'READY_FOR_MANUAL_PROMOTION',
    blockers: Object.freeze(blockers),
    automaticPromotion: false,
    automaticDelete: false,
    automaticRewrite: false,
  });
}

export function curriculumCandidateIntrinsicBlockers(candidate) {
  return [...evaluateCurriculumCandidate(candidate, {
    automatedQaPassed: true,
    safeUsageEvidence: 'sufficient-safe-usage',
    manualApproval: true,
  }).blockers];
}

function curriculumCandidateSetKey(candidates = []) {
  const evidenceRows = (Array.isArray(candidates) ? candidates : [])
    .map(candidate => [
      text(candidate?.candidateId),
      text(candidate?.sourceContext?.quality),
      text(candidate?.sourceContext?.evidenceExcerptHash),
    ].join('|'))
    .sort();
  return evidenceRows.length
    ? `gaps-${sha256(evidenceRows.join('\n')).slice(0, 24)}`
    : 'no-gaps';
}
export function buildCurriculumCoveragePlan({
  pipeline,
  sourcePages = [],
  sourceHash = '',
  generatedAt = new Date().toISOString(),
} = {}) {
  const unsupported = (pipeline?.coverage || []).filter(row => row?.status === 'GENERATOR_UNSUPPORTED');
  const candidates = unsupported.map(gap => {
    const registered = matchCurriculumFamily(gap.subject, gap.topic);
    const proposedQuestions = familyQuestions(registered);
    const candidate = {
      candidateId: `curriculum-${slug(gap.subject)}-${slug(gap.topic)}-${sha256(`${gap.subject}|${gap.topic}`).slice(0, 10)}`,
      familyId: registered?.id || slug(gap.topic),
      subject: text(gap.subject),
      topic: text(gap.topic),
      sourceHash: text(sourceHash || pipeline?.sourceHash),
      generatedAt,
      sourceContext: sourceContextForGap(gap, sourcePages),
      featureFlag: registered?.featureFlag || `curriculum-family:${slug(gap.topic)}-candidate`,
      enabledByDefault: false,
      registryMatch: registered ? {
        id: registered.id,
        rolloutStatus: registered.rolloutStatus,
        standards: registered.standards,
        domain: registered.domain,
      } : null,
      minimumSemanticVariants: registered?.minimumSemanticVariants || DEFAULT_MIN_VARIANTS,
      requiredQuestionTypes: registered?.requiredQuestionTypes || [...REQUIRED_TYPES],
      proposedQuestions,
      authoring: {
        status: proposedQuestions.length ? 'DRAFT_FAMILY_PRESENT' : 'AUTHORING_REQUIRED',
        generatedQuestionCount: proposedQuestions.length,
        minimumSemanticVariants: registered?.minimumSemanticVariants || DEFAULT_MIN_VARIANTS,
        requiredQuestionTypes: registered?.requiredQuestionTypes || [...REQUIRED_TYPES],
        requiredQuestionFields: ['questionType', 'prompt', 'choices', 'answer', 'explanation', 'hint', 'dok', 'difficulty'],
      },
      rollout: {
        featureFlagRequired: true,
        automatedQaRequired: true,
        safeUsageEvidenceRequired: true,
        manualPromotionRequired: true,
        automaticPromotion: false,
      },
    };
    return {
      ...candidate,
      readiness: evaluateCurriculumCandidate(candidate),
    };
  });

  return {
    schemaVersion: 1,
    generatedAt,
    sourceHash: text(sourceHash || pipeline?.sourceHash),
    candidateSetKey: curriculumCandidateSetKey(candidates),
    unsupportedCount: unsupported.length,
    status: unsupported.length ? 'CANDIDATES_REQUIRED' : 'NO_GAPS',
    candidates,
  };
}

export function validateCurriculumCandidateManifest(candidate) {
  const issues = [];
  const id = text(candidate?.candidateId) || 'candidate';
  if (!text(candidate?.candidateId)) issues.push('candidate-id-missing');
  if (!text(candidate?.familyId)) issues.push(`${id}:family-id-missing`);
  if (!text(candidate?.subject)) issues.push(`${id}:subject-missing`);
  if (!text(candidate?.topic)) issues.push(`${id}:topic-missing`);
  if (!text(candidate?.featureFlag)) issues.push(`${id}:feature-flag-missing`);
  if (!['AUTHORING_REQUIRED', 'DRAFT_FAMILY_PRESENT'].includes(candidate?.authoring?.status)) issues.push(`${id}:authoring-status-invalid`);
  const questionCount = Array.isArray(candidate?.proposedQuestions) ? candidate.proposedQuestions.length : 0;
  if (!Number.isInteger(candidate?.authoring?.generatedQuestionCount) || candidate.authoring.generatedQuestionCount < 0) issues.push(`${id}:authoring-question-count-invalid`);
  else if (candidate.authoring.generatedQuestionCount !== questionCount) issues.push(`${id}:authoring-question-count-mismatch`);
  if (candidate?.authoring?.status === 'AUTHORING_REQUIRED' && questionCount !== 0) issues.push(`${id}:authoring-status-count-mismatch`);
  if (candidate?.authoring?.status === 'DRAFT_FAMILY_PRESENT' && questionCount === 0) issues.push(`${id}:authoring-status-count-mismatch`);
  if (Number(candidate?.authoring?.minimumSemanticVariants) !== Number(candidate?.minimumSemanticVariants)) issues.push(`${id}:authoring-minimum-mismatch`);
  if (JSON.stringify(candidate?.authoring?.requiredQuestionTypes || []) !== JSON.stringify(candidate?.requiredQuestionTypes || [])) issues.push(`${id}:authoring-types-mismatch`);
  if (!Array.isArray(candidate?.authoring?.requiredQuestionFields) || candidate.authoring.requiredQuestionFields.length < 8) issues.push(`${id}:authoring-contract-incomplete`);
  if (candidate?.enabledByDefault !== false) issues.push(`${id}:candidate-must-start-disabled`);
  if (candidate?.rollout?.featureFlagRequired !== true) issues.push(`${id}:feature-flag-gate-required`);
  if (candidate?.rollout?.automatedQaRequired !== true) issues.push(`${id}:automated-qa-gate-required`);
  if (candidate?.rollout?.safeUsageEvidenceRequired !== true) issues.push(`${id}:safe-usage-gate-required`);
  if (candidate?.rollout?.manualPromotionRequired !== true) issues.push(`${id}:manual-promotion-gate-required`);
  if (candidate?.rollout?.automaticPromotion !== false) issues.push(`${id}:automatic-promotion-must-stay-disabled`);
  if (!['page-exact', 'unresolved'].includes(candidate?.sourceContext?.quality)) issues.push(`${id}:source-context-quality-invalid`);
  if (candidate?.sourceContext?.quality === 'page-exact') {
    if (!['exact-topic-phrase', 'all-topic-tokens'].includes(candidate.sourceContext.matchMethod)) issues.push(`${id}:source-match-method-invalid`);
    if (!text(candidate.sourceContext.sourceTitle)) issues.push(`${id}:source-title-missing`);
    if (!text(candidate.sourceContext.sourceUrl)) issues.push(`${id}:source-url-missing`);
    if (!text(candidate.sourceContext.sourceCaptureHash)) issues.push(`${id}:source-capture-hash-missing`);
    if (!text(candidate.sourceContext.sourceLine)) issues.push(`${id}:source-line-missing`);
    if (!text(candidate.sourceContext.evidenceExcerptHash)) issues.push(`${id}:evidence-excerpt-hash-missing`);
  }
  if (!candidate?.readiness || candidate.readiness.status !== 'HOLD') issues.push(`${id}:draft-readiness-must-hold`);
  if (candidate?.readiness?.automaticPromotion !== false) issues.push(`${id}:readiness-auto-promotion-must-stay-disabled`);
  return [...new Set(issues)];
}

export function validateCurriculumCoveragePlan(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') return ['plan-missing'];
  if (plan.schemaVersion !== 1) issues.push('schema-version-invalid');
  if (!Array.isArray(plan.candidates)) issues.push('candidates-missing');
  for (const candidate of plan.candidates || []) {
    issues.push(...validateCurriculumCandidateManifest(candidate));
  }
  const expectedCandidateSetKey = curriculumCandidateSetKey(plan.candidates || []);
  if (text(plan.candidateSetKey) !== expectedCandidateSetKey) issues.push('candidate-set-key-mismatch');
  if ((plan.unsupportedCount || 0) !== (plan.candidates || []).length) issues.push('unsupported-count-mismatch');
  return [...new Set(issues)];
}

export function writeCurriculumCoveragePlan(plan, outputPath) {
  const issues = validateCurriculumCoveragePlan(plan);
  if (issues.length) throw new Error(`Curriculum coverage plan invalid: ${JSON.stringify(issues)}`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return outputPath;
}

export function materializeCurriculumCandidates(plan, outputDir) {
  const issues = validateCurriculumCoveragePlan(plan);
  if (issues.length) throw new Error(`Curriculum coverage plan invalid: ${JSON.stringify(issues)}`);
  mkdirSync(outputDir, { recursive: true });
  const paths = [];
  for (const candidate of plan.candidates || []) {
    const path = join(outputDir, `${candidate.candidateId}.json`);
    writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
    paths.push(path);
  }
  return paths;
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const reportPath = argValue('report');
  const candidateDir = argValue('candidate-dir');
  if (!reportPath) {
    throw new Error('Use --report=<coverage-plan.json> for CLI materialization.');
  }
  const plan = JSON.parse(readFileSync(reportPath, 'utf8'));
  const issues = validateCurriculumCoveragePlan(plan);
  if (issues.length) throw new Error(`Curriculum coverage plan invalid: ${JSON.stringify(issues)}`);
  if (candidateDir) {
    const paths = materializeCurriculumCandidates(plan, candidateDir);
    console.log(JSON.stringify({ status: plan.status, unsupportedCount: plan.unsupportedCount, paths }, null, 2));
  } else {
    console.log(JSON.stringify(plan, null, 2));
  }
}
