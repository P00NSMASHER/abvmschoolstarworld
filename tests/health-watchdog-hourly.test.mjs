import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/refresh-health.yml',import.meta.url),'utf8');
const recovery=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');

test('source watchdog has independent hourly heartbeat without losing existing checks',()=>{
  assert.ok(workflow.includes("cron: '43 6-23 * * *'\n      timezone: 'America/New_York'"));
  assert.ok(workflow.includes("cron: '29 16 * * *'"));
  assert.ok(workflow.includes("cron: '53 0 * * *'"));
  assert.ok(workflow.includes('workflow_run:'));
  assert.ok(workflow.includes('Refresh current ABVM homework'));
  assert.ok(workflow.includes('scripts/check-refresh-health.mjs --max-age-hours 16 --live-url'));
});
test('bounded recovery still protects source identity and deployment integrity',()=>{
  assert.ok(recovery.includes('Monitor ABVM refresh health'));
  assert.ok(recovery.includes('maybe_dispatch sync-study-pack.yml'));
  assert.ok(recovery.includes('maybe_dispatch refresh-current-homework.yml'));
  assert.ok(recovery.includes('attempts >= 6'));
  assert.ok(recovery.includes('count >= 2'));
  assert.ok(recovery.includes('maybe_dispatch pages.yml'));
});
