import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync, existsSync, mkdtempSync, rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
import {tmpdir} from "node:os";

const read=name=>readFileSync(new URL("../.github/workflows/"+name,import.meta.url),"utf8").replaceAll("\r\n","\n");
const notices=read("sync-uploaded-notices.yml");
const teacher=read("sync-study-pack.yml");
const homework=read("refresh-current-homework.yml");

function job(source,name){
  const marker="\n  "+name+":\n";
  assert.ok(source.includes(marker),"missing job "+name);
  return source.split(marker)[1].split(/\n  [a-z][\w-]*:\n/)[0];
}

test("notice integration skips a costly release when no reviewed content changes",()=>{
  const integrate=job(notices,"integrate");
  const deploy=job(notices,"deploy");
  assert.match(integrate,/git diff --quiet -- pages\/data\/study-pack\.json pages\/data\/study-archive\.json/);
  assert.match(integrate,/echo "published=false" >> "\$GITHUB_OUTPUT"/);
  assert.match(integrate,/echo "published=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(notices,/published: \$\{\{ steps\.integrate\.outputs\.published \}\}/);
  assert.match(deploy,/if: needs\.integrate\.outputs\.published == 'true'/);
  assert.match(deploy,/ref: \$\{\{ needs\.integrate\.outputs\.release_sha \}\}/);
});

test("source writers have no Pages or OIDC permission; only release jobs can deploy",()=>{
  for(const [workflow,sourceName] of [
    [notices,"integrate"],[teacher,"refresh"],[homework,"homework"]
  ]){
    assert.match(workflow,/^permissions:\n  contents: read/m);
    const source=job(workflow,sourceName);
    assert.match(source,/    permissions:\n      contents: write/);
    assert.doesNotMatch(source,/^      pages: write$/m);
    assert.doesNotMatch(source,/^      id-token: write$/m);
    const publisher=job(workflow,"deploy");
    assert.match(publisher,/    permissions:\n      contents: read\n      pages: write\n      id-token: write/);
    assert.match(publisher,/uses: .\/.github\/workflows\/pages\.yml/);
  }
  assert.match(job(teacher,"refresh"),/      pull-requests: write/);
  assert.match(job(teacher,"reviewed-lunch"),/      contents: write/);
});

test("full browser QA and Pages reuse binaries only for the matching npm lockfile",()=>{
  for(const name of [
    "pages.yml","qa.yml","qa-reproduction.yml","teacher-refresh-candidate.yml",
    "sync-study-pack.yml"
  ]){
    const workflow=read(name);
    assert.match(workflow,/name: Cache version-pinned Playwright browsers\n\s+continue-on-error: true\n\s+uses: actions\/cache@v4/,"optional browser cache must never block QA "+name);
    assert.match(workflow,/path: ~\/.cache\/ms-playwright/,"wrong cache path "+name);
    assert.match(workflow,/key: abvm-playwright-/,"missing browser-cache prefix "+name);
    assert.ok(workflow.includes("hashFiles('package-lock.json')"),"unversioned browser cache "+name);
    assert.match(workflow,/bash scripts\/install-playwright-ci\.sh/,"must use bounded browser and OS dependency bootstrap "+name);
    assert.match(workflow,/npm run qa/,"full release QA must remain present "+name);
  }
  assert.match(teacher,/Cache Playwright browsers only for changed reviewed lunch\n\s+if: steps\.lunch-change\.outputs\.changed == 'true'\n\s+continue-on-error: true/);
});

const fakeSha="0123456789abcdef0123456789abcdef01234567";
function runNoticeCase(scenario){
  const source=job(notices,"integrate");
  const at=source.indexOf("      - name: Integrate reviewed uploaded notices and publish to main");
  assert.ok(at>=0);
  const scriptAt=source.indexOf("        run: |\n",at);
  assert.ok(scriptAt>=0);
  const shell=source.slice(scriptAt+"        run: |\n".length).split("\n").map(line=>
    line.startsWith("          ")?line.slice(10):"").join("\n");
  const mock=[
    'git() {',
    '  case "$1" in',
    '    config|fetch|reset|add|commit) return 0;;',
    '    diff) if [ "$SCENARIO" = noop ]; then return 0; else return 1; fi;;',
    '    push) if [ "$SCENARIO" = changed ]; then return 0; else return 1; fi;;',
    '    rev-parse) printf "%s\n" "$MOCK_SHA"; return 0;;',
    '    *) return 1;;',
    '  esac',
    '}',
    'node() { :; }',
    'npm() { :; }'
  ].join("\n");
  const dir=mkdtempSync(join(tmpdir(),"abvm-notice-action-"));
  try{
    const output=join(dir,"output");
    const r=spawnSync("bash",["-c",mock+"\n"+shell],{
      cwd:dir,encoding:"utf8",
      env:{...process.env,SCENARIO:scenario,MOCK_SHA:fakeSha,GITHUB_OUTPUT:output}
    });
    return {status:r.status,stdout:r.stdout,stderr:r.stderr,
      outputs:existsSync(output)?readFileSync(output,"utf8"):""};
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test("actual notice publish step is no-op safe, positive-publish accurate, and bounded on push races",
  {skip:process.platform==="win32"},()=>{
    const noop=runNoticeCase("noop");
    assert.equal(noop.status,0,noop.stderr);
    assert.match(noop.outputs,/published=false/);
    assert.match(noop.outputs,new RegExp("release_sha="+fakeSha));
    assert.doesNotMatch(noop.outputs,/published=true/);

    const changed=runNoticeCase("changed");
    assert.equal(changed.status,0,changed.stderr);
    assert.match(changed.outputs,/published=true/);
    assert.match(changed.outputs,new RegExp("release_sha="+fakeSha));

    const failed=runNoticeCase("push-rejected");
    assert.equal(failed.status,1);
    assert.doesNotMatch(failed.outputs,/published=true/);
    assert.match(failed.stderr,/Could not publish reviewed uploaded notices after 3 main-race retries/);
});
