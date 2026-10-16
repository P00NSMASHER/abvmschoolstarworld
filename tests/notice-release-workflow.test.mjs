import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/sync-uploaded-notices.yml', import.meta.url),
  'utf8',
);

test('notice integration publishes the exact commit it actually reconciled', () => {
  assert.match(workflow, /outputs:\s*\n\s+release_sha: \$\{\{ steps\.integrate\.outputs\.release_sha \}\}/);
  assert.match(workflow, /id: integrate/);

  const emittedShaCount = workflow.match(
    /echo "release_sha=\$\(git rev-parse HEAD\)" >> "\$GITHUB_OUTPUT"/g,
  )?.length ?? 0;
  assert.equal(emittedShaCount, 2, 'both no-op and pushed integrations must emit the exact SHA');

  const deploySection = workflow.slice(workflow.indexOf('\n  deploy:'));
  assert.match(deploySection, /needs: integrate/);
  assert.match(
    deploySection,
    /ref: \$\{\{ needs\.integrate\.outputs\.release_sha \}\}/,
  );
  assert.doesNotMatch(deploySection, /\n\s+ref: main\s*$/m);
});
