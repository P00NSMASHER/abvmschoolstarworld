import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/refresh-health.yml',import.meta.url),'utf8');
test('source watchdog has independent hourly school-hour heartbeat and bounded recovery',()=>{
  assert.ok(workflow.includes("- cron: '43 6-23 * * *'\n      timezone: 'America/New_York'"),'hourly Eastern schedule must be present');
  assert.ok(workflow.includes('workflow_run:'),'watchdog must retain completion triggers');
  assert.ok(workflow.includes('Refresh current ABVM homework'));
  assert.ok(workflow.includes('scripts/check-refresh-health.mjs --max-age-hours 16 --live-url'));
  const recovery=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  assert.ok(recovery.includes('Monitor ABVM refresh health'));
  assert.ok(recovery.includes('maybe_dispatch sync-study-pack.yml'));
  assert.ok(recovery.includes('maybe_dispatch refresh-current-homework.yml'));
  assert.ok(recovery.includes('attempts >= 6'),'source recovery must retain dispatch caps');
});
