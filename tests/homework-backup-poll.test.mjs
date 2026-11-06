import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n');
const workflow=read('.github/workflows/backup-homework-poll.yml');
const primary=read('.github/workflows/refresh-current-homework.yml');
const recovery=read('.github/workflows/daily-source-recovery.yml');
const dashboard=read('.github/workflows/health-dashboard.yml');
const script=read('scripts/refresh-current-homework.mjs');

test('backup poll is scheduled between primary polls and has no write permission',()=>{
  assert.match(primary,/cron: '7,37 6-23 \* \* \*'/);
  assert.match(workflow,/cron: '19,49 6-23 \* \* \*'/);
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
