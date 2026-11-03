import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/refresh-reviewed-lunch-week.yml', import.meta.url), 'utf8');
const standardQa = readFileSync(new URL('../.github/workflows/qa.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Playwright lunch publication QA prepares checksum-verified jq before full recovery-history tests', () => {
  const setupIndex = workflow.indexOf('- name: Install checksum-verified jq for full app QA');
  const qaIndex = workflow.indexOf('- name: Run complete app release QA for a changed lunch week');
  assert.ok(setupIndex >= 0 && qaIndex > setupIndex, 'jq must be available before npm run qa in the Playwright container');

  const setup = workflow.slice(setupIndex, qaIndex);
  const expectedDigest = '020468de7539ce70ef1bceaf7cde2e8c4f2ca6c3afb84642aabc5c97d9fc2a0d';
  assert.ok(setup.includes('jq-1.8.1/jq-linux-amd64'), 'jq release must be pinned');
  assert.ok(setup.includes(expectedDigest), 'jq must have a known checksum');
  assert.ok(standardQa.includes(expectedDigest), 'lunch and standard QA must trust the same binary digest');
  assert.match(setup, /sha256sum --check/);
  assert.ok(setup.includes('$GITHUB_PATH'), 'jq path must be exported for later steps');
  assert.match(setup, /set -euo pipefail/);
  assert.match(workflow.slice(qaIndex), /npm run qa/);
  assert.ok(packageJson.scripts['qa:unit'].includes('tests/*.test.mjs'));
});
