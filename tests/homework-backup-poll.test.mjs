import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n');
const workflow=read('.github/workflows/backup-homework-poll.yml');
const primary=read('.github/workflows/refresh-current-homework.yml');
const recovery=read('.github/workflows/daily-source-recovery.yml');
const dashboard=read('.github/workflows/health-dashboard.yml');
const script=read('scripts/refresh-current-homework.mjs');

test('backup poll remains an on-demand read-only diagnostic',()=>{
  assert.match(primary,/cron: '15 6,18 \* \* \*'/);
  assert.doesNotMatch(workflow,/\bschedule:/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.doesNotMatch(workflow,/contents: write|pages: write|id-token: write/);
});

test('backup poll performs a real read-only source check and fails closed on change',()=>{
  assert.match(workflow,/refresh-current-homework\.mjs --dry-run --fail-on-change/);
  assert.match(script,/process\.argv\.includes\('--fail-on-change'\)&&contentChanged/);
  assert.match(script,/process\.exit\(2\)/);
});

test('backup completion wakes bounded recovery and the operational dashboard',()=>{
  for(const source of [recovery,dashboard]){
    assert.match(source,/Verify ABVM Homework backup poll/);
  }
  assert.match(recovery,/maybe_dispatch refresh-current-homework\.yml "\$homework"/);
});
