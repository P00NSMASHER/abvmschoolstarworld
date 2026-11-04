import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const workflow=readFileSync(new URL('../.github/workflows/sync-study-pack.yml',import.meta.url),'utf8');
const source=workflow.split('\n  refresh:\n')[1]?.split('\n  publish:\n')[0]||'';
const publish=workflow.split('\n  publish:\n')[1]?.split('\n  deploy:\n')[0]||'';

function stepScript(name) {
  const marker='      - name: '+name+'\n';
  const start=workflow.indexOf(marker);
  assert.ok(start>=0,'missing source commit security step: '+name);
  const lines=workflow.slice(start+marker.length).split('\n');
  const run=lines.findIndex(line=>line==='        run: |');
  assert.ok(run>=0,'missing executable shell: '+name);
  const body=[];
  for(const line of lines.slice(run+1)){
    if(line.trim()&&!line.startsWith('          '))break;
    body.push(line.startsWith('          ')?line.slice(10):'');
  }
  return body.join('\n');
}
const guard=stepScript('Reject incompatible main drift and restore verified candidate');
const SHA=text=>createHash('sha256').update(text).digest('hex');
const file=(root,path,text)=>{const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,text);};
function run(cwd,program,args,extra={}){
  const x=spawnSync(program,args,{cwd,encoding:'utf8',timeout:12000,...extra});
  assert.equal(x.status,0,program+' '+args.join(' ')+'\n'+(x.stderr||''),{cause:x.error});
  return String(x.stdout||'').trim();
}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'abvm-source-guard-'));
  const bare=join(root,'origin.git'),work=join(root,'work');
  mkdirSync(work);
  run(root,'git',['init','--bare',bare]);
  run(work,'git',['init','-b','main']);
  run(work,'git',['config','user.name','ABVM CI Fixture']);
  run(work,'git',['config','user.email','verified@example.invalid']);
  file(work,'pages/data/study-pack.json','{"old":"teacher"}\n');
  file(work,'pages/data/study-archive.json','{"old":"archive"}\n');
  file(work,'pages/data/homework-current.json','{"checkedAt":"previous"}\n');
  run(work,'git',['add','.']);
  run(work,'git',['commit','-m','synthetic verified main']);
  run(work,'git',['remote','add','origin',bare]);
  run(work,'git',['push','origin','main']);
  const base=run(work,'git',['rev-parse','HEAD']);
  const pack='{"verified":"candidate teacher pack"}\n';
  const archive='{"verified":"candidate teacher archive"}\n';
  const artifact='.abvm-teacher-verified/';
  file(work,artifact+'pages/data/study-pack.json',pack);
  file(work,artifact+'pages/data/study-archive.json',archive);
  file(work,artifact+'SHA256SUMS',
    SHA(pack)+'  pages/data/study-pack.json\n'+SHA(archive)+'  pages/data/study-archive.json\n');
  return {root,work,base,pack,archive,artifact};
}
function advanceMain(fixture,path,text){
  file(fixture.work,path,text);
  run(fixture.work,'git',['add',path]);
  run(fixture.work,'git',['commit','-m','independent verified upstream update']);
  run(fixture.work,'git',['push','origin','main']);
  const latest=run(fixture.work,'git',['rev-parse','HEAD']);
  run(fixture.work,'git',['reset','--hard',fixture.base]);
  return latest;
}
function checkGuard(f,base=f.base){
  return spawnSync('bash',['-c',guard],{
    cwd:f.work,encoding:'utf8',timeout:12000,
    env:{...process.env,VERIFIED_BASE:base}
  });
}

test('teacher full QA is never carried inside the school-data publication mutex',()=>{
  assert.match(source,/Validate the candidate app before changing main\n\s+run: npm run qa/);
  assert.doesNotMatch(source,/group: abvm-verified-school-state/);
  assert.match(publish,/needs: refresh/);
  assert.match(publish,/group: abvm-verified-school-state/);
  assert.doesNotMatch(publish,/npm run qa/);
  assert.match(publish,/Reject stale teacher data after a publication queue delay/);
  assert.match(publish,/git push origin HEAD:main/);
  assert.doesNotMatch(publish,/push --force|reset --hard origin\/main.*&& git push --force/);
});

test('the real locked Bash guard accepts only disjoint Homework main drift and retains its changes',
  {skip:process.platform==='win32'},()=>{
  const f=fixture();
  try{
    const latest=advanceMain(f,'pages/data/homework-current.json','{"checkedAt":"new independently verified Homework"}\n');
    const done=checkGuard(f);
    assert.equal(done.status,0,done.stderr);
    assert.equal(run(f.work,'git',['rev-parse','HEAD']),latest);
    assert.equal(readFileSync(join(f.work,'pages/data/study-pack.json'),'utf8'),f.pack);
    assert.equal(readFileSync(join(f.work,'pages/data/study-archive.json'),'utf8'),f.archive);
    assert.match(readFileSync(join(f.work,'pages/data/homework-current.json'),'utf8'),/new independently verified/);
  }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('the real Bash guard rejects intervening code or teacher-pack changes before modifying main',
  {skip:process.platform==='win32'},()=>{
  for(const path of ['pages/app.js','pages/data/study-pack.json']){
    const f=fixture();
    try{
      advanceMain(f,path,'unverified changed content\n');
      const done=checkGuard(f);
      assert.notEqual(done.status,0,path);
      assert.match(done.stdout+done.stderr,/Main changed outside isolated Homework/);
      assert.equal(run(f.work,'git',['rev-parse','HEAD']),f.base);
      assert.equal(readFileSync(join(f.work,'pages/data/study-pack.json'),'utf8'),'{"old":"teacher"}\n');
    }finally{rmSync(f.root,{recursive:true,force:true});}
  }
});

test('missing/wrong source evidence cannot authorize a teacher data mutation',
  {skip:process.platform==='win32'},()=>{
  const f=fixture();
  try{
    file(f.work,f.artifact+'pages/data/study-pack.json','{"tampered":true}\n');
    const bad=checkGuard(f);
    assert.notEqual(bad.status,0);
    assert.match(bad.stdout+bad.stderr,/FAILED|did NOT match|checksum/i);
    assert.equal(run(f.work,'git',['rev-parse','HEAD']),f.base);
    assert.equal(readFileSync(join(f.work,'pages/data/study-pack.json'),'utf8'),'{"old":"teacher"}\n');
    const invalid=checkGuard(f,'invalid');
    assert.notEqual(invalid.status,0);
  }finally{rmSync(f.root,{recursive:true,force:true});}
});
