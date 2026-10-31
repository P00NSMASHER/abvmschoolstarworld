import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const jobs={
  'sync-study-pack.yml':['refresh','reviewed-lunch'],
  'refresh-current-homework.yml':['homework'],
  'sync-uploaded-notices.yml':['integrate'],
  'import-yahoo-weekly-reminders.yml':['import'],
  'pages.yml':['deploy'],
};
function job(text,name){return text.split('\n  '+name+':\n')[1]?.split(/\n  [a-z][a-z-]*:\n/)[0]||'';}
for(const [file,names] of Object.entries(jobs)){
  for(const name of names)test(`${file} / ${name} shares the queued source-publication mutex`,()=>{
    const text=read(file),body=job(text,name);
    assert.ok(body,'job must exist');
    assert.match(body,/concurrency:\n\s+group: abvm-verified-school-state\n\s+cancel-in-progress: false\n\s+queue: max/);
    const parent=text.split('\njobs:')[0];
    assert.doesNotMatch(parent,/group: abvm-verified-school-state/,'a reusable caller cannot hold its child release lock');
  });
}
for(const file of Object.keys(jobs).filter(f=>f!=='pages.yml')){
  test(`${file} release reconciles only through the guarded main publisher`,()=>{
    const deploy=job(read(file),'deploy');
    assert.match(deploy,/uses: \.\/\.github\/workflows\/pages\.yml/);
    assert.match(deploy,/reconcile_latest_main: true/);
    assert.match(deploy,/ref: \$\{\{ needs\./);
  });
}
test('Pages retains exact-source admission and final guard around full release QA',()=>{
  const pages=read('pages.yml');
  assert.match(pages,/reconcile_latest_main:\n\s+description:[^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/);
  assert.match(pages,/CALLER_WORKFLOW: \$\{\{ github.workflow \}\}/);
  assert.match(pages,/RECONCILE_LATEST_MAIN: \$\{\{ inputs.reconcile_latest_main/);
  assert.match(pages,/Requested release is not the exact current protected-main commit/);
  assert.match(pages,/Run release QA\n\s+run: npm run qa/);
  assert.match(pages,/Main advanced while QA ran/);
  assert.match(pages,/Verify live lunch data and visible mobile flows/);
});
test('a scheduled recovery tick does not require a preceding workflow to finish',()=>{
  const recovery=read('daily-source-recovery.yml');
  assert.match(recovery,/cron: '11 6-23 \* \* \*'/);
  assert.match(recovery,/timezone: 'America\/New_York'/);
  assert.match(recovery,/attempts >= 6/);
  assert.match(recovery,/count >= 2/);
});

test('every real source workflow name is in the guarded reconciliation allowlist',()=>{
  const release=read('pages.yml');
  for(const file of Object.keys(jobs).filter(f=>f!=='pages.yml')){
    const name=read(file).match(/^name: (.+)$/m)?.[1];
    assert.ok(name);
    assert.ok(release.includes("'"+name+"'"),'missing source caller '+name);
  }
});

test('controller scan expectations match the configured source cron times',async()=>{
  const {REFRESH_SCHEDULES}=await import('../scripts/refresh-controller.mjs');
  const teacher=[...read('sync-study-pack.yml').matchAll(/cron: '(\d+) (\d+) \* \* \*'/g)]
    .map(([,minute,hour])=>Number(hour)*60+Number(minute));
  assert.deepEqual([...REFRESH_SCHEDULES.curriculum],teacher);
  assert.match(read('refresh-current-homework.yml'),/cron: '7,37 6-23 \* \* \*'/);
  assert.deepEqual([...REFRESH_SCHEDULES.homework],
    Array.from({length:18},(_,i)=>[(i+6)*60+7,(i+6)*60+37]).flat());
});
