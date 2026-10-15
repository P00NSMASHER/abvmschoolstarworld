import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateCurriculumCoveragePlan} from './curriculum-coverage-autopilot.mjs';
import {unresolvedCurriculumCoverage} from './assert-curriculum-coverage-resolved.mjs';

const requiredPages = ['Home', 'Homework', 'Reading Work', 'Weekly Spelling List', 'Tests', 'Religion'];
const key = row => [row.subject, row.topic].map(value => String(value || '').trim().toLowerCase()).join('|');
const hash = value => /^[a-f0-9]{64}$/i.test(String(value || ''));
function deny(reason) {
  throw new Error('Unsafe teacher refresh: ' + reason);
}

/**
 * Allow independently verified teacher pages to publish even if a novel topic
 * lacks a validated question generator. Fully checked existing families are
 * automatically eligible without any teacher, educator, parent or owner approval.
 * A candidate lacking the automated release evidence stays isolated.
 */
export function assertSafeTeacherRefresh(plan, envelope) {
  const issues = validateCurriculumCoveragePlan(plan);
  if (issues.length) deny('curriculum coverage report invalid: ' + issues.join(', '));
  const gaps = unresolvedCurriculumCoverage(plan);
  const pack = envelope?.pack;
  const pipeline = pack?.contentPipeline;
  const checkedAt = envelope?.sourceLastCheckedAt;
  if (envelope?.delivery !== 'verified' || pack?.sourceSufficient !== true) {
    deny('verified, source-sufficient teacher data required');
  }
  if (!checkedAt || !Number.isFinite(Date.parse(checkedAt)) ||
      pack?.sourceCheckedAt !== checkedAt || pipeline?.generatedAt !== checkedAt) {
    deny('source check timestamps disagree');
  }
  if (!/^teacher-pages-[a-f0-9]{20}$/i.test(String(plan.sourceHash || '')) ||
      plan.sourceHash !== pack.sourceHash || plan.sourceHash !== pipeline?.sourceHash) {
    deny('curriculum report does not match teacher pack source hash');
  }
  const pages = envelope?.sourcePages;
  if (!Array.isArray(pages) || pages.length < requiredPages.length ||
      requiredPages.some(title => !pages.some(page => page?.title === title))) {
    deny('verified teacher page set is incomplete');
  }
  const pagesByUrl = new Map();
  for (const page of pages) {
    if (!/^https:\/\/sites\.google\.com\/view\/abvmgr2\//.test(page?.url || '') ||
        !hash(page?.contentHash) || page?.checkedAt !== checkedAt ||
        pagesByUrl.has(page.url)) {
      deny('teacher page provenance is inconsistent');
    }
    pagesByUrl.set(page.url, page);
  }

  const coverage = pipeline?.coverage;
  const questions = pipeline?.questions;
  const qa = pipeline?.qa;
  if (!Array.isArray(coverage) || !Array.isArray(questions) || !questions.length ||
      qa?.status !== 'pass' || qa.questionCount !== questions.length ||
      qa.unresolvedLineageCount !== 0) {
    deny('question bank or pipeline QA is incomplete');
  }
  const unsupported = coverage.filter(row => row?.status === 'GENERATOR_UNSUPPORTED');
  if (unsupported.length !== gaps.length || qa.unsupportedSkillCount !== gaps.length ||
      new Set(unsupported.map(key)).size !== gaps.length ||
      unsupported.map(key).sort().join('\n') !== gaps.map(key).sort().join('\n')) {
    deny('unsupported teacher topics are not fully accounted for');
  }
  for (const candidate of plan.candidates) {
    // Automatic promotion is the policy, not a bypass: no unsupported question
    // is active without complete family QA and page-exact source lineage.
    if (candidate.enabledByDefault !== false || candidate.readiness?.status !== 'HOLD' ||
        candidate.readiness?.automaticPromotion !== false ||
        candidate.rollout?.automaticPromotion !== true) {
      deny('an unsupported curriculum candidate is active');
    }
  }
  const coveredSkills = new Set(coverage
    .filter(row => row?.status === 'COVERED' || row?.status === 'PARTIALLY_COVERED')
    .map(row => row.skillId).filter(Boolean));
  for (const question of questions) {
    const lineage = question?.sourceLineage;
    const page = pagesByUrl.get(lineage?.sourceUrl);
    if (!coveredSkills.has(question?.skill) || lineage?.quality !== 'page-exact' ||
        !page || lineage.sourceCaptureHash !== page.contentHash ||
        lineage.sourceCheckedAt !== checkedAt ||
        !/^sha256:[a-f0-9]{64}$/i.test(String(lineage.evidenceExcerptHash || ''))) {
      deny('an unverified or untraceable question would be published: ' + String(question?.id || '?'));
    }
  }
  return {unsupportedCount: gaps.length, questionCount: questions.length};
}

function argValue(name) {
  const prefix = '--' + name + '=';
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || '';
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const reportPath = argValue('report') || '.curriculum-coverage-plan.json';
  const envelopePath = argValue('pack') || 'pages/data/study-pack.json';
  const plan = JSON.parse(readFileSync(reportPath, 'utf8'));
  const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'));
  const receipt = assertSafeTeacherRefresh(plan, envelope);
  if (receipt.unsupportedCount) {
    console.warn('Verified teacher data may refresh; ' + receipt.unsupportedCount +
      ' unsupported topic(s) remain isolated from the ' + receipt.questionCount +
      ' source-backed practice questions.');
  } else {
    console.log('Verified teacher refresh safe: all curriculum topics accounted for.');
  }
}
