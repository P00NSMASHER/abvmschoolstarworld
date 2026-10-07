import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
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
