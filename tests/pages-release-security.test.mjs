import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,chmodSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const normalizeNewlines=value=>value.replace(/\r\n/g,"\n");
const pages=normalizeNewlines(readFileSync(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8"));
const importer=normalizeNewlines(readFileSync(new URL("../.github/workflows/import-yahoo-weekly-reminders.yml",import.meta.url),"utf8"));
const sha="0123456789abcdef0123456789abcdef01234567";
const stale="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function stepScript(stepName){
  const at=pages.indexOf("      - name: "+stepName+"\n");
  assert.ok(at>=0,"missing guarded release step: "+stepName);
  const lines=pages.slice(at).split("\n");
  const run=lines.findIndex(line=>line==="        run: |");
  assert.ok(run>=0,"missing bash script for: "+stepName);
  const code=[];
  for(const line of lines.slice(run+1)){
    if(line.trim()!==""&&!line.startsWith("          "))break;
    code.push(line.startsWith("          ")?line.slice(10):"");
  }
  return code.join("\n");
}
const admit=stepScript("Admit exact current protected-main commit");
const recheck=stepScript("Recheck protected-main before publishing");

function runGuard(script,extra={}){
  const dir=mkdtempSync(join(tmpdir(),"abvm-pages-admission-"));
  try{
    const git=join(dir,"git");
    writeFileSync(git,'#!/bin/sh\nif [ "$1" = "ls-remote" ]; then\n  printf "%s\\trefs/heads/main\\n" "$MOCK_REMOTE_SHA"\nelse\n  exec /usr/bin/git "$@"\nfi\n');
    chmodSync(git,0o755);
    const output=join(dir,"output");
    const env={...process.env,PATH:dir+":"+process.env.PATH,GITHUB_REPOSITORY:"example/school",
      GITHUB_OUTPUT:output,MOCK_REMOTE_SHA:sha,TRIGGER_REF:"refs/heads/main",
      TRIGGER_SHA:sha,REQUESTED_REF:sha,ADMITTED_SHA:sha,...extra};
    const result=spawnSync("bash",["-c",script],{cwd:dir,env,encoding:"utf8"});
    return {status:result.status,stderr:result.stderr,stdout:result.stdout,
      output:result.status===0&&script===admit?readFileSync(output,"utf8"):""};
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test("Pages admission accepts only the exact current main commit",{skip:process.platform==='win32'},()=>{
  assert.equal(runGuard(admit).status,0);
  assert.equal(runGuard(admit).output.trim(),"sha="+sha);
  assert.equal(runGuard(admit,{REQUESTED_REF:"main"}).status,0);
  assert.notEqual(runGuard(admit,{TRIGGER_REF:"refs/heads/feature"}).status,0);
  assert.notEqual(runGuard(admit,{REQUESTED_REF:"feature"}).status,0);
  assert.notEqual(runGuard(admit,{REQUESTED_REF:"refs/tags/v1"}).status,0);
  assert.notEqual(runGuard(admit,{REQUESTED_REF:stale}).status,0);
  assert.notEqual(runGuard(admit,{TRIGGER_SHA:stale,REQUESTED_REF:"main"}).status,0);
  assert.notEqual(runGuard(admit,{MOCK_REMOTE_SHA:""}).status,0);
});
test("Pages rechecks main before deployment",{skip:process.platform==='win32'},()=>{
  assert.equal(runGuard(recheck).status,0);
  assert.notEqual(runGuard(recheck,{MOCK_REMOTE_SHA:stale}).status,0);
});
test("untrusted refs never reach checkout; importer publishes only pushed SHA",()=>{
  assert.ok(pages.indexOf("Admit exact current protected-main commit")<
    pages.indexOf("Checkout admitted release commit"));
  assert.match(pages,/ref:\s*\$\{\{ steps\.admit\.outputs\.sha \}\}/);
  assert.doesNotMatch(pages,/ref:\s*\$\{\{ inputs\.ref \|\| github\.sha \}\}/);
  assert.match(importer,/permissions:\s*\n  contents: read/);
  assert.match(importer,/  import:\s*\n    permissions:\s*\n      contents: write/);
  assert.match(importer,/  deploy:[\s\S]*?permissions:\s*\n      contents: read\s*\n      pages: write\s*\n      id-token: write/);
  assert.match(importer,/source_sha=\$\(git rev-parse HEAD\)/);
  assert.match(importer,/ref:\s*\$\{\{ needs\.import\.outputs\.source_sha \}\}/);
});

// Execute the real admission shell, not a separate model of its decisions.
test('trusted source writers reconcile stale queued SHAs to current main', {skip:process.platform==='win32'},()=>{
  for(const caller of ['Refresh ABVM teacher pages','Refresh current ABVM homework','Integrate ABVM uploaded notices','Import ABVM Yahoo weekly reminders']){
    const result=runGuard(admit,{CALLER_WORKFLOW:caller,TRIGGER_EVENT:'schedule',
      TRIGGER_SHA:stale,REQUESTED_REF:stale,RECONCILE_LATEST_MAIN:'true'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.output.trim(),'sha='+sha);
  }
});
test('queue reconciliation cannot admit untrusted callers, branches or malformed source refs', {skip:process.platform==='win32'},()=>{
  const trusted={CALLER_WORKFLOW:'Refresh ABVM teacher pages',RECONCILE_LATEST_MAIN:'true'};
  for(const extra of [
    {CALLER_WORKFLOW:'Untrusted workflow'},
    {TRIGGER_REF:'refs/heads/feature'},
    {REQUESTED_REF:'main'},
    {REQUESTED_REF:'refs/tags/v1'},
    {REQUESTED_REF:'not-a-commit'},
    {MOCK_REMOTE_SHA:''},
  ])assert.notEqual(runGuard(admit,{...trusted,...extra}).status,0);
});
test('unpinned main releases select main at queue admission while pinned stale SHAs stay rejected', {skip:process.platform==='win32'},()=>{
  for(const event of ['push','workflow_dispatch']){
    const actual={CALLER_WORKFLOW:'Deploy ABVM to GitHub Pages',TRIGGER_EVENT:event,TRIGGER_SHA:stale};
    assert.equal(runGuard(admit,{...actual,REQUESTED_REF:'main'}).output.trim(),'sha='+sha);
    assert.equal(runGuard(admit,{...actual,REQUESTED_REF:''}).output.trim(),'sha='+sha);
    assert.notEqual(runGuard(admit,{...actual,REQUESTED_REF:stale}).status,0);
    assert.notEqual(runGuard(admit,{...actual,REQUESTED_REF:'main',TRIGGER_REF:'refs/heads/pr'}).status,0);
  }
});
