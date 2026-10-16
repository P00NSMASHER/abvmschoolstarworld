import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildRuntimePack} from '../scripts/build-runtime-pack.mjs';
import {buildStudyUniverse} from '../scripts/build-study-universe.mjs';
import {buildRecentReviewPipeline} from '../scripts/curriculum-continuity.mjs';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {withOriginalMathFixture} from './helpers/original-math-fixture.mjs';
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


const historical=JSON.parse(readFileSync(new URL('./fixtures/math-original-practice.json',import.meta.url),'utf8'));
const legacyQuestion=()=>structuredClone(historical.questions.find(q=>q.prompt.startsWith('Sam says 9 - 4 = 6.')));
test('cached current, retained, runtime, archive and export readers share the exact editorial correction',()=>{
 const q=legacyQuestion(),fixed=correctOriginalQuestion(q),window={};
 class Clock extends Date{constructor(...a){super(...(a.length?a:['2026-10-16T12:00:00Z']))}static now(){return Date.parse('2026-10-16T12:00:00Z')}}
 vm.runInNewContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),{window,Intl,Date:Clock,console,localStorage:{getItem:()=>null}});
 const engine=window.ABVMStudyGames;
 assert.deepEqual(JSON.parse(JSON.stringify(engine.correctOriginalQuestion(q))),fixed);
 assert.notEqual(fixed.variantFingerprint,q.variantFingerprint);
 assert.notEqual(fixed.contentFingerprint,q.contentFingerprint);
 assert.equal(correctOriginalQuestion(fixed),fixed);
 const fixture=withOriginalMathFixture(JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8')));
 fixture.pack.contentPipeline.questions=[...fixture.pack.contentPipeline.questions.filter(row=>row.subject!=='Math'),q];
 const review={...q,reviewVerifiedAt:'2026-10-15T12:00:00Z',reviewExpiresAt:'2026-10-29T12:00:00Z',reviewSourceHash:'historical-reviewed-math'};
 fixture.pack.recentReviewPipeline={schemaVersion:1,retentionDays:14,bankFingerprint:'historical-cached-review',skills:[],questions:[review]};
 const before=JSON.stringify(fixture),runtime=buildRuntimePack(fixture);
 for(const pipeline of [runtime.pack.contentPipeline,runtime.pack.recentReviewPipeline]){
  const repaired=pipeline.questions.find(row=>row.skill==='math-subtraction');
  assert.equal(repaired.prompt,SUBTRACTION_CHECK_PROMPT);
  assert.equal(repaired.variantFingerprint,fixed.variantFingerprint);
 }
 const catalog=engine.buildCatalog(fixture.pack,{sourceKey:'cached-source-fixture'});
 assert.ok(catalog.questions.some(row=>row.prompt===SUBTRACTION_CHECK_PROMPT));
 assert.ok(catalog.questions.every(row=>row.prompt!==q.prompt));
 const saved=archive();saved.questions=[{...q,...original()}];
 const noCurrent={...fixture.pack,subjects:fixture.pack.subjects.map(row=>row.subject==='Math'?{...row,topics:[]}:row),contentPipeline:{...fixture.pack.contentPipeline,questions:fixture.pack.contentPipeline.questions.filter(row=>row.subject!=='Math')}};
 const model=createStudyMaterials({pack:noCurrent,catalog:engine.buildCatalog(noCurrent,{sourceKey:'withdrawn'}),engine,archive:saved,now:()=>new Clock()});
 const scope=model.forMode('math',{source:'weekly'}),eligible=new Set(scope.eligibleIds),served=scope.catalog.questions.filter(row=>eligible.has(row.id));
 assert.ok(served.some(row=>row.prompt===SUBTRACTION_CHECK_PROMPT));assert.ok(served.every(row=>row.prompt!==q.prompt));
 const exported=buildStudyUniverse({pack:fixture,archive:saved});
 assert.ok(exported.questions.every(row=>row.prompt!==q.prompt));
 assert.equal(JSON.stringify(fixture),before,'read-time repairs never mutate governed source data');
});

test('retained-review repair changes the item identity without renewing its source verification',()=>{
 const q=legacyQuestion(),previous={generatedAt:'2026-10-15T12:00:00Z',sourceHash:'historical-reviewed-math',qa:{status:'pass'},skills:historical.skills,questions:[q]};
 const options={previousCurrent:previous,current:{skills:[],questions:[]},now:'2026-10-16T12:00:00Z'};
 const result=buildRecentReviewPipeline(options),retained=result.questions[0];
 assert.equal(retained.prompt,SUBTRACTION_CHECK_PROMPT);
 assert.equal(Date.parse(retained.reviewVerifiedAt),Date.parse(previous.generatedAt));
 assert.equal(retained.reviewSourceHash,previous.sourceHash);
 assert.equal(retained.variantFingerprint,correctOriginalQuestion(q).variantFingerprint);
 const repeated=buildRecentReviewPipeline({...options,previousCurrent:{...previous,questions:[correctOriginalQuestion(q)]}});
 assert.equal(repeated.bankFingerprint,result.bankFingerprint);
});
