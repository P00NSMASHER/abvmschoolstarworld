import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function unresolvedCurriculumCoverage(plan) {
  const candidates = Array.isArray(plan?.candidates) ? plan.candidates : [];
  const count = plan?.unsupportedCount;

  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Curriculum coverage plan has an invalid unsupportedCount.');
  }
  if (count !== candidates.length) {
    throw new Error(
      `Curriculum coverage plan is inconsistent: unsupportedCount=${count}, candidates=${candidates.length}.`
    );
  }

  return candidates.map(candidate => ({
    subject: String(candidate?.subject || 'Unknown subject'),
    topic: String(candidate?.topic || 'Unknown topic'),
    candidateId: String(candidate?.candidateId || 'unknown-candidate'),
  }));
}

export function assertCurriculumCoverageResolved(
  plan,
  { context = 'Unresolved curriculum coverage' } = {}
) {
  const unresolved = unresolvedCurriculumCoverage(plan);
  if (!unresolved.length) return true;

  const summary = unresolved
    .map(row => `${row.subject}: ${row.topic} (${row.candidateId})`)
    .join('; ');
  throw new Error(`${context}: ${summary}`);
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = argValue('report') || '.curriculum-coverage-plan.json';
  const context = argValue('context') || 'Unresolved curriculum coverage';
  const plan = JSON.parse(readFileSync(report, 'utf8'));

  assertCurriculumCoverageResolved(plan, { context });
  console.log('Curriculum coverage resolved.');
}
