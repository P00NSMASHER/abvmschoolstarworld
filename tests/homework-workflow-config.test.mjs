import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/refresh-current-homework.yml',import.meta.url),'utf8');

test('independent Homework updates publish through verified Pages without relying on bot-push triggers',()=>{
  assert.match(workflow,/^\s*schedule:\s*$/m);
  assert.match(workflow,/^\s*contents:\s*write\s*$/m);
  assert.match(workflow,/^\s*pages:\s*write\s*$/m);
  assert.match(workflow,/^\s*id-token:\s*write\s*$/m);
  assert.match(workflow,/^\s*id:\s*publish\s*$/m);
  assert.match(workflow,/echo "published=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow,/echo "release_sha=\$\(git rev-parse HEAD\)" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow,/^\s*deploy:\s*$/m);
  assert.match(workflow,/if: needs\.homework\.outputs\.published == 'true'/);
  assert.match(workflow,/uses: \.\/\.github\/workflows\/pages\.yml/);
  assert.match(workflow,/ref: \$\{\{ needs\.homework\.outputs\.release_sha \}\}/);
});
