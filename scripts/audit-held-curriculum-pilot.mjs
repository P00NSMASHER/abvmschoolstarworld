import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
export const EXPECTED_HELD_CANDIDATES = Object.freeze([
  ['curriculum-reading-ela-ask-answer-questions-b08b218ff1.json', 'Ask & answer questions'],
  ['curriculum-reading-ela-long-i-i-e-and-short-i-08bac3c7d8.json', 'long i (i_e) and short i'],
  ['curriculum-reading-ela-main-idea-details-0a409e562c.json', 'main idea / details'],
  ["curriculum-reading-ela-possessives-s-de6f518f2a.json", "possessives ('s)"],
]);

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function readHeldCandidates(root = ROOT) {
  return EXPECTED_HELD_CANDIDATES.map(([file]) => JSON.parse(
    readFileSync(new URL('curriculum-candidates/' + file, root), 'utf8')
  ));
}

export function heldCandidateIssues(candidates) {
  const issues = [];
  if (!Array.isArray(candidates) || candidates.length !== EXPECTED_HELD_CANDIDATES.length) {
    return ['expected-exactly-four-held-families'];
  }
  const allPrompts = new Set();
  const allIds = new Set();
  candidates.forEach((candidate, familyIndex) => {
    const [filename, expectedTopic] = EXPECTED_HELD_CANDIDATES[familyIndex];
    const id = String(candidate?.candidateId || '');
    const family = expectedTopic;
    if (id !== filename.replace(/\.json$/, '')) issues.push(family + ':candidate-identity');
    if (candidate?.topic !== expectedTopic || candidate?.subject !== 'Reading / ELA') issues.push(family + ':topic-identity');
    if (allIds.has(id)) issues.push(family + ':duplicate-identity');
    allIds.add(id);
    if (!candidate?.sourceHash || candidate?.sourceContext?.quality !== 'page-exact' ||
        !candidate?.sourceContext?.sourceCaptureHash || !candidate?.sourceContext?.sourceUrl ||
        !candidate?.sourceContext?.sourceLine || !candidate?.sourceContext?.evidenceExcerptHash) {
      issues.push(family + ':source-lineage');
    }
    if (candidate?.readiness?.status !== 'HOLD' ||
        candidate?.enabledByDefault !== false ||
        candidate?.readiness?.automaticPromotion !== false ||
        candidate?.rollout?.automaticPromotion !== true ||
        candidate?.rollout?.manualPromotionRequired !== false ||
        candidate?.rollout?.safeUsageEvidenceRequired !== false ||
        candidate?.rollout?.automatedQaRequired !== true ||
        candidate?.rollout?.featureFlagRequired !== false) {
      issues.push(family + ':release-hold');
    }
    if (!Array.isArray(candidate?.proposedQuestions) || candidate.proposedQuestions.length !== 8 ||
        candidate?.authoring?.generatedQuestionCount !== 8) {
      issues.push(family + ':question-count');
      return;
    }
    const typeCount = { direct: 0, transfer: 0, reasoning: 0 };
    candidate.proposedQuestions.forEach((question, index) => {
      const label = family + ':q' + (index + 1);
      if (question?.candidateIndex !== index + 1) issues.push(label + ':index');
      if (!(question?.questionType in typeCount)) issues.push(label + ':type');
      else typeCount[question.questionType] += 1;
      if (!question?.prompt || !question?.explanation || !question?.hint ||
          !Array.isArray(question?.choices) || question.choices.length !== 3) {
        issues.push(label + ':incomplete');
        return;
      }
      const prompt = normalize(question.prompt);
      if (allPrompts.has(prompt)) issues.push(label + ':repeated-prompt');
      allPrompts.add(prompt);
      const choices = question.choices.map(normalize);
      if (new Set(choices).size !== 3 || !choices.every(Boolean)) issues.push(label + ':duplicate-choices');
      if (question.choices.filter(choice => choice === question.answer).length !== 1) {
        issues.push(label + ':invalid-answer-key');
      }
      if (normalize(question.answer).length >= 4 && normalize(question.hint).includes(normalize(question.answer))) {
        issues.push(label + ':answer-leaking-hint');
      }
      if (!Number.isInteger(question.dok) || !Number.isInteger(question.difficulty) ||
          question.dok < 1 || question.dok > 2 || question.difficulty < 2 || question.difficulty > 3) {
        issues.push(label + ':assessment-metadata');
      }
    });
    if (typeCount.direct !== 2 || typeCount.transfer !== 3 || typeCount.reasoning !== 3) {
      issues.push(family + ':question-types');
    }
  });
  return issues;
}

export function scoreSyntheticChoice(question, choice) {
  if (!question?.choices?.includes(choice)) throw new Error('Synthetic choice is not in the item.');
  return choice === question.answer;
}

export function auditHeldCurriculumPilot(candidates = readHeldCandidates()) {
  const issues = heldCandidateIssues(candidates);
  if (issues.length) throw new Error('Held curriculum pilot preflight failed: ' + issues.join('; '));
  let trials = 0, correct = 0, wrong = 0, hints = 0;
  for (const family of candidates) {
    for (const question of family.proposedQuestions) {
      for (const choice of question.choices) {
        trials += 1;
        if (scoreSyntheticChoice(question, choice)) correct += 1;
        else wrong += 1;
      }
      if (typeof question.hint !== 'string' || !question.hint.trim()) {
        throw new Error('Missing hint during synthetic exercise.');
      }
      hints += 1;
    }
  }
  if (trials !== 96 || correct !== 32 || wrong !== 64 || hints !== 32) {
    throw new Error('Synthetic exercise coverage drift.');
  }
  const canonical = candidates.map(candidate => ({
    candidateId: candidate.candidateId,
    sourceHash: candidate.sourceHash,
    sourceCaptureHash: candidate.sourceContext.sourceCaptureHash,
    proposedQuestions: candidate.proposedQuestions,
  }));
  const contentFingerprint = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return Object.freeze({
    schemaVersion: 1,
    contentFingerprint,
    candidateFamilies: 4,
    questions: 32,
    syntheticChoiceTrials: trials,
    syntheticCorrectCases: correct,
    syntheticIncorrectCases: wrong,
    syntheticHintsInspected: hints,
    evidenceClass: 'SYNTHETIC_TEST_ONLY',
    learnerResultsCollected: false,
    realSafeUsageEvidence: 'NOT_PROVIDED',
    independentEducatorDocumentation: 'NOT_VERIFIED_BY_THIS_TEST',
    productionRegistryIntegration: 'NOT_AUTHORIZED_BY_THIS_TEST',
    exactHeadActionResult: 'VERIFY_IN_GITHUB_ACTIONS',
    publication: 'HOLD',
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(auditHeldCurriculumPilot(), null, 2));
}
