import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {correctOriginalQuestion,SUBTRACTION_CHECK_PROMPT} from '../scripts/question-corrections.mjs';
import {mergeStudyPack,rebuildStudyArchive} from '../scripts/build-study-archive.mjs';
const original=()=>({id:'auto-math-subtraction-5-4-9-3c0d03',subject:'Math',skill:'math-subtraction',prompt:'Sam says 9 - 4 = 6. Which fact shows that his answer is one too high?',choices:['6 + 4 = 10','5 + 4 = 9','9 + 4 = 13'],answer:'5 + 4 = 9',archiveId:'archive-existing-public-identity',firstSeenAt:'2026-10-07T03:18:58.967Z',lastSeenAt:'2026-10-15T13:16:33.856Z',provenance:[{sourceRef:'old',capturedAt:'2026-10-06'}]});
const archive=()=>({schemaVersion:1,historyBootstrapped:true,notes:[],vocabulary:[],questions:[original()],sources:{old:{sourceHash:'reviewed-historical-source',weekLabel:'Week of October 5, 2026'}}});
const withdrawn=()=>({pack:{sourceHash:'qa-withdrawn-math',sourceCapturedAt:'2026-10-16T05:00:00Z',generatedAt:'2026-10-16T05:00:00Z',subjects:[{subject:'Math',topics:[]}],contentPipeline:{qa:{status:'pass'},questions:[]}}});

test('normal archive builds repair saved original practice even when current Math is withdrawn',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'abvm-correction-'));
 try{
  const data=path.join(root,'pages/data');await mkdir(data,{recursive:true});
  const source=JSON.stringify(withdrawn());
  await writeFile(path.join(data,'study-pack.json'),source);
  await writeFile(path.join(data,'study-archive.json'),JSON.stringify(archive()));
  const result=await rebuildStudyArchive({repoRoot:root});
  assert.equal(result.questions.length,1);
  assert.deepEqual(result.questions[0],{...original(),id:original().id+'-wording-v2',prompt:SUBTRACTION_CHECK_PROMPT});
  assert.equal(await readFile(path.join(data,'study-pack.json'),'utf8'),source,'never invent or promote current teacher content');
  const again=await rebuildStudyArchive({repoRoot:root});
  assert.deepEqual(again,result,'routine rebuilds are idempotent');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('corrected current and legacy entries reuse the saved identity and retain provenance without duplicates',()=>{
 const saved=archive();
 const duplicate={...original(),prompt:'Sam says 9 - 4 = 6. Which fact shows his answer is one too high?',archiveId:'duplicate-old-wording'};
 saved.questions.push(duplicate);
 const fresh=withdrawn();fresh.pack.contentPipeline.questions=[{...correctOriginalQuestion(original()),id:'auto-math-subtraction-revised-id'}];
 mergeStudyPack(saved,fresh);
 assert.equal(saved.questions.length,1);
 assert.equal(saved.questions[0].archiveId,original().archiveId);
 assert.equal(saved.questions[0].firstSeenAt,original().firstSeenAt);
 assert.equal(saved.questions[0].lastSeenAt,'2026-10-16T05:00:00.000Z');
 assert.equal(saved.questions[0].provenance.length,2);
 const once=JSON.stringify(saved);mergeStudyPack(saved,fresh);assert.equal(JSON.stringify(saved),once);
});

test('the original-practice correction never rewrites other questions or teacher text',()=>{
 for(const change of [{id:'teacher-source-row'},{subject:'Reading / ELA'},{skill:'different-skill'},{answer:'6 + 4 = 10'},{choices:['5 + 4 = 9','A different fact','9 + 4 = 13']},{prompt:'A different subtraction question'}]){
  const q={...original(),...change};assert.equal(correctOriginalQuestion(q),q);
 }
});
