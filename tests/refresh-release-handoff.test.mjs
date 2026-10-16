import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const refresh = readFileSync(new URL('../.github/workflows/sync-study-pack.yml', import.meta.url), 'utf8');
const release = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('teacher refresh passes the actual new main SHA rather than the stale triggering SHA', () => {
  assert.match(refresh, /published_sha:\s*\$\{\{\s*steps\.confirm-published-sha\.outputs\.sha\s*\}\}/);
  assert.match(refresh, /id: confirm-published-sha/);
  assert.match(refresh, /git fetch --no-tags origin main/);
  assert.match(refresh, /git ls-remote --exit-code origin refs\/heads\/main/);
  assert.match(refresh, /test "\$EXPECTED" = "\$CURRENT"/);
  assert.match(refresh, /needs: \[refresh, reviewed-lunch\]/);
  assert.match(refresh, /needs\.reviewed-lunch\.outputs\.changed == 'true'/);
  assert.match(refresh, /published_sha:\s*\$\{\{\s*steps\.confirm-lunch-published-sha\.outputs\.sha\s*\}\}/);
  assert.match(refresh, /ref:\s*\$\{\{\s*needs\.reviewed-lunch\.outputs\.published_sha \|\| needs\.refresh\.outputs\.published_sha\s*\}\}/);
});

test('Pages still rejects a release SHA that is not the exact current main commit', () => {
  assert.match(release, /current_main=.*git ls-remote/);
  assert.match(release, /candidate=.*REQUESTED_REF/);
  assert.match(release, /candidate".*current_main/);
  assert.match(release, /Main advanced while QA ran/);
});

test('source lanes finish before release: changed lunch publishes independently, no-op lunch cannot bypass teacher QA',()=>{
  assert.match(refresh,/needs: \[refresh, reviewed-lunch\]/);
  assert.match(refresh,/always\(\) && \(needs\.refresh\.result == 'success' \|\| \(needs\.reviewed-lunch\.result == 'success' && needs\.reviewed-lunch\.outputs\.changed == 'true'\)\)/);
  const lunch=refresh.split("\n  reviewed-lunch:\n")[1]||"";
  assert.match(lunch,/outputs:\s*\n\s*published_sha:.*steps\.confirm-lunch-published-sha\.outputs\.sha/);
  assert.match(lunch,/id: confirm-lunch-published-sha/);
  assert.match(lunch,/git ls-remote --exit-code origin refs\/heads\/main/);
  assert.match(lunch,/echo "sha=\$REMOTE_MAIN" >> "\$GITHUB_OUTPUT"/);
  assert.match(refresh,/uses: \.\/\.github\/workflows\/pages\.yml/);
  assert.match(release,/Main advanced while QA ran/);
});
