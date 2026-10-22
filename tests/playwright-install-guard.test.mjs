import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, join} from 'node:path';
import {spawnSync} from 'node:child_process';

const installer=new URL('../scripts/install-playwright-ci.sh',import.meta.url);
const qaWorkflow=new URL('../.github/workflows/qa.yml',import.meta.url);
const refreshWorkflow=new URL('../.github/workflows/sync-study-pack.yml',import.meta.url);
const pagesWorkflow=new URL('../.github/workflows/pages.yml',import.meta.url);

function fakeNpx(mode){
  const dir=mkdtempSync(join(tmpdir(),'abvm-playwright-bootstrap-'));
  const countFile=join(dir,'count');
  const executable=join(dir,'npx');
  writeFileSync(executable,`#!/usr/bin/env bash
set -eu
count=0
if [[ -f "$COUNT_FILE" ]]; then count="$(cat "$COUNT_FILE")"; fi
echo "$((count + 1))" > "$COUNT_FILE"
if [[ "$FAKE_MODE" == "slow" ]]; then sleep 3; fi
exit 0
`);
  chmodSync(executable,0o755);
  const started=Date.now();
  const result=spawnSync('bash',[installer.pathname],{
    encoding:'utf8',
    timeout:6000,
    env:{...process.env,PATH:dir+delimiter+(process.env.PATH||''),COUNT_FILE:countFile,
      FAKE_MODE:mode,PLAYWRIGHT_INSTALL_TIMEOUT_SECONDS:'1',PLAYWRIGHT_INSTALL_ATTEMPTS:'2'},
  });
  return {dir,countFile,result,elapsed:Date.now()-started};
}

test('Playwright bootstrap succeeds once and preserves Chromium/WebKit coverage',()=>{
  const {dir,countFile,result}=fakeNpx('success');
  try{
    assert.equal(result.status,0,result.stderr);
    assert.equal(readFileSync(countFile,'utf8').trim(),'1');
    assert.match(result.stdout,/Chromium\/WebKit browsers and OS dependencies are ready/);
    const source=readFileSync(installer,'utf8');
    assert.match(source,/npx playwright install --with-deps chromium webkit/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Playwright bootstrap retries once, then fails fast with explicit timeout evidence',()=>{
  const {dir,countFile,result,elapsed}=fakeNpx('slow');
  try{
    assert.equal(result.status,124,result.stderr);
    assert.equal(readFileSync(countFile,'utf8').trim(),'2');
    assert.ok(elapsed<4500,`bounded retry took ${elapsed}ms`);
    assert.match(result.stderr,/Playwright bootstrap retry/);
    assert.match(result.stderr,/Playwright bootstrap timeout/);
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
