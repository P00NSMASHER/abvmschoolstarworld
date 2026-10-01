import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  curriculumCandidateIntrinsicBlockers,
  validateCurriculumCandidateManifest,
} from './curriculum-coverage-autopilot.mjs';

const DIR = 'curriculum-candidates';
if (!existsSync(DIR)) {
  console.log('No curriculum candidate manifests present.');
  process.exit(0);
}

const files = readdirSync(DIR).filter(name => name.endsWith('.json')).sort();
const issues = [];
for (const name of files) {
  const path = join(DIR, name);
  let candidate;
  try {
    candidate = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    issues.push(`${name}:invalid-json:${error?.message || error}`);
    continue;
  }
  for (const issue of validateCurriculumCandidateManifest(candidate)) issues.push(`${name}:${issue}`);
  for (const blocker of curriculumCandidateIntrinsicBlockers(candidate)) issues.push(`${name}:promotion-quality:${blocker}`);
}

if (issues.length) {
  throw new Error(`Curriculum candidate validation failed: ${JSON.stringify(issues)}`);
}
console.log(`Validated ${files.length} curriculum candidate manifest(s).`);
