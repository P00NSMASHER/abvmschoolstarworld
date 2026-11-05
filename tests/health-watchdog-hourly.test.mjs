import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/refresh-health.yml',import.meta.url),'utf8');
test('source watchdog has independent hourly school-hour heartbeat and bounded recovery',()=>{
  assert.match(workflow,/cron:\\s*'43 6-23 \\* \\* \\*'\\s*\\n\\s*timezone:\\s*'America\\/New_York'/);
  assert.match(workflow,/workflow_run:[\\s\\S]*?Refresh current ABVM homework/);
  assert.match(workflow,/scripts\\/check-refresh-health\\.mjs --max-age-hours 16 --live-url/);
  const recovery=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  assert.match(recovery,/Monitor ABVM refresh health/);
  assert.match(recovery,/maybe_dispatch sync-study-pack\\.yml/);
  assert.match(recovery,/maybe_dispatch refresh-current-homework\\.yml/);
  assert.match(recovery,/if \\(\\( attempts >= 6 \\)\\)/);
});
