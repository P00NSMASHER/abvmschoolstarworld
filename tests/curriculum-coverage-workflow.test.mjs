import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('teacher refresh opens only draft curriculum candidates and blocks publication on unresolved coverage', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  assert.match(workflow, /--autopilot-report=\.curriculum-coverage-plan\.json/);
  assert.match(workflow, /gh pr create --draft/);
  assert.match(workflow, /curriculum-candidate-\$\{SAFE_KEY\}/);
  assert.match(workflow, /Block publication while curriculum candidates are unresolved/);
  assert.match(workflow, /process\.exit\(1\)/);
  assert.doesNotMatch(workflow, /gh pr merge|--auto-merge|enable-auto-merge/i);
});

test('candidate-only pull requests still receive the full QA workflow', () => {
  const qa = readFileSync('.github/workflows/qa.yml', 'utf8');
  assert.match(qa, /curriculum-candidates\/\*\*/);
});

test('static QA validates candidate manifests before browser testing', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['qa:static'], /validate-curriculum-candidates\.mjs/);
});

test('teacher refresh reruns when its browser-QA contract changes', () => {
  const workflow = readFileSync('.github/workflows/sync-study-pack.yml', 'utf8');
  for (const path of [
    'tests/calendar-edge.spec.mjs',
    'tests/content-pipeline.spec.mjs',
    'tests/gold-standard.spec.mjs',
    'tests/recovered-learning-loop.spec.mjs',
    'tests/study-games-rich-content.spec.mjs',
  ]) {
    assert.ok(workflow.includes(path), `Missing refresh trigger for ${path}`);
  }
});
