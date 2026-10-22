import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assessPublicationParity} from '../scripts/publication-parity-health.mjs';

const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8').replace(/\r\n/g,'\n');

test('only both exactly matching live files count as a verified publication',()=>{
  assert.equal(assessPublicationParity({curriculumLiveMatches:true,homeworkLiveMatches:true}).state,'verified');
  assert.equal(assessPublicationParity({curriculumLiveMatches:true,homeworkLiveMatches:true}).verified,true);
  for(const row of [
    {curriculumLiveMatches:false,homeworkLiveMatches:true},
    {curriculumLiveMatches:true,homeworkLiveMatches:false},
    {curriculumLiveMatches:false,homeworkLiveMatches:false},
  ]){
    assert.equal(assessPublicationParity(row).state,'mismatch');
    assert.equal(assessPublicationParity(row).verified,false);
  }
  for(const row of [null,{}, {curriculumLiveMatches:true}, {homeworkLiveMatches:true},
    {curriculumLiveMatches:null,homeworkLiveMatches:null}]){
    assert.equal(assessPublicationParity(row).state,'unknown');
    assert.equal(assessPublicationParity(row).verified,false);
  }
});

test('original timestamps and missing live feeds remain accurately represented',()=>{
  const parity=assessPublicationParity({
    curriculumLiveMatches:false,homeworkLiveMatches:null,
    checkedAt:{curriculum:'2026-10-22T10:00:00Z',homework:'2026-10-22T11:00:00Z'},
    caution:['live-homework-unavailable'],
  });
  assert.equal(parity.curriculum,'mismatch');
  assert.equal(parity.homework,'unknown');
  assert.equal(parity.checkedAt.curriculum,'2026-10-22T10:00:00Z');
  assert.deepEqual(parity.caution,['live-homework-unavailable']);
});

test('operational dashboard never reports healthy when known repository/live parity differs',()=>{
  const dir=mkdtempSync(join(tmpdir(),'abvm-live-parity-'));
  try{
    const evidence=join(dir,'parity.json');
    writeFileSync(evidence,JSON.stringify({
      curriculumLiveMatches:false,homeworkLiveMatches:true,
      checkedAt:{curriculum:'2026-10-22T10:00:00Z',homework:'2026-10-22T10:00:00Z'}
    }));
    const script=fileURLToPath(new URL('../scripts/build-health-report.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script],{
      cwd:dir,encoding:'utf8',
      env:{...process.env,SOURCE_RECOVERY_PLAN_FILE:evidence}
    });
    assert.equal(result.status,1,result.stderr);
    const state=JSON.parse(readFileSync(join(dir,'health-output/abvm-health-status.json'),'utf8'));
    const summary=readFileSync(join(dir,'health-output/abvm-health-summary.md'),'utf8');
    assert.equal(state.publicationParity.state,'mismatch');
    assert.equal(state.publicationParity.curriculum,'mismatch');
    assert.equal(state.publicationParity.homework,'verified');
    assert.equal(state.overall,'critical');
    assert.match(summary,/Live study-pack and Homework parity/);
    assert.match(summary,/curriculum mismatch/i);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('dashboard and hourly watchdog inspect actual public data without manual intervention',()=>{
  const dashboard=read('.github/workflows/health-dashboard.yml');
  const watchdog=read('.github/workflows/refresh-health.yml');
  assert.match(dashboard,/node scripts\/source-freshness-recovery\.mjs --report=source-recovery-plan\.json/);
  assert.match(dashboard,/SOURCE_RECOVERY_PLAN_FILE: source-recovery-plan\.json/);
  assert.match(dashboard,/node scripts\/fetch-health-history\.mjs/);
  assert.match(dashboard,/npm run health:report/);
  assert.match(watchdog,/cron: '29 6-23 \* \* \*'/);
  assert.match(watchdog,/timezone: 'America\/New_York'/);
  assert.match(watchdog,/workflow_run:[\s\S]*?Refresh ABVM teacher pages/);
  assert.match(watchdog,/workflow_run:[\s\S]*?Refresh current ABVM homework/);
  assert.match(watchdog,/--live-url https:\/\/p00nsmasher\.github\.io\/abvmschoolstarworld\/data\/study-pack\.json/);
});

test('queued publishers older than two hours must be reported, not silently treated as recovery',()=>{
  const recovery=read('.github/workflows/daily-source-recovery.yml');
  assert.match(recovery,/fromdateiso8601/);
  assert.match(recovery,/7200/);
  assert.match(recovery,/stalled active workflow/);
  assert.match(recovery,/stalled source publisher/);
  assert.match(recovery,/maybe_dispatch pages\.yml "\$deploy"/);
  assert.match(recovery,/count >= 2/);
  assert.match(recovery,/attempts >= 6/);
});
