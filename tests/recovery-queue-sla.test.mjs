import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const shellAvailable=process.platform!=='win32';
const source=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('          maybe_dispatch()');
const end=source.indexOf('          curriculum=',start);
assert.ok(start>=0&&end>start,'real recovery function must remain discoverable');
const body=source.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');

// GitHub's Actions API returns fractional-second timestamps. Keep that exact
// shape in the regression so the production jq parser cannot drift back to
// accepting only whole-second ISO-8601 values.
const hoursAgo=hours=>new Date(Date.now()-hours*3600_000).toISOString();
const active=({createdHours=3,updatedHours=3}={})=>[{
  status:'queued',event:'schedule',createdAt:hoursAgo(createdHours),updatedAt:hoursAgo(updatedHours),conclusion:null,
}];
function run({target='refresh-current-homework.yml',recent=[],nested=[]}={}){
  const bash=[
    'set -euo pipefail',
    'gh() {',
    '  if [[ "$1" == run && "$2" == list ]]; then',
    '    case "$4" in',
    '      pages.yml) printf %s "$PAGE_HISTORY" ;;',
    '      sync-study-pack.yml) printf %s "$PUBLISHER_HISTORY" ;;',
    '      *) printf %s "$RUN_HISTORY" ;;',
    '    esac',
    '  else',
    '    echo DISPATCHED',
    '  fi',
    '}',
    body,
    'result=0',
    'maybe_dispatch "'+target+'" true || result=1',
    'exit "$result"',
  ].join('\n');
  return spawnSync('bash',['-c',bash],{
    encoding:'utf8',
    env:{...process.env,RUN_HISTORY:JSON.stringify(recent),
      PAGE_HISTORY:JSON.stringify(target==='pages.yml'?recent:[]),PUBLISHER_HISTORY:JSON.stringify(nested)},
  });
}

test('recent progress in an older queued source must not falsely become an incident',{skip:!shellAvailable},()=>{
  const result=run({recent:active({createdHours:3,updatedHours:.1})});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/Recovery already in progress/);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('genuinely stalled queued source fails closed without a duplicate dispatch',{skip:!shellAvailable},()=>{
  const result=run({recent:active()});
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/stalled active workflow/);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('genuinely stalled nested publisher is an incident, not a green recovery',{skip:!shellAvailable},()=>{
  const result=run({target:'pages.yml',nested:active()});
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/stalled source publisher/);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('recent nested publisher activity prevents a redundant Pages deployment',{skip:!shellAvailable},()=>{
  const result=run({target:'pages.yml',nested:active({createdHours:3,updatedHours:.1})});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/defer standalone Pages recovery/);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('no queued source authorizes exactly one guarded Pages dispatch',{skip:!shellAvailable},()=>{
  const result=run({target:'pages.yml'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/DISPATCHED/);
});
