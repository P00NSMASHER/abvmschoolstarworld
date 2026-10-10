import test from 'node:test';
import assert from 'node:assert/strict';
import {chmod,mkdir,mkdtemp,readFile,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {assertPrivatePath,integrateLearningHistory,mergeLearningHistory,validateObservationBatch} from '../scripts/learning-history.mjs';

const observation=(id,sourceId,day,result='correct',extra={})=>({
  id,sourceId,subject:'Math',skill:'regrouping',studiedOn:day,addedOn:day,result,
  errorType:result==='correct'?'unknown':'procedure-error',independence:'independent',confidence:0.95,...extra
});
const batch=(observations,asOf='2026-10-07')=>({schemaVersion:1,intakeId:'batch-'+asOf,asOf,observations});

test('reviewed observation batch validates strict cumulative evidence',()=>{
  assert.deepEqual(validateObservationBatch(batch([observation('o1','p1','2026-10-01')])),{observations:1});
  const bad=batch([observation('o1','p1','2026-10-01')]);
  bad.observations[0].studentName='Private';
  assert.throws(()=>validateObservationBatch(bad),/unknown field/);
});

test('mastery requires repeated independent success across sources and dates',()=>{
  const first=mergeLearningHistory(null,batch([
    observation('o1','p1','2026-10-01','incorrect'),
    observation('o2','p2','2026-10-02','correct')
  ],'2026-10-02'));
  assert.equal(first.skills[0].status,'learning');
  const second=mergeLearningHistory(first,batch([
    observation('o3','p3','2026-10-03','correct'),
    observation('o4','p4','2026-10-05','correct')
  ],'2026-10-05'));
  assert.equal(second.skills[0].status,'mastered');
  assert.equal(second.skills[0].trend,'improving');
});

test('recent misses outrank generic reinforcement and retain error taxonomy',()=>{
  const result=mergeLearningHistory(null,batch([
    observation('o1','p1','2026-10-01','correct'),
    observation('o2','p2','2026-10-02','incorrect',{errorType:'procedure-error'}),
    {...observation('o3','r1','2026-10-03','partial',{subject:'Reading / ELA',skill:'directions',errorType:'reading-comprehension'}),id:'o3'}
  ],'2026-10-07'));
  assert.equal(result.practiceTargets[0].reason,'recent-miss');
  const math=result.skills.find(item=>item.skill==='regrouping');
  assert.deepEqual(math.commonErrorTypes,[{type:'procedure-error',count:1}]);
});

test('replay is idempotent and conflicting observation IDs fail closed',()=>{
  const b=batch([observation('o1','p1','2026-10-01')]);
  const once=mergeLearningHistory(null,b);
  assert.deepEqual(mergeLearningHistory(once,b),once);
  const changed=batch([observation('o1','p1','2026-10-01','incorrect')]);
  assert.throws(()=>mergeLearningHistory(once,changed),/collision/);
});

test('private history and reviewed batch paths cannot live inside public repo',()=>{
  const repoRoot='/tmp/public-abvm';
  assert.throws(()=>assertPrivatePath('/tmp/public-abvm/private/history.json','History',repoRoot),/outside the public ABVM repository/);
  assert.equal(assertPrivatePath('/tmp/private-abvm/history.json','History',repoRoot),path.resolve('/tmp/private-abvm/history.json'));
});

test('file integration writes only to an external private path',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-learning-'));
  try{
    const privateDir=path.join(dir,'private'),repoRoot=path.join(dir,'public-repo');
    const history=path.join(privateDir,'history.json'),input=path.join(privateDir,'batch.json');
    await mkdir(privateDir,{recursive:true});
    await writeFile(input,JSON.stringify(batch([observation('o1','p1','2026-10-01','incorrect')])));
    const result=await integrateLearningHistory(history,input,{write:true,repoRoot});
    assert.equal(result.changed,true);
    const saved=JSON.parse(await readFile(history,'utf8'));
    assert.equal(saved.observations.length,1);
    assert.equal(saved.practiceTargets[0].reason,'recent-miss');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('a rephotographed assignment item cannot count as a new assessment',()=>{
  const first=mergeLearningHistory(null,batch([
    observation('o1','original.jpeg','2026-10-01','correct',{assignmentId:'Math Page 42',questionId:'4'})
  ],'2026-10-01'));
  const rephoto=batch([
    observation('o2','second-photo.jpeg','2026-10-05','correct',{assignmentId:'  math page 42 ',questionId:'4'})
  ],'2026-10-05');
  assert.throws(()=>mergeLearningHistory(first,rephoto),/Repeated assessment item.*o2 duplicates o1/);
  assert.deepEqual(mergeLearningHistory(first,batch([
    observation('o2','second-photo.jpeg','2026-10-05','correct',{assignmentId:'math page 42',questionId:'5'})
  ],'2026-10-05')).skills[0].scoredCount,2);
});

test('unknown worksheet dates cannot create mastery or a chronological improvement trend',()=>{
  const undated=[1,2,3,4].map((n)=>observation('u'+n,'source-'+n+'.jpeg','2026-10-0'+n,n===1?'incorrect':'correct',{
    studiedOn:null,addedOn:'2026-10-0'+n,assignmentId:'worksheet-'+n,questionId:'1'
  }));
  const result=mergeLearningHistory(null,batch(undated,'2026-10-08'));
  assert.equal(result.skills[0].scoredCount,4);
  assert.equal(result.skills[0].status,'learning');
  assert.equal(result.skills[0].trend,'insufficient-data');
  assert.equal(result.skills[0].confidence>0,true);
  assert.equal(result.practiceTargets[0].reason,'learning');
});

test('verified assignment dates, not merely intake dates, support chronological improvement',()=>{
  const items=[
    observation('d1','p1','2026-10-01','incorrect'),
    observation('d2','p2','2026-10-02','incorrect'),
    observation('d3','p3','2026-10-03','correct'),
    observation('d4','p4','2026-10-05','correct')
  ];
  const result=mergeLearningHistory(null,batch(items,'2026-10-09'));
  assert.equal(result.skills[0].trend,'improving');
  assert.equal(result.skills[0].status,'improving');
});

test('replaying older approved evidence cannot rewind the private history date',()=>{
  const first=mergeLearningHistory(null,batch([
    observation('o1','p1','2026-10-01','correct')
  ],'2026-10-09'));
  const replay=mergeLearningHistory(first,batch([
    observation('o1','p1','2026-10-01','correct')
  ],'2026-10-01'));
  assert.deepEqual(replay,first);
});

test('private history and batch cannot escape through symlinked files or parent folders',{skip:process.platform==='win32'},async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-private-paths-'));
  try{
    const publicRoot=path.join(dir,'public'),privateRoot=path.join(dir,'private');
    await mkdir(publicRoot);await mkdir(privateRoot);
    const safeBatch=path.join(privateRoot,'batch.json');
    await writeFile(safeBatch,JSON.stringify(batch([observation('o1','p1','2026-10-01')])));
    const shortcut=path.join(privateRoot,'public-link');
    await symlink(publicRoot,shortcut,'dir');
    await assert.rejects(
      integrateLearningHistory(path.join(shortcut,'history.json'),safeBatch,{write:true,repoRoot:publicRoot}),
      /outside the public ABVM repository/
    );
    const exposedBatch=path.join(publicRoot,'reviewed-batch.json');
    await writeFile(exposedBatch,await readFile(safeBatch));
    await symlink(exposedBatch,path.join(privateRoot,'source-shortcut.json'),'file');
    await assert.rejects(
      integrateLearningHistory(path.join(privateRoot,'history.json'),path.join(privateRoot,'source-shortcut.json'),{write:true,repoRoot:publicRoot}),
      /outside the public ABVM repository/
    );
    const exposedHistory=path.join(publicRoot,'history.json');
    await writeFile(exposedHistory,'DO NOT OVERWRITE');
    await symlink(exposedHistory,path.join(privateRoot,'history-shortcut.json'),'file');
    await assert.rejects(
      integrateLearningHistory(path.join(privateRoot,'history-shortcut.json'),safeBatch,{write:true,repoRoot:publicRoot}),
      /outside the public ABVM repository/
    );
    assert.equal(await readFile(exposedHistory,'utf8'),'DO NOT OVERWRITE');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('new and replaced private histories are owner-only even under a permissive umask',{skip:process.platform==='win32'},async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-private-permissions-'));
  try{
    const privateDir=path.join(dir,'nested','history'),target=path.join(privateDir,'history.json');
    const source=path.join(dir,'batch.json'),publicRoot=path.join(dir,'public');
    await writeFile(source,JSON.stringify(batch([observation('o1','p1','2026-10-01')],'2026-10-07')));
    await integrateLearningHistory(target,source,{write:true,repoRoot:publicRoot});
    assert.equal((await stat(privateDir)).mode&0o777,0o700);
    assert.equal((await stat(target)).mode&0o777,0o600);
    await chmod(target,0o644); // simulate a previously over-permissive history file
    await writeFile(source,JSON.stringify(batch([observation('o2','p2','2026-10-03')],'2026-10-08')));
    await integrateLearningHistory(target,source,{write:true,repoRoot:publicRoot});
    assert.equal((await stat(target)).mode&0o777,0o600);
    assert.equal(JSON.parse(await readFile(target,'utf8')).observations.length,2);
    await chmod(target,0o644); // legacy permissions on content-identical replay
    const replay=await integrateLearningHistory(target,source,{write:true,repoRoot:publicRoot});
    assert.equal(replay.changed,false);
    assert.equal((await stat(target)).mode&0o777,0o600);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('mastery requires distinct assignments, not rephotographs of one worksheet',()=>{
  const sameSheet=[
    observation('a1','camera-1.jpeg','2026-10-01','correct',{assignmentId:'Math Page 9',questionId:'1'}),
    observation('a2','camera-2.jpeg','2026-10-02','correct',{assignmentId:' math page 9 ',questionId:'2'}),
    observation('a3','camera-3.jpeg','2026-10-03','correct',{assignmentId:'MATH PAGE 9',questionId:'3'})
  ];
  const oneAssignment=mergeLearningHistory(null,batch(sameSheet,'2026-10-03'));
  assert.equal(oneAssignment.skills[0].scoredCount,3);
  assert.notEqual(oneAssignment.skills[0].status,'mastered');
  // A genuinely separate assignment supplies independent evidence.
  const later=mergeLearningHistory(oneAssignment,batch([
    observation('b1','camera-4.jpeg','2026-10-04','correct',{assignmentId:'Math Page 10',questionId:'1'})
  ],'2026-10-04'));
  assert.equal(later.skills[0].status,'mastered');
});

test('future-dated study observations and intake-after-review dates fail closed',()=>{
  const studiedAfterIntake=observation('future','p1','2026-10-09','correct',{addedOn:'2026-10-07'});
  assert.throws(()=>validateObservationBatch(batch([studiedAfterIntake],'2026-10-10')),/studiedOn cannot be after addedOn/);
  const laterIntake=observation('late','p2','2026-10-09','correct');
  assert.throws(()=>validateObservationBatch(batch([laterIntake],'2026-10-08')),/addedOn cannot be after batch asOf/);
  // Rejection cannot mutate a previously accepted private learning ledger.
  const existing=mergeLearningHistory(null,batch([observation('o1','p1','2026-10-01')],'2026-10-05'));
  const snapshot=structuredClone(existing);
  assert.throws(()=>mergeLearningHistory(existing,batch([laterIntake],'2026-10-08')));
  assert.deepEqual(existing,snapshot);
});

test('an existing exclusive writer lock blocks history reads and leaves records unchanged',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-history-lock-'));
  try{
    const history=path.join(dir,'history.json'),source=path.join(dir,'batch.json');
    const repoRoot=path.join(dir,'public');
    // An active writer may temporarily be preparing or replacing the ledger.
    await writeFile(history,'{"partially-written":');
    await writeFile(history+'.lock','other writer');
    await writeFile(source,JSON.stringify(batch([observation('lock-1','p1','2026-10-01')])));
    await assert.rejects(
      integrateLearningHistory(history,source,{write:true,repoRoot}),
      error=>error.code==='EEXIST'
    );
    assert.equal(await readFile(history,'utf8'),'{"partially-written":');
    // A dry-run is nonmutating, so it can still report invalid external state.
    await assert.rejects(integrateLearningHistory(history,source,{repoRoot}),SyntaxError);
    await rm(history+'.lock');
    await rm(history);
    const result=await integrateLearningHistory(history,source,{write:true,repoRoot});
    assert.equal(result.observations,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('simultaneous private intakes either serialize or explicitly fail for safe retry',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-history-parallel-'));
  try{
    const history=path.join(dir,'history.json'),repoRoot=path.join(dir,'public');
    const batches=['first','second'].map((name,i)=>({
      file:path.join(dir,name+'.json'),
      value:batch([observation(name,'source-'+name,'2026-10-0'+(i+1))],'2026-10-09')
    }));
    for(const item of batches)await writeFile(item.file,JSON.stringify(item.value));
    const results=await Promise.allSettled(batches.map(item=>
      integrateLearningHistory(history,item.file,{write:true,repoRoot})
    ));
    const succeeded=results.filter(result=>result.status==='fulfilled').length;
    assert.ok(succeeded>=1);
    for(const result of results)if(result.status==='rejected')assert.equal(result.reason.code,'EEXIST');
    const initial=JSON.parse(await readFile(history,'utf8'));
    assert.equal(initial.observations.length,succeeded,'no successful intake may be lost');
    // Retry each original intake; existing observations remain idempotent.
    for(const item of batches)await integrateLearningHistory(history,item.file,{write:true,repoRoot});
    const complete=JSON.parse(await readFile(history,'utf8'));
    assert.equal(complete.observations.length,2);
    assert.deepEqual(new Set(complete.observations.map(item=>item.id)),new Set(['first','second']));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('uploading an old undated miss does not become a dated recent miss or erase verified mastery',()=>{
  const completed=[
    observation('master-1','p1','2026-10-01','correct',{assignmentId:'math-1',questionId:'1'}),
    observation('master-2','p2','2026-10-03','correct',{assignmentId:'math-2',questionId:'1'}),
    observation('master-3','p3','2026-10-05','correct',{assignmentId:'math-3',questionId:'1'})
  ];
  const original=mergeLearningHistory(null,batch(completed,'2026-10-05'));
  assert.equal(original.skills[0].status,'mastered');
  const oldUndated=observation('older-photo','old-work.jpeg','2026-10-09','incorrect',{
    studiedOn:null,assignmentId:'old-worksheet',questionId:'3'
  });
  const result=mergeLearningHistory(original,batch([oldUndated],'2026-10-10'));
  assert.equal(result.skills[0].status,'mastered');
  assert.equal(result.skills[0].scoredCount,4);
  assert.equal(result.practiceTargets[0].reason,'review-undated');
  assert.notEqual(result.practiceTargets[0].reason,'recent-miss');
});

test('new undated uploads do not create an improving timeline or hide a verified latest miss',()=>{
  const reviewed=[
    observation('dated-1','dated-1.jpeg','2026-10-01','correct'),
    observation('dated-2','dated-2.jpeg','2026-10-03','incorrect'),
    observation('photo-3','third.jpeg','2026-10-09','correct',{studiedOn:null}),
    observation('photo-4','fourth.jpeg','2026-10-10','correct',{studiedOn:null})
  ];
  const result=mergeLearningHistory(null,batch(reviewed,'2026-10-10'));
  assert.equal(result.skills[0].status,'learning');
  assert.equal(result.skills[0].trend,'insufficient-data');
  assert.equal(result.practiceTargets[0].reason,'recent-miss');
  assert.equal(result.skills[0].scoredCount,4);
});

test('mastered retention age uses last verified study date rather than upload time',()=>{
  const completed=[
    observation('dated-a','a.jpeg','2026-10-01','correct'),
    observation('dated-b','b.jpeg','2026-10-03','correct'),
    observation('dated-c','c.jpeg','2026-10-05','correct')
  ];
  const reviewed=[...completed,observation('undated-later','archival.jpeg','2026-10-24','correct',{
    studiedOn:null,assignmentId:'old-math-practice',questionId:'6'
  })];
  const result=mergeLearningHistory(null,batch(reviewed,'2026-10-25'));
  assert.equal(result.skills[0].status,'mastered');
  assert.equal(result.practiceTargets[0].reason,'retention-check');
  assert.equal(result.practiceTargets[0].priority,20);
});
