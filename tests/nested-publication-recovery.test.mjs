import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
const start=workflow.indexOf('          maybe_dispatch()');
const end=workflow.indexOf('          curriculum=',start);
assert.ok(start>=0&&end>start,'bounded recovery dispatcher must exist');
const shell=workflow.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');
const parents=['sync-study-pack.yml','refresh-current-homework.yml','sync-uploaded-notices.yml','import-yahoo-weekly-reminders.yml'];
// Fixed UTC clock prevents calendar rollover from changing retry-budget results.
const fixedNow='2026-11-05T18:00:00.000Z';
const hoursBefore=(hours,now=fixedNow)=>new Date(Date.parse(now)-hours*3600000).toISOString();
const row=(status='in_progress',event='push',conclusion=null,createdAt=hoursBefore(1/60))=>({status,event,conclusion,createdAt});
function dispatch({histories={},failedRead='',malformed='',target='pages.yml',needed=true,now=fixedNow}={}){
  const result=spawnSync('bash',['-c',`set -euo pipefail
    # Simulate UTC day and epoch in the REAL dispatch Bash guard. Do not stub
    # jq/fromdateiso8601 or bypass any retry/cap decision.
    date() {
      if [[ "$1" == '-u' && "$2" == '+%Y-%m-%d' ]]; then printf '%s\\n' "$TEST_TODAY";
      elif [[ "$1" == '-u' && "$2" == '+%s' ]]; then printf '%s\\n' "$TEST_NOW_EPOCH";
      else command date "$@"; fi
    }
    gh() {
      if [[ "$1" == run && "$2" == list ]]; then
        local source="$4"
        if [[ "$source" == "$FAILED_READ" ]]; then echo 'provider read failed' >&2; return 1; fi
        if [[ "$source" == "$MALFORMED" ]]; then printf '%s' 'not-json'; return 0; fi
        jq -c --arg source "$source" '.[$source] // []' <<< "$HISTORIES"
      elif [[ "$1" == workflow && "$2" == run ]]; then
        printf 'DISPATCHED %s\\n' "$3"
      else echo 'unexpected CLI arguments' >&2; return 2; fi
    }
    ${shell}
    result=0
    maybe_dispatch "$TARGET" "$NEEDED" || result=1
    exit "$result"`],{encoding:'utf8',env:{...process.env,HISTORIES:JSON.stringify(histories),
      FAILED_READ:failedRead,MALFORMED:malformed,TARGET:target,NEEDED:String(needed),
      TEST_TODAY:now.slice(0,10),TEST_NOW_EPOCH:String(Math.floor(Date.parse(now)/1000))}});
  assert.notEqual(result.status,null,result.error?.message);
  return result;
}
for(const parent of parents){
  test('Pages recovery waits for active nested publisher: '+parent,()=>{
    for(const status of ['in_progress','queued','pending','waiting','requested']){
      const result=dispatch({histories:{[parent]:[row(status)]}});
      assert.equal(result.status,0,result.stderr);
      assert.doesNotMatch(result.stdout,/DISPATCHED/,'must not queue duplicate Pages while '+parent+' is '+status);
    }
  });
}
test('a completed source parent cannot suppress needed Pages recovery',()=>{
  for(const conclusion of ['success','failure','cancelled']){
    const histories=Object.fromEntries(parents.map(parent=>[parent,[row('completed','push',conclusion)]]));
    const result=dispatch({histories});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/DISPATCHED pages.yml/);
  }
});
test('unknown nested-publisher history never authorizes a duplicate release',()=>{
  for(const parent of parents){
    for(const options of [{failedRead:parent},{malformed:parent},{histories:{[parent]:[{}]}}]){
      const result=dispatch(options);
      assert.equal(result.status,1,result.stdout+result.stderr);
      assert.doesNotMatch(result.stdout,/DISPATCHED/);
    }
  }
});
test('source refreshes remain independent of other source publishers',()=>{
  const result=dispatch({target:'refresh-current-homework.yml',histories:{'sync-study-pack.yml':[row()]}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/DISPATCHED refresh-current-homework.yml/);
});
test('no-op plans do not require parent history or dispatch anything',()=>{
  const result=dispatch({needed:false,failedRead:parents[0]});
  assert.equal(result.status,0,result.stderr);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});
test('standalone Pages activity and retry caps remain enforced',()=>{
  for(const history of [[row()],Array.from({length:2},()=>row('completed','workflow_dispatch','failure')),
      Array.from({length:6},()=>row('completed','workflow_dispatch','success'))]){
    const result=dispatch({histories:{'pages.yml':history}});
    assert.doesNotMatch(result.stdout,/DISPATCHED/);
    assert.equal(result.status,history[0].status==='completed'?1:0,result.stderr);
  }
});

test('two old failed recovery attempts permit one later retry without waiting until midnight',()=>{
  const old1=hoursBefore(3);
  const old2=hoursBefore(2);
  const history=[row('completed','workflow_dispatch','failure',old2),
    row('completed','workflow_dispatch','failure',old1)];
  const result=dispatch({target:'refresh-current-homework.yml',
    histories:{'refresh-current-homework.yml':history}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/DISPATCHED refresh-current-homework.yml/);
});

test('a recent failed recovery still enforces cooldown and never dispatches twice',()=>{
  const history=[row('completed','workflow_dispatch','failure'),
    row('completed','workflow_dispatch','failure')];
  const result=dispatch({target:'refresh-current-homework.yml',
    histories:{'refresh-current-homework.yml':history}});
  assert.equal(result.status,1,result.stderr);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('six recovery dispatches remain the hard daily ceiling even after cooldown',()=>{
  const old=hoursBefore(3);
  const history=Array.from({length:6},()=>row('completed','workflow_dispatch','failure',old));
  const result=dispatch({target:'refresh-current-homework.yml',
    histories:{'refresh-current-homework.yml':history}});
  assert.equal(result.status,1,result.stderr);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});

test('UTC rollover resets the daily attempt count without erasing active safety gates',()=>{
  const old=hoursBefore(3,fixedNow);
  const tomorrow='2026-11-06T00:30:00.000Z';
  const history=Array.from({length:6},()=>row('completed','workflow_dispatch','failure',old));
  const result=dispatch({target:'refresh-current-homework.yml',now:tomorrow,
    histories:{'refresh-current-homework.yml':history}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/DISPATCHED refresh-current-homework.yml/);
});
