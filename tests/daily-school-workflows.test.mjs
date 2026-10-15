import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const file = name => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
const teacher = file('sync-study-pack.yml');
const homework = file('refresh-current-homework.yml');
const recovery = file('daily-source-recovery.yml');
const pages = file('pages.yml');

test('both school sources have scheduled Eastern daily runs and no teacher/educator approval job', () => {
  assert.match(teacher, /name: Refresh ABVM teacher pages/);
  assert.match(teacher, /cron: '17 6 \* \* \*'/);
  assert.match(teacher, /cron: '47 15 \* \* \*'/);
  assert.match(homework, /name: Refresh current ABVM homework/);
  assert.match(homework, /cron: '23 6,9,12,15-23 \* \* \*'/);
  for (const workflow of [teacher, homework, recovery]) {
    assert.match(workflow,/timezone: 'America\/New_York'/);
    assert.doesNotMatch(workflow,/needs:\s*(?:educator|teacher-approval|manual-approval|parent-signoff)/i);
  }
});

test('optional draft question candidate bookkeeping cannot block verified curriculum publication', () => {
  assert.match(teacher, /name: Open governed curriculum candidate PR when coverage gaps exist\n\s+continue-on-error: true/);
  assert.match(teacher, /trap 'git switch main/);
  assert.match(teacher, /test "\$\(git branch --show-current\)" = main/);
  assert.match(teacher, /node scripts\/assert-safe-teacher-refresh\.mjs --report=/);
  assert.match(teacher, /node scripts\/check-refresh-health\.mjs --require-today/);
  assert.match(teacher, /- name: Validate the candidate app before changing main\n\s+run: npm run qa/);
});

test('bounded no-signoff recovery checks repository and live site, then dispatches only guarded workflows', () => {
  assert.match(recovery, /cron: '11 7,11,16,20,23 \* \* \*'/);
  assert.match(recovery, /node scripts\/source-freshness-recovery\.mjs --report=/);
  assert.match(recovery, /maybe_dispatch sync-study-pack\.yml "\$curriculum"/);
  assert.match(recovery, /maybe_dispatch refresh-current-homework\.yml "\$homework"/);
  assert.match(recovery, /maybe_dispatch pages\.yml "\$deploy"/);
  assert.match(recovery, /count >= 2/);
  assert.match(recovery, /running > 0/);
  assert.match(recovery, /if \[\[ "\$curriculum" == false && "\$homework" == false \]\]/);
  assert.match(pages, /Requested release is not the exact current protected-main commit/);
  assert.match(pages, /Main advanced while QA ran/);
});
