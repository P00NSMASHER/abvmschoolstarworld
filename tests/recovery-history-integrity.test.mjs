import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

function dispatch({history='[]',readFails=false}={}){
  const workflow=readFileSync(new URL('../.github/workflows/daily-source-recovery.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('          maybe_dispatch()');
  const end=workflow.indexOf('          curriculum=',start);
  assert.ok(start>=0&&end>start);
  const body=workflow.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');
  return spawnSync('bash',['-c',`set -euo pipefail
    gh() {
      if [[ "$1" == run ]]; then
        if [[ "$READ_FAILS" == true ]]; then echo 'history temporarily unavailable' >&2; return 1; fi
        printf '%s' "$HISTORY"
      else echo DISPATCHED; fi
    }
    ${body}
    result=0
    # Match the real workflow call site: this conditional disables implicit
    # Bash errexit inside a function, so reads must be checked explicitly.
    maybe_dispatch refresh-current-homework.yml true || result=1
    exit "$result"`],{encoding:'utf8',env:{...process.env,HISTORY:history,READ_FAILS:String(readFails)}});
}

test('unavailable workflow history never authorizes a recovery dispatch',()=>{
  const result=dispatch({readFails:true});
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.doesNotMatch(result.stdout,/DISPATCHED/);
});
test('malformed or non-list run evidence never bypasses retry limits',()=>{
  for(const history of ['not-json','{}','null','[{"status":"completed"}]']){
    const result=dispatch({history});
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.doesNotMatch(result.stdout,/DISPATCHED/);
  }
});
test('a verified empty run history still permits one bounded recovery',()=>{
  const result=dispatch();
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/DISPATCHED/);
});
