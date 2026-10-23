import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, join} from 'node:path';
import {spawnSync} from 'node:child_process';

const installer=new URL('../scripts/install-playwright-ci.sh',import.meta.url);
const qaWorkflow=new URL('../.github/workflows/qa.yml',import.meta.url);
const refreshWorkflow=new URL('../.github/workflows/sync-study-pack.yml',import.meta.url);
const pagesWorkflow=new URL('../.github/workflows/pages.yml',import.meta.url);

function fakeBootstrap({probe='success',fallback='success',preinstalled=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'abvm-playwright-bootstrap-'));
  const callsFile=join(dir,'calls');
  const probeCountFile=join(dir,'probe-count');
  const npx=join(dir,'npx');
  const node=join(dir,'node');
  writeFileSync(npx,`#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$CALLS_FILE"
if [[ "$*" == *"--with-deps"* ]]; then
  if [[ "$FALLBACK_MODE" == "slow" ]]; then sleep 3; fi
  if [[ "$FALLBACK_MODE" == "fail" ]]; then exit 17; fi
fi
exit 0
`);
  writeFileSync(node,`#!/usr/bin/env bash
set -eu
count=0
if [[ -f "$PROBE_COUNT_FILE" ]]; then count="$(cat "$PROBE_COUNT_FILE")"; fi
count="$((count + 1))"
echo "$count" > "$PROBE_COUNT_FILE"
if [[ "$PROBE_MODE" == "fail" ]]; then exit 19; fi
if [[ "$PROBE_MODE" == "fail-first" && "$count" == "1" ]]; then exit 19; fi
exit 0
`);
  chmodSync(npx,0o755);
  chmodSync(node,0o755);
  const started=Date.now();
  const result=spawnSync('bash',[installer.pathname],{
    encoding:'utf8',
    timeout:5000,
    env:{...process.env,PATH:dir+delimiter+(process.env.PATH||''),CALLS_FILE:callsFile,
      PROBE_COUNT_FILE:probeCountFile,PROBE_MODE:probe,FALLBACK_MODE:fallback,
      ABVM_PREINSTALLED_BROWSERS:preinstalled?'1':'0',PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS:'1'},
  });
  const calls=existsSync(callsFile)?readFileSync(callsFile,'utf8').trim().split('\n').filter(Boolean):[];
  return {dir,result,calls,elapsed:Date.now()-started};
}

test('cached Chromium and WebKit launch without a redundant apt transaction',()=>{
  const {dir,result,calls}=fakeBootstrap();
  try{
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(calls,['playwright install chromium webkit']);
    assert.match(result.stdout,/Cached Playwright Chromium\/WebKit browsers and runtime dependencies are ready/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('failed cached-browser probe permits exactly one dependency fallback',()=>{
  const {dir,result,calls}=fakeBootstrap({probe:'fail-first',fallback:'success'});
  try{
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(calls,[
      'playwright install chromium webkit',
      'playwright install --with-deps chromium webkit',
    ]);
    assert.match(result.stderr,/Playwright dependency fallback/);
    assert.match(result.stdout,/ready after the bounded fallback/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('dependency timeout fails closed without starting an overlapping apt retry',()=>{
  const {dir,result,calls,elapsed}=fakeBootstrap({probe:'fail',fallback:'slow'});
  try{
    assert.equal(result.status,124,result.stderr);
    assert.deepEqual(calls,[
      'playwright install chromium webkit',
      'playwright install --with-deps chromium webkit',
    ]);
    assert.ok(elapsed<2500,`bounded fallback took ${elapsed}ms`);
    assert.match(result.stderr,/Playwright bootstrap timeout/);
    assert.match(result.stderr,/no overlapping apt retry was started/);
    assert.match(result.stderr,/browser QA was not run/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('workflows use the bounded installer without widening their job budgets',()=>{
  const qa=readFileSync(qaWorkflow,'utf8');
  const refresh=readFileSync(refreshWorkflow,'utf8');
  const pages=readFileSync(pagesWorkflow,'utf8');
  const installerCall=/bash scripts\/install-playwright-ci\.sh/g;
  assert.equal((qa.match(installerCall)||[]).length,1);
  assert.equal((refresh.match(installerCall)||[]).length,2);
  assert.equal((pages.match(installerCall)||[]).length,1);
  assert.match(qa,/timeout-minutes: 30/);
  assert.match(refresh,/timeout-minutes: 45/);
  assert.match(refresh,/timeout-minutes: 30/);
  assert.match(pages,/timeout-minutes: 25/);
  assert.doesNotMatch(qa,/npx playwright install --with-deps chromium webkit/);
  assert.doesNotMatch(refresh,/npx playwright install --with-deps chromium webkit/);
  assert.doesNotMatch(pages,/npx playwright install --with-deps chromium webkit/);
});

test('every Chromium and WebKit workflow uses the same bounded bootstrap and lockfile-pinned cache',()=>{
 const names=['today-visual-acceptance.yml','calendar-visual-acceptance.yml','public-privacy-visual-acceptance.yml',
  'study-tools-visual.yml','study-player-visual-acceptance.yml','study-visual-acceptance.yml','progress-visual-acceptance.yml'];
 for(const name of names){
  const workflow=readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  assert.match(workflow,/bash scripts\/install-playwright-ci\.sh/,name);
  assert.doesNotMatch(workflow,/npx playwright install --with-deps chromium webkit/,name);
  assert.ok(workflow.includes("hashFiles('package-lock.json')"),name);
  assert.ok(workflow.includes('path: ~/.cache/ms-playwright'),name);
 }
});

test('all dual-browser CI jobs use an version-pinned official image matching the locked Playwright version',()=>{
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 const version=lock.packages['node_modules/@playwright/test'].version;
 const names=['qa.yml','qa-reproduction.yml','pages.yml','sync-study-pack.yml','teacher-refresh-candidate.yml',
  'today-visual-acceptance.yml','calendar-visual-acceptance.yml','public-privacy-visual-acceptance.yml',
  'study-tools-visual.yml','study-player-visual-acceptance.yml','study-visual-acceptance.yml','progress-visual-acceptance.yml'];
 for(const name of names){
  const workflow=readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  const jobs=workflow.split('    runs-on: ubuntu-latest').slice(1);
  assert.ok(jobs.length,name);
  for(const job of jobs){
   assert.ok(job.includes('image: mcr.microsoft.com/playwright:v'+version+'-noble-amd64\n'),name);
   assert.ok(job.includes('uses: actions/setup-python@v5'),name);
   assert.match(job,/defaults:\n      run:\n        shell: bash/,name);
  }
 }
});

test('preinstalled browser runtime performs no install and fails closed on a missing dependency',()=>{
 for(const probe of ['success','fail']){
  const {dir,result,calls}=fakeBootstrap({probe,preinstalled:true});
  try{
   assert.deepEqual(calls,[],'preinstalled CI must not invoke npm installs or apt');
   assert.equal(result.status,probe==='success'?0:19);
   assert.match(result.stdout+result.stderr,probe==='success'?/no installation needed/:/no mutable dependency installation was attempted/);
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
