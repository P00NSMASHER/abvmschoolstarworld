import { createHash } from 'node:crypto';

export const RECENT_REVIEW_RETENTION_DAYS = 14;
export const TEACHER_EVENT_HISTORY_DAYS = 45;
const DAY_MS = 86_400_000;
const text = value => String(value ?? '').trim();
const clone = value => JSON.parse(JSON.stringify(value));

function iso(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}
function plusDays(value, days) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? new Date(ms + days * DAY_MS).toISOString() : '';
}
function hash(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function recordsFromCurrent(pipeline) {
  const verifiedAt = iso(pipeline?.generatedAt);
  if (!verifiedAt) return [];
  const expiresAt = plusDays(verifiedAt, RECENT_REVIEW_RETENTION_DAYS);
  const questions = Array.isArray(pipeline?.questions) ? pipeline.questions : [];
  return (pipeline?.skills || []).map(skill => ({
    skill: clone(skill),
    questions: questions.filter(question => question?.skill === skill?.id).map(clone),
    verifiedAt,
    expiresAt,
    sourceHash: text(pipeline?.sourceHash),
  }));
}
function recordsFromReview(review) {
  const questions = Array.isArray(review?.questions) ? review.questions : [];
  return (review?.skills || []).map(skill => ({
    skill: clone(skill),
    questions: questions.filter(question => question?.skill === skill?.id).map(clone),
    verifiedAt: iso(skill?.reviewVerifiedAt),
    expiresAt: iso(skill?.reviewExpiresAt),
    sourceHash: text(skill?.reviewSourceHash),
  })).filter(row => row.verifiedAt && row.expiresAt);
}

export function buildRecentReviewPipeline({
  previousCurrent,
  previousReview,
  current,
  now = new Date().toISOString(),
} = {}) {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('Recent review continuity requires a valid now timestamp.');
  const currentSkillIds = new Set((current?.skills || []).map(skill => text(skill?.id)).filter(Boolean));
  const newestBySkill = new Map();

  for (const row of [...recordsFromReview(previousReview), ...recordsFromCurrent(previousCurrent)]) {
    const id = text(row.skill?.id);
    if (!id || currentSkillIds.has(id) || !row.questions.length) continue;
    const verifiedMs = Date.parse(row.verifiedAt), expiresMs = Date.parse(row.expiresAt);
    if (!Number.isFinite(verifiedMs) || !Number.isFinite(expiresMs) || expiresMs <= nowMs || verifiedMs > nowMs) continue;
    const prior = newestBySkill.get(id);
    if (!prior || Date.parse(prior.verifiedAt) < verifiedMs) newestBySkill.set(id, row);
  }

  const rows = [...newestBySkill.values()]
    .sort((a,b)=>Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt)||text(a.skill.id).localeCompare(text(b.skill.id)))
    .slice(0, 40);

  const skills = rows.map(row => ({
    ...row.skill,
    reviewVerifiedAt: row.verifiedAt,
    reviewExpiresAt: row.expiresAt,
    reviewSourceHash: row.sourceHash,
  }));
  const allowed = new Set(skills.map(skill => skill.id));
  const questions = rows.flatMap(row => row.questions.map(question => ({
    ...question,
    reviewVerifiedAt: row.verifiedAt,
    reviewExpiresAt: row.expiresAt,
    reviewSourceHash: row.sourceHash,
  }))).filter(question => allowed.has(question.skill)).slice(0, 400);
  const withQuestions = new Set(questions.map(question => question.skill));
  const safeSkills = skills.filter(skill => withQuestions.has(skill.id));
  const fingerprint = hash([
    ...safeSkills.map(skill => `${skill.id}|${skill.reviewVerifiedAt}|${skill.reviewSourceHash}`),
    ...questions.map(question => `${question.skill}|${question.variantFingerprint || question.id}`),
  ].sort().join('||') || 'empty-review-bank');

  return {
    schemaVersion: 1,
    retentionDays: RECENT_REVIEW_RETENTION_DAYS,
    generatedAt: new Date(nowMs).toISOString(),
    bankFingerprint: fingerprint,
    skills: safeSkills,
    questions: questions.filter(question => withQuestions.has(question.skill)),
  };
}

export function validateRecentReviewPipeline(review, { current } = {}) {
  const issues = [];
  if (!review || typeof review !== 'object') return ['review-pipeline-missing'];
  if (review.schemaVersion !== 1) issues.push('review-schema-version-invalid');
  if (review.retentionDays !== RECENT_REVIEW_RETENTION_DAYS) issues.push('review-retention-window-invalid');
  if (!text(review.bankFingerprint)) issues.push('review-bank-fingerprint-missing');
  if (!Array.isArray(review.skills)) issues.push('review-skills-missing');
  if (!Array.isArray(review.questions)) issues.push('review-questions-missing');
  const currentIds = new Set((current?.skills || []).map(skill => text(skill?.id)).filter(Boolean));
  const skillIds = new Set();
  for (const skill of review.skills || []) {
    const id=text(skill?.id);
    if(!id) issues.push('review-skill-id-missing');
    if(skillIds.has(id)) issues.push(`review-skill-duplicate:${id}`);
    skillIds.add(id);
    if(currentIds.has(id)) issues.push(`review-skill-still-current:${id}`);
    const verified=Date.parse(skill?.reviewVerifiedAt||''),expires=Date.parse(skill?.reviewExpiresAt||'');
    if(!Number.isFinite(verified)||!Number.isFinite(expires)||expires<=verified) issues.push(`review-skill-window-invalid:${id}`);
    if(!text(skill?.reviewSourceHash)) issues.push(`review-skill-source-missing:${id}`);
  }
  for (const question of review.questions || []) {
    if(!skillIds.has(text(question?.skill))) issues.push(`review-question-skill-missing:${text(question?.id)||'unknown'}`);
    if(!text(question?.reviewVerifiedAt)||!text(question?.reviewExpiresAt)||!text(question?.reviewSourceHash)) issues.push(`review-question-metadata-missing:${text(question?.id)||'unknown'}`);
  }
  return [...new Set(issues)];
}
